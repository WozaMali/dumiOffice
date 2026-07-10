-- Per-category label position on personalisation bottle previews.
-- Run in Supabase SQL Editor (safe to re-run).

alter table public.personalisation_settings
  add column if not exists label_top_pct_mens numeric(5, 2),
  add column if not exists label_left_pct_mens numeric(5, 2),
  add column if not exists label_width_pct_mens numeric(5, 2),
  add column if not exists label_top_pct_womens numeric(5, 2),
  add column if not exists label_left_pct_womens numeric(5, 2),
  add column if not exists label_width_pct_womens numeric(5, 2),
  add column if not exists label_top_pct_unisex numeric(5, 2),
  add column if not exists label_left_pct_unisex numeric(5, 2),
  add column if not exists label_width_pct_unisex numeric(5, 2),
  add column if not exists label_top_pct_diffuser numeric(5, 2),
  add column if not exists label_left_pct_diffuser numeric(5, 2),
  add column if not exists label_width_pct_diffuser numeric(5, 2);

-- Copy legacy single position into each category where not set yet
update public.personalisation_settings
set
  label_top_pct_mens = coalesce(label_top_pct_mens, label_top_pct, 42),
  label_left_pct_mens = coalesce(label_left_pct_mens, label_left_pct, 50),
  label_width_pct_mens = coalesce(label_width_pct_mens, label_width_pct, 72),
  label_top_pct_womens = coalesce(label_top_pct_womens, label_top_pct, 42),
  label_left_pct_womens = coalesce(label_left_pct_womens, label_left_pct, 50),
  label_width_pct_womens = coalesce(label_width_pct_womens, label_width_pct, 72),
  label_top_pct_unisex = coalesce(label_top_pct_unisex, label_top_pct, 42),
  label_left_pct_unisex = coalesce(label_left_pct_unisex, label_left_pct, 50),
  label_width_pct_unisex = coalesce(label_width_pct_unisex, label_width_pct, 72),
  label_top_pct_diffuser = coalesce(label_top_pct_diffuser, label_top_pct, 42),
  label_left_pct_diffuser = coalesce(label_left_pct_diffuser, label_left_pct, 50),
  label_width_pct_diffuser = coalesce(label_width_pct_diffuser, label_width_pct, 72),
  updated_at = now()
where code = 'default';

notify pgrst, 'reload schema';
