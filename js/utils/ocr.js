window.App = window.App || {};

(function (App) {
  /**
   * Pre-processes an image file on an offscreen canvas to improve OCR accuracy:
   * - Upscales small screenshots
   * - Converts to grayscale
   * - Detects dark-mode screenshots and inverts them to dark-text-on-light
   * - Applies gentle contrast stretching
   */
  function preprocessImageForOcr(file) {
    return new Promise((resolve) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);

      img.onload = () => {
        try {
          const scale = img.width < 900 ? 1.75 : img.width > 2400 ? 2400 / img.width : 1;
          const width = Math.max(1, Math.round(img.width * scale));
          const height = Math.max(1, Math.round(img.height * scale));

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          const imageData = ctx.getImageData(0, 0, width, height);
          const data = imageData.data;

          // First pass: convert to grayscale and compute average luminance
          let totalLum = 0;
          const pixelCount = data.length / 4;
          for (let i = 0; i < data.length; i += 4) {
            const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
            data[i] = data[i + 1] = data[i + 2] = lum;
            totalLum += lum;
          }

          const avgLum = totalLum / pixelCount;
          const isDarkMode = avgLum < 110;

          // Second pass: invert if dark mode and stretch contrast
          for (let i = 0; i < data.length; i += 4) {
            let v = data[i];
            if (isDarkMode) {
              v = 255 - v;
            }
            // Contrast boost around midpoint
            v = (v - 128) * 1.35 + 128;
            v = Math.max(0, Math.min(255, Math.round(v)));
            data[i] = data[i + 1] = data[i + 2] = v;
          }

          ctx.putImageData(imageData, 0, 0);
          URL.revokeObjectURL(objectUrl);
          canvas.toBlob(
            (blob) => {
              resolve(blob || file);
            },
            'image/png',
            1
          );
        } catch (err) {
          URL.revokeObjectURL(objectUrl);
          resolve(file);
        }
      };

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(file);
      };

      img.src = objectUrl;
    });
  }

  /**
   * Parse receipt/screenshot OCR text for amount, currency, label, and candidate amounts
   */
  function parseReceiptText(text, fallbackCurrency) {
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    // Detect currency from symbols or ISO codes
    let currency = fallbackCurrency || 'USD';
    if (/₹|\bINR\b|\bRs\.?\b|\bRupees\b/i.test(text)) {
      currency = 'INR';
    } else if (/€|\bEUR\b/i.test(text)) {
      currency = 'EUR';
    } else if (/\$|\bUSD\b/i.test(text)) {
      currency = 'USD';
    }

    const totalKeywords = /\b(grand\s*total|total|amount\s*paid|amount\s*due|amount|paid|spent|debited|debit|sum|due|balance|charge|net\s*amount|sent\s*to)\b/i;
    const secondaryKeywords = /\b(subtotal|sub-total|tax|vat|gst|tip|service|fare|bill)\b/i;
    const ignoreLineKeywords = /\b(upi\s*id|txn|transaction\s*id|ref\s*no|utr|invoice\s*#|order\s*#|phone|tel|mob|gstin|card\s*ending)\b/i;

    const amountRegex = /(?:([$€₹]|USD|EUR|INR|Rs\.?)\s*)?(\d{1,3}(?:,\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)/gi;

    const candidateMap = new Map();

    lines.forEach((line, lineIdx) => {
      if (ignoreLineKeywords.test(line) && !totalKeywords.test(line)) return;

      const hasTotalKw = totalKeywords.test(line);
      const hasSecondaryKw = secondaryKeywords.test(line);
      const lineHasCurrency = /[$€₹]|\b(USD|EUR|INR|Rs\.?)\b/i.test(line);

      let match;
      amountRegex.lastIndex = 0;

      while ((match = amountRegex.exec(line)) !== null) {
        const prefixCurrency = match[1] || '';
        const rawNum = match[2];

        // Skip likely years (2020-2035) or times/dates if no currency or decimal
        if (/^(19|20)\d{2}$/.test(rawNum) && !prefixCurrency && !hasTotalKw) continue;
        // Skip numbers with more than 7 digits without decimals (likely phone/ID)
        if (/^\d{7,}$/.test(rawNum)) continue;

        let numStr = rawNum.replace(/,/g, '');
        if (/^\d+,\d{2}$/.test(rawNum)) {
          numStr = rawNum.replace(',', '.');
        }
        const val = parseFloat(numStr);
        if (isNaN(val) || val <= 0 || val > 500000) continue;

        let score = 0;
        if (hasTotalKw) score += 7;
        if (prefixCurrency) score += 5;
        else if (lineHasCurrency) score += 3;
        if (/\.\d{2}$/.test(numStr)) score += 3;
        if (hasSecondaryKw && !hasTotalKw) score -= 2;
        if (val >= 1) score += 1;

        // Clean snippet context for UI chip
        let tag = '';
        if (hasTotalKw) {
          const kwMatch = line.match(totalKeywords);
          tag = kwMatch ? kwMatch[0] : 'Total';
        } else if (hasSecondaryKw) {
          const kwMatch = line.match(secondaryKeywords);
          tag = kwMatch ? kwMatch[0] : 'Item';
        } else if (prefixCurrency || lineHasCurrency) {
          tag = 'Detected';
        } else {
          tag = `Line ${lineIdx + 1}`;
        }

        const key = val.toFixed(2);
        const existing = candidateMap.get(key);
        if (!existing || score > existing.score) {
          candidateMap.set(key, {
            amount: val,
            score,
            tag: tag.charAt(0).toUpperCase() + tag.slice(1).toLowerCase()
          });
        }
      }
    });

    const candidates = Array.from(candidateMap.values()).sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.amount - a.amount;
    });

    const bestAmount = candidates.length > 0 ? candidates[0].amount : null;

    // Extract a clean merchant / expense label
    const noiseRegex = /^(\d{1,2}:\d{2}|.*(5g|4g|lte|wifi|battery|%\b)|receipt|tax\s*invoice|payment\s*successful|paid\s*to|sent\s*to|transaction\s*successful)$/i;
    let label = 'Scanned Receipt';

    // Check for "Paid to X" or "Sent to X" pattern common in payment apps
    const paidToMatch = text.match(/(?:paid\s+to|sent\s+to|to)\s+([A-Za-z0-9 &.'-]{3,30})/i);
    if (paidToMatch && paidToMatch[1]) {
      label = paidToMatch[1].trim();
    } else {
      const cleanLine = lines.find(
        (l) =>
          /[a-zA-Z]{3,}/.test(l) &&
          !totalKeywords.test(l) &&
          !secondaryKeywords.test(l) &&
          !ignoreLineKeywords.test(l) &&
          !noiseRegex.test(l.trim())
      );
      if (cleanLine) {
        label = cleanLine.replace(/[^a-zA-Z0-9 &.'()-]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 32);
      }
    }

    if (!label) label = 'Scanned Receipt';

    return {
      amount: bestAmount,
      currency,
      label,
      candidates: candidates.slice(0, 6)
    };
  }

  /**
   * Run Tesseract OCR on an image file (with pre-processing and progress reporting)
   */
  async function scanReceiptImage(file, fallbackCurrency, onProgress) {
    if (typeof Tesseract === 'undefined') {
      throw new Error('OCR library unavailable');
    }

    if (typeof onProgress === 'function') {
      onProgress(10, 'Enhancing image contrast...');
    }

    const processedBlob = await preprocessImageForOcr(file);

    const result = await Tesseract.recognize(processedBlob, 'eng', {
      logger: (m) => {
        if (typeof onProgress === 'function' && m && typeof m.progress === 'number') {
          if (m.status === 'recognizing text') {
            const pct = Math.min(98, Math.max(15, Math.round(15 + m.progress * 83)));
            onProgress(pct, `Reading receipt text (${pct}%)...`);
          } else {
            onProgress(15, 'Initializing OCR engine...');
          }
        }
      }
    });

    if (typeof onProgress === 'function') {
      onProgress(100, 'Finished scanning!');
    }

    const rawText = result?.data?.text || '';
    const parsed = parseReceiptText(rawText, fallbackCurrency);
    return { rawText, parsed };
  }

  App.OCR = {
    parseReceiptText,
    scanReceiptImage
  };
})(window.App);
