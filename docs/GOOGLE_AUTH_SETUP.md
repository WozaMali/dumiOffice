# Google Sign-In Setup (Supabase)

Use these steps to enable Google sign-in for both storefront checkout auth and office login.

## 1) Enable Google provider in Supabase

1. Open Supabase Dashboard -> Authentication -> Providers -> Google.
2. Enable the provider.
3. Add your Google OAuth Client ID and Client Secret.

## 2) Configure Google OAuth redirect URL

In Google Cloud Console, add the Supabase callback URL as an authorized redirect URI:

`https://<your-project-ref>.supabase.co/auth/v1/callback`

You can copy this directly from the Supabase Google provider panel.

## 3) Configure site URLs in Supabase

In Supabase Dashboard -> Authentication -> URL Configuration:

- Site URL:
  - `http://localhost:5173` (or your production domain)
- Additional Redirect URLs:
  - `http://localhost:5173/login`
  - `http://localhost:5173/walk-in`
  - `https://your-production-domain/login`
  - `https://your-production-domain/walk-in`

## 4) Role behavior in this project

- Storefront Google users are treated as customer accounts.
- Office routes require user metadata role:
  - `superadmin`
  - `admin`
  - `manager`

If a Google user does not have an office role, they are blocked from office login.
