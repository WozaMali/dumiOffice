-- Update personalisation fonts to house brand typefaces.
-- Run in Supabase SQL Editor (safe to re-run).

insert into public.personalisation_fonts (code, label, font_family, sort_order, is_active)
values
  ('hiragenda', 'Hiragenda', '"Hiragenda", sans-serif', 0, true),
  ('ocean-trace', 'Ocean Trace-Personal', '"Ocean Trace-Personal", cursive', 1, true),
  ('chillax', 'Chillax Family', '"Chillax", "Chillax Family", sans-serif', 2, true)
on conflict (code) do update set
  label = excluded.label,
  font_family = excluded.font_family,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active,
  updated_at = now();

update public.personalisation_fonts
set is_active = false, updated_at = now()
where code in ('classic-serif', 'modern-sans', 'elegant-script', 'bold-caps');
