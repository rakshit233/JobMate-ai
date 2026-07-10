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

// Reads a row that may legitimately not exist yet (a free user has no
// subscription row; a user who hasn't generated this month has no usage row).
// "No rows found" is a normal state, NOT an error — only real database
// failures (permissions, connectivity, bad schema) are surfaced.
const readOptionalRow = async (query, label) => {
  const { data, error } = await query.maybeSingle();
  if (error) {
    // PGRST116 = "JSON object requested, multiple (or no) rows returned"
    if (error.code === "PGRST116") return null;
    throw new Error(`${label} read failed: ${error.message}`);
  }
  return data;
};

// Reads plan + this month's usage without consuming anything.
// Throws on any database error — callers turn that into a 500 rather than
// silently reporting wrong numbers.
export const getUsageState = async (userId) => {
  const admin = getAdminClient();
  const month = currentMonth();

  const [sub, usage] = await Promise.all([
    readOptionalRow(admin.from("subscriptions").select("plan, status").eq("user_id", userId), "subscriptions"),
    readOptionalRow(admin.from("usage_counters").select("count").eq("user_id", userId).eq("month", month), "usage_counters"),
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
// Uses the consume_usage_credit Postgres function so the check-and-increment
// happens in a single statement — two simultaneous requests can never both
// slip past the limit. Throws on database errors.
export const consumeCredit = async (userId) => {
  const admin = getAdminClient();
  const month = currentMonth();

  const sub = await readOptionalRow(
    admin.from("subscriptions").select("plan, status").eq("user_id", userId), "subscriptions");

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
