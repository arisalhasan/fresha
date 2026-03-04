# Aphrodite Beauty – Automated Phone Booking Workflow (Option B: Browser Automation)

## Goal
When a customer calls:
1. AI answers the call.
2. Captures treatment + preferred day/time.
3. Checks Fresha booking page for available slots via Playwright.
4. Reads back available times and service price.
5. Sends booking confirmation link by SMS/WhatsApp.
6. If anything fails, creates callback task for staff.

---

## Architecture
- **Twilio Voice**: inbound calls + voice webhooks
- **Twilio Studio / Voice webhook**: collect caller intent
- **n8n**: orchestration and business rules
- **Playwright service (Node.js)**: scrape Fresha availability
- **Google Sheets / Airtable / Postgres**: logs, service mapping, fallback queue
- **Twilio SMS / WhatsApp**: follow-up confirmations

---

## Core Workflow

### A) Inbound Call (Twilio)
1. Incoming call triggers webhook (`/voice/incoming`).
2. AI greeting:
   - asks treatment
   - asks preferred date window
   - optional asks budget/time of day
3. Webhook posts payload to n8n.

### B) Orchestration (n8n)
1. Validate treatment against allowed service map.
2. Call Playwright endpoint:
   - `GET /availability?service=<id>&dateFrom=<YYYY-MM-DD>&days=14`
3. Receive top available slots + displayed service price.
4. If slots found:
   - pick 2-3 best options
   - respond to caller in voice
5. If caller confirms slot:
   - send booking link SMS/WhatsApp with direct service URL
   - optionally hold/flag pending in internal sheet
6. If no slots or scrape error:
   - ask alternate dates
   - if still none -> create callback ticket

### C) After Call
- Send summary to staff (WhatsApp/email):
  - caller number
  - requested service
  - preferred times
  - slots offered
  - outcome (booked / pending / callback)

---

## Reliability Rules (must-have)
1. **Timeouts**: Playwright hard timeout 20s.
2. **Retries**: max 2 retries with jitter.
3. **Fallback**: if automation fails, never block caller; offer callback.
4. **Change detection**: alert if selector fails 3 times (UI changed).
5. **Logging**: every lookup request + result + duration.

---

## Compliance / Safety
- Check Fresha terms before production scraping.
- Never store full card data.
- Keep only minimal PII (phone + booking intent).
- Add consent line for SMS/WhatsApp follow-up.

---

## Deployment Checklist
- [ ] Twilio number bought and voice webhook connected
- [ ] n8n webhook public URL secured with secret/token
- [ ] Playwright service deployed (Railway/Render/VPS)
- [ ] Service map created (friendly name -> Fresha selector key)
- [ ] Fallback callback queue configured
- [ ] Test scripts (10 call scenarios) passed

---

## Suggested Call Script (short)
"Hi, thanks for calling Aphrodite Beauty. I can help with availability and booking. Which treatment would you like?"

"Great choice. I can see [DAY TIME], [DAY TIME], or [DAY TIME]. Which one works best for you?"

"Perfect — I’ve sent your booking details by text now. If you need changes, just reply to that message."

---

## Files in this folder
- `playwright-fresha-checker.js` – slot lookup worker
- `n8n-workflow-outline.json` – import-ready starter workflow structure
