// Bulk action utilities
import { supabase } from "@/lib/supabase";
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
  const trackingHref = (order: Order) =>
    order.tracking_url ||
    (order.tracking_number
      ? `https://www.google.com/search?q=${encodeURIComponent(
          `${order.courier || "courier"} tracking ${order.tracking_number}`,
        )}`
      : "");

  const labelHTML = orders
    .map(
      (order) => `
    <div style="page-break-after: always; padding: 18px; border: 2px solid #111; margin: 10px; border-radius: 14px; font-family: Inter, Arial, sans-serif;">
      <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom: 14px; border-bottom:1px solid #ddd; padding-bottom:10px;">
        <div>
          <h1 style="margin: 0; font-size: 20px; letter-spacing:0.04em;">Dumi Essence</h1>
          <p style="margin: 4px 0 0 0; font-size: 11px; color:#444;">Premium Fragrances · Shipping Label</p>
        </div>
        <div style="text-align:right;">
          <p style="margin:0; font-size:11px; color:#555;">${order.date}</p>
          <p style="margin:4px 0 0 0; font-size:11px; color:#555;">Ref: ${order.reference}</p>
        </div>
      </div>

      <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">
        <div style="padding:10px; border:1px solid #ddd; border-radius:10px;">
          <p style="margin:0 0 6px 0; font-size:10px; letter-spacing:0.08em; color:#666;">ORDER</p>
          <p style="margin:0; font-size:13px;"><strong>ID:</strong> ${order.id}</p>
          <p style="margin:4px 0 0 0; font-size:13px;"><strong>Channel:</strong> ${order.channel}</p>
          <p style="margin:4px 0 0 0; font-size:13px;"><strong>Service:</strong> ${order.shipping_method || "Standard"}</p>
        </div>
        <div style="padding:10px; border:1px solid #ddd; border-radius:10px;">
          <p style="margin:0 0 6px 0; font-size:10px; letter-spacing:0.08em; color:#666;">SHIPMENT</p>
          <p style="margin:0; font-size:13px;"><strong>Courier:</strong> ${order.courier || "Pending assignment"}</p>
          <p style="margin:4px 0 0 0; font-size:13px;"><strong>Tracking:</strong> ${order.tracking_number || "Pending"}</p>
          ${
            trackingHref(order)
              ? `<p style="margin:4px 0 0 0; font-size:12px;"><strong>Track:</strong> ${trackingHref(order)}</p>`
              : ""
          }
        </div>
      </div>

      <div style="margin-bottom: 12px; padding: 12px; background: #f6f6f6; border-radius:10px; border:1px solid #ddd;">
        <p style="margin:0 0 6px 0; font-size:10px; letter-spacing:0.08em; color:#666;">SHIP TO</p>
        <p style="margin:0; font-size:16px; font-weight:700;">${order.customer_name}</p>
        <p style="margin:4px 0 0 0; font-size:13px; color:#222;">${order.customer_phone || ""}</p>
        <p style="margin:4px 0 0 0; font-size:13px; line-height:1.4;">
          ${(order as any).shipping_address || order.customer_address || ""}
        </p>
      </div>

      ${
        order.customer_notes
          ? `
      <div style="margin-bottom: 12px; padding: 10px; border:1px dashed #888; border-radius:10px;">
        <p style="margin:0 0 6px 0; font-size:10px; letter-spacing:0.08em; color:#666;">DELIVERY NOTE</p>
        <p style="margin:0; font-size:12px;">${order.customer_notes}</p>
      </div>
      `
          : ""
      }

      <div style="display:flex; align-items:flex-end; justify-content:space-between; gap:12px; margin-top:16px;">
        <div>
          <p style="margin:0; font-size:10px; color:#666;">Packed with care by Dumi Essence</p>
          <p style="margin:4px 0 0 0; font-size:10px; color:#666;">Need help? info@dumiessence.co.za · 072 849 5559</p>
        </div>
        <div style="text-align:right; font-size:11px;">
          <p style="margin:0; color:#666;">Amount</p>
          <p style="margin:2px 0 0 0; font-size:15px; font-weight:700;">R${order.grand_total.toFixed(2)}</p>
        </div>
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
          body { font-family: Inter, Arial, sans-serif; margin: 0; padding: 20px; background:#fff; }
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

export const openShipmentEmailDraft = (order: Order) => {
  const recipient = order.customer_email?.trim();
  if (!recipient) return false;

  const trackingHint =
    order.tracking_url ||
    (order.tracking_number
      ? `https://www.google.com/search?q=${encodeURIComponent(
          `${order.courier || "courier"} tracking ${order.tracking_number}`,
        )}`
      : "We will share your tracking link shortly.");

  const subject = `Your Dumi Essence order is on the way (${order.reference})`;
  const body = [
    `Hi ${order.customer_name},`,
    "",
    "Your order has been prepared and handed over for delivery.",
    "",
    `Order reference: ${order.reference}`,
    `Courier: ${order.courier || "To be confirmed"}`,
    `Tracking number: ${order.tracking_number || "Pending"}`,
    `Tracking link: ${trackingHint}`,
    "",
    "If you need any support, simply reply to this email and our team will assist.",
    "",
    "Warm regards,",
    "Dumi Essence",
  ].join("\n");

  const href = `mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  window.location.href = href;
  return true;
};

export const sendShipmentUpdateEmail = async (order: Order) => {
  // Attempt server-side email first (if edge function exists and is configured).
  try {
    const { data, error } = await supabase.functions.invoke("send-shipment-update", {
      body: {
        orderId: order.id,
        customerName: order.customer_name,
        customerEmail: order.customer_email,
        reference: order.reference,
        courier: order.courier,
        trackingNumber: order.tracking_number,
        trackingUrl: order.tracking_url,
      },
    });
    if (!error && (data as any)?.ok) {
      return { ok: true, mode: "server" as const };
    }
  } catch {
    // Ignore and fallback to email draft.
  }

  const opened = openShipmentEmailDraft(order);
  return { ok: opened, mode: "draft" as const };
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
