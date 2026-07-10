# Office app — Client Notes (home testimonials)

Manage storefront **Index → Client Notes** testimonials from **Office → Content → Client Notes**.

---

## Setup (once)

Run **`docs/SUPABASE_HOME_CLIENT_NOTES.sql`** in Supabase SQL Editor.

Expected result: `testimonial_count = 3` (seed rows).

---

## What Office controls

| Item | Storage | Office UI |
|------|---------|-----------|
| Section kicker | `home_hero_slides.code = 'client-notes'` | Kicker field |
| Section headline | same row | Headline field |
| Testimonial cards | `home_client_notes` | Add / edit / hide / delete |

No separate settings table — section copy reuses the hero-slides pattern (like Personalisation card).

---

## Table: `home_client_notes`

| Column | Notes |
|--------|-------|
| `client_name` | e.g. `Nolwazi M.` |
| `location` | e.g. `Johannesburg` |
| `quote` | Full testimonial text |
| `rating` | 0–5 (default 5.0) |
| `sort_order` | Lower = earlier in carousel/grid |
| `is_active` | Hidden when false |

**RLS:** anon/authenticated read active rows; authenticated office users full CRUD.

---

## Office implementation (this repo)

- **API:** `src/lib/api/homeClientNotes.ts`
- **Types:** `HomeClientNote` in `src/types/database.ts`
- **UI:** `src/pages/Content.tsx` — Client Notes section (between Bundle specials and Home bestsellers)
- **Hero preset:** `client-notes` auto-seeded via `HERO_PRESETS` on Content load
- **Storefront read API:** `src/lib/api/storefront/homeClientNotes.ts` (copy to main app)

---

## Main app handoff

See **`docs/STOREFRONT_CLIENT_NOTES.md`** for wiring the home page section in the storefront repo.

Replace hardcoded fallback testimonials with:

```ts
import { storefrontClientNotesApi } from "@/lib/api/storefront/homeClientNotes";

const [header, testimonials] = await Promise.all([
  storefrontClientNotesApi.getSectionHeader(),
  storefrontClientNotesApi.listActiveTestimonials(),
]);
```

Render `header?.kicker`, `header?.headline`, then map `testimonials` to cards.

---

## Cursor prompt (main storefront app)

Paste into the **storefront** repo if Client Notes is not wired yet:

```
Wire the home page "Client Notes" section to Supabase instead of hardcoded testimonials.

Context:
- Table: home_client_notes (client_name, location, quote, rating, is_active, sort_order)
- Section header: home_hero_slides where code = 'client-notes' (kicker + headline only)
- SQL already run in Supabase; see docs/SUPABASE_HOME_CLIENT_NOTES.sql in Office repo

Tasks:
1. Add HomeClientNote type and storefrontClientNotesApi (list active testimonials + get section header)
2. On Index/home, fetch header + testimonials; keep existing card layout/styles
3. Fall back to current hardcoded copy only if fetch fails or returns empty
4. Show rating as stars (0–5, one decimal)
5. Respect sort_order; only show is_active = true rows

Reference Office repo files:
- src/lib/api/storefront/homeClientNotes.ts
- docs/STOREFRONT_CLIENT_NOTES.md
```
