window.App = window.App || {};

(function (App) {
  const { STORAGE_KEY, DEFAULT_STATE, SUPPORTED_CURRENCIES, DEFAULT_DAILY_LIMIT_USD } = App.Config;

  function cloneDefaultState() {
    if (typeof structuredClone === 'function') {
      return structuredClone(DEFAULT_STATE);
    }
    return JSON.parse(JSON.stringify(DEFAULT_STATE));
  }

  function normalizeExpense(exp, fallbackId) {
    const amountUsd = parseFloat(exp.amountUsd) > 0 ? parseFloat(exp.amountUsd) : 0;
    const origCur = SUPPORTED_CURRENCIES.includes(exp.originalCurrency) ? exp.originalCurrency : 'USD';
    const origAmt = parseFloat(exp.originalAmount) > 0 ? parseFloat(exp.originalAmount) : amountUsd;
    return {
      id: parseInt(exp.id, 10) || fallbackId,
      day: Math.max(1, parseInt(exp.day, 10) || 1),
      name: String(exp.name || 'Expense').trim(),
      amountUsd,
      originalAmount: origAmt,
      originalCurrency: origCur,
      source: exp.source === 'scan' ? 'scan' : 'manual'
    };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return cloneDefaultState();
      const parsed = JSON.parse(raw);
      const days = Math.min(365, Math.max(1, parseInt(parsed.days, 10) || 7));
      const selectedDay = Math.min(days, Math.max(1, parseInt(parsed.selectedDay, 10) || 1));

      return {
        activeTab: ['home', 'add', 'expenses', 'settings'].includes(parsed.activeTab)
          ? parsed.activeTab
          : 'home',
        selectedDay,
        expenseFilterDay:
          parsed.expenseFilterDay === 'all'
            ? 'all'
            : Math.min(days, Math.max(1, parseInt(parsed.expenseFilterDay, 10) || 1)),
        autoAddScan: Boolean(parsed.autoAddScan),
        dailyLimitUsd:
          parseFloat(parsed.dailyLimitUsd) > 0
            ? parseFloat(parsed.dailyLimitUsd)
            : DEFAULT_DAILY_LIMIT_USD,
        days,
        displayCurrency: SUPPORTED_CURRENCIES.includes(parsed.displayCurrency)
          ? parsed.displayCurrency
          : 'USD',
        rates: {
          USD: 1,
          EUR: parseFloat(parsed.rates?.EUR) > 0 ? parseFloat(parsed.rates.EUR) : DEFAULT_STATE.rates.EUR,
          INR: parseFloat(parsed.rates?.INR) > 0 ? parseFloat(parsed.rates.INR) : DEFAULT_STATE.rates.INR
        },
        nextId: parseInt(parsed.nextId, 10) || 1,
        expenses: Array.isArray(parsed.expenses)
          ? parsed.expenses.map((e, idx) => normalizeExpense(e, idx + 1))
          : []
      };
    } catch (e) {
      return cloneDefaultState();
    }
  }

  let currentState = loadState();

  // Transient UI state (not persisted to localStorage)
  let uiState = {
    editingExpenseId: null,
    confirmingClearAll: false,
    pendingScan: null
  };

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(currentState));
    } catch (e) {
      // Ignore storage errors in restricted environments
    }
  }

  App.State = {
    get() {
      return currentState;
    },

    getUI() {
      return uiState;
    },

    setActiveTab(tab) {
      if (['home', 'add', 'expenses', 'settings'].includes(tab)) {
        currentState.activeTab = tab;
        uiState.confirmingClearAll = false;
        saveState();
      }
    },

    setSelectedDay(day) {
      const d = Math.min(currentState.days, Math.max(1, parseInt(day, 10) || 1));
      currentState.selectedDay = d;
      saveState();
    },

    setExpenseFilterDay(dayOrAll) {
      if (dayOrAll === 'all') {
        currentState.expenseFilterDay = 'all';
      } else {
        const d = Math.min(currentState.days, Math.max(1, parseInt(dayOrAll, 10) || 1));
        currentState.expenseFilterDay = d;
        currentState.selectedDay = d;
      }
      saveState();
    },

    setAutoAddScan(enabled) {
      currentState.autoAddScan = Boolean(enabled);
      saveState();
    },

    setDisplayCurrency(currency) {
      if (SUPPORTED_CURRENCIES.includes(currency)) {
        currentState.displayCurrency = currency;
        saveState();
      }
    },

    setDailyLimitUsd(limitValue) {
      const val = parseFloat(limitValue);
      if (!isNaN(val) && val > 0 && val <= 100000) {
        currentState.dailyLimitUsd = val;
        saveState();
        return true;
      }
      return false;
    },

    setDays(days) {
      const val = Math.min(365, Math.max(1, parseInt(days, 10) || 1));
      currentState.days = val;
      if (currentState.selectedDay > val) {
        currentState.selectedDay = val;
      }
      if (currentState.expenseFilterDay !== 'all' && currentState.expenseFilterDay > val) {
        currentState.expenseFilterDay = 'all';
      }
      saveState();
    },

    setRate(currency, rateValue) {
      const val = parseFloat(rateValue);
      if (!isNaN(val) && val > 0 && currentState.rates[currency] !== undefined) {
        currentState.rates[currency] = val;
        saveState();
        return true;
      }
      return false;
    },

    resetSettings() {
      currentState.dailyLimitUsd = DEFAULT_DAILY_LIMIT_USD;
      currentState.days = DEFAULT_STATE.days;
      currentState.rates = { ...DEFAULT_STATE.rates };
      if (currentState.selectedDay > currentState.days) {
        currentState.selectedDay = currentState.days;
      }
      saveState();
    },

    addExpense({ day, name, amountUsd, originalAmount, originalCurrency, source }) {
      const validDay = Math.min(currentState.days, Math.max(1, parseInt(day, 10) || 1));
      const newExpense = normalizeExpense(
        {
          id: currentState.nextId++,
          day: validDay,
          name,
          amountUsd,
          originalAmount: originalAmount ?? amountUsd,
          originalCurrency: originalCurrency || 'USD',
          source: source || 'manual'
        },
        currentState.nextId
      );
      currentState.expenses.unshift(newExpense);
      saveState();
      return newExpense;
    },

    updateExpense(id, { day, name, amountUsd, originalAmount, originalCurrency }) {
      const idx = currentState.expenses.findIndex((e) => e.id === id);
      if (idx === -1) return false;
      const existing = currentState.expenses[idx];
      currentState.expenses[idx] = normalizeExpense(
        {
          ...existing,
          day: day ?? existing.day,
          name: name ?? existing.name,
          amountUsd: amountUsd ?? existing.amountUsd,
          originalAmount: originalAmount ?? existing.originalAmount,
          originalCurrency: originalCurrency ?? existing.originalCurrency
        },
        existing.id
      );
      uiState.editingExpenseId = null;
      saveState();
      return true;
    },

    removeExpense(id) {
      currentState.expenses = currentState.expenses.filter((e) => e.id !== id);
      if (uiState.editingExpenseId === id) {
        uiState.editingExpenseId = null;
      }
      saveState();
    },

    clearExpenses() {
      currentState.expenses = [];
      uiState.editingExpenseId = null;
      uiState.confirmingClearAll = false;
      saveState();
    },

    setEditingExpenseId(id) {
      uiState.editingExpenseId = id;
    },

    setConfirmingClearAll(confirming) {
      uiState.confirmingClearAll = Boolean(confirming);
    },

    setPendingScan(scanData) {
      uiState.pendingScan = scanData;
    }
  };
})(window.App);
