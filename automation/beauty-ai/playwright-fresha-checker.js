// Minimal Fresha availability checker (Option B)
// Run: node playwright-fresha-checker.js "<fresha-url>" "<serviceName>"

const { chromium } = require('playwright');

async function checkAvailability({ url, serviceName }) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 2000 } });

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Accept cookie banners if present (best effort)
    const cookieButtons = [
      'button:has-text("Accept")',
      'button:has-text("Allow all")',
      '[aria-label="Accept"]'
    ];
    for (const sel of cookieButtons) {
      const btn = page.locator(sel).first();
      if (await btn.count()) {
        await btn.click({ timeout: 1000 }).catch(() => {});
      }
    }

    // Select service by visible text
    const serviceLocator = page.locator(`text=${serviceName}`).first();
    await serviceLocator.waitFor({ timeout: 15000 });
    await serviceLocator.click({ timeout: 5000 });

    // Wait for slots area (selectors may need tuning per UI changes)
    await page.waitForTimeout(1500);

    // Try common slot-like selectors
    const slotSelectors = [
      'button[data-testid*="time"]',
      'button:has-text(":")',
      '[role="button"]:has-text(":")'
    ];

    let slots = [];
    for (const sel of slotSelectors) {
      const handles = await page.locator(sel).allTextContents();
      const filtered = handles
        .map(s => s.trim())
        .filter(s => /\b\d{1,2}:\d{2}\b/.test(s));
      if (filtered.length) {
        slots = [...new Set(filtered)].slice(0, 8);
        break;
      }
    }

    // Price capture (best effort)
    const pageText = await page.textContent('body');
    const priceMatch = pageText && pageText.match(/£\s?\d+(?:\.\d{2})?/);
    const price = priceMatch ? priceMatch[0].replace(/\s+/g, '') : null;

    return {
      ok: true,
      serviceName,
      price,
      slots
    };
  } catch (err) {
    return { ok: false, error: err.message, serviceName, slots: [] };
  } finally {
    await browser.close();
  }
}

(async () => {
  const [url, serviceName] = process.argv.slice(2);
  if (!url || !serviceName) {
    console.error('Usage: node playwright-fresha-checker.js "<fresha-url>" "<serviceName>"');
    process.exit(1);
  }

  const res = await checkAvailability({ url, serviceName });
  console.log(JSON.stringify(res, null, 2));
})();
