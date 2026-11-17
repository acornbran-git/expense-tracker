const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function setup() {
  const values = new Map();
  const calls = [];
  const receipts = new Map();
  const context = vm.createContext({ console, Blob, URLSearchParams, navigator: { onLine: true },
    localStorage: { getItem: k => values.get(k) || null, setItem: (k, v) => values.set(k, v) },
    crypto: require('node:crypto').webcrypto,
    indexedDB: { open: () => {
      const req = { result: { close() {}, transaction() {
        const tx = { objectStore: () => Object.fromEntries(['put', 'getAll', 'delete'].map(action => [action, value => {
          const result = action === 'getAll' ? [...receipts.values()] : undefined;
          if (action === 'put') receipts.set(value.key, value);
          if (action === 'delete') receipts.delete(value);
          setImmediate(() => tx.oncomplete());
          return { result };
        }])) };
        return tx;
      } } };
      setImmediate(() => req.onsuccess()); return req;
    } },
    fetch: async (url, options) => {
      calls.push({ url, options });
      if (url.includes('uploadType')) return { ok: true, json: async () => ({ id: 'backup-id' }) };
      return { ok: true, json: async () => ({ files: [{ id: 'folder-id' }] }) };
    }
  });
  context.window = context;
  for (const file of ['js/config.js', 'js/state.js', 'js/utils/drive.js']) vm.runInContext(fs.readFileSync(file, 'utf8'), context);
  context.App.State.setDriveSettings({ clientId: 'test.apps.googleusercontent.com' });
  context.google = { accounts: { oauth2: {
    hasGrantedAllScopes: () => true,
    initTokenClient: config => ({ requestAccessToken: () => config.callback({ access_token: 'test-token', expires_in: 3600 }) })
  } } };
  return { context, calls, values, receipts, App: context.App };
}

test('backup round trip preserves connection, excludes credentials, and advances IDs', () => {
  const { App } = setup();
  const backup = App.State.exportBackup();
  assert.equal(backup.data.driveClientId, undefined);
  App.State.clearExpenses();
  App.State.restoreBackup(backup);
  assert.equal(App.State.get().expenses.length, 2);
  assert.equal(App.State.get().nextId, 3);
  assert.equal(App.State.get().driveClientId, 'test.apps.googleusercontent.com');
});

test('malformed or unsafe backups leave state unchanged', () => {
  const { App } = setup();
  const before = JSON.stringify(App.State.get());
  for (const change of [b => b.version = 99, b => b.data.expenses[0].receiptDriveUrl = 'javascript:alert(1)',
    b => b.data.expenses[1].id = b.data.expenses[0].id, b => b.data.rates.EUR = -1]) {
    const backup = JSON.parse(JSON.stringify(App.State.exportBackup())); change(backup);
    assert.throws(() => App.State.restoreBackup(backup));
    assert.equal(JSON.stringify(App.State.get()), before);
  }
});

test('storage failure cannot replace live expenses', () => {
  const { App, context } = setup();
  const backup = App.State.exportBackup(); App.State.clearExpenses();
  context.localStorage.setItem = () => { throw new Error('quota'); };
  assert.throws(() => App.State.restoreBackup(backup), /quota/);
  assert.equal(App.State.get().expenses.length, 0);
});

test('Drive backup requests limited scope and authenticated multipart upload', async () => {
  const { App, calls, values } = setup();
  await App.Drive.connect();
  assert.equal(App.Drive.isConnected(), true);
  await App.Drive.backup();
  const upload = calls.find(c => c.url.includes('uploadType'));
  assert.equal(upload.options.headers.Authorization, 'Bearer test-token');
  const body = await upload.options.body.text();
  assert.match(body, /backup-v1/);
  assert.match(body, /folder-id/);
  assert.doesNotMatch(body, /test-token|apps.googleusercontent/);
  assert.equal([...values.values()].some(v => v.includes('test-token')), false);
  App.Drive.disconnect();
  await assert.rejects(App.Drive.backup(), /Connect Google Drive/);
});

test('offline and denied sign-in fail without modifying expenses', async () => {
  const { App, context } = setup();
  const before = JSON.stringify(App.State.get());
  context.navigator.onLine = false;
  await assert.rejects(App.Drive.connect(), /internet/);
  context.navigator.onLine = true;
  context.google.accounts.oauth2.initTokenClient = config => ({ requestAccessToken: () => config.callback({ error: 'access_denied' }) });
  await assert.rejects(App.Drive.connect(), /not granted/);
  assert.equal(JSON.stringify(App.State.get()), before);
});

test('offline receipts persist for explicit retry and clear only after successful upload', async () => {
  const { App, context, receipts, calls } = setup();
  context.navigator.onLine = false;
  await App.Drive.saveReceipt(new Blob(['receipt'], { type: 'image/png' }), App.State.get().expenses[0]);
  assert.equal(receipts.size, 1);
  assert.equal(App.State.get().expenses[0].receiptUploadStatus, 'queued');
  context.navigator.onLine = true;
  await App.Drive.connect();
  context.fetch = async () => ({ ok: false, status: 503 });
  await assert.rejects(App.Drive.flushReceipts(), /503/);
  assert.equal(receipts.size, 1);
  context.fetch = async (url, options) => {
    calls.push({ url, options });
    if (url.includes('uploadType')) return { ok: true, json: async () => ({ id: 'receipt-id' }) };
    return { ok: true, json: async () => ({ files: url.includes('receiptKey') ? [] : [{ id: 'folder-id' }] }) };
  };
  assert.equal(await App.Drive.flushReceipts(), 1);
  assert.equal(receipts.size, 0);
  assert.match(App.State.get().expenses[0].receiptDriveUrl, /receipt-id/);
  assert.equal(await App.Drive.flushReceipts(), 0);
});

test('restoring expenses cannot attach previously queued receipts to replacement data', async () => {
  const { App } = setup();
  await App.Drive.saveReceipt(new Blob(['receipt']), App.State.get().expenses[0]);
  const backup = App.State.exportBackup();
  App.State.restoreBackup(backup);
  await App.Drive.connect();
  assert.equal(await App.Drive.flushReceipts(), 0);
});

test('all bound Settings controls exist in the HTML', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(ids.length, new Set(ids).size);
  for (const file of ['js/ui/elements.js', 'js/app.js']) {
    for (const [, id] of fs.readFileSync(file, 'utf8').matchAll(/getElementById\('([^']+)'\)/g)) {
      assert.ok(ids.includes(id), 'Missing HTML control: ' + id);
    }
  }
});
