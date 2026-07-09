import { requireUser } from "./_auth.js";
import { consumeCredit } from "./_billing.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const user = await requireUser(req, res);
  if (!user) return;

  try {
    const result = await consumeCredit(user.id);
    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({ error: "Failed to check usage", details: err.message });
  }
}
