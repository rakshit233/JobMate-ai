import Stripe from "stripe";
import { getAdminClient } from "./_billing.js";

// Stripe signs the raw request body, so we must read it unparsed — disable
// Vercel's automatic JSON body parsing for this route only.
export const config = { api: { bodyParser: false } };

const readRawBody = (req) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });

// Maps a Stripe subscription status to our simple plan field.
const planFor = (status) => (["active", "trialing"].includes(status) ? "pro" : "free");

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const secretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secretKey || !webhookSecret) return res.status(500).json({ error: "Billing is not configured" });

  const stripe = new Stripe(secretKey);
  const admin = getAdminClient();

  let event;
  try {
    const rawBody = await readRawBody(req);
    const signature = req.headers["stripe-signature"];
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    // Signature check failed — reject. This is what stops anyone but Stripe
    // itself from calling this endpoint and granting themselves "pro".
    return res.status(400).json({ error: `Webhook signature verification failed: ${err.message}` });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const userId = session.client_reference_id || session.metadata?.supabase_user_id;
        if (userId && session.subscription) {
          const subscription = await stripe.subscriptions.retrieve(session.subscription);
          await admin.from("subscriptions").upsert({
            user_id: userId,
            stripe_customer_id: session.customer,
            stripe_subscription_id: subscription.id,
            plan: planFor(subscription.status),
            status: subscription.status,
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            updated_at: new Date().toISOString(),
          }, { onConflict: "user_id" });
        }
        break;
      }

      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        const userId = subscription.metadata?.supabase_user_id;
        // Fall back to looking the user up by stripe_customer_id if metadata is missing
        // (e.g. subscription created directly in the Stripe dashboard).
        const status = event.type === "customer.subscription.deleted" ? "canceled" : subscription.status;
        const update = {
          stripe_subscription_id: subscription.id,
          plan: planFor(status),
          status,
          current_period_end: subscription.current_period_end
            ? new Date(subscription.current_period_end * 1000).toISOString() : null,
          updated_at: new Date().toISOString(),
        };
        if (userId) {
          await admin.from("subscriptions").update(update).eq("user_id", userId);
        } else {
          await admin.from("subscriptions").update(update).eq("stripe_customer_id", subscription.customer);
        }
        break;
      }

      default:
        // Ignore events we don't act on.
        break;
    }
    res.status(200).json({ received: true });
  } catch (err) {
    // Returning 500 makes Stripe retry the webhook later, which is what we want
    // if our own database write failed transiently.
    res.status(500).json({ error: "Webhook handling failed", details: err.message });
  }
}
