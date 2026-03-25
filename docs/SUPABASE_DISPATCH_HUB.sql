-- Optional Dispatch Hub schema extensions
-- This is NOT required for current UI functionality.
-- Apply when you want persistent dispatch audit trails and editable email templates.

create table if not exists dispatch_events (
  id uuid primary key default gen_random_uuid(),
  order_id text not null references orders(id) on delete cascade,
  event_type text not null check (event_type in (
    'shipment_saved',
    'marked_shipped',
    'email_sent',
    'email_draft_opened'
  )),
  payload jsonb not null default '{}'::jsonb,
  created_by text,
  created_at timestamptz not null default now()
);

create index if not exists idx_dispatch_events_order_id
  on dispatch_events(order_id);

create index if not exists idx_dispatch_events_created_at
  on dispatch_events(created_at desc);

create table if not exists notification_templates (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  subject text not null,
  body text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into notification_templates (code, subject, body)
values (
  'shipment_update_default',
  'Your Dumi Essence order is on the way ({reference})',
  'Hi {customer_name},

Your order has been prepared and handed over for delivery.

Order reference: {reference}
Courier: {courier}
Tracking number: {tracking_number}
Tracking link: {tracking_url}

If you need any support, simply reply and our team will assist.

Warm regards,
Dumi Essence'
)
on conflict (code) do nothing;
