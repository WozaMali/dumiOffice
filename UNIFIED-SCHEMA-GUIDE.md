# Unified Database Schema Guide

## Overview

This unified schema is designed to be shared between **two applications**:

1. **Office App** (Admin) - Order management, inventory, fulfilment, reporting
2. **Main App** (Customer-facing) - Product browsing, shopping cart, checkout, order tracking

Both apps connect to the **same Supabase database** using the same schema, ensuring data consistency and real-time synchronization.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Supabase Database                        │
│                  (Unified Schema)                           │
└─────────────────────────────────────────────────────────────┘
                    ▲                    ▲
                    │                    │
        ┌───────────┴──────────┐    ┌───┴──────────────┐
        │    Office App        │    │   Main App       │
        │    (Admin)           │    │   (Customer)     │
        │                      │    │                  │
        │  - Order mgmt        │    │  - Browse        │
        │  - Inventory         │    │  - Cart          │
        │  - Fulfilment        │    │  - Checkout      │
        │  - Reporting         │    │  - Track orders  │
        └──────────────────────┘    └──────────────────┘
```

---

## Key Design Decisions

### 1. Order ID Format
- **Type**: `TEXT` (not UUID)
- **Format**: `DE-1050`, `DE-1051`, etc.
- **Reason**: Human-readable, sequential, easier for customer service
- **Trade-off**: Can't use foreign key constraints (TEXT vs UUID incompatibility)
- **Solution**: Use indexes on `order_id` columns for performance

### 2. Shared Tables
All tables are shared between both apps, with access controlled by:
- Row-Level Security (RLS) policies
- User roles (admin, customer, warehouse, customer_service)
- Supabase Auth integration

### 3. Data Visibility
- **Products**: Public read (Main App), admin write (Office)
- **Orders**: Customers see their own, admins see all
- **Customers**: Admins see all, customers see only their own data
- **Inventory**: Admin only (Office)
- **Incidents**: Admin only (Office)

---

## Table Breakdown by Application

### Tables Used by BOTH Apps

#### **products**
- **Office**: Manage inventory, add products, update stock, pricing
- **Main App**: Browse catalog, view product details, check availability

#### **orders**
- **Office**: Manage fulfilment, update status, track shipments
- **Main App**: View order history, track delivery, request returns

#### **order_items**
- **Office**: Pick and pack items, verify quantities
- **Main App**: View order details, product breakdown

#### **customers**
- **Office**: View customer profiles, lifetime value, order history
- **Main App**: Manage account, view profile, update preferences

#### **addresses**
- **Office**: View delivery addresses for fulfilment
- **Main App**: Manage saved addresses, select delivery address

#### **order_status_history**
- **Office**: Record status changes, audit trail
- **Main App**: Track order progress, view timeline

---

### Tables Used PRIMARILY by Office App

#### **incidents**
Quality and fulfilment issues, customer complaints, courier delays

#### **activity_log**
Global audit trail for all system actions

#### **discount_codes**
Create and manage promo codes (Main App uses them at checkout)

---

### Tables Used PRIMARILY by Main App

#### **carts** & **cart_items**
Shopping cart functionality for customers

#### **reviews**
Product reviews from customers (Office can moderate)

#### **wishlists** & **wishlist_items**
Customer wishlists and saved items

#### **notifications**
In-app notifications for customers

#### **collections** & **collection_products**
Product collections (Winter Stories, Gift Sets, etc.)

---

## Row-Level Security (RLS) Strategy

### Current State (Testing)
All policies are **permissive** (allow all operations) for initial testing.

### Production Strategy

#### Products
```sql
-- Public can read active products
CREATE POLICY "Public read active products" ON products
  FOR SELECT USING (is_active = true);

-- Admins can manage all products
CREATE POLICY "Admins manage products" ON products
  FOR ALL USING (
    auth.jwt() ->> 'role' = 'admin'
  );
```

#### Orders
```sql
-- Customers see their own orders
CREATE POLICY "Customers view own orders" ON orders
  FOR SELECT USING (
    customer_id = (
      SELECT customer_id FROM profiles 
      WHERE id = auth.uid()
    )
  );

-- Admins see all orders
CREATE POLICY "Admins view all orders" ON orders
  FOR SELECT USING (
    auth.jwt() ->> 'role' IN ('admin', 'warehouse', 'customer_service')
  );
```

#### Customers
```sql
-- Customers can update their own profile
CREATE POLICY "Customers update own profile" ON customers
  FOR UPDATE USING (
    id = (
      SELECT customer_id FROM profiles 
      WHERE id = auth.uid()
    )
  );

