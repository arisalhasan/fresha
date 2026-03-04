const express = require('express');
const { chromium } = require('playwright');

const app = express();
app.use(express.json());

const PORT = Number(process.env.PORT || 3000);
const API_KEY = process.env.API_KEY || '';
const DEFAULT_FRESHA_URL = process.env.FRESHA_URL || 'https://www.fresha.com/book-now/aphroditebeauty-zdjxrm79/services?lid=1531418&share=true&pId=1454315';

function auth(req, res, next) {
  if (!API_KEY) return next();
  const key = req.header('x-api-key');
  if (key !== API_KEY) return res.status(401).json({ ok: false, error: 'Unauthorized' });
  next();
}

async function lookupSlots({ url, serviceName }) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 1800 } });

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

    for (const s of ['button:has-text("Accept")', 'button:has-text("Allow all")']) {
      const b = page.locator(s).first();
      if (await b.count()) await b.click({ timeout: 1200 }).catch(() => {});
    }

    const service = page.locator(`text=${serviceName}`).first();
    await service.waitFor({ timeout: 15000 });
    await service.click({ timeout: 5000 });

    await page.waitForTimeout(1500);

    let slots = [];
    for (const sel of [
      'button[data-testid*="time"]',
      'button:has-text(":")',
      '[role="button"]:has-text(":")'
    ]) {
      const texts = await page.locator(sel).allTextContents();
      const parsed = texts
        .map((t) => t.trim())
        .filter((t) => /\b\d{1,2}:\d{2}\b/.test(t));
      if (parsed.length) {
        slots = [...new Set(parsed)].slice(0, 8);
        break;
      }
    }

    const body = (await page.textContent('body')) || '';
    const priceMatch = body.match(/£\s?\d+(?:\.\d{2})?/);
    const price = priceMatch ? priceMatch[0].replace(/\s+/g, '') : null;

    return { ok: true, serviceName, price, slots, checkedAt: new Date().toISOString() };
  } finally {
    await browser.close();
  }
}

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'beauty-ai-booking-assistant' });
});

app.get('/availability', auth, async (req, res) => {
  const serviceName = (req.query.service || '').toString().trim();
  const url = (req.query.url || DEFAULT_FRESHA_URL).toString();

  if (!serviceName) {
    return res.status(400).json({ ok: false, error: 'Missing required query param: service' });
  }

  try {
    const result = await lookupSlots({ url, serviceName });
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message, serviceName });
  }
});

app.listen(PORT, () => {
  console.log(`Beauty AI server listening on port ${PORT}`);
});
