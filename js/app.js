window.App = window.App || {};

(function (App) {
  const { formatMoney, formatRawCurrency, formatOtherCurrencies, toUsd } = App.Currency;
  const { scanReceiptImage } = App.OCR;
  const {
    render,
    showScanFeedback,
    showDriveTestFeedback,
    updateOcrProgress,
    updateScanConversionPreview,
    updateManualConversionPreview
  } = App.Render;
  const el = App.Elements;

  async function maybeUploadReceiptToDrive(file, expense) {
    if (!file || !App.State.get().driveAutoUpload) return;
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error('Receipt image is larger than 5 MB. Use a smaller image for Drive storage.');
      await App.Drive.saveReceipt(file, expense);
    } catch (error) {
      showScanFeedback('warning', 'Expense saved. Receipt upload pending or unavailable: ' + error.message);
    }
    render();
  }

  async function processUploadedImage(file) {
    if (!file || !file.type.startsWith('image/')) {
      showScanFeedback('error', 'Please choose or paste a valid image file (PNG, JPG, WebP).');
      return;
    }

    // Ensure the Add & Scan tab is visible if user pasted via Ctrl+V from another tab
    const state = App.State.get();
    if (state.activeTab !== 'add') {
      App.State.setActiveTab('add');
      render();
    }

    const targetDay = state.selectedDay;
    const previewUrl = URL.createObjectURL(file);

    App.State.setPendingScan(null);
    render();

    showScanFeedback('loading', `Scanning receipt image for Day ${targetDay}...`);
    updateOcrProgress(5, 'Preparing image for OCR...');

    try {
      const { rawText, parsed } = await scanReceiptImage(file, state.displayCurrency, (pct, msg) => {
        updateOcrProgress(pct, msg);
      });

      updateOcrProgress(null);
      const snippet = rawText.replace(/\s+/g, ' ').trim().slice(0, 100);

      // If auto-add is enabled AND a clear amount was found, add immediately
      if (state.autoAddScan && parsed.amount && parsed.amount > 0) {
        const amountUsd = toUsd(parsed.amount, parsed.currency);
        const createdExpense = App.State.addExpense({
          day: targetDay,
          name: parsed.label,
          amountUsd,
          originalAmount: parsed.amount,
          originalCurrency: parsed.currency,
          source: 'scan'
        });

        const detectedStr = formatRawCurrency(parsed.amount, parsed.currency);
        const convertedStr = formatMoney(amountUsd, App.State.get().displayCurrency);
        const driveSuffix =
          state.driveAutoUpload ? ' · Saving receipt for Drive upload...' : '';
        showScanFeedback(
          'success',
          `Auto-added "${parsed.label}" (${detectedStr} → ${convertedStr}) to Day ${targetDay}!${driveSuffix}`
        );
        render();
        maybeUploadReceiptToDrive(file, createdExpense);
        return;
      }

      // Otherwise open the Review & Confirm card so user can verify or pick from candidate chips
      const hasAmount = parsed.amount && parsed.amount > 0;
      App.State.setPendingScan({
        file,
        previewUrl,
        fileName: file.name || 'Pasted screenshot',
        rawSnippet: snippet ? `OCR text: "${snippet}"` : file.name,
        summaryText: hasAmount
          ? `Detected ${formatRawCurrency(parsed.amount, parsed.currency)} for "${parsed.label}". Verify or click another amount below:`
          : 'Could not auto-detect the total. Please type the amount while looking at your receipt:',
        name: parsed.label || 'Scanned Receipt',
        day: targetDay,
        currency: parsed.currency || state.displayCurrency,
        amount: hasAmount ? parsed.amount : null,
        candidates: parsed.candidates || []
      });

      if (hasAmount) {
        showScanFeedback(
          'success',
          `Receipt scanned! Review the detected details below and click "Confirm & Add Expense".`
        );
      } else {
        showScanFeedback(
          'warning',
          'Receipt text was unclear. Enter the amount in the review card below to add it.'
        );
      }

      render();
      el.scanEditAmount.focus();
    } catch (err) {
      updateOcrProgress(null);
      App.State.setPendingScan({
        file,
        previewUrl,
        fileName: file.name || 'Receipt image',
        rawSnippet: file.name || '',
        summaryText: 'Automatic OCR could not run. You can still view the receipt and enter the amount below:',
        name: 'Scanned Receipt',
        day: targetDay,
        currency: state.displayCurrency,
        amount: null,
        candidates: []
      });
      showScanFeedback(
        'warning',
        'Could not auto-read text from that image. Enter the details in the review card below.'
      );
      render();
    } finally {
      el.screenshotInput.value = '';
    }
  }

  function bindEvents() {
    // 1. Main Navigation Tabs
    el.navTabs.forEach((btn) => {
      btn.addEventListener('click', () => {
        App.State.setActiveTab(btn.dataset.tab);
        render();
      });
    });

    // Home quick-action buttons
    el.goScanBtn.addEventListener('click', () => {
      App.State.setActiveTab('add');
      render();
    });

    el.goManualBtn.addEventListener('click', () => {
      App.State.setActiveTab('add');
      render();
      el.expenseNameInput.focus();
    });

    el.viewAllExpensesBtn.addEventListener('click', () => {
      App.State.setExpenseFilterDay('all');
      App.State.setActiveTab('expenses');
      render();
    });

    // 2. Display Currency Switcher
    el.currencyTabs.forEach((btn) => {
      btn.addEventListener('click', () => {
        App.State.setDisplayCurrency(btn.dataset.currency);
        render();
      });
    });

    // 3. Synced Day Selection in Add & Scan Tab
    el.scanDaySelect.addEventListener('change', () => {
      App.State.setSelectedDay(el.scanDaySelect.value);
      const pending = App.State.getUI().pendingScan;
      if (pending) {
        pending.day = App.State.get().selectedDay;
      }
      render();
    });

    el.expenseDaySelect.addEventListener('change', () => {
      App.State.setSelectedDay(el.expenseDaySelect.value);
      render();
    });

    // 4. Auto-Add Toggle
    el.autoAddToggle.addEventListener('change', () => {
      App.State.setAutoAddScan(el.autoAddToggle.checked);
    });

    // 5. Screenshot / Photo File Upload, Drag & Drop, and Global Paste (Ctrl+V)
    el.screenshotInput.addEventListener('change', (event) => {
      const file = event.target.files?.[0];
      if (file) {
        processUploadedImage(file);
      }
    });

    ['dragenter', 'dragover'].forEach((evtName) => {
      el.scanDropzone.addEventListener(evtName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        el.scanDropzone.classList.add('dropzone-active');
      });
    });

    ['dragleave', 'drop'].forEach((evtName) => {
      el.scanDropzone.addEventListener(evtName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        el.scanDropzone.classList.remove('dropzone-active');
      });
    });

    el.scanDropzone.addEventListener('drop', (e) => {
      const file = e.dataTransfer?.files?.[0];
      if (file) {
        processUploadedImage(file);
      }
    });

    document.addEventListener('paste', (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            processUploadedImage(file);
            break;
          }
        }
      }
    });

    // 6. Review & Confirm Scanned Expense Card Events
    el.scanEditName.addEventListener('input', () => {
      const pending = App.State.getUI().pendingScan;
      if (pending) pending.name = el.scanEditName.value;
    });

    el.scanEditDay.addEventListener('change', () => {
      const dayVal = parseInt(el.scanEditDay.value, 10) || 1;
      const pending = App.State.getUI().pendingScan;
      if (pending) pending.day = dayVal;
      App.State.setSelectedDay(dayVal);
      render();
    });

    el.scanEditCurrency.addEventListener('change', () => {
      const pending = App.State.getUI().pendingScan;
      if (pending) pending.currency = el.scanEditCurrency.value;
      render();
    });

    el.scanEditAmount.addEventListener('input', () => {
      const pending = App.State.getUI().pendingScan;
      const val = parseFloat(el.scanEditAmount.value);
      if (pending) pending.amount = isNaN(val) ? null : val;
      updateScanConversionPreview();
    });

    el.scanConfirmBtn.addEventListener('click', () => {
      const state = App.State.get();
      const pending = App.State.getUI().pendingScan;
      const pendingFile = pending?.file || null;
      const name = el.scanEditName.value.trim() || 'Scanned Receipt';
      const day = Math.min(state.days, Math.max(1, parseInt(el.scanEditDay.value, 10) || state.selectedDay));
      const entryCurrency = el.scanEditCurrency.value;
      const rawAmount = parseFloat(el.scanEditAmount.value);

      if (isNaN(rawAmount) || rawAmount <= 0) {
        showScanFeedback('error', 'Please enter a valid receipt amount greater than 0 before confirming.');
        el.scanEditAmount.focus();
        return;
      }

      const amountUsd = toUsd(rawAmount, entryCurrency);
      const createdExpense = App.State.addExpense({
        day,
        name,
        amountUsd,
        originalAmount: rawAmount,
        originalCurrency: entryCurrency,
        source: 'scan'
      });

      App.State.setPendingScan(null);
      const cur = App.State.get().displayCurrency;
      const driveSuffix =
        pendingFile && state.driveAutoUpload
          ? ' · Saving receipt for Drive upload...'
          : '';
      showScanFeedback(
        'success',
        `Added "${name}" (${formatRawCurrency(rawAmount, entryCurrency)} → ${formatMoney(amountUsd, cur)}) to Day ${day}!${driveSuffix}`
      );
      render();

      if (pendingFile) {
        maybeUploadReceiptToDrive(pendingFile, createdExpense);
      }
    });

    el.scanCancelBtn.addEventListener('click', () => {
      App.State.setPendingScan(null);
      showScanFeedback(null);
      render();
    });

    // Receipt Lightbox Modal
    el.scanPreviewBtn.addEventListener('click', () => {
      el.imageModal.classList.remove('hidden');
    });

    el.closeModalBtn.addEventListener('click', () => {
      el.imageModal.classList.add('hidden');
    });

    el.imageModal.addEventListener('click', (e) => {
      if (e.target === el.imageModal) {
        el.imageModal.classList.add('hidden');
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !el.imageModal.classList.contains('hidden')) {
        el.imageModal.classList.add('hidden');
      }
    });

    // 7. Manual Expense Form
    el.expenseAmountInput.addEventListener('input', updateManualConversionPreview);
    el.expenseCurrencySelect.addEventListener('change', updateManualConversionPreview);

    el.expenseForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const state = App.State.get();
      const name = el.expenseNameInput.value.trim();
      const day = Math.min(state.days, Math.max(1, parseInt(el.expenseDaySelect.value, 10) || state.selectedDay));
      const entryCurrency = el.expenseCurrencySelect.value;
      const rawAmount = parseFloat(el.expenseAmountInput.value);

      if (!name || isNaN(rawAmount) || rawAmount <= 0) {
        el.formErrorEl.textContent = 'Please enter an item name and an amount greater than 0.';
        el.formErrorEl.classList.remove('hidden');
        return;
      }

      el.formErrorEl.classList.add('hidden');
      const amountUsd = toUsd(rawAmount, entryCurrency);
      App.State.addExpense({
        day,
        name,
        amountUsd,
        originalAmount: rawAmount,
        originalCurrency: entryCurrency,
        source: 'manual'
      });

      el.expenseNameInput.value = '';
      el.expenseAmountInput.value = '';
      el.manualConversionPreview.classList.add('hidden');
      el.expenseNameInput.focus();
      render();
    });

    // 8. Safe Clear All Expenses
    el.clearAllBtn.addEventListener('click', () => {
      App.State.setConfirmingClearAll(true);
      render();
    });

    el.clearConfirmYes.addEventListener('click', () => {
      App.State.clearExpenses();
      render();
    });

    el.clearConfirmNo.addEventListener('click', () => {
      App.State.setConfirmingClearAll(false);
      render();
    });

    // 9. Settings Tab Inputs
    el.dailyLimitInput.addEventListener('input', () => {
      if (App.State.setDailyLimitUsd(el.dailyLimitInput.value)) {
        render();
      }
    });

    el.daysInput.addEventListener('input', () => {
      if (el.daysInput.value === '') return;
      App.State.setDays(el.daysInput.value);
      render();
    });

    el.daysInput.addEventListener('blur', () => {
      App.State.setDays(el.daysInput.value);
      render();
    });

    el.rateEurInput.addEventListener('input', () => {
      if (App.State.setRate('EUR', el.rateEurInput.value)) {
        render();
      }
    });

    el.rateInrInput.addEventListener('input', () => {
      if (App.State.setRate('INR', el.rateInrInput.value)) {
        render();
      }
    });

    el.resetSettingsBtn.addEventListener('click', () => {
      App.State.resetSettings();
      render();
    });

    // Google Drive operations require an explicit user action.
    let driveBusy = false;
    async function driveAction(action) {
      if (driveBusy) return;
      driveBusy = true;
      const buttons = ['drive-test-btn', 'drive-disconnect-btn', 'drive-upload-btn', 'drive-backup-btn', 'drive-restore-btn', 'drive-recover-btn'];
      buttons.forEach(id => document.getElementById(id).disabled = true);
      showDriveTestFeedback('loading', 'Working with Google Drive…');
      try { await action(); }
      catch (error) { showDriveTestFeedback('error', error.message); }
      finally {
        driveBusy = false;
        buttons.forEach(id => document.getElementById(id).disabled = false);
        render();
      }
    }
    el.driveScanStatusBtn?.addEventListener('click', () => {
      App.State.setActiveTab('settings'); render(); el.driveClientInput.focus();
    });
    el.driveAutoUploadToggle.addEventListener('change', () => {
      App.State.setDriveSettings({ autoUpload: el.driveAutoUploadToggle.checked }); render();
    });
    el.driveClientInput.addEventListener('change', () => {
      App.Drive.disconnect();
      App.State.setDriveSettings({ clientId: el.driveClientInput.value.trim() }); render();
    });
    el.driveFolderInput.addEventListener('change', () => {
      App.State.setDriveSettings({ folderName: el.driveFolderInput.value.trim() });
    });
    el.driveTestBtn.addEventListener('click', () => driveAction(async () => {
      App.State.setDriveSettings({ clientId: el.driveClientInput.value.trim() });
      await App.Drive.connect();
      showDriveTestFeedback('success', 'Connected. Pending receipts will upload to the Google account you selected when you choose Upload pending receipts.');
    }));
    document.getElementById('drive-disconnect-btn').addEventListener('click', () => {
      App.Drive.disconnect(); render();
      showDriveTestFeedback('success', 'Disconnected on this device. You can revoke the app’s permission in your Google Account settings.');
    });
    document.getElementById('drive-upload-btn').addEventListener('click', () => driveAction(async () => {
      const count = await App.Drive.flushReceipts();
      showDriveTestFeedback('success', count + ' pending receipts uploaded.');
    }));
    document.getElementById('drive-backup-btn').addEventListener('click', () => driveAction(async () => {
      await App.Drive.backup();
      showDriveTestFeedback('success', 'Dated expense backup saved to Google Drive. Receipt images upload separately.');
    }));
    document.getElementById('drive-restore-btn').addEventListener('click', () => driveAction(async () => {
      const backup = await App.Drive.latestBackup();
      if (!window.confirm('Replace this device’s expenses and budget settings with the latest Drive backup (' + backup.data.expenses.length + ' expenses, saved ' + backup.savedAt + ')? A local recovery copy will be saved first.')) {
        showDriveTestFeedback('warning', 'Restore cancelled.'); return;
      }
      localStorage.setItem('expense_tracker_before_restore', JSON.stringify(App.State.exportBackup()));
      App.State.restoreBackup(backup);
      showDriveTestFeedback('success', 'Backup restored. Your Google connection settings were kept.');
    }));
    document.getElementById('drive-recover-btn').addEventListener('click', () => driveAction(async () => {
      const recovery = localStorage.getItem('expense_tracker_before_restore');
      if (!recovery) throw new Error('No pre-restore recovery copy is saved yet.');
      const backup = JSON.parse(recovery);
      App.State.validateBackup(backup);
      if (!window.confirm('Replace current expenses and budget settings with the local pre-restore recovery copy?')) {
        showDriveTestFeedback('warning', 'Recovery cancelled.'); return;
      }
      const current = JSON.stringify(App.State.exportBackup());
      App.State.restoreBackup(backup);
      localStorage.setItem('expense_tracker_before_restore', current);
      showDriveTestFeedback('success', 'Local recovery copy restored.');
    }));
    document.getElementById('drive-recovery-btn').addEventListener('click', () => {
      const recovery = localStorage.getItem('expense_tracker_before_restore');
      if (!recovery) { showDriveTestFeedback('warning', 'No pre-restore recovery copy is saved yet.'); return; }
      const url = URL.createObjectURL(new Blob([recovery], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url; link.download = 'expense-tracker-before-restore.json'; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
    window.addEventListener('online', () => {
      showDriveTestFeedback('success', 'Back online. Connect Google Drive if needed, then upload pending receipts or back up expenses.');
      render();
    });
    window.addEventListener('offline', render);
  }

  bindEvents();
  render();
})(window.App);
