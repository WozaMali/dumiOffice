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
  const track = (order: Order) =>
    order.tracking_url ||
    (order.tracking_number
      ? `https://www.google.com/search?q=${encodeURIComponent(
          `${order.courier || "courier"} tracking ${order.tracking_number}`,
        )}`
      : "");

  const labelHTML = orders
    .map(
      (order) => `
    <div class="label">
      <div class="band">
        <div class="brand">
          <img src="/Dumi Essence.png" alt="" />
          <div>
            <div class="name">Dumi Essence</div>
            <div class="tag">Shipping label · Dispatch</div>
          </div>
        </div>
        <div class="meta">
          <div>${order.date}</div>
          <div>Ref ${order.reference}</div>
        </div>
      </div>
      <div class="gold"></div>

      <div class="grid">
        <div class="card">
          <div class="eyebrow">Order</div>
          <div><strong>ID</strong> ${order.id}</div>
          <div><strong>Channel</strong> ${order.channel}</div>
          <div><strong>Service</strong> ${order.shipping_method || "Standard"}</div>
        </div>
        <div class="card">
          <div class="eyebrow">Shipment</div>
          <div><strong>Courier</strong> ${order.courier || "Pending assignment"}</div>
          <div><strong>Tracking</strong> ${order.tracking_number || "Pending"}</div>
          ${track(order) ? `<div class="track">${track(order)}</div>` : ""}
        </div>
      </div>

      <div class="ship">
        <div class="eyebrow">Ship to</div>
        <div class="who">${order.customer_name}</div>
        <div class="contact">${order.customer_phone || ""}</div>
        <div class="addr">${(order as { shipping_address?: string }).shipping_address || order.customer_address || ""}</div>
      </div>

      ${
        order.customer_notes
          ? `<div class="note"><div class="eyebrow">Delivery note</div><div>${order.customer_notes}</div></div>`
          : ""
      }

      <div class="foot">
        <div>
          <div>Packed with care by Dumi Essence</div>
          <div class="muted">info@dumiessence.co.za · 072 849 5559</div>
        </div>
        <div class="amt">
          <div class="muted">Amount</div>
          <div class="total">R${order.grand_total.toFixed(2)}</div>
        </div>
      </div>
    </div>
  `,
    )
    .join("");

  return `<!DOCTYPE html>
<html>
<head>
  <title>Shipping Labels - Dumi Essence</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0; padding: 20px; background: #f3f1ec;
      font-family: "Segoe UI", Georgia, "Times New Roman", serif;
      color: #1c1c1c;
    }
    .label {
      page-break-after: always;
      background: #fff;
      border: 1px solid #d8d4cc;
      margin: 0 auto 16px;
      max-width: 820px;
      padding: 0 0 18px;
      overflow: hidden;
    }
    .band {
      display: flex; justify-content: space-between; align-items: center;
      gap: 12px; padding: 16px 20px; background: #141414; color: #fff;
    }
    .brand { display: flex; align-items: center; gap: 12px; }
    .brand img { height: 40px; width: auto; display: block; }
    .name { font-size: 18px; letter-spacing: 0.06em; font-weight: 700; }
    .tag { margin-top: 3px; font-size: 11px; color: #c8c8c8; letter-spacing: 0.04em; }
    .meta { text-align: right; font-size: 12px; color: #cfcfcf; line-height: 1.45; }
    .gold { height: 3px; background: #c8aa5a; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; padding: 16px 20px 0; }
    .card, .ship, .note {
      border: 1px solid #e5e1d8; border-radius: 2px; padding: 12px 14px; background: #faf9f6;
    }
    .ship { margin: 12px 20px 0; }
    .note { margin: 12px 20px 0; border-style: dashed; }
    .eyebrow {
      font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase;
      color: #8a8478; margin-bottom: 8px; font-family: "Segoe UI", Arial, sans-serif;
    }
    .card div, .ship div { font-size: 13px; line-height: 1.45; font-family: "Segoe UI", Arial, sans-serif; }
    .who { font-size: 18px !important; font-weight: 700; }
    .contact, .addr, .track { color: #333; }
    .track { word-break: break-all; font-size: 11px !important; margin-top: 4px; }
    .foot {
      display: flex; justify-content: space-between; align-items: flex-end;
      gap: 12px; margin: 18px 20px 0; font-family: "Segoe UI", Arial, sans-serif; font-size: 12px;
    }
    .muted { color: #777; margin-top: 3px; }
    .amt { text-align: right; }
    .total { font-size: 18px; font-weight: 700; color: #1c1c1c; }
    @media print {
      body { background: #fff; padding: 0; }
      .label { border: none; margin: 0; max-width: none; }
    }
  </style>
</head>
<body>${labelHTML}</body>
</html>`;
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
