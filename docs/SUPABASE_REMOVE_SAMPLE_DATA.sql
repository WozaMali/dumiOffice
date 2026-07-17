-- Remove demo/sample rows seeded by older unified-schema installs.
-- Safe to re-run. Does not touch real storefront collections (mens/womens/etc).

-- Sample inventory products
delete from public.products
where sku in (
  'DE-OR50', 'DE-OR100', 'DE-RN100', 'DE-AVS', 'DE-JD30',
  'DE-MI50', 'DE-VS30', 'DE-OR-RD', 'DE-RN-RD', 'DE-OR-CAR'
);

-- Sample CRM clients (+ addresses via ON DELETE CASCADE if configured)
delete from public.addresses
where customer_id in (
  'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d',
  'b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e',
  'c3d4e5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f'
);

delete from public.customers
where customer_email in (
  'amara@example.com',
  'lindiwe@example.com',
  'thabo@example.com'
)
or id in (
  'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d',
  'b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e',
  'c3d4e5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f'
);

-- Demo collections from unified schema (not storefront shop cards)
delete from public.collections
where slug in ('winter-stories', 'summer-breeze', 'gift-sets');
