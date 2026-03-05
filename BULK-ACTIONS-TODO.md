# Bulk Actions Implementation Guide

## Current State

The Orders page has bulk selection UI implemented, but the actual bulk action logic is placeholder. When you click bulk action buttons, you see a toast notification saying "not yet implemented".

## What's Already Working

✅ Checkbox selection for individual orders
✅ "Select all" checkbox in table header
✅ Selected items state management (`selectedItems` array)
✅ Bulk action bar appears when orders are selected
✅ Three bulk action buttons:
  - "Mark as In Progress"
  - "Export CSV"
  - "Print Labels"

## Implementation Tasks

### 1. Mark as In Progress (Bulk Status Update)

**Location**: `src/pages/Orders.tsx` → `handleBulkAction` function

**Logic**:
```typescript
const handleBulkAction = async (action: string) => {
  if (selectedItems.length === 0) {
    toast.error("No orders selected");
    return;
  }

  if (action === "Mark as In Progress") {
    try {
      // Update all selected orders
      await Promise.all(
        selectedItems.map((orderId) =>
          ordersApi.updateStatus(orderId, "Processing", "In Progress", "Admin")
        )
      );
      
      // Refresh orders list
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      
      // Clear selection
      setSelectedItems([]);
      
      toast.success(`${selectedItems.length} orders marked as In Progress`);
    } catch (error) {
      toast.error("Failed to update orders");
      console.error(error);
    }
  }
};
```

**Considerations**:
- Only update orders that are currently in "Scheduled" stage
- Show warning if some selected orders are already "In Progress" or "Completed"
- Add confirmation dialog for bulk operations

### 2. Export CSV

**Location**: `src/pages/Orders.tsx` → `handleBulkAction` function

**Logic**:
```typescript
if (action === "Export CSV") {
  try {
    // Fetch full order details for selected orders
    const selectedOrders = orders.filter((o) => selectedItems.includes(o.id));
    
    // Fetch order items for each order
    const ordersWithItems = await Promise.all(
      selectedOrders.map(async (order) => {
        const items = await orderItemsApi.listByOrderId(order.id);
        return { ...order, items };
      })
    );
    
    // Generate CSV
    const csv = generateOrdersCSV(ordersWithItems);
    
    // Download file
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dumi-essence-orders-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    
    toast.success(`Exported ${selectedItems.length} orders to CSV`);
  } catch (error) {
    toast.error("Failed to export CSV");
    console.error(error);
  }
}
```

**Helper function**:
```typescript
const generateOrdersCSV = (orders: any[]) => {
  const headers = [
    "Order ID",
    "Reference",
    "Date",
    "Customer Name",
    "Customer Email",
    "Customer Phone",
    "Customer Address",
    "Channel",
    "Status",
    "Stage",
    "Payment Status",
    "Payment Method",
    "Shipping Method",
    "Courier",
    "Tracking Number",
    "Items",
    "Subtotal",
    "Shipping Fee",
    "Discount",
    "Tax",
    "Grand Total",
    "Location",
    "Customer Notes",
    "Internal Notes",
  ];
  
  const rows = orders.map((order) => [
    order.id,
    order.reference,
    order.date,
    order.customer_name,
    order.customer_email || "",
    order.customer_phone || "",
    order.customer_address || "",
    order.channel,
    order.status,
    order.stage,
    order.payment_status,
    order.payment_method || "",
    order.shipping_method || "",
    order.courier || "",
    order.tracking_number || "",
    order.items?.map((i: any) => `${i.product_name} (${i.quantity})`).join("; ") || "",
    order.subtotal.toFixed(2),
    order.shipping_fee.toFixed(2),
    order.discount.toFixed(2),
    order.tax.toFixed(2),
    order.grand_total.toFixed(2),
    order.location,
    order.customer_notes || "",
    order.internal_notes || "",
  ]);
  
  return [
    headers.join(","),
    ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
  ].join("\n");
};
```

**Dependencies**:
- No external library needed (native browser APIs)
- Consider adding `papaparse` for more robust CSV generation

### 3. Print Labels

**Location**: `src/pages/Orders.tsx` → `handleBulkAction` function

**Logic**:
```typescript
if (action === "Print Labels") {
  try {
    const selectedOrders = orders.filter((o) => selectedItems.includes(o.id));
    
    // Generate printable HTML
    const printContent = generateShippingLabels(selectedOrders);
    
    // Open print dialog
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
      printWindow.close();
    }
    
    toast.success(`Generated labels for ${selectedItems.length} orders`);
  } catch (error) {
    toast.error("Failed to generate labels");
    console.error(error);
  }
}
```

