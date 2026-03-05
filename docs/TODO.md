# Dumi Essence – Project TODO

## Completed
- [x] Inventory Management: three-section layout (overview, stock adjustment, current inventory)
- [x] Stock Adjustment form: 5 tabs (Details, Items, Location, Valuation, Notes), Adjustment Information, Save Draft, Save & Apply
- [x] Accounting Management: three-section layout (overview, transaction entry, current ledger)
- [x] Receipt attachment for transactions (Supabase Storage + accounting_attachments)
- [x] Unified schema; inventory movements; accounting migrations
- [x] **Date range filters** on Accounting – From/To drive revenue, ledger and P&L for selected period
- [x] **Categories management UI** – Manage categories dialog: list categories, add new (name + kind)
- [x] **P&L summary** – P&L (period) card: ledger income − expense for selected period

## In progress / Next
- [ ] **Suppliers & purchase invoices** – schema (suppliers, purchase_invoices, lines), UI to create/list invoices
- [ ] **Wire purchase invoices** – stock in via inventory_movements, expense via accounting_transactions
- [ ] **Post paid orders to ledger** – auto-create income transactions when order is marked Paid (channel-based category)
- [ ] **Suppliers view** – totals per supplier, outstanding, last invoice

## Later
- [ ] Categories management: edit/archive categories
- [ ] Date range presets (This month, Last 30 days, Quarter, Year)
- [ ] Export P&L and by-category breakdown
