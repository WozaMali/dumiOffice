-- Remove legacy gift-guide section headers and feature bullets from home_hero_slides.
-- Run once in Supabase SQL Editor, then refresh Office Content → Hero moments.

delete from public.home_hero_slides
where code in (
  -- Perfect Gift bullets (previous cleanup)
  'gift-perfect-presence',
  'gift-perfect-unboxing',
  'gift-perfect-match',
  'gift-perfect-personal',
  'gift-perfect-heart',
  -- Section headers + feature bullets
  'gift-perfect-section',
  'gift-edits-section',
  'gift-guide-feature-presentation',
  'gift-guide-feature-categories',
  'gift-guide-feature-premium'
);

notify pgrst, 'reload schema';

select count(*) as remaining_rows
from public.home_hero_slides
where code in (
  'gift-perfect-presence',
  'gift-perfect-unboxing',
  'gift-perfect-match',
  'gift-perfect-personal',
  'gift-perfect-heart',
  'gift-perfect-section',
  'gift-edits-section',
  'gift-guide-feature-presentation',
  'gift-guide-feature-categories',
  'gift-guide-feature-premium'
);
