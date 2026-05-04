# Storefront: SQL setup and how to read loyalty

This guide is for anyone building the **front-facing shop** (React + Supabase anon key). It explains **which SQL to run**, **how data connects**, and **how the app should query** points safely.

---

## 1. What lives where

| Concept | Table | Notes |
|--------|--------|--------|
| Signed-in shopper profile | `store_clients` | Tied to `auth.users` via `auth_user_id`. |
| Office CRM client | `customers` | Used by the office app; holds **`loyalty_points`** balance. |
| History of point changes | `loyalty_point_transactions` | Ledger rows (delta, balance_after, reason, `order_id`, `reference`). |
| Storefront checkout orders | `store_orders` | Optional; can drive automatic loyalty if you add triggers (see below). |
| Office orders | `orders` | Office app awards points when a paid order is marked **Delivered** (see `Orders.tsx` + `loyaltyPoints.ts`). |

**Rule in code and SQL:** **R2.00 spent → 1 point** → `floor(amount_zar / 2)` (see `loyalty_points_for_spend_zar` in `docs/SUPABASE_LOYALTY_POINTS.sql`).

---

## 2. SQL files in this repo (minimal path)

Run these in the **Supabase SQL Editor** when you only use what’s checked into this repository:

1. **`docs/SUPABASE_STOREFRONT_AUTH_CHECKOUT.sql`**  
   Creates `store_clients`, addresses, preferences, `store_orders` / `store_order_items`, and RLS for those tables.

2. **`docs/SUPABASE_LOYALTY_POINTS.sql`**  
   Adds `customers.loyalty_points`, `loyalty_point_transactions`, `loyalty_points_for_spend_zar`, `loyalty_apply_points`, and basic RLS on the **ledger** (office roles can read).

**Gap (important):**  
That minimal path does **not** add `customers.auth_user_id` or a link from `store_clients` → `customers`. So a storefront user does **not** automatically have a row the app can use to read `loyalty_points` unless you also match or link them (e.g. shared consolidated script with `customer_id` on `store_clients` + trigger, or manual office workflow).

---

## 3. “Full” setup (storefront + office loyalty aligned)

If you use a **single consolidated SQL** (the one you pasted with `store_office_staff`, `customers.auth_user_id`, `store_clients.customer_id`, and `apply_loyalty_on_store_order_office`):

- Run it **after** base tables exist: `customers`, `store_clients`, `store_orders`, etc.
- Follow the **comment order** in that file (e.g. `store_office_staff` before policies that reference it).
- **Grants:** that script often sets `loyalty_apply_points` to **service_role only**. The **office browser app** in this repo calls `loyalty_apply_points` as **authenticated** staff; if you revoke that, either:
  - **Re-grant** `execute` on `loyalty_apply_points` to `authenticated`, **or**
  - Remove client RPC calls and award only via **Edge Function / DB trigger** with service role.

- **`customers` RLS:** if you enable RLS on `customers`, you must add policies so **office staff** can still `insert` / `update` / `delete` clients from the office app, not only `select`.

- **Column names:** this repo’s TypeScript uses **`customer_email`**, **`customer_name`**, etc. If your trigger inserts into `customers (email, …)`, align the column names with your real `customers` table or the insert will fail.

---

## 4. How the storefront should **read** loyalty (frontend)

### A) Customer linked to the same auth user (`customers.auth_user_id`)

If your database has `customers.auth_user_id` and an RLS policy like “user can select their own customer row”:

```ts
const { data: { user } } = await supabase.auth.getUser();
if (!user) return;

const { data, error } = await supabase
  .from("customers")
  .select("id, loyalty_points, customer_name")
  .eq("auth_user_id", user.id)
  .maybeSingle();

// data?.loyalty_points
```

### B) Link via `store_clients.customer_id`

If `store_clients` has `customer_id` populated (trigger or backfill):

```ts
const { data: { user } } = await supabase.auth.getUser();
if (!user) return;

const { data: sc } = await supabase
  .from("store_clients")
  .select("customer_id")
  .eq("auth_user_id", user.id)
  .maybeSingle();

if (!sc?.customer_id) return;

const { data: cust } = await supabase
  .from("customers")
  .select("loyalty_points")
  .eq("id", sc.customer_id)
  .maybeSingle();
```

### C) Read transaction history (if RLS allows)

```ts
const { data: rows } = await supabase
  .from("loyalty_point_transactions")
  .select("*")
  .eq("customer_id", customerId)
  .order("created_at", { ascending: false });
```

If the query returns **empty** or **RLS error**, the JWT user is not allowed to read that table; fix policies (e.g. “customer sees rows where `customer_id` matches their linked `customers.id`”).

---

## 5. How points get **earned** (two channels)

1. **Office `orders`**  
   This repo: when staff marks a **paid** order **Delivered**, the app calls `loyalty_apply_points` with reference `earn:order:<office_order_id>` (see `src/lib/api/loyaltyPoints.ts` + `Orders.tsx`).

2. **Storefront `store_orders`**  
   Only if you deploy SQL that runs `loyalty_apply_points` on insert/update of `store_orders` (e.g. your trigger). Use a **distinct** `reference` pattern (e.g. `earn:store_order:<uuid>`) so it does not collide with office order IDs.

---

## 6. Environment

- Storefront uses the same **`VITE_SUPABASE_URL`** and **`VITE_SUPABASE_ANON_KEY`** as documented in your project setup.
- Never put the **service_role** key in the storefront bundle.

---

## 7. Quick checklist for storefront devs

- [ ] Run storefront + loyalty SQL (or your consolidated script).
- [ ] Confirm `customers` ↔ shopper link (`auth_user_id` and/or `store_clients.customer_id`).
- [ ] Confirm RLS allows the signed-in user to **select** their balance (and history if you show it).
- [ ] Confirm `loyalty_apply_points` is callable from where you award points (browser RPC vs Edge Function vs trigger only).
- [ ] Display copy: **R2.00 = 1 point** (same as office).

For Google OAuth and redirect URLs, see **`docs/GOOGLE_AUTH_SETUP.md`**.
