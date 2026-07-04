import { createClient } from "@supabase/supabase-js";

// Server-side Supabase client used only to validate the caller's access token.
// The anon key is safe to use here — it has no special privilege on its own,
// it just lets us ask Supabase Auth "is this JWT valid, and whose is it?"
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

let client = null;
const getClient = () => {
  if (!client && supabaseUrl && supabaseAnonKey) {
    client = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
};

// Verifies the Authorization: Bearer <token> header against Supabase Auth.
// Returns the authenticated user on success, or null if missing/invalid.
// Every route that spends our money or our API quota must call this first.
export const requireUser = async (req, res) => {
  const supabase = getClient();
  if (!supabase) {
    res.status(500).json({ error: "Auth not configured on server" });
    return null;
  }

  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    res.status(401).json({ error: "Missing or invalid Authorization header" });
    return null;
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    res.status(401).json({ error: "Invalid or expired session" });
    return null;
  }

  return data.user;
};
