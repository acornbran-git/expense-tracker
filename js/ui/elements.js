window.App = window.App || {};

(function (App) {
  App.Elements = {
    // Header & Navigation
    headerSubtitle: document.getElementById('header-subtitle'),
    currencyTabs: document.querySelectorAll('.currency-tab'),
    navTabs: document.querySelectorAll('.nav-tab'),
    navExpenseCount: document.getElementById('nav-expense-count'),

    // Tab Containers
    tabPanels: {
      home: document.getElementById('tab-home'),
      add: document.getElementById('tab-add'),
      expenses: document.getElementById('tab-expenses'),
      settings: document.getElementById('tab-settings')
    },

    // Home Tab (Big Picture Overview & Carryover Table)
    overviewPeriodLabel: document.getElementById('overview-period-label'),
    goScanBtn: document.getElementById('go-scan-btn'),
    goManualBtn: document.getElementById('go-manual-btn'),

    savedCardEl: document.getElementById('saved-card'),
    savedLabelEl: document.getElementById('saved-label'),
    totalSavedEl: document.getElementById('total-saved'),
    totalSavedAltEl: document.getElementById('total-saved-alt'),

    totalSpentEl: document.getElementById('total-spent'),
    totalSpentAltEl: document.getElementById('total-spent-alt'),
    dailyAverageEl: document.getElementById('daily-average'),
    dailyAverageAltEl: document.getElementById('daily-average-alt'),
    totalBudgetEl: document.getElementById('total-budget'),
    totalBudgetAltEl: document.getElementById('total-budget-alt'),

    limitStatusEl: document.getElementById('limit-status'),
    limitPercentEl: document.getElementById('limit-percent'),
    limitBarEl: document.getElementById('limit-bar'),

    dailyAllowanceNote: document.getElementById('daily-allowance-note'),
    activeDayIndicator: document.getElementById('active-day-indicator'),
    dailyTableBody: document.getElementById('daily-table-body'),

    // Add & Scan Tab
    scanDaySelect: document.getElementById('scan-day'),
    selectedDaySummary: document.getElementById('selected-day-summary'),
    autoAddToggle: document.getElementById('auto-add-toggle'),
    scanDropzone: document.getElementById('scan-dropzone'),
    screenshotInput: document.getElementById('screenshot-input'),

    ocrProgressWrap: document.getElementById('ocr-progress-wrap'),
    ocrProgressLabel: document.getElementById('ocr-progress-label'),
    ocrProgressPct: document.getElementById('ocr-progress-pct'),
    ocrProgressBar: document.getElementById('ocr-progress-bar'),

    scanFeedbackEl: document.getElementById('scan-feedback'),
    scanReviewCard: document.getElementById('scan-review-card'),
    scanPreviewBtn: document.getElementById('scan-preview-btn'),
    scanPreviewImg: document.getElementById('scan-preview'),
    scanDetectedTextEl: document.getElementById('scan-detected-text'),
    scanRawSnippetEl: document.getElementById('scan-raw-snippet'),

    scanCandidatesWrap: document.getElementById('scan-candidates-wrap'),
    scanCandidatesList: document.getElementById('scan-candidates-list'),

    scanEditName: document.getElementById('scan-edit-name'),
    scanEditDay: document.getElementById('scan-edit-day'),
    scanEditCurrency: document.getElementById('scan-edit-currency'),
    scanEditAmount: document.getElementById('scan-edit-amount'),
    scanConversionPreview: document.getElementById('scan-conversion-preview'),
    scanCancelBtn: document.getElementById('scan-cancel-btn'),
    scanConfirmBtn: document.getElementById('scan-confirm-btn'),

    expenseForm: document.getElementById('expense-form'),
    expenseNameInput: document.getElementById('expense-name'),
    expenseDaySelect: document.getElementById('expense-day'),
    expenseCurrencySelect: document.getElementById('expense-currency'),
    expenseAmountInput: document.getElementById('expense-amount'),
    manualConversionPreview: document.getElementById('manual-conversion-preview'),
    formErrorEl: document.getElementById('form-error'),

    recentExpensesCard: document.getElementById('recent-expenses-card'),
    recentTotalCount: document.getElementById('recent-total-count'),
    recentExpenseList: document.getElementById('recent-expense-list'),
    viewAllExpensesBtn: document.getElementById('view-all-expenses-btn'),

    // Expenses Tab
    expenseCountEl: document.getElementById('expense-count'),
    filteredTotalLabel: document.getElementById('filtered-total-label'),
    dayFilterBar: document.getElementById('day-filter-bar'),
    expenseListEl: document.getElementById('expense-list'),
    emptyStateEl: document.getElementById('empty-state'),

    clearAllBtn: document.getElementById('clear-all-btn'),
    clearConfirmGroup: document.getElementById('clear-confirm-group'),
    clearConfirmYes: document.getElementById('clear-confirm-yes'),
    clearConfirmNo: document.getElementById('clear-confirm-no'),

    // Settings Tab
    dailyLimitInput: document.getElementById('daily-limit-input'),
    dailyLimitEquiv: document.getElementById('daily-limit-equiv'),
    daysInput: document.getElementById('days-input'),
    rateEurInput: document.getElementById('rate-eur'),
    rateInrInput: document.getElementById('rate-inr'),
    resetSettingsBtn: document.getElementById('reset-settings-btn'),

    // Image Preview Modal
    imageModal: document.getElementById('image-modal'),
    modalImage: document.getElementById('modal-image'),
    closeModalBtn: document.getElementById('close-modal-btn')
  };
})(window.App);
