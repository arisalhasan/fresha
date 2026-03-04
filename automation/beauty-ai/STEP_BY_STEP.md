# Step-by-step: go live after scaffolding

## 1) Install dependencies
```bash
cd ~/.openclaw/workspace/automation/beauty-ai
npm install
npx playwright install chromium
```

## 2) Configure environment
```bash
cp .env.example .env
```
Edit `.env` and set:
- `API_KEY` to a strong random secret
- keep `FRESHA_URL` as your aunt's booking link (or update later)

## 3) Start local API
```bash
set -a; source .env; set +a
npm start
```
Server should show:
`Beauty AI server listening on port 3000`

## 4) Test health and availability
In another terminal:
```bash
curl "http://localhost:3000/health"
```

Then test a real service name exactly as shown on Fresha (example):
```bash
curl -H "x-api-key: YOUR_API_KEY" "http://localhost:3000/availability?service=Eyelash%20Extensions"
```

If service text doesn't match exactly, it won't find results. Test multiple service names and keep a list.

## 5) Deploy this API (one of these)
- Railway
- Render
- VPS (PM2 + Nginx)

Minimum production settings:
- `API_KEY` enabled
- HTTPS endpoint
- process auto-restart

## 6) Connect to n8n
In `n8n-workflow-outline.json`:
- Set `Availability Lookup (Playwright API)` URL to your deployed endpoint:
  `https://YOUR_DOMAIN/availability`
- Add query param `service` from call transcript
- Add header `x-api-key` = your API key

## 7) Connect Twilio voice flow
Twilio incoming call should capture:
- caller number
- requested treatment
- preferred date/time

Then POST this into n8n webhook.

n8n should:
1. normalize service string
2. call `/availability`
3. return top 2-3 slots
4. send SMS/WhatsApp booking link
5. on failure, push callback task

## 8) Create fallback callback queue
Use Google Sheets/Airtable with columns:
- timestamp
- caller
- requested_service
- preferred_time
- status (pending/called/booked)

## 9) Test before launch (must pass)
- valid service + slots
- valid service + no slots
- invalid service
- Fresha timeout/error
- caller asks for human
- out-of-hours call

## 10) Go live safely
- start with business hours only
- monitor logs daily for 1 week
- keep human handoff option always available

---

## Notes
- Fresha UI can change; selectors may need updates.
- Keep this as an assistant flow first, not hard auto-booking, unless integration terms/behavior are fully validated.
