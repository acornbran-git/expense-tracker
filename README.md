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

## Running the App

No installation or build step is required. Simply open `index.html` in any web browser.
