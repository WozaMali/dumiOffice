# Dumi Essence Office - Setup Guide

## Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Supabase account

## 1. Database Setup

### Step 1: Run the SQL Schema

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Open the file `supabase-schema.sql` from this project
4. Copy the entire contents
5. Paste into the SQL Editor
6. Click **Run** to execute

This will create all necessary tables:
- `customers` - Customer records with lifetime value tracking
- `addresses` - Customer delivery addresses
- `products` - Product catalog with stock management
- `orders` - Main orders table with full financial tracking
- `order_items` - Line items for each order (multi-product support)
- `order_status_history` - Audit trail for status changes
- `incidents` - Quality and fulfilment issues

### Step 2: Verify Tables

After running the schema, verify in the **Table Editor** that all tables are created with sample data.

## 2. Environment Variables

Your `.env` file should already contain:

```
VITE_SUPABASE_URL=https://clpanszayisgviyyuvwa.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Important:** After running the SQL schema, restart your dev server for Vite to pick up the environment variables.

## 3. Install Dependencies

```bash
npm install
```

This will install:
- `@supabase/supabase-js` - Supabase client
- `@tanstack/react-query` - Data fetching and caching
- All existing dependencies

## 4. Start the Development Server

```bash
npm run dev
```

The app should now be running at `http://localhost:8080`

## 5. Verify the Setup

### Test Orders Page

1. Navigate to `/orders`
2. You should see the orders table load (may be empty initially)
3. Click **Create Order**
4. Fill in customer details
5. Add at least one product (you should see products from the sample data)
6. Submit the order
7. Verify the order appears in the table

### Test Inventory Page

1. Navigate to `/inventory`
2. You should see 10 sample products loaded
3. Click **Add product** to create a new product
4. Click **Edit** on any product to update it

### Test Order Workflow

1. Create a new order (status: Processing, stage: Scheduled)
2. Click **View** on the order
3. Click **Start Picking** - status should change to "In Progress"
4. Click **Mark as Shipped** - status should change to "Shipped"
5. Click **Mark as Delivered** - status should change to "Delivered", stage to "Completed"
6. Check the **Status history** section to see the audit trail

## Features Implemented

### Data Model & Persistence
✅ Full Supabase backend with 7 tables
✅ Orders persist across sessions
✅ Multi-item orders with line items
✅ Financial fields (subtotal, shipping, discount, tax, grand total)
✅ Customer and address management
✅ Product catalog with stock tracking

### Operational Workflow (SOP)
✅ Status transition buttons (Picking → Packed → Shipped → Delivered)
✅ Order status history / audit trail
✅ Payment status tracking (Pending, Paid, Refunded, Failed)
✅ Shipping details (method, courier, tracking number)
✅ Return workflow support

### UX & UI
✅ Bulk selection with checkboxes
✅ Bulk action buttons (placeholder for Mark as In Progress, Export CSV, Print Labels)
✅ Advanced filtering (channel, stage, search)
✅ Empty states with guidance
✅ Loading states for async operations
✅ Error handling with toast notifications
✅ Inline editing for inventory

### Dumi Essence-Specific
✅ Product categories (Perfume, Diffuser, Car Perfume)
✅ Products pulled from database (not hard-coded)
✅ Stock warnings in product selection
✅ System-generated order references (e.g., WEB-20260227-1050)
✅ Customer phone number tracking
✅ Internal and customer notes

### Technical
✅ Full Supabase CRUD operations
✅ React Query for data fetching and caching
✅ Optimistic updates for better UX
✅ TypeScript types for all database entities
✅ Row-level security policies (currently permissive, tighten with auth later)

## Next Steps (Future Enhancements)

### Short-term
- Implement bulk actions (Mark as In Progress, Export CSV, Print Labels)
- Add date range filters
- Saved filter presets
- Stock blocking when creating orders
- Email/phone validation

### Medium-term
- User authentication (Supabase Auth)
- Role-based access control
- Courier tracking integration
- Automated email notifications
- Dashboard analytics from real order data

### Long-term
- Mobile app for warehouse picking
- Barcode scanning
- Integration with payment providers
- Advanced reporting and forecasting
- Multi-warehouse support

## Troubleshooting

### "Supabase environment variables are missing"
- Restart your dev server: Stop (Ctrl+C) and run `npm run dev` again
- Verify `.env` file has no leading spaces on the variable names

### "Failed to load orders/products"
- Check that you ran the `supabase-schema.sql` in your Supabase SQL Editor
- Verify your Supabase URL and anon key are correct in `.env`
- Check the browser console for specific error messages
- Verify Row Level Security policies are set to "Allow all" (for testing)

### Orders not persisting
- Open browser DevTools → Network tab
- Create an order and check for failed POST requests
- Verify the `orders` and `order_items` tables exist in Supabase

### Products not loading in Create Order dialog
- Verify the `products` table has data (run the sample data inserts from the schema)
- Check the browser console for errors

## Support

For issues or questions, check:
1. Browser console for JavaScript errors
2. Supabase dashboard → Logs for database errors
3. Network tab for failed API requests
