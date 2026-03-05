# Order Flow Guide - Dumi Essence Office

## Complete Order Lifecycle

This document outlines the complete journey of an order from creation to delivery, including all status transitions, data captured, and actions available at each stage.

---

## 1. Order Creation

### Entry Points
- **Manual entry**: Staff creates order via "Create Order" button
- **Future**: API integration from Shopify/WooCommerce
- **Future**: Customer portal self-service

### Data Captured

#### Customer Information
- Customer name (required)
- Email address (optional)
- Phone number (required)
- Delivery address (required)

#### Order Details
- Channel (Online Orders, Boutique & Pop-up, Wholesale, Returns)
- Payment status (Pending, Paid, Refunded, Failed)
- Payment method (Card, EFT, Cash, COD)
- Shipping method (Standard, Express, Same-day, Collection)
- Fulfilment location (e.g., "Johannesburg Warehouse")

#### Line Items (Multi-product support)
For each product:
- Product category (Perfume, Diffuser, Car Perfume)
- Specific product (from database)
- Quantity
- Unit price (auto-filled from product)
- Line discount (optional)
- Line total (calculated)

#### Financial Summary
- Subtotal (sum of all line totals)
- Shipping fee
- Order-level discount
- Tax (currently 0, ready for VAT)
- Grand total (calculated)

#### Notes
- Customer notes (e.g., "Gift wrapping", "Call before delivery")
- Internal notes (e.g., "VIP customer", "Fragile items")

### System-Generated Fields
- **Order ID**: Sequential (e.g., DE-1050, DE-1051)
- **Reference**: Channel-Date-ID format
  - Online Orders: `WEB-20260227-1050`
  - Boutique: `BTQ-20260227-1050`
  - Wholesale: `WHO-20260227-1050`
  - Returns: `RET-20260227-1050`
- **Date**: Current date
- **Initial status**: Processing
- **Initial stage**: Scheduled
- **Score**: "-" (updated during quality check)
- **Findings**: "Awaiting picking"

### Database Operations
1. Insert into `orders` table
2. Insert multiple rows into `order_items` table
3. Insert first entry into `order_status_history` table
4. (Future) Update `customers` table (lifetime value, total orders)
5. (Future) Reserve stock in `products` table

---

## 2. Order Stages & Status Flow

### Stage 1: Scheduled
**Status**: Processing  
**Meaning**: Order is confirmed and awaiting warehouse action

**Available Actions**:
- ✅ Start Picking → moves to "In Progress"
- ✅ Cancel Order → moves to "Cancelled" / "Completed"
- ✅ Edit order details (future)
- ✅ View order
- ✅ Print pick list

**What Happens**:
- Order appears in "Scheduled" tab
- Warehouse receives notification (future)
- Stock is reserved (future)

**Staff Workflow**:
1. Review order details
2. Verify stock availability
3. Print pick list
4. Click "Start Picking" when ready

---

### Stage 2: In Progress
**Status**: Processing  
**Meaning**: Order is being picked and packed

**Available Actions**:
- ✅ Mark as Packed → stays "In Progress"
- ✅ Mark as Shipped → moves status to "Shipped"
- ✅ Cancel Order → moves to "Cancelled" / "Completed"
- ✅ Add internal notes (e.g., "Item damaged, replaced")
- ✅ Log incident (future)

**What Happens**:
- Order appears in "In Progress" tab
- Findings updated to "Picking in progress"
- Status history records transition

**Staff Workflow**:
1. Locate items in warehouse
2. Pick items, verify quantities
3. Quality check each item
4. Pack securely with branding materials
5. Update findings if issues found
6. Click "Mark as Packed"
7. Hand over to courier or click "Mark as Shipped"

**Quality Checks**:
- Verify product matches order
- Check for damage
- Ensure correct quantity
- Verify expiry dates (if applicable)
- Add gift wrapping if requested

---

### Stage 3: Shipped
**Status**: Shipped  
**Meaning**: Order has been handed to courier or collected

**Available Actions**:
- ✅ Mark as Delivered → moves to "Delivered" / "Completed"
- ✅ Update tracking number
- ✅ Update courier details
- ✅ Log incident (e.g., "Courier delay")

