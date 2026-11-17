window.App = window.App || {};
(function (App) {
  const SCOPE = 'https://www.googleapis.com/auth/drive.file';
  const API = 'https://www.googleapis.com/drive/v3/files';
  let token = '', expires = 0, folderId = '', syncing = false;
  function isConnected() { return Boolean(token && Date.now() < expires); }
  function disconnect() { token = ''; expires = 0; folderId = ''; }
  function connect() {
    if (!navigator.onLine) return Promise.reject(new Error('Connect to the internet first.'));
    if (!window.google?.accounts?.oauth2) return Promise.reject(new Error('Google sign-in has not loaded. Check your connection and reload.'));
    const clientId = App.State.get().driveClientId;
    if (!/^[\w.-]+\.apps\.googleusercontent\.com$/.test(clientId)) return Promise.reject(new Error('Enter your Google Web OAuth client ID in Settings.'));
    disconnect();
    return new Promise((resolve, reject) => {
      const client = google.accounts.oauth2.initTokenClient({
        client_id: clientId, scope: SCOPE,
        callback(response) {
          if (response.error || !response.access_token || !google.accounts.oauth2.hasGrantedAllScopes(response, SCOPE)) {
            reject(new Error('Drive permission was not granted.')); return;
          }
          token = response.access_token;
          expires = Date.now() + Math.max(0, Number(response.expires_in) - 60) * 1000;
          resolve();
        },
        error_callback: () => reject(new Error('Google sign-in was closed or blocked. Please try again.'))
      });
      client.requestAccessToken({ prompt: 'select_account' });
    });
  }
  async function request(url, options = {}) {
    if (!navigator.onLine) throw new Error('You are offline. Your local expenses are still saved.');
    if (!isConnected()) throw new Error('Connect Google Drive again to continue.');
    const response = await fetch(url, { ...options, headers: { ...options.headers, Authorization: `Bearer ${token}` } });
    if (response.status === 401) { disconnect(); throw new Error('Google session expired. Connect again.'); }
    if (!response.ok) throw new Error(`Google Drive request failed (${response.status}). Please retry.`);
    return response;
  }
  async function list(q) {
    const result = await (await request(`${API}?${new URLSearchParams({ q: `trashed = false and (${q})`, fields: 'files(id,name,webViewLink,modifiedTime)', orderBy: 'modifiedTime desc', pageSize: '100' })}`)).json();
    return result.files || [];
  }
  async function getFolder() {
    if (folderId) return folderId;
    const folders = await list("mimeType = 'application/vnd.google-apps.folder' and appProperties has { key='expenseTracker' and value='folder-v1' }");
    if (folders.length) folderId = folders[0].id;
    else {
      const folder = await (await request(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: App.State.get().driveFolderName || 'Expense Tracker', mimeType: 'application/vnd.google-apps.folder', appProperties: { expenseTracker: 'folder-v1' } }) })).json();
      folderId = folder.id;
    }
    return folderId;
  }
  async function upload(blob, name, kind, extra = {}) {
    const parent = await getFolder();
    const boundary = 'expense_tracker_' + crypto.randomUUID();
    const metadata = { name, parents: [parent], appProperties: { expenseTracker: kind, ...extra } };
    const body = new Blob([`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`, JSON.stringify(metadata), `\r\n--${boundary}\r\nContent-Type: ${blob.type || 'application/octet-stream'}\r\n\r\n`, blob, `\r\n--${boundary}--`]);
    return (await request(`https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink`, { method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body })).json();
  }
  function database() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open('expense-tracker-receipts', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('pending', { keyPath: 'key' });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(new Error('Could not store receipt locally. Browser storage may be full.'));
    });
  }
  async function queue(action, value) {
    const db = await database();
    try { return await new Promise((resolve, reject) => {
      const tx = db.transaction('pending', action === 'getAll' ? 'readonly' : 'readwrite');
      const req = tx.objectStore('pending')[action](...(value === undefined ? [] : [value]));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = tx.onabort = () => reject(new Error('Receipt storage failed. Check available browser storage.'));
    }); } finally { db.close(); }
  }
  async function saveReceipt(file, expense) {
    const generation = App.State.get().receiptGeneration || 'initial';
    await queue('put', { key: crypto.randomUUID(), generation, file, expense: { ...expense } });
    App.State.updateExpenseReceipt(expense.id, { receiptUploadStatus: 'queued' });
    if (isConnected() && navigator.onLine) await flushReceipts();
  }
  async function flushReceipts() {
    if (syncing) throw new Error('Receipt upload is already running.');
    if (!isConnected()) throw new Error('Connect Google Drive first.');
    syncing = true;
    let count = 0;
    try {
      for (const item of await queue('getAll')) {
        if (item.generation !== (App.State.get().receiptGeneration || 'initial')) continue;
        const { expense, file } = item;
        const current = App.State.get().expenses.find(e => e.id === expense.id);
        // Removed or replaced expenses must not attach their old image to another entry.
        if (!current) continue;
        if (file.size > 5 * 1024 * 1024) throw new Error('A queued receipt exceeds 5 MB. Use a smaller image.');
        const prior = await list(`appProperties has { key='receiptKey' and value='${item.key}' }`);
        const extension = { 'image/png': 'png', 'image/webp': 'webp', 'image/jpeg': 'jpg' }[file.type] || 'img';
        const result = prior[0] || await upload(file, `Day${expense.day}_${expense.name.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 32)}_${item.key}.${extension}`, 'receipt-v1', { receiptKey: item.key });
        App.State.updateExpenseReceipt(expense.id, { receiptDriveId: result.id, receiptDriveUrl: result.webViewLink || `https://drive.google.com/file/d/${result.id}/view`, receiptUploadStatus: 'uploaded' });
        await queue('delete', item.key);
        count++;
      }
      return count;
    } finally { syncing = false; }
  }
  async function backup() {
    const data = App.State.exportBackup();
    return upload(new Blob([JSON.stringify(data)], { type: 'application/json' }), `expense-tracker-backup-${data.savedAt.replace(/[:.]/g, '-')}.json`, 'backup-v1');
  }
  async function latestBackup() {
    const files = await list("appProperties has { key='expenseTracker' and value='backup-v1' }");
    if (!files.length) throw new Error('No expense tracker backups found in this Google account.');
    const backup = await (await request(`${API}/${encodeURIComponent(files[0].id)}?alt=media`)).json();
    App.State.validateBackup(backup);
    return backup;
  }
  App.Drive = { connect, disconnect, isConnected, saveReceipt, flushReceipts, backup, latestBackup };
})(window.App);
