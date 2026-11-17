window.App = window.App || {};

(function (App) {
  const { formatMoney, formatRawCurrency, formatOtherCurrencies, toUsd } = App.Currency;

  function populateDaySelect(selectEl, totalDays, selectedValue) {
    if (!selectEl) return;
    selectEl.innerHTML = '';
    for (let d = 1; d <= totalDays; d++) {
      const opt = document.createElement('option');
      opt.value = String(d);
      opt.textContent = `Day ${d}`;
      selectEl.appendChild(opt);
    }
    selectEl.value = String(Math.min(Math.max(1, selectedValue || 1), totalDays));
  }

  function showScanFeedback(type, message) {
    const { scanFeedbackEl } = App.Elements;
    if (!message) {
      scanFeedbackEl.classList.add('hidden');
      return;
    }
    scanFeedbackEl.classList.remove(
      'hidden',
      'bg-indigo-50',
      'text-indigo-700',
      'bg-emerald-50',
      'text-emerald-700',
      'bg-amber-50',
      'text-amber-800',
      'bg-rose-50',
      'text-rose-700'
    );
    if (type === 'loading') {
      scanFeedbackEl.classList.add('bg-indigo-50', 'text-indigo-700');
    } else if (type === 'success') {
      scanFeedbackEl.classList.add('bg-emerald-50', 'text-emerald-700');
    } else if (type === 'warning') {
      scanFeedbackEl.classList.add('bg-amber-50', 'text-amber-800');
    } else {
      scanFeedbackEl.classList.add('bg-rose-50', 'text-rose-700');
    }
    scanFeedbackEl.textContent = message;
  }

  function updateOcrProgress(percent, label) {
    const { ocrProgressWrap, ocrProgressLabel, ocrProgressPct, ocrProgressBar } = App.Elements;
    if (percent === null || percent === undefined) {
      ocrProgressWrap.classList.add('hidden');
      return;
    }
    ocrProgressWrap.classList.remove('hidden');
    const clamped = Math.min(100, Math.max(0, Math.round(percent)));
    ocrProgressLabel.textContent = label || 'Reading receipt...';
    ocrProgressPct.textContent = `${clamped}%`;
    ocrProgressBar.style.width = `${clamped}%`;
  }

  function updateScanConversionPreview() {
    const el = App.Elements;
    const state = App.State.get();
    const rawVal = parseFloat(el.scanEditAmount.value);
    const entryCur = el.scanEditCurrency.value;
    if (isNaN(rawVal) || rawVal <= 0) {
      el.scanConversionPreview.textContent = 'Enter a valid amount greater than 0 to add this expense.';
      return;
    }
    const amountUsd = toUsd(rawVal, entryCur);
    el.scanConversionPreview.textContent = `Converts to ${formatMoney(amountUsd, state.displayCurrency)} (${formatOtherCurrencies(amountUsd, state.displayCurrency)})`;
  }

  function updateManualConversionPreview() {
    const el = App.Elements;
    const state = App.State.get();
    const rawVal = parseFloat(el.expenseAmountInput.value);
    const entryCur = el.expenseCurrencySelect.value;
    if (isNaN(rawVal) || rawVal <= 0) {
      el.manualConversionPreview.classList.add('hidden');
      return;
    }
    const amountUsd = toUsd(rawVal, entryCur);
    el.manualConversionPreview.classList.remove('hidden');
    el.manualConversionPreview.textContent = `Saves as ${formatRawCurrency(rawVal, entryCur)} · Converts to ${formatMoney(amountUsd, state.displayCurrency)} (${formatOtherCurrencies(amountUsd, state.displayCurrency)})`;
  }

  function renderScanReviewCard() {
    const el = App.Elements;
    const state = App.State.get();
    const ui = App.State.getUI();
    const pending = ui.pendingScan;

    if (!pending) {
      el.scanReviewCard.classList.add('hidden');
      return;
    }

    el.scanReviewCard.classList.remove('hidden');
    el.scanPreviewImg.src = pending.previewUrl;
    el.modalImage.src = pending.previewUrl;

    el.scanDetectedTextEl.textContent = pending.summaryText || 'Review detected values below before adding:';
    el.scanRawSnippetEl.textContent = pending.rawSnippet || pending.fileName || '';

    populateDaySelect(el.scanEditDay, state.days, pending.day);
    el.scanEditName.value = pending.name || '';
    el.scanEditCurrency.value = pending.currency || state.displayCurrency;
    el.scanEditAmount.value = pending.amount && pending.amount > 0 ? pending.amount.toFixed(2) : '';

    // Render candidate amount chips if available
    if (Array.isArray(pending.candidates) && pending.candidates.length > 0) {
      el.scanCandidatesWrap.classList.remove('hidden');
      el.scanCandidatesList.innerHTML = '';

      pending.candidates.forEach((cand) => {
        const isSelected =
          pending.amount && Math.abs(cand.amount - pending.amount) < 0.005;
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = isSelected
          ? 'amount-chip inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1 text-xs font-bold text-white shadow-xs cursor-pointer'
          : 'amount-chip inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-300 hover:bg-indigo-50 hover:text-indigo-700 cursor-pointer';

        const amtText = formatRawCurrency(cand.amount, el.scanEditCurrency.value);
        chip.textContent = `${amtText} (${cand.tag})`;
        chip.addEventListener('click', () => {
          pending.amount = cand.amount;
          el.scanEditAmount.value = cand.amount.toFixed(2);
          renderScanReviewCard();
        });
        el.scanCandidatesList.appendChild(chip);
      });
    } else {
      el.scanCandidatesWrap.classList.add('hidden');
    }

    updateScanConversionPreview();
  }

  function render() {
    const state = App.State.get();
    const ui = App.State.getUI();
    const el = App.Elements;
    const cur = state.displayCurrency;
    const dailyLimitUsd = state.dailyLimitUsd;

    // 1. Header & Currency Switcher
    const dailyAllowanceFormatted = formatMoney(dailyLimitUsd, cur);
    el.headerSubtitle.textContent = `${dailyAllowanceFormatted}/day carryover budget · Multi-currency & smart receipt scanner`;

    el.currencyTabs.forEach((btn) => {
      const active = btn.dataset.currency === cur;
      btn.className = active
        ? 'currency-tab px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 text-white shadow-xs cursor-pointer'
        : 'currency-tab px-3 py-1.5 text-xs font-semibold rounded-lg text-slate-600 hover:bg-slate-100 cursor-pointer';
    });

    // 2. Navigation Tabs & Active Panel
    el.navExpenseCount.textContent = String(state.expenses.length);
    el.navTabs.forEach((btn) => {
      const tabName = btn.dataset.tab;
      const isActive = tabName === state.activeTab;
      btn.className = isActive
        ? 'nav-tab flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs sm:text-sm font-semibold bg-indigo-600 text-white shadow-xs cursor-pointer'
        : 'nav-tab flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs sm:text-sm font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer';
    });

    Object.entries(el.tabPanels).forEach(([tabKey, panelEl]) => {
      if (!panelEl) return;
      if (tabKey === state.activeTab) {
        panelEl.classList.remove('hidden');
      } else {
        panelEl.classList.add('hidden');
      }
    });

    // 3. Calculate Overall & Day-by-Day Carryover Metrics
    const totalBudgetUsd = state.days * dailyLimitUsd;
    const totalSpentUsd = state.expenses.reduce((sum, item) => sum + item.amountUsd, 0);
    const perDayUsd = totalSpentUsd / state.days;
    const totalSavedUsd = totalBudgetUsd - totalSpentUsd;
    const percentUsed = totalBudgetUsd > 0 ? (totalSpentUsd / totalBudgetUsd) * 100 : 0;

    // Compute per-day breakdown array
    const dailyStats = [];
    let runningSavedUsd = 0;
    for (let d = 1; d <= state.days; d++) {
      const dayExpenses = state.expenses.filter((e) => e.day === d);
      const spentTodayUsd = dayExpenses.reduce((sum, e) => sum + e.amountUsd, 0);
      const availableTodayUsd = runningSavedUsd + dailyLimitUsd;
      runningSavedUsd = availableTodayUsd - spentTodayUsd;
      dailyStats.push({
        day: d,
        count: dayExpenses.length,
        spentTodayUsd,
        availableTodayUsd,
        runningSavedUsd
      });
    }

    // 4. Render Home Tab (Big Picture Overview & Carryover Table)
    el.overviewPeriodLabel.textContent = `Across ${state.days} day${state.days > 1 ? 's' : ''} (${dailyAllowanceFormatted}/day allowance)`;

    el.totalSpentEl.textContent = formatMoney(totalSpentUsd, cur);
    el.totalSpentAltEl.textContent = formatOtherCurrencies(totalSpentUsd, cur);

    el.dailyAverageEl.textContent = formatMoney(perDayUsd, cur);
    el.dailyAverageAltEl.textContent = formatOtherCurrencies(perDayUsd, cur);

    el.totalBudgetEl.textContent = formatMoney(totalBudgetUsd, cur);
    el.totalBudgetAltEl.textContent = formatOtherCurrencies(totalBudgetUsd, cur);

    el.totalSavedEl.textContent = formatMoney(totalSavedUsd, cur);
    el.totalSavedAltEl.textContent = formatOtherCurrencies(totalSavedUsd, cur);

    if (totalSavedUsd < 0) {
      el.savedCardEl.className = 'rounded-xl bg-rose-50/80 p-4 ring-1 ring-inset ring-rose-600/20';
      el.savedLabelEl.className = 'text-xs font-semibold text-rose-700 uppercase tracking-wide';
      el.savedLabelEl.textContent = 'Over Budget';
      el.totalSavedEl.className = 'text-2xl font-bold text-rose-700 mt-1';
      el.totalSavedAltEl.className = 'text-xs text-rose-700/80 mt-1';
      el.limitStatusEl.textContent = `Over ${state.days}-day budget by ${formatMoney(Math.abs(totalSavedUsd), cur)}`;
      el.limitStatusEl.className = 'font-semibold text-rose-600';
      el.limitBarEl.className = 'h-full rounded-full bg-rose-500';
    } else {
      el.savedCardEl.className = 'rounded-xl bg-emerald-50/70 p-4 ring-1 ring-inset ring-emerald-600/15';
      el.savedLabelEl.className = 'text-xs font-semibold text-emerald-700 uppercase tracking-wide';
      el.savedLabelEl.textContent = 'Total Saved';
      el.totalSavedEl.className = 'text-2xl font-bold text-emerald-700 mt-1';
      el.totalSavedAltEl.className = 'text-xs text-emerald-700/80 mt-1';
      el.limitStatusEl.textContent = `${formatMoney(totalSavedUsd, cur)} saved across ${state.days} day${state.days > 1 ? 's' : ''}`;
      el.limitStatusEl.className = 'font-semibold text-emerald-700';
      el.limitBarEl.className = 'h-full rounded-full bg-emerald-500';
    }

    el.limitBarEl.style.width = `${Math.min(100, Math.max(0, percentUsed)).toFixed(1)}%`;
    el.limitPercentEl.textContent = `${Math.round(percentUsed)}% of ${formatMoney(totalBudgetUsd, cur)} used`;

    el.dailyAllowanceNote.textContent = `Each day adds ${dailyAllowanceFormatted} to your running pool. Click any row to select that day.`;
    el.activeDayIndicator.textContent = `Selected: Day ${state.selectedDay}`;

    el.dailyTableBody.innerHTML = '';
    dailyStats.forEach((stat) => {
      const isSelected = stat.day === state.selectedDay;
      const tr = document.createElement('tr');
      tr.className = isSelected
        ? 'bg-indigo-50/60 hover:bg-indigo-50 cursor-pointer transition-colors'
        : 'hover:bg-slate-50 cursor-pointer transition-colors';

      tr.addEventListener('click', () => {
        App.State.setSelectedDay(stat.day);
        render();
      });

      const tdDay = document.createElement('td');
      tdDay.className = 'py-3 pr-3 font-semibold text-slate-800 whitespace-nowrap';
      tdDay.innerHTML = `<div class="flex items-center gap-2">
        <span>Day ${stat.day}</span>
        ${isSelected ? '<span class="rounded-md bg-indigo-600 px-1.5 py-0.5 text-[10px] font-bold text-white">Active</span>' : ''}
        ${stat.count > 0 ? `<span class="text-xs font-normal text-slate-400">(${stat.count} item${stat.count > 1 ? 's' : ''})</span>` : ''}
      </div>`;

      const tdSpent = document.createElement('td');
      tdSpent.className = 'py-3 px-3 text-right text-slate-700 whitespace-nowrap';
      tdSpent.textContent = formatMoney(stat.spentTodayUsd, cur);

      const tdAvail = document.createElement('td');
      tdAvail.className = 'py-3 px-3 text-right text-slate-500 whitespace-nowrap';
      tdAvail.textContent = formatMoney(stat.availableTodayUsd, cur);

      const tdSaved = document.createElement('td');
      tdSaved.className =
        stat.runningSavedUsd < 0
          ? 'py-3 px-3 text-right font-semibold text-rose-600 whitespace-nowrap'
          : 'py-3 px-3 text-right font-semibold text-emerald-700 whitespace-nowrap';
      tdSaved.textContent = formatMoney(stat.runningSavedUsd, cur);

      const tdActions = document.createElement('td');
      tdActions.className = 'py-3 pl-3 text-right whitespace-nowrap';

      const actionWrap = document.createElement('div');
      actionWrap.className = 'inline-flex items-center gap-1.5';

      const addBtn = document.createElement('button');
      addBtn.type = 'button';
      addBtn.className = 'rounded-lg bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 cursor-pointer';
      addBtn.textContent = '+ Add';
      addBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        App.State.setSelectedDay(stat.day);
        App.State.setActiveTab('add');
        render();
      });

      const viewBtn = document.createElement('button');
      viewBtn.type = 'button';
      viewBtn.className = 'rounded-lg bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200 cursor-pointer';
      viewBtn.textContent = 'View';
      viewBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        App.State.setExpenseFilterDay(stat.day);
        App.State.setActiveTab('expenses');
        render();
      });

      actionWrap.appendChild(addBtn);
      actionWrap.appendChild(viewBtn);
      tdActions.appendChild(actionWrap);

      tr.appendChild(tdDay);
      tr.appendChild(tdSpent);
      tr.appendChild(tdAvail);
      tr.appendChild(tdSaved);
      tr.appendChild(tdActions);
      el.dailyTableBody.appendChild(tr);
    });

    // 5. Render Add & Scan Tab
    populateDaySelect(el.scanDaySelect, state.days, state.selectedDay);
    populateDaySelect(el.expenseDaySelect, state.days, state.selectedDay);
    el.autoAddToggle.checked = Boolean(state.autoAddScan);

    const driveReady = Boolean(App.Drive?.isConnected() && state.driveAutoUpload);
    if (el.driveScanStatusBtn && el.driveScanStatusText) {
      if (driveReady) {
        el.driveScanStatusBtn.className =
          'inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20 hover:bg-emerald-100 transition-colors cursor-pointer';
        el.driveScanStatusText.textContent = 'Receipt uploads: On';
      } else if (App.Drive?.isConnected() && !state.driveAutoUpload) {
        el.driveScanStatusBtn.className =
          'inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800 ring-1 ring-inset ring-amber-500/20 hover:bg-amber-100 transition-colors cursor-pointer';
        el.driveScanStatusText.textContent = 'Receipt uploads: Paused';
      } else {
        el.driveScanStatusBtn.className =
          'inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer';
        el.driveScanStatusText.textContent = 'Connect Google Drive';
      }
    }

    const activeDayStat = dailyStats[state.selectedDay - 1];
    if (activeDayStat) {
      el.selectedDaySummary.textContent = `Day ${state.selectedDay} Spent: ${formatMoney(activeDayStat.spentTodayUsd, cur)} · Running Balance: ${formatMoney(activeDayStat.runningSavedUsd, cur)}`;
    }

    renderScanReviewCard();
    updateManualConversionPreview();

    // Render Recent Expenses mini-list inside Add & Scan tab
    el.recentTotalCount.textContent = String(state.expenses.length);
    el.recentExpenseList.innerHTML = '';
    if (state.expenses.length === 0) {
      el.recentExpensesCard.classList.add('hidden');
    } else {
      el.recentExpensesCard.classList.remove('hidden');
      state.expenses.slice(0, 3).forEach((item) => {
        const li = document.createElement('li');
        li.className = 'flex items-center justify-between py-2.5 gap-3';
        const origBadge =
          item.originalCurrency && item.originalCurrency !== cur
            ? `<span class="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-500">Orig: ${formatRawCurrency(item.originalAmount, item.originalCurrency)}</span>`
            : '';
        let driveBadgeHtml = '';
        if (item.receiptDriveUrl) {
          driveBadgeHtml = `<a href="${escapeHtml(item.receiptDriveUrl)}" target="_blank" rel="noopener noreferrer" class="shrink-0 rounded bg-emerald-50 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100">☁️ Drive ↗</a>`;
        } else if (['uploading', 'queued'].includes(item.receiptUploadStatus)) {
          driveBadgeHtml = `<span class="shrink-0 rounded bg-indigo-50 px-1.5 py-0.5 text-[11px] font-medium text-indigo-600">⏳ Pending upload</span>`;
        }
        li.innerHTML = `
          <div class="flex items-center gap-2 min-w-0">
            <span class="shrink-0 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">Day ${item.day}</span>
            <span class="text-sm font-medium text-slate-800 truncate">${escapeHtml(item.name)}</span>
            ${item.source === 'scan' ? '<span class="text-[11px] text-indigo-600 font-semibold">📸</span>' : ''}
            ${driveBadgeHtml}
          </div>
          <div class="flex items-center gap-2 shrink-0">
            ${origBadge}
            <span class="text-sm font-bold text-slate-900">${formatMoney(item.amountUsd, cur)}</span>
          </div>
        `;
        el.recentExpenseList.appendChild(li);
      });
    }

    // 6. Render Expenses Tab (Day Filters, Inline Edit, Original Currency Badges)
    renderExpensesTab(state, ui, cur);

    // 7. Render Settings Tab
    if (document.activeElement !== el.dailyLimitInput) {
      el.dailyLimitInput.value = String(state.dailyLimitUsd);
    }
    el.dailyLimitEquiv.textContent = `Equivalent to ${formatMoney(state.dailyLimitUsd, 'EUR')}/day · ${formatMoney(state.dailyLimitUsd, 'INR')}/day`;

    if (document.activeElement !== el.daysInput) {
      el.daysInput.value = String(state.days);
    }
    if (document.activeElement !== el.rateEurInput) {
      el.rateEurInput.value = String(state.rates.EUR);
    }
    if (document.activeElement !== el.rateInrInput) {
      el.rateInrInput.value = String(state.rates.INR);
    }

    if (el.driveAutoUploadToggle) {
      el.driveAutoUploadToggle.checked = Boolean(state.driveAutoUpload);
    }
    if (el.driveClientInput && document.activeElement !== el.driveClientInput) {
      el.driveClientInput.value = state.driveClientId || '';
    }
    if (el.driveFolderInput && document.activeElement !== el.driveFolderInput) {
      el.driveFolderInput.value = state.driveFolderName || 'Expense Tracker Receipts';
    }
    if (el.driveSettingsBadge) {
      if (App.Drive?.isConnected() && state.driveAutoUpload) {
        el.driveSettingsBadge.className = 'rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800';
        el.driveSettingsBadge.textContent = 'Active';
      } else if (App.Drive?.isConnected()) {
        el.driveSettingsBadge.className = 'rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-800';
        el.driveSettingsBadge.textContent = 'Paused';
      } else {
        el.driveSettingsBadge.className = 'rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-600';
        el.driveSettingsBadge.textContent = 'Not Configured';
      }
    }

  }

  function renderExpensesTab(state, ui, cur) {
    const el = App.Elements;

    // Day filter pills
    el.dayFilterBar.innerHTML = '';
    const allPill = document.createElement('button');
    allPill.type = 'button';
    const isAllActive = state.expenseFilterDay === 'all';
    allPill.className = isAllActive
      ? 'day-filter-pill shrink-0 rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs cursor-pointer'
      : 'day-filter-pill shrink-0 rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200 cursor-pointer';
    allPill.textContent = `All Days (${state.expenses.length})`;
    allPill.addEventListener('click', () => {
      App.State.setExpenseFilterDay('all');
      render();
    });
    el.dayFilterBar.appendChild(allPill);

    for (let d = 1; d <= state.days; d++) {
      const count = state.expenses.filter((e) => e.day === d).length;
      const isActive = state.expenseFilterDay === d;
      const pill = document.createElement('button');
      pill.type = 'button';
      pill.className = isActive
        ? 'day-filter-pill shrink-0 rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs cursor-pointer'
        : 'day-filter-pill shrink-0 rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200 cursor-pointer';
      pill.textContent = `Day ${d} (${count})`;
      pill.addEventListener('click', () => {
        App.State.setExpenseFilterDay(d);
        render();
      });
      el.dayFilterBar.appendChild(pill);
    }

    const filteredExpenses =
      state.expenseFilterDay === 'all'
        ? state.expenses
        : state.expenses.filter((e) => e.day === state.expenseFilterDay);

    const filteredSumUsd = filteredExpenses.reduce((s, e) => s + e.amountUsd, 0);
    el.expenseCountEl.textContent = String(filteredExpenses.length);
    el.filteredTotalLabel.textContent =
      state.expenseFilterDay === 'all'
        ? `Total across all days: ${formatMoney(filteredSumUsd, cur)}`
        : `Day ${state.expenseFilterDay} total: ${formatMoney(filteredSumUsd, cur)}`;

    // Safe Clear All controls
    if (state.expenses.length === 0) {
      el.clearAllBtn.classList.add('hidden');
      el.clearConfirmGroup.classList.add('hidden');
    } else if (ui.confirmingClearAll) {
      el.clearAllBtn.classList.add('hidden');
      el.clearConfirmGroup.classList.remove('hidden');
    } else {
      el.clearAllBtn.classList.remove('hidden');
      el.clearConfirmGroup.classList.add('hidden');
    }

    el.expenseListEl.innerHTML = '';

    if (filteredExpenses.length === 0) {
      el.emptyStateEl.classList.remove('hidden');
      return;
    }

    el.emptyStateEl.classList.add('hidden');

    filteredExpenses.forEach((item) => {
      const li = document.createElement('li');
      li.className = 'py-3.5';

      // Check if this item is currently being edited inline
      if (ui.editingExpenseId === item.id) {
        const editWrap = document.createElement('div');
        editWrap.className = 'rounded-xl bg-slate-50 p-3 ring-1 ring-indigo-200 space-y-2.5';

        const grid = document.createElement('div');
        grid.className = 'grid grid-cols-1 sm:grid-cols-12 gap-2';

        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.value = item.name;
        nameInput.className = 'sm:col-span-5 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none';

        const daySelect = document.createElement('select');
        daySelect.className = 'sm:col-span-2 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-semibold text-slate-800';
        populateDaySelect(daySelect, state.days, item.day);

        const amtWrap = document.createElement('div');
        amtWrap.className = 'sm:col-span-3 flex';

        const curSelect = document.createElement('select');
        curSelect.className = 'rounded-l-lg border border-r-0 border-slate-300 bg-slate-100 px-2 py-1.5 text-xs font-bold text-slate-700';
        ['USD', 'EUR', 'INR'].forEach((c) => {
          const opt = document.createElement('option');
          opt.value = c;
          opt.textContent = c;
          curSelect.appendChild(opt);
        });
        curSelect.value = item.originalCurrency || 'USD';

        const amtInput = document.createElement('input');
        amtInput.type = 'number';
        amtInput.step = '0.01';
        amtInput.min = '0.01';
        amtInput.value = Number(item.originalAmount || item.amountUsd).toFixed(2);
        amtInput.className = 'w-full min-w-0 rounded-r-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm font-semibold text-slate-900 focus:border-indigo-500 focus:outline-none';

        amtWrap.appendChild(curSelect);
        amtWrap.appendChild(amtInput);

        const btnWrap = document.createElement('div');
        btnWrap.className = 'sm:col-span-2 flex items-center justify-end gap-1.5';

        const saveBtn = document.createElement('button');
        saveBtn.type = 'button';
        saveBtn.textContent = 'Save';
        saveBtn.className = 'rounded-lg bg-indigo-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 cursor-pointer';
        saveBtn.addEventListener('click', () => {
          const newName = nameInput.value.trim();
          const newDay = parseInt(daySelect.value, 10) || item.day;
          const newCur = curSelect.value;
          const newRawAmt = parseFloat(amtInput.value);
          if (!newName || isNaN(newRawAmt) || newRawAmt <= 0) return;

          const newAmountUsd = toUsd(newRawAmt, newCur);
          App.State.updateExpense(item.id, {
            day: newDay,
            name: newName,
            amountUsd: newAmountUsd,
            originalAmount: newRawAmt,
            originalCurrency: newCur
          });
          render();
        });

        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.textContent = 'Cancel';
        cancelBtn.className = 'rounded-lg bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 ring-1 ring-slate-300 hover:bg-slate-100 cursor-pointer';
        cancelBtn.addEventListener('click', () => {
          App.State.setEditingExpenseId(null);
          render();
        });

        btnWrap.appendChild(saveBtn);
        btnWrap.appendChild(cancelBtn);

        grid.appendChild(nameInput);
        grid.appendChild(daySelect);
        grid.appendChild(amtWrap);
        grid.appendChild(btnWrap);
        editWrap.appendChild(grid);
        li.appendChild(editWrap);
        el.expenseListEl.appendChild(li);
        return;
      }

      // Standard expense row display
      const row = document.createElement('div');
      row.className = 'flex items-center justify-between gap-3';

      const leftWrap = document.createElement('div');
      leftWrap.className = 'flex items-center gap-2.5 min-w-0';

      const dayBadge = document.createElement('span');
      dayBadge.className = 'shrink-0 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600';
      dayBadge.textContent = `Day ${item.day}`;

      const nameWrap = document.createElement('div');
      nameWrap.className = 'min-w-0';

      const nameLine = document.createElement('div');
      nameLine.className = 'flex items-center gap-1.5';

      const nameSpan = document.createElement('span');
      nameSpan.className = 'text-sm font-medium text-slate-800 truncate';
      nameSpan.textContent = item.name;
      nameLine.appendChild(nameSpan);

      if (item.source === 'scan') {
        const scanBadge = document.createElement('span');
        scanBadge.className = 'shrink-0 rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-600';
        scanBadge.textContent = '📸 Scanned';
        nameLine.appendChild(scanBadge);
      }

      if (item.receiptDriveUrl) {
        const driveLink = document.createElement('a');
        driveLink.href = item.receiptDriveUrl;
        driveLink.target = '_blank';
        driveLink.rel = 'noopener noreferrer';
        driveLink.className =
          'shrink-0 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20 hover:bg-emerald-100 transition-colors';
        driveLink.textContent = '☁️ View Receipt ↗';
        nameLine.appendChild(driveLink);
      } else if (['uploading', 'queued'].includes(item.receiptUploadStatus)) {
        const uploadingBadge = document.createElement('span');
        uploadingBadge.className = 'shrink-0 rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-600';
        uploadingBadge.textContent = '⏳ Pending Drive upload';
        nameLine.appendChild(uploadingBadge);
      } else if (item.receiptUploadStatus === 'failed') {
        const failedBadge = document.createElement('span');
        failedBadge.className = 'shrink-0 rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-medium text-rose-600';
        failedBadge.textContent = '⚠️ Drive upload failed';
        nameLine.appendChild(failedBadge);
      }

      nameWrap.appendChild(nameLine);
      leftWrap.appendChild(dayBadge);
      leftWrap.appendChild(nameWrap);

      const rightWrap = document.createElement('div');
      rightWrap.className = 'flex items-center gap-3 shrink-0';

      // Show original currency badge when entered in a currency different from current display currency
      if (item.originalCurrency && item.originalAmount > 0) {
        const origSpan = document.createElement('span');
        origSpan.className =
          item.originalCurrency !== cur
            ? 'rounded-md bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800 ring-1 ring-inset ring-amber-500/20'
            : 'text-xs text-slate-400 hidden sm:inline';
        origSpan.textContent = `Receipt: ${formatRawCurrency(item.originalAmount, item.originalCurrency)}`;
        rightWrap.appendChild(origSpan);
      }

      const amountSpan = document.createElement('span');
      amountSpan.className = 'text-sm font-bold text-slate-900 min-w-[4.5rem] text-right';
      amountSpan.textContent = formatMoney(item.amountUsd, cur);

      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.textContent = 'Edit';
      editBtn.className = 'text-xs font-semibold text-indigo-600 hover:text-indigo-500 transition-colors cursor-pointer';
      editBtn.addEventListener('click', () => {
        App.State.setEditingExpenseId(item.id);
        render();
      });

      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.textContent = 'Remove';
      deleteBtn.className = 'text-xs font-medium text-slate-400 hover:text-rose-600 transition-colors cursor-pointer';
      deleteBtn.addEventListener('click', () => {
        App.State.removeExpense(item.id);
        render();
      });

      rightWrap.appendChild(amountSpan);
      rightWrap.appendChild(editBtn);
      rightWrap.appendChild(deleteBtn);

      row.appendChild(leftWrap);
      row.appendChild(rightWrap);
      li.appendChild(row);
      el.expenseListEl.appendChild(li);
    });
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function showDriveTestFeedback(type, message) {
    const { driveTestFeedback } = App.Elements;
    if (!driveTestFeedback) return;
    if (!message) {
      driveTestFeedback.classList.add('hidden');
      return;
    }
    driveTestFeedback.classList.remove(
      'hidden',
      'bg-indigo-50',
      'text-indigo-700',
      'bg-emerald-50',
      'text-emerald-700',
      'bg-amber-50',
      'text-amber-800',
      'bg-rose-50',
      'text-rose-700'
    );
    if (type === 'loading') {
      driveTestFeedback.classList.add('bg-indigo-50', 'text-indigo-700');
    } else if (type === 'success') {
      driveTestFeedback.classList.add('bg-emerald-50', 'text-emerald-700');
    } else if (type === 'warning') {
      driveTestFeedback.classList.add('bg-amber-50', 'text-amber-800');
    } else {
      driveTestFeedback.classList.add('bg-rose-50', 'text-rose-700');
    }
    driveTestFeedback.textContent = message;
  }

  App.Render = {
    render,
    showScanFeedback,
    showDriveTestFeedback,
    updateOcrProgress,
    updateScanConversionPreview,
    updateManualConversionPreview,
    renderScanReviewCard
  };
})(window.App);
