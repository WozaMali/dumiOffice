# Storefront Client Notes (home page testimonials)

Testimonial cards on the **home page** Client Notes section, managed in **Office → Content → Client Notes**.

---

## Setup (once)

Run **`docs/SUPABASE_HOME_CLIENT_NOTES.sql`** in Supabase (Office repo). Seeds three launch testimonials and the section header row.

---

## Data sources

| Content | Table | Filter |
|---------|-------|--------|
| Section kicker + headline | `home_hero_slides` | `code = 'client-notes'` and `is_active` |
| Testimonial cards | `home_client_notes` | `is_active = true`, order by `sort_order`, `created_at` |

---

## TypeScript (main app)

Copy or mirror from Office:

```ts
import { storefrontClientNotesApi } from "@/lib/api/storefront/homeClientNotes";

const header = await storefrontClientNotesApi.getSectionHeader();
const testimonials = await storefrontClientNotesApi.listActiveTestimonials();
```

### `HomeClientNote`

```ts
interface HomeClientNote {
  id: string;
  client_name: string;
  location: string;
  quote: string;
  rating: number;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}
```

---

## UI mapping

| Field | Typical UI |
|-------|------------|
| `header.kicker` | Small label above title |
| `header.headline` | Section title |
| `client_name` | Card attribution |
| `location` | Subline / city |
| `quote` | Body copy (quoted) |
| `rating` | Star display (0–5) |

---

## Fallback behaviour

If the API returns no active testimonials, keep existing hardcoded cards as a dev/offline fallback until Office content is live.

---

## Office editing

- **Section copy:** Office → Content → Client Notes → Save section header
- **Cards:** Add / edit / hide (`is_active`) / delete inactive cards

See **`docs/OFFICE_APP_CLIENT_NOTES.md`** in the Office repo.
