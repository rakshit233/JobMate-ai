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
// Throws on any database error — callers turn that into a 500 rather than
// silently reporting wrong numbers.
export const getUsageState = async (userId) => {
  const admin = getAdminClient();
  const month = currentMonth();

  const [subRes, usageRes] = await Promise.all([
    admin.from("subscriptions").select("plan, status").eq("user_id", userId).maybeSingle(),
    admin.from("usage_counters").select("count").eq("user_id", userId).eq("month", month).maybeSingle(),
  ]);
  if (subRes.error) throw new Error(`subscriptions read failed: ${subRes.error.message}`);
  if (usageRes.error) throw new Error(`usage_counters read failed: ${usageRes.error.message}`);

  const sub = subRes.data;
  const isPro = sub?.plan === "pro" && (sub?.status === "active" || sub?.status === "trialing");
  const used = usageRes.data?.count || 0;
  return {
    plan: isPro ? "pro" : "free",
    used,
    limit: FREE_MONTHLY_LIMIT,
    remaining: isPro ? null : Math.max(0, FREE_MONTHLY_LIMIT - used),
  };
};

// Atomically consumes one credit for the current month, unless the user is
// on an active/trialing pro plan (unlimited) or has already hit the limit.
// Uses the consume_usage_credit Postgres function so the check-and-increment
// happens in a single statement — two simultaneous requests can never both
// slip past the limit. Throws on database errors.
export const consumeCredit = async (userId) => {
  const admin = getAdminClient();
  const month = currentMonth();

  const { data: sub, error: subErr } = await admin
    .from("subscriptions").select("plan, status").eq("user_id", userId).maybeSingle();
  if (subErr) throw new Error(`subscriptions read failed: ${subErr.message}`);

  const isPro = sub?.plan === "pro" && (sub?.status === "active" || sub?.status === "trialing");
  if (isPro) return { allowed: true, plan: "pro", used: null, limit: null, remaining: null };

  const { data: newCount, error: rpcErr } = await admin.rpc("consume_usage_credit", {
    p_user_id: userId,
    p_month: month,
    p_limit: FREE_MONTHLY_LIMIT,
  });
  if (rpcErr) throw new Error(`consume_usage_credit failed: ${rpcErr.message}`);

  if (newCount === null || newCount === undefined) {
    // Limit already reached — nothing was consumed.
    return { allowed: false, plan: "free", used: FREE_MONTHLY_LIMIT, limit: FREE_MONTHLY_LIMIT, remaining: 0 };
  }

  return {
    allowed: true,
    plan: "free",
    used: newCount,
    limit: FREE_MONTHLY_LIMIT,
    remaining: Math.max(0, FREE_MONTHLY_LIMIT - newCount),
  };
};