-- Admins can view all customers
CREATE POLICY "Admins view all customers" ON customers
  FOR SELECT USING (
    auth.jwt() ->> 'role' IN ('admin', 'customer_service')
  );
```

---

## Authentication Flow

### Office App (Admin)
1. Staff logs in with Supabase Auth
2. `profiles` table links to `auth.users`
3. Role is set to `admin`, `warehouse`, or `customer_service`
4. RLS policies grant access based on role

### Main App (Customer)
1. Customer signs up / logs in with Supabase Auth
2. `profiles` table created with role = `customer`
3. `customer_id` links to `customers` table
4. RLS policies grant access to own data only

---

## Data Flow Examples

### Example 1: Customer Places Order (Main App)

1. **Customer browses products**
   - Query: `SELECT * FROM products WHERE is_active = true`
   - RLS: Public read policy allows access

2. **Customer adds to cart**
   - Insert: `carts` and `cart_items` tables
   - RLS: Customer can manage own cart

3. **Customer checks out**
   - Insert: `orders` table with `channel = 'Main App'`
   - Insert: `order_items` table (one row per product)
   - Update: `customers` table (increment total_orders, update lifetime_value)
   - Insert: `order_status_history` (initial status)
   - Delete: `cart` and `cart_items` (cart converted to order)

4. **Customer views order**
   - Query: `SELECT * FROM orders WHERE customer_id = ?`
   - RLS: Customer can only see own orders

### Example 2: Office Staff Fulfils Order

1. **Staff views orders**
   - Query: `SELECT * FROM orders WHERE stage = 'Scheduled'`
   - RLS: Admin role grants access to all orders

2. **Staff starts picking**
   - Update: `orders` SET `stage = 'In Progress'`
   - Insert: `order_status_history` (status change recorded)

3. **Staff marks as shipped**
   - Update: `orders` SET `status = 'Shipped'`, `shipped_at = NOW()`
   - Update: Add `tracking_number` and `courier`
   - Insert: `order_status_history`

4. **Customer sees update in Main App**
   - Query: `SELECT * FROM orders WHERE id = ?`
   - Query: `SELECT * FROM order_status_history WHERE order_id = ?`
   - Real-time subscription updates UI automatically

---

## Real-Time Synchronization

Both apps can use Supabase real-time subscriptions:

### Office App
```typescript
// Listen for new orders
supabase
  .channel('orders')
  .on('postgres_changes', 
    { event: 'INSERT', schema: 'public', table: 'orders' },
    (payload) => {
      // New order received! Play sound, show notification
      console.log('New order:', payload.new);
    }
  )
  .subscribe();
