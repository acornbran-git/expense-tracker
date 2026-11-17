// Global namespace for the Expense Tracker application
window.App = window.App || {};

window.App.Config = {
  DEFAULT_DAILY_LIMIT_USD: 60,
  STORAGE_KEY: 'daily_expense_tracker_v2',
  SUPPORTED_CURRENCIES: ['USD', 'EUR', 'INR'],
  CURRENCY_SYMBOLS: {
    USD: '$',
    EUR: '€',
    INR: '₹'
  },
  DEFAULT_STATE: {
    activeTab: 'home',
    selectedDay: 1,
    expenseFilterDay: 'all',
    autoAddScan: false,
    dailyLimitUsd: 60,
    days: 7,
    displayCurrency: 'USD',
    driveClientId: '',
    driveFolderName: 'Expense Tracker Receipts',
    driveAutoUpload: true,
    rates: {
      USD: 1,
      EUR: 0.9084,
      INR: 93.48
    },
    nextId: 3,
    expenses: [
      {
        id: 1,
        day: 1,
        name: 'Coffee & pastry',
        amountUsd: 6.50,
        originalAmount: 6.50,
        originalCurrency: 'USD',
        source: 'manual'
      },
      {
        id: 2,
        day: 1,
        name: 'Lunch bowl',
        amountUsd: 14.00,
        originalAmount: 14.00,
        originalCurrency: 'USD',
        source: 'manual'
      }
    ]
  }
};
