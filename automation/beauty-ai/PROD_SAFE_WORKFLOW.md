# Production-Safe Workflow (No Slot Scraping)

This version avoids fragile availability scraping and still delivers strong business value.

## What it does
1. Answers incoming calls (AI receptionist)
2. Captures intent (service + preferred date/time + caller details)
3. Sends instant booking handoff link (Fresha)
4. Creates callback task if caller needs human help
5. Sends follow-up reminders

---

## End-to-end flow

### A) Incoming Call
- Twilio Voice webhook receives call
- AI says:
  - greeting
  - asks treatment
  - asks preferred time/day
  - asks if they want text booking link now

### B) Lead Capture + Routing (n8n)
- Save in Google Sheets/Airtable:
  - timestamp
  - caller number
  - requested treatment
  - preferred date/time
  - urgency
  - status (new / link_sent / callback_required / booked)

### C) Instant Handoff Message (SMS/WhatsApp)
- Message template:
  - thanks for calling
  - direct Fresha booking link
  - short instruction for chosen treatment
  - option to reply for human callback

### D) Callback Queue
- If caller asks for human, create callback task.
- Notify staff (WhatsApp/email):
  - Caller number
  - Requested treatment
  - Preferred time
  - Note

### E) Follow-up automation
- +15 min: "Need help booking?"
- +24h: "Would you like us to call and assist?"
- Stop follow-up when status=booked.

---

## Twilio webhook payload (recommended)
Pass this JSON from Twilio Studio/Function to n8n webhook:

```json
{
  "caller": "+447...",
  "channel": "voice",
  "service": "Brow Lamination",
  "datePref": "Next Tuesday afternoon",
  "wantsHuman": false,
  "notes": "Asked about patch test first"
}
```

---

## Message templates

### 1) Booking Link SMS
"Thanks for calling Aphrodite Beauty 💖 You can book here: https://www.fresha.com/book-now/aphroditebeauty-zdjxrm79/services?lid=1531418&share=true&pId=1454315. If you'd like, reply with your preferred day/time and we’ll help you book."

### 2) Callback Acknowledgement
"Thanks — we’ve asked a team member to call you back shortly to help with your booking."

### 3) Follow-up
"Hi again from Aphrodite Beauty 👋 Did you manage to book your appointment? Reply YES if done, or HELP and we’ll assist."

---

## Why this is best now
- Works reliably today
- No brittle scraping blockers
- Captures missed leads immediately
- Fast to deploy and easy for staff to operate

You can still add true live-availability automation later when a stable integration path is available.