**What Happens**:
- Order appears in "Shipped" filter
- Customer receives tracking info (future)
- Tracking link available (future)
- `shipped_at` timestamp recorded

**Staff Workflow**:
1. Hand over to courier
2. Capture tracking number
3. Click "Mark as Shipped"
4. (Future) Send tracking email to customer

**Courier Integration** (future):
- The Courier Guy API
- Pargo locker integration
- Aramex tracking
- Real-time tracking updates

---

### Stage 4: Delivered
**Status**: Delivered  
**Stage**: Completed  
**Meaning**: Customer has received the order

**Available Actions**:
- ✅ Mark as Returned → moves to "Returned" / "Completed"
- ✅ View order (read-only)
- ✅ Request review (future)
- ✅ Log incident (e.g., "Customer complaint")

**What Happens**:
- Order appears in "Completed" tab
- `delivered_at` timestamp recorded
- Customer receives delivery confirmation (future)
- Order eligible for review request (future)
- Customer lifetime value updated (future)

**Post-Delivery**:
- Send thank you email (future)
- Request product review (future)
- Offer loyalty points (future)
- Track customer satisfaction

---

### Stage 5: Cancelled
**Status**: Cancelled  
**Stage**: Completed  
**Meaning**: Order was cancelled before delivery

**Reasons for Cancellation**:
- Customer requested cancellation
- Payment failed
- Out of stock
- Fraudulent order
- Customer unreachable

**What Happens**:
- Stock released back to inventory (future)
- Payment refunded if already paid (future)
- Cancellation reason recorded (future)
- Customer notified (future)

---

### Stage 6: Returned
**Status**: Returned  
**Stage**: Completed  
**Meaning**: Order was delivered but returned by customer

**Return Reasons**:
- Customer changed mind
- Wrong item sent
- Item damaged in transit
- Item not as described
- Allergic reaction

**What Happens**:
- Return incident logged
- Refund processed (future)
- Stock returned to inventory (future)
- Quality check on returned items
- Customer refund confirmation (future)

**Return Workflow** (future):
1. Customer requests return
2. Return label generated
3. Item collected or dropped off
4. Quality check on returned item
5. Refund processed
6. Stock updated

---

## 3. Status History & Audit Trail

Every status change is recorded in `order_status_history` table:

```
{
  from_status: "Processing",
  to_status: "Shipped",
  from_stage: "In Progress",
  to_stage: "In Progress",
  changed_by: "Admin",
  notes: "Handed to The Courier Guy",
  created_at: "2026-02-27T14:30:00Z"
}
```

**Visible in UI**:
- View Order dialog → Status history section
- Shows who changed status, when, and why
- Useful for accountability and troubleshooting

---

## 4. Order Views & Filters

### Channel Tabs
- **Online Orders**: Website, mobile app, social media
- **Boutique & Pop-up**: Physical store purchases
- **Wholesale**: Bulk orders from retailers
- **Returns**: Return processing

### Stage Filters
- **All Orders**: Show everything
- **Scheduled**: Orders awaiting picking
- **In Progress**: Currently being processed
- **Completed**: Delivered, cancelled, or returned

### Search
- Order ID (e.g., "DE-1050")
- Reference (e.g., "WEB-20260227-1050")
- Customer name
- Customer email

### Future Filters
- Date range (Today, This week, This month, Custom)
- Payment status (Paid, Pending, Failed)
- Courier (The Courier Guy, Pargo, etc.)
- Product category (Perfume, Diffuser, Car Perfume)
- Location (Johannesburg, Rosebank, etc.)

---

## 5. Bulk Operations

### Current
- Select multiple orders with checkboxes
- "Select all" for current view
- Bulk action buttons (placeholder)

### Planned Bulk Actions
- **Mark as In Progress**: Move scheduled orders to picking
- **Export CSV**: Download order data for reporting
- **Print Labels**: Generate shipping labels
- **Assign Courier**: Set courier for multiple orders
- **Print Pick List**: Consolidated pick list for warehouse
- **Send Tracking**: Email tracking info to customers

---

## 6. Order Details View

### Customer Section
- Name, email, phone
- Delivery address
- Customer type (retail, wholesale, VIP) - future
- Order history - future

### Order Items Section
- Table with: Product, SKU, Qty, Price, Discount, Total
- Visual product images - future
- Stock availability indicator

