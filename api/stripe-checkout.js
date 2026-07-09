import Stripe from "stripe";
import { requireUser } from "./_auth.js";
import { getAdminClient } from "./_billing.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const user = await requireUser(req, res);
  if (!user) return;

  const secretKey = process.env.STRIPE_SECRET_KEY;
  const priceId = process.env.STRIPE_PRICE_ID;
  if (!secretKey || !priceId) return res.status(500).json({ error: "Billing is not configured" });

  const stripe = new Stripe(secretKey);
  const admin = getAdminClient();
  const origin = req.headers.origin || "https://app.jobmate.tech";

  try {
    // Reuse an existing Stripe customer for this user if we already have one,
    // so repeat checkouts don't create duplicate customer records.
    const { data: existing } = await admin
      .from("subscriptions").select("stripe_customer_id").eq("user_id", user.id).maybeSingle();

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      customer: existing?.stripe_customer_id || undefined,
      customer_email: existing?.stripe_customer_id ? undefined : user.email,
      client_reference_id: user.id,
      metadata: { supabase_user_id: user.id },
      subscription_data: { metadata: { supabase_user_id: user.id } },
      success_url: `${origin}/?upgraded=1`,
      cancel_url: `${origin}/?upgrade_canceled=1`,
      allow_promotion_codes: true,
    });

    res.status(200).json({ url: session.url });
  } catch (err) {
    res.status(500).json({ error: "Could not start checkout", details: err.message });
  }
}