```

### Main App
```typescript
// Listen for order status changes
supabase
  .channel(`order:${orderId}`)
  .on('postgres_changes',
    { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` },
    (payload) => {
      // Order status updated! Show notification
      console.log('Order updated:', payload.new);
    }
  )
  .subscribe();
```

---

## Migration from Separate Schemas

If you already have data in separate databases:

### Step 1: Export Data
```bash
# From Office App database
pg_dump -t orders -t order_items -t products > office_data.sql

# From Main App database
pg_dump -t customers -t carts -t reviews > main_data.sql
```

### Step 2: Run Unified Schema
```sql
-- Run supabase-schema-unified.sql in new database
```

### Step 3: Import Data
```bash
# Import with conflict resolution
psql -d new_database -f office_data.sql
psql -d new_database -f main_data.sql
```

### Step 4: Update Connection Strings
```env
# Office App .env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Main App .env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

---

## Environment Variables

### Office App
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### Main App
```env
# Next.js example
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Or React/Vite
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

**Both apps use the SAME Supabase project!**

---

## API Structure

### Shared API Functions

Both apps can use the same API functions:

```typescript
// src/lib/api/products.ts (shared)
export const productsApi = {
  async list() {
    const { data } = await supabase
      .from('products')
      .select('*')
      .eq('is_active', true);
    return data;
  },
  
  async getById(id: string) {
    const { data } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .single();
    return data;
  }
};
```

### Office-Specific API Functions

```typescript
// src/lib/api/inventory.ts (Office only)
export const inventoryApi = {
  async updateStock(productId: string, quantity: number) {
    const { data } = await supabase
      .from('products')
      .update({ stock_on_hand: quantity })
      .eq('id', productId);
    return data;
  }
};
```

### Main App-Specific API Functions

```typescript
// src/lib/api/cart.ts (Main App only)
export const cartApi = {
  async addItem(productId: string, quantity: number) {
    // Get or create cart
    let cart = await getActiveCart();
    if (!cart) {
      cart = await createCart();
    }
    
    // Add item
    const { data } = await supabase
      .from('cart_items')
      .insert({
        cart_id: cart.id,
        product_id: productId,
        quantity
      });
    return data;
  }
};
```

---

## Testing Strategy

### 1. Test Office App
- Create order in Office App
- Verify order appears in `orders` table
- Update order status
- Verify `order_status_history` records changes

### 2. Test Main App
- Browse products (should see same products as Office)
- Add to cart
- Checkout (creates order)
- View order history

### 3. Test Synchronization
- Create order in Main App
- Verify it appears in Office App immediately
- Update status in Office App
- Verify customer sees update in Main App

---

## Security Checklist

Before going to production:

- [ ] Implement Supabase Auth in both apps
- [ ] Create `profiles` table entries for all users
- [ ] Update RLS policies to check `auth.uid()` and roles
- [ ] Test that customers can only see their own data
- [ ] Test that admins can see all data
- [ ] Enable email verification for customer signups
- [ ] Set up password reset flow
- [ ] Add rate limiting on API endpoints
- [ ] Validate all inputs on both client and server
- [ ] Use HTTPS only in production
- [ ] Enable Supabase database backups
- [ ] Set up monitoring and alerts

---

## Performance Optimization

### Indexes
All critical indexes are included in the schema:
- `orders(customer_id, date, status, channel)`
- `order_items(order_id, product_id)`
- `products(sku, slug, category)`
- `customers(email, phone)`

### Caching Strategy
- **Office App**: Use React Query with 5-minute cache
- **Main App**: Use React Query with 1-minute cache for products
- **Both**: Real-time subscriptions for order updates

### Pagination
For large datasets, implement pagination:
```typescript
const { data, count } = await supabase
  .from('orders')
  .select('*', { count: 'exact' })
  .range(0, 49) // First 50 orders
  .order('date', { ascending: false });
```

---

## Deployment Steps

### 1. Create Supabase Project
1. Go to https://supabase.com
2. Create new project
3. Note the project URL and anon key

### 2. Run Unified Schema
1. Open Supabase SQL Editor
2. Copy contents of `supabase-schema-unified.sql`
3. Paste and run

### 3. Verify Tables
1. Go to Table Editor
2. Verify all 25 tables created
3. Check sample data exists

### 4. Update Office App
1. Update `.env` with Supabase credentials
2. Restart dev server
3. Test order creation and management

### 5. Update Main App
1. Update `.env` with SAME Supabase credentials
2. Install Supabase client: `npm install @supabase/supabase-js`
3. Create Supabase client instance
4. Test product browsing and cart

### 6. Test Integration
1. Create order in Main App
2. Verify it appears in Office App
3. Update status in Office App
4. Verify customer sees update in Main App

---

## Troubleshooting

### Orders not syncing between apps
- Verify both apps use the same Supabase project URL
- Check RLS policies aren't blocking access
- Verify real-time subscriptions are set up correctly

### Customer can see other customers' orders
- RLS policies not properly configured
- Update policies to check `customer_id`

### Products not appearing in Main App
- Check `is_active = true` filter
- Verify `published_at` is set
- Check RLS policies

### Office App can't update orders
- Verify user role is set to `admin` in `profiles` table
- Check RLS policies grant admin access

---

## Next Steps

1. **Implement Authentication**
   - Set up Supabase Auth in both apps
   - Create login/signup flows
   - Link users to `profiles` and `customers` tables

2. **Tighten Security**
   - Update RLS policies for production
   - Add role-based access control
   - Enable email verification

3. **Add Features**
   - Real-time order notifications
   - Email confirmations
   - SMS delivery alerts
   - Customer reviews
   - Loyalty program

4. **Optimize Performance**
   - Add pagination
   - Implement caching
   - Monitor slow queries
   - Add database indexes as needed

---

## Summary

This unified schema provides:

✅ **Single source of truth** - One database for both apps
✅ **Real-time sync** - Changes appear instantly in both apps
✅ **Scalable** - Supports growth from startup to enterprise
✅ **Secure** - RLS policies protect customer data
✅ **Flexible** - Easy to add new features and tables
✅ **Cost-effective** - One Supabase project, not two

Both your Office App and Main App are now connected to the same database, ensuring data consistency and enabling powerful features like real-time order tracking and inventory synchronization.