### Financial Section
- Subtotal
- Shipping fee
- Discount
- Tax
- Grand total
- Payment status and method

### Shipping Section
- Shipping method
- Courier name
- Tracking number (with link) - future
- Pickup scheduled date
- Shipped date
- Delivered date

### Notes Section
- Customer notes (visible to customer)
- Internal notes (staff only)

### Status History Section
- Timeline of all status changes
- Who made the change
- When it happened
- Notes for each change

---

## 7. Notifications (Future)

### Customer Notifications
- **Order Confirmed**: Email with order details and reference
- **Order Shipped**: Email with tracking link
- **Out for Delivery**: SMS notification
- **Delivered**: Email confirmation with review request
- **Delayed**: SMS if courier reports delay

### Staff Notifications
- **New Order**: Alert to warehouse
- **Low Stock**: When order depletes stock below threshold
- **Payment Failed**: Alert to customer service
- **Return Requested**: Alert to returns team
- **Incident Logged**: Alert to quality team

---

## 8. Integration Points (Future)

### E-commerce Platforms
- Shopify webhook → auto-create order
- WooCommerce REST API → sync orders
- Custom checkout → direct API

### Payment Gateways
- PayFast: Verify payment status
- Yoco: Card payments
- SnapScan: QR code payments

### Courier Services
- The Courier Guy: Create waybill, track shipment
- Pargo: Book locker, notify customer
- Aramex: International shipping

### Accounting Software
- Xero: Sync invoices
- QuickBooks: Financial reporting
- Sage: Inventory valuation

### Marketing Tools
- Mailchimp: Email campaigns
- WhatsApp Business: Order updates
- Google Analytics: Track conversions

---

## 9. Reporting & Analytics (Future)

### Order Reports
- Daily order summary
- Weekly fulfilment performance
- Monthly revenue by channel
- Product performance (best sellers)
- Customer lifetime value
- Average order value
- Fulfilment time (order to delivery)

### Operational Metrics
- Orders per day/week/month
- Average picking time
- Packing accuracy rate
- On-time delivery rate
- Return rate by product/category
- Incident rate

### Financial Reports
- Revenue by channel
- Revenue by product category
- Shipping costs vs. revenue
- Discount impact analysis
- Payment method breakdown

---

## 10. Best Practices

### For Warehouse Staff
1. Always verify stock before marking "In Progress"
2. Update findings if any issues found
3. Add internal notes for unusual situations
4. Double-check address before shipping
5. Capture tracking number immediately
6. Log incidents promptly

### For Customer Service
1. Keep customer informed at each stage
2. Respond to queries within 2 hours
3. Proactively notify of delays
4. Handle returns gracefully
5. Update internal notes for context

### For Management
1. Review daily order summary
2. Monitor fulfilment metrics
3. Address incidents promptly
4. Analyze return patterns
5. Optimize based on data

---

## 11. Troubleshooting

### Order Not Appearing
- Check channel filter
- Check stage filter
- Verify order was saved (check toast notification)
- Refresh page
- Check browser console for errors

### Can't Update Status
- Verify order is in correct stage
- Check Supabase connection
- Verify user permissions (future)
- Check browser console for errors

### Missing Order Items
- Verify items were added before saving
- Check `order_items` table in Supabase
- Recreate order if necessary

### Payment Status Not Updating
- Verify payment gateway webhook (future)
- Manually update in View Order dialog
- Check payment provider dashboard

---

## 12. Quick Reference

### Order ID Format
- `DE-1050` (Dumi Essence - Sequential number)

### Reference Format
- `WEB-20260227-1050` (Channel-Date-ID)

### Status Values
- Processing, Shipped, Delivered, Cancelled, Returned

### Stage Values
- Scheduled, In Progress, Completed

### Payment Status Values
- Pending, Paid, Refunded, Failed

### Channel Values
- Online Orders, Boutique & Pop-up, Wholesale, Returns

### Product Categories
- Perfume, Diffuser, Car Perfume

---

## Support

For questions or issues with the order flow:
1. Check this guide first
2. Review SETUP.md for technical issues
3. Check IMPLEMENTATION-SUMMARY.md for feature details
4. Contact system administrator