**Helper function**:
```typescript
const generateShippingLabels = (orders: Order[]) => {
  const labelHTML = orders.map((order) => `
    <div style="page-break-after: always; padding: 20px; border: 2px solid #000; margin: 10px;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h1 style="margin: 0; font-size: 24px;">Dumi Essence</h1>
        <p style="margin: 5px 0; font-size: 12px;">Premium Fragrances</p>
      </div>
      
      <div style="margin-bottom: 15px;">
        <strong>Order ID:</strong> ${order.id}<br />
        <strong>Reference:</strong> ${order.reference}<br />
        <strong>Date:</strong> ${order.date}
      </div>
      
      <div style="margin-bottom: 15px; padding: 10px; background: #f0f0f0;">
        <strong>SHIP TO:</strong><br />
        ${order.customer_name}<br />
        ${order.customer_phone || ""}<br />
        ${order.customer_address || ""}
      </div>
      
      <div style="margin-bottom: 15px;">
        <strong>Channel:</strong> ${order.channel}<br />
        <strong>Shipping Method:</strong> ${order.shipping_method || "Standard"}<br />
        ${order.courier ? `<strong>Courier:</strong> ${order.courier}<br />` : ""}
        ${order.tracking_number ? `<strong>Tracking:</strong> ${order.tracking_number}<br />` : ""}
      </div>
      
      ${order.customer_notes ? `
        <div style="margin-top: 15px; padding: 10px; border: 1px dashed #666;">
          <strong>Customer Notes:</strong><br />
          ${order.customer_notes}
        </div>
      ` : ""}
      
      <div style="margin-top: 20px; text-align: center; font-size: 10px; color: #666;">
        Packed with care by Dumi Essence
      </div>
    </div>
  `).join("");
  
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Shipping Labels - Dumi Essence</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
          @media print {
            body { margin: 0; padding: 0; }
          }
        </style>
      </head>
      <body>
        ${labelHTML}
      </body>
    </html>
  `;
};
```

**Considerations**:
- Label size should match your printer (A4, thermal printer, etc.)
- Consider integrating with courier APIs for official labels
- Add barcode/QR code for order reference

## Additional Bulk Actions to Consider

### 4. Bulk Delete
```typescript
if (action === "Delete") {
  const confirmed = window.confirm(
    `Are you sure you want to delete ${selectedItems.length} orders? This cannot be undone.`
  );
  
  if (confirmed) {
    await Promise.all(selectedItems.map((id) => ordersApi.delete(id)));
    queryClient.invalidateQueries({ queryKey: ["orders"] });
    setSelectedItems([]);
    toast.success("Orders deleted");
  }
}
```

### 5. Bulk Assign Courier
```typescript
if (action === "Assign Courier") {
  const courier = prompt("Enter courier name (e.g., The Courier Guy, Pargo):");
  if (courier) {
    await Promise.all(
      selectedItems.map((id) =>
        ordersApi.update(id, { courier: courier.trim() })
      )
    );
    queryClient.invalidateQueries({ queryKey: ["orders"] });
    toast.success(`Assigned ${courier} to ${selectedItems.length} orders`);
  }
}
```

### 6. Bulk Print Pick List
Generate a consolidated pick list for warehouse staff showing all items to pick across selected orders.

## Testing Checklist

- [ ] Select multiple orders
- [ ] Click "Mark as In Progress" - all selected orders update
- [ ] Click "Export CSV" - file downloads with correct data
- [ ] Click "Print Labels" - print dialog opens with formatted labels
- [ ] Test with 1 order selected
- [ ] Test with 10+ orders selected
- [ ] Test with no orders selected (should show error)
- [ ] Test with orders in different stages (should handle gracefully)
- [ ] Verify selection clears after successful bulk action
- [ ] Verify toast notifications appear for success/error

## UI Improvements

Consider adding:
- Confirmation dialog for destructive actions
- Progress indicator for bulk operations
- "Undo" functionality for recent bulk actions
- Keyboard shortcuts (Ctrl+A to select all, etc.)
- Filter to show only selected orders
- Bulk action dropdown menu for more actions

## Performance Notes

- For large selections (100+ orders), consider:
  - Batch API calls (e.g., 10 at a time)
  - Show progress bar
  - Use Web Workers for CSV generation
  - Implement server-side bulk operations endpoint

## Next Steps

1. Implement "Mark as In Progress" first (simplest)
2. Add confirmation dialog
3. Implement "Export CSV" second
4. Implement "Print Labels" third
5. Add more bulk actions based on user feedback
6. Consider moving bulk operations to server-side for better performance
