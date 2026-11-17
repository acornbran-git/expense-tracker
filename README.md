# Daily Expense Tracker

A zero-install web application for tracking daily expenses with a customizable daily budget carryover (default `$60/day`), multi-currency conversion (`USD`, `EUR`, `INR`), and a smart client-side receipt/screenshot OCR scanner.

## Features

- **🏠 Home (Big Picture Overview)**:
  - Hero summary cards for **Total Saved / Over Budget**, **Total Spent**, **Avg Per Day**, and **Total Budget Pool** with live secondary currency conversions.
  - Visual budget health progress bar.
  - Interactive **Day-by-Day Carryover Table** — click any day to select it or jump directly to add/view expenses for that day.
- **📸 Add & Scan**:
  - **Smart Photo & Screenshot Scanner**: Upload a file, drag & drop, or press `Ctrl+V` anywhere to paste a screenshot.
  - **Automatic Image Pre-processing**: Upscales small screenshots, converts to grayscale, and automatically inverts dark-mode payment screenshots (GPay, PhonePe, Apple Pay, etc.) for high OCR accuracy.
  - **Live OCR Progress Bar**: Real-time percentage indicator while Tesseract.js reads the image.
  - **Review & Confirm Card + Candidate Amount Chips**: Click any detected number from the receipt (e.g., Total vs. Subtotal), zoom into the receipt image, or toggle **Auto-add without review**.
  - **Manual Expense Entry**: Live currency conversion preview as you type.
- **🧾 Expenses**:
  - Filter expenses by day (`All Days`, `Day 1`, `Day 2`, …).
  - **Original Receipt Currency Badge**: Preserves and displays the original currency & amount (e.g., `Receipt: ₹500.00`) alongside the converted display currency.
  - **Inline Edit & Safe Clear All**: Edit any existing expense's name, day, currency, or amount inline, and confirm before clearing all expenses.
- **⚙️ Settings**:
  - Customize the **Daily Budget Allowance** (default `$60/day`), **Number of Days** (`1–365`), and **Exchange Rates** (`EUR`, `INR` per `1 USD`).
  - **☁️ Google Drive Storage (OAuth)**: Automatically upload scanned receipt images to a folder in your Google Drive and link each expense to its stored receipt.

## Connecting Google Drive

1. Create a Google Cloud project and enable **Google Drive API**.
2. Configure **Google Auth Platform** branding and audience. While in Testing, add your Google account as a test user.
3. Under **Data Access**, add only https://www.googleapis.com/auth/drive.file.
4. Create a **Web application OAuth client**. Add https://acornbran-git.github.io under Authorized JavaScript origins (no repository path). For local development add http://localhost:8000.
5. Open the hosted app, go to **Settings**, paste the client ID, then choose **Connect Google Drive**. No client secret or API key is needed. Tokens stay in memory and expire; reconnect after reloading or expiry.
6. Use **Upload pending receipts**, **Back up to Drive**, or **Restore latest backup**. These actions operate on the Google account selected during connection.

The app requests access only to files created or authorized for this app. Files remain private unless you share them yourself. The old Apps Script webhook is no longer used; revoke any old public deployment you created.

Receipt images up to 5 MB are queued in IndexedDB, including while offline, if receipt saving is enabled. Browser storage must remain available. Pending receipts upload automatically when added during an active online session; after reconnecting use the explicit upload button. Expenses themselves remain in localStorage. This change adds offline storage, not an offline app shell: initial page loading and OCR still depend on the internet until PWA support is added.

Backups are separate timestamped JSON files with expenses, budget settings, rates, and receipt links. They exclude OAuth configuration, credentials, and image blobs; upload pending receipts **before** making a backup to include their links. Restore validates the latest backup and asks before replacing local data. It does not merge devices. A pre-restore recovery backup is kept locally and can be downloaded using **Download pre-restore recovery copy**. Clearing browser data removes local expenses and pending receipts.

Serve locally over HTTP rather than opening a file URL for Google sign-in. Use the same OAuth client ID across your devices to find the same backups.

Google documentation: [OAuth token flow](https://developers.google.com/identity/oauth2/web/guides/use-token-model), [Drive scope](https://developers.google.com/workspace/drive/api/guides/api-specific-auth).

## Hosting on GitHub Pages (or Netlify / Vercel / Cloudflare Pages)

Because this app is 100% static (`index.html`, `css/`, `js/`, `assets/`) with zero build steps, you can host it anywhere for free:

### Option A: GitHub Pages
1. Push this folder to a GitHub repository.
2. In your GitHub repo, go to **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to **Deploy from a branch** and choose `main` (root `/`).
4. Click **Save** — your app will be live at `https://<your-username>.github.io/<repo-name>/`.

### Option B: Running Locally
Simply open `index.html` in any web browser—no installation or build step required.
