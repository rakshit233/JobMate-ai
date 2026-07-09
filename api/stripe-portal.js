import Stripe from "stripe";
import { requireUser } from "./_auth.js";
import { getAdminClient } from "./_billing.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const user = await requireUser(req, res);
  if (!user) return;

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) return res.status(500).json({ error: "Billing is not configured" });

  const stripe = new Stripe(secretKey);
  const admin = getAdminClient();
  const origin = req.headers.origin || "https://app.jobmate.tech";

  try {
    const { data: sub } = await admin
      .from("subscriptions").select("stripe_customer_id").eq("user_id", user.id).maybeSingle();

    if (!sub?.stripe_customer_id) {
      return res.status(404).json({ error: "No billing account found yet — subscribe first." });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      return_url: `${origin}/`,
    });

    res.status(200).json({ url: session.url });
  } catch (err) {
    res.status(500).json({ error: "Could not open billing portal", details: err.message });
  }
}
