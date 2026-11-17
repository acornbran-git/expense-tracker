window.App = window.App || {};

(function (App) {
  const { CURRENCY_SYMBOLS, SUPPORTED_CURRENCIES } = App.Config;

  function formatMoney(amountUsd, currency) {
    const state = App.State.get();
    const rate = state.rates[currency] || 1;
    const converted = amountUsd * rate;
    const sign = converted < 0 ? '-' : '';
    const absVal = Math.abs(converted).toFixed(2);
    const symbol = CURRENCY_SYMBOLS[currency] || '$';
    return `${sign}${symbol}${absVal}`;
  }

  function formatRawCurrency(amount, currency) {
    const val = parseFloat(amount) || 0;
    const sign = val < 0 ? '-' : '';
    const absVal = Math.abs(val).toFixed(2);
    const symbol = CURRENCY_SYMBOLS[currency] || '$';
    return `${sign}${symbol}${absVal}`;
  }

  function formatOtherCurrencies(amountUsd, primaryCurrency) {
    const others = SUPPORTED_CURRENCIES.filter((c) => c !== primaryCurrency);
    return others.map((c) => formatMoney(amountUsd, c)).join(' · ');
  }

  function toUsd(amount, currency) {
    const state = App.State.get();
    const rate = state.rates[currency] || 1;
    return amount / rate;
  }

  App.Currency = {
    formatMoney,
    formatRawCurrency,
    formatOtherCurrencies,
    toUsd
  };
})(window.App);
