// Bulk action utilities
import type { Order, OrderItem, Product } from "@/types/database";

export const generateOrdersCSV = (orders: (Order & { items?: OrderItem[] })[]): string => {
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
    order.items?.map((i) => `${i.product_name} (${i.quantity})`).join("; ") || "",
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
    ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")),
  ].join("\n");
};

export const downloadCSV = (csv: string, filename: string) => {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.URL.revokeObjectURL(url);
};

export const generateShippingLabels = (orders: Order[]): string => {
  const labelHTML = orders
    .map(
      (order) => `
    <div style="page-break-after: always; padding: 20px; border: 2px solid #000; margin: 10px; font-family: Arial, sans-serif;">
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
      
      ${
        order.customer_notes
          ? `
        <div style="margin-top: 15px; padding: 10px; border: 1px dashed #666;">
          <strong>Customer Notes:</strong><br />
          ${order.customer_notes}
        </div>
      `
          : ""
      }
      
      <div style="margin-top: 20px; text-align: center; font-size: 10px; color: #666;">
        Packed with care by Dumi Essence
      </div>
    </div>
  `,
    )
    .join("");

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

export const printLabels = (html: string) => {
  const printWindow = window.open("", "_blank");
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  }
};

export const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.error("Failed to copy:", err);
    return false;
  }
};

export const generateProductsCSV = (products: Product[]): string => {
  const headers = [
    "Product Name",
    "SKU",
    "Category",
    "Type",
    "Stock on Hand",
    "Low Stock Threshold",
    "Status",
    "Description",
  ];

  const rows = products.map((p) => [
    p.product_name,
    p.sku,
    p.product_category,
    p.product_type || "",
    p.stock_on_hand,
    p.stock_threshold,
    p.is_active ? "Active" : "Inactive",
    p.description || "",
  ]);

  return [
    headers.join(","),
    ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")),
  ].join("\n");
};
