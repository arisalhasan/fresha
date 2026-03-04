const express = require('express');
const { chromium } = require('playwright');

const app = express();
app.use(express.json());

const PORT = Number(process.env.PORT || 3000);
const API_KEY = process.env.API_KEY || '';
const DEFAULT_FRESHA_URL = process.env.FRESHA_URL || 'https://www.fresha.com/book-now/aphroditebeauty-zdjxrm79/services?lid=1531418&share=true&pId=1454315';

const CATEGORY_HINTS = {
  'brow lamination': 'Lash and Brow Lamination',
  'powder brows': 'Lash and Brow Lamination',
  'brow tinting': 'Lash and Brow Lamination',
  'classic set natural hybrid': 'Eyelash Extensions',
  'angel lashes': 'Eyelash Extensions',
  'hybrid set': 'Eyelash Extensions',
  'infill': 'Eyelash Extensions',
  'mini infill': 'Eyelash Extensions',
  'volume kim k style wispy': 'Eyelash Extensions',
  'russian volume': 'Eyelash Extensions',
  'mega volume': 'Eyelash Extensions',
  'lash removal': 'Eyelash Extensions',
  'patch test': 'Eyelash Extensions'
};

function auth(req, res, next) {
  if (!API_KEY) return next();
  const key = req.header('x-api-key');
  if (key !== API_KEY) return res.status(401).json({ ok: false, error: 'Unauthorized' });
  next();
}

async function lookupSlots({ url, serviceName }) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 1800 } });

  const norm = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

    for (const s of ['button:has-text("Accept")', 'button:has-text("Allow all")', 'button:has-text("Accept all")']) {
      const b = page.locator(s).first();
      if (await b.count()) await b.click({ timeout: 1500 }).catch(() => {});
    }

    // Dismiss/close floating banners that can intercept clicks (best effort)
    for (const s of [
      'button[aria-label*="close" i]',
      'button:has-text("Close")',
      '.Banner_banner__3Qcnr button',
      '.Banner_banner__3Qcnr [role="button"]'
    ]) {
      const b = page.locator(s).first();
      if (await b.count()) await b.click({ timeout: 1000 }).catch(() => {});
    }

    // Prefer Professional tab/category area if present
    for (const s of ['button:has-text("Professional")', '[role="tab"]:has-text("Professional")']) {
      const t = page.locator(s).first();
      if (await t.count()) await t.click({ timeout: 1200 }).catch(() => {});
    }

    // Open likely category first when known
    const wantedNorm = norm(serviceName);
    for (const [k, cat] of Object.entries(CATEGORY_HINTS)) {
      if (wantedNorm.includes(k) || k.includes(wantedNorm)) {
        const catBtn = page.locator(`text=${cat}`).first();
        if (await catBtn.count()) await catBtn.click({ timeout: 2000, force: true }).catch(() => {});
        break;
      }
    }

    // 1) Try exact text match first (visible candidates only)
    let clicked = false;
    const serviceCandidates = page.locator(`text=${serviceName}`);
    const exactCount = await serviceCandidates.count();
    for (let i = 0; i < Math.min(exactCount, 8); i++) {
      const candidate = serviceCandidates.nth(i);
      if (await candidate.isVisible().catch(() => false)) {
        await candidate.click({ timeout: 7000, force: true });
        clicked = true;
        break;
      }
    }

    // 2) Fallback: fuzzy service name contains matching words
    if (!clicked) {
      const wanted = norm(serviceName);
      const candidates = await page.locator('span,div,h3,h4,button,[role="button"]').allTextContents();
      const best = candidates
        .map((t) => t.trim())
        .filter(Boolean)
        .find((t) => {
          const nt = norm(t);
          return nt.includes(wanted) || wanted.includes(nt) || wanted.split(' ').every(w => nt.includes(w));
        });
      if (best) {
        const fuzzyCandidates = page.locator(`text=${best}`);
        const fuzzyCount = await fuzzyCandidates.count();
        for (let i = 0; i < Math.min(fuzzyCount, 12); i++) {
          const fuzzy = fuzzyCandidates.nth(i);
          if (await fuzzy.isVisible().catch(() => false)) {
            await fuzzy.click({ timeout: 7000, force: true });
            clicked = true;
            break;
          }
        }
      }
    }

    // 2b) Last-resort fuzzy click: find visible button-like element containing all words
    if (!clicked) {
      const wantedWords = norm(serviceName).split(' ').filter(Boolean);
      const buttonish = page.locator('button,[role="button"],a,div,span');
      const count = await buttonish.count();
      for (let i = 0; i < Math.min(count, 200); i++) {
        const el = buttonish.nth(i);
        const txt = norm(await el.textContent().catch(() => ''));
        if (!txt) continue;
        if (wantedWords.every(w => txt.includes(w)) && await el.isVisible().catch(() => false)) {
          await el.click({ timeout: 4000, force: true }).catch(() => {});
          clicked = true;
          break;
        }
      }
    }

    if (!clicked) {
      // Last fallback: click through known categories and retry exact match
      for (const cat of ['Lash and Brow Lamination', 'Eyelash Extensions', 'Microblading / Permanent Make-Up', 'Aesthetics / Facials']) {
        const catBtn = page.locator(`text=${cat}`).first();
        if (await catBtn.count()) await catBtn.click({ timeout: 1800, force: true }).catch(() => {});
        const retry = page.locator(`text=${serviceName}`);
        const retryCount = await retry.count();
        for (let i = 0; i < Math.min(retryCount, 8); i++) {
          const r = retry.nth(i);
          if (await r.isVisible().catch(() => false)) {
            await r.click({ timeout: 5000, force: true });
            clicked = true;
            break;
          }
        }
        if (clicked) break;
      }
    }

    if (!clicked) throw new Error(`Service not found on page: ${serviceName}`);

    // Some flows require an extra continue/next click to reach slots
    for (const s of ['button:has-text("Next")', 'button:has-text("Continue")', 'button:has-text("Book")']) {
      const b = page.locator(s).first();
      if (await b.count()) {
        await b.click({ timeout: 1200 }).catch(() => {});
      }
    }

    // If a date rail exists, click the first available date
    for (const s of ['button[aria-label*="day" i]', 'button:has-text("Today")', '[role="tab"]']) {
      const d = page.locator(s).first();
      if (await d.count()) {
        await d.click({ timeout: 1200 }).catch(() => {});
        break;
      }
    }

    await page.waitForTimeout(1800);

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
