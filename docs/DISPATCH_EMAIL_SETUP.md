# Dispatch Email Setup

This enables real shipment update emails from the Dispatch Hub.

## 1) Deploy the edge function

```bash
supabase functions deploy send-shipment-update
```

## 2) Set required secrets

```bash
supabase secrets set RESEND_API_KEY=your_resend_api_key
supabase secrets set SHIPMENT_FROM_EMAIL="Dumi Essence <dispatch@yourdomain.com>"
```

## 3) Behavior in app

- The app calls `send-shipment-update` first.
- If function is unavailable or fails, app automatically falls back to opening a prefilled email draft (`mailto`).

## 4) Recommended domain setup

- Verify your sender domain in Resend.
- Use a branded sender address (example: `dispatch@dumiessence.co.za`).

