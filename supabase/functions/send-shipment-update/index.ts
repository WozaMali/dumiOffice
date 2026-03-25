// Supabase Edge Function: send-shipment-update
// Sends transactional shipment update emails via Resend API.

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });

const required = (value: string | undefined, name: string) => {
  if (!value || !value.trim()) throw new Error(`Missing ${name}`);
  return value.trim();
};

const trackingFallback = (courier?: string, trackingNumber?: string) => {
  if (!trackingNumber) return "We will share your tracking link shortly.";
  return `https://www.google.com/search?q=${encodeURIComponent(
    `${courier || "courier"} tracking ${trackingNumber}`,
  )}`;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return json(405, { ok: false, error: "Method not allowed" });
  }

  try {
    const resendApiKey = required(Deno.env.get("RESEND_API_KEY"), "RESEND_API_KEY");
    const fromEmail = required(Deno.env.get("SHIPMENT_FROM_EMAIL"), "SHIPMENT_FROM_EMAIL");

    const payload = (await req.json()) as {
      customerName?: string;
      customerEmail?: string;
      reference?: string;
      courier?: string;
      trackingNumber?: string;
      trackingUrl?: string;
    };

    const customerName = required(payload.customerName, "customerName");
    const customerEmail = required(payload.customerEmail, "customerEmail");
    const reference = required(payload.reference, "reference");
    const courier = payload.courier?.trim() || "To be confirmed";
    const trackingNumber = payload.trackingNumber?.trim() || "Pending";
    const trackingUrl =
      payload.trackingUrl?.trim() || trackingFallback(payload.courier, payload.trackingNumber);

    const subject = `Your Dumi Essence order is on the way (${reference})`;
    const text = [
      `Hi ${customerName},`,
      "",
      "Your order has been prepared and handed over for delivery.",
      "",
      `Order reference: ${reference}`,
      `Courier: ${courier}`,
      `Tracking number: ${trackingNumber}`,
      `Tracking link: ${trackingUrl}`,
      "",
      "If you need support, simply reply and our team will assist.",
      "",
      "Warm regards,",
      "Dumi Essence",
    ].join("\n");

    const html = `
      <div style="font-family: Inter, Arial, sans-serif; line-height:1.6; color:#111;">
        <p>Hi ${customerName},</p>
        <p>Your order has been prepared and handed over for delivery.</p>
        <p><strong>Order reference:</strong> ${reference}<br/>
        <strong>Courier:</strong> ${courier}<br/>
        <strong>Tracking number:</strong> ${trackingNumber}<br/>
        <strong>Tracking link:</strong> <a href="${trackingUrl}">${trackingUrl}</a></p>
        <p>If you need support, simply reply and our team will assist.</p>
        <p>Warm regards,<br/>Dumi Essence</p>
      </div>
    `;

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [customerEmail],
        subject,
        text,
        html,
      }),
    });

    if (!resendRes.ok) {
      const errText = await resendRes.text();
      return json(502, { ok: false, error: "Email provider error", details: errText });
    }

    const resendBody = (await resendRes.json()) as { id?: string };
    return json(200, { ok: true, provider: "resend", id: resendBody.id ?? null });
  } catch (err) {
    return json(400, { ok: false, error: (err as Error).message });
  }
});

