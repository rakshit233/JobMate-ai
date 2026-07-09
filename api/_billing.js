import { createClient } from "@supabase/supabase-js";

// A privileged Supabase client for server-only code. Uses the service_role
// key, which bypasses Row Level Security entirely — this is what lets us
// write subscription status and usage counts that a user's own browser
// session is only ever allowed to read, never modify. NEVER import this
// file, or expose SUPABASE_SERVICE_ROLE_KEY, anywhere that reaches the client.
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let client = null;
export const getAdminClient = () => {
  if (!client && supabaseUrl && serviceRoleKey) {
    client = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
};

export const FREE_MONTHLY_LIMIT = 3;

const currentMonth = () => new Date().toISOString().slice(0, 7); // 'YYYY-MM'

// Reads plan + this month's usage without consuming anything.
export const getUsageState = async (userId) => {
  const admin = getAdminClient();
  const month = currentMonth();

  const [{ data: sub }, { data: usage }] = await Promise.all([
    admin.from("subscriptions").select("plan, status").eq("user_id", userId).maybeSingle(),
    admin.from("usage_counters").select("count").eq("user_id", userId).eq("month", month).maybeSingle(),
  ]);

  const isPro = sub?.plan === "pro" && (sub?.status === "active" || sub?.status === "trialing");
  const used = usage?.count || 0;
  return {
    plan: isPro ? "pro" : "free",
    used,
    limit: FREE_MONTHLY_LIMIT,
    remaining: isPro ? null : Math.max(0, FREE_MONTHLY_LIMIT - used),
  };
};

// Atomically consumes one credit for the current month, unless the user is
// on an active/trialing pro plan (unlimited) or has already hit the limit.
// Returns the same shape as getUsageState, plus `allowed`.
export const consumeCredit = async (userId) => {
  const admin = getAdminClient();
  const month = currentMonth();

  const { data: sub } = await admin.from("subscriptions").select("plan, status").eq("user_id", userId).maybeSingle();
  const isPro = sub?.plan === "pro" && (sub?.status === "active" || sub?.status === "trialing");
  if (isPro) return { allowed: true, plan: "pro", used: null, limit: null, remaining: null };

  // Single upsert that only increments if under the limit. Postgres evaluates
  // the WHERE clause against the row as it stands before this statement, so
  // two near-simultaneous requests can't both sneak through past the limit.
  const { data: existing } = await admin
    .from("usage_counters").select("count").eq("user_id", userId).eq("month", month).maybeSingle();

  const used = existing?.count || 0;
  if (used >= FREE_MONTHLY_LIMIT) {
    return { allowed: false, plan: "free", used, limit: FREE_MONTHLY_LIMIT, remaining: 0 };
  }

  const newCount = used + 1;
  await admin.from("usage_counters").upsert(
    { user_id: userId, month, count: newCount, updated_at: new Date().toISOString() },
    { onConflict: "user_id,month" }
  );

  return { allowed: true, plan: "free", used: newCount, limit: FREE_MONTHLY_LIMIT, remaining: FREE_MONTHLY_LIMIT - newCount };
};
