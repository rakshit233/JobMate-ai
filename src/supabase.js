import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);

export const signInWithGoogle = async () => {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin }
  });
  if (error) console.error('Login error:', error);
};

// Passwordless email login — Supabase sends a one-time magic link to the address.
// Returns { error } so the UI can show success vs. failure inline.
export const signInWithMagicLink = async (email) => {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin }
  });
  if (error) console.error('Magic link error:', error);
  return { error };
};

export const signOut = async () => {
  await supabase.auth.signOut();
};

export const getUser = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
};

// Returns { Authorization: "Bearer <token>" } for the current session, or {} if
// signed out. Every fetch to /api/claude or /api/adzuna must spread this in —
// those endpoints reject requests without a valid Supabase session.
export const getAuthHeader = async () => {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// ── Profiles ─────────────────────────────────────────────────────
// Table: profiles — see db/schema.sql
// RLS: enable, policy "users manage own profiles" using (auth.uid() = user_id)
// Replaces the old localStorage-only "jobmate_profiles" storage so a saved
// profile is visible anywhere the user is logged in — including the browser
// extension, which has no access to this site's localStorage.

export const listProfiles = async (userId) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (error) { console.error('listProfiles error:', error); return []; }
  return data || [];
};

export const insertProfile = async (userId, name, data = {}, isActive = false) => {
  const { data: row, error } = await supabase
    .from('profiles')
    .insert({ user_id: userId, name, data, is_active: isActive })
    .select()
    .single();
  if (error) { console.error('insertProfile error:', error); return null; }
  return row;
};

export const updateProfileFields = async (userId, profileId, fields) => {
  const { data, error } = await supabase
    .from('profiles')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', profileId)
    .eq('user_id', userId)
    .select()
    .single();
  if (error) { console.error('updateProfileFields error:', error); return null; }
  return data;
};

export const deleteProfileRow = async (userId, profileId) => {
  const { error } = await supabase
    .from('profiles')
    .delete()
    .eq('id', profileId)
    .eq('user_id', userId);
  if (error) { console.error('deleteProfileRow error:', error); return false; }
  return true;
};

// Marks exactly one profile as active for this user (unsets all others first).
export const setActiveProfileRow = async (userId, profileId) => {
  const { error: e1 } = await supabase
    .from('profiles').update({ is_active: false }).eq('user_id', userId).neq('id', profileId);
  const { error: e2 } = await supabase
    .from('profiles').update({ is_active: true }).eq('id', profileId).eq('user_id', userId);
  if (e1 || e2) { console.error('setActiveProfileRow error:', e1 || e2); return false; }
  return true;
};

// ── Resume versions ────────────────────────────────────────────────
// Table: resume_versions
//   id uuid pk default gen_random_uuid()
//   user_id uuid references auth.users not null
//   name text not null              -- e.g. "Default", "PM roles"
//   data jsonb not null             -- the resume object (name, contact, summary, education, experience, skills)
//   last_tailored_role text         -- last job title this version was tailored for (used for auto-select matching)
//   created_at timestamptz default now()
//   updated_at timestamptz default now()
// RLS: enable, policy "users manage own rows" using (auth.uid() = user_id)

export const listResumeVersions = async (userId) => {
  const { data, error } = await supabase
    .from('resume_versions')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });
  if (error) { console.error('listResumeVersions error:', error); return []; }
  return data || [];
};

export const saveResumeVersion = async (userId, version) => {
  const payload = {
    user_id: userId,
    name: version.name,
    data: version.data,
    last_tailored_role: version.last_tailored_role || null,
    updated_at: new Date().toISOString(),
  };
  if (version.id) {
    const { data, error } = await supabase
      .from('resume_versions')
      .update(payload)
      .eq('id', version.id)
      .eq('user_id', userId)
      .select()
      .single();
    if (error) { console.error('saveResumeVersion (update) error:', error); return null; }
    return data;
  }
  const { data, error } = await supabase
    .from('resume_versions')
    .insert(payload)
    .select()
    .single();
  if (error) { console.error('saveResumeVersion (insert) error:', error); return null; }
  return data;
};

export const deleteResumeVersion = async (userId, versionId) => {
  const { error } = await supabase
    .from('resume_versions')
    .delete()
    .eq('id', versionId)
    .eq('user_id', userId);
  if (error) { console.error('deleteResumeVersion error:', error); return false; }
  return true;
};

// Pick the version most recently tailored for a similar job title.
// Simple keyword overlap — no AI call needed for this, keeps it fast and free.
export const findBestMatchingVersion = (versions, targetRoleTitle) => {
  if (!versions?.length) return null;
  if (!targetRoleTitle) return versions[0]; // most recently updated
  const targetWords = targetRoleTitle.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  let best = null, bestScore = -1;
  for (const v of versions) {
    const role = (v.last_tailored_role || '').toLowerCase();
    const score = targetWords.reduce((acc, w) => acc + (role.includes(w) ? 1 : 0), 0);
    if (score > bestScore) { bestScore = score; best = v; }
  }
  return bestScore > 0 ? best : versions[0];
};

// ── Job tracker ──────────────────────────────────────────────────
// Table: job_tracker_entries — see db/schema.sql
// RLS: enable, policy "users manage own tracker entries" using (auth.uid() = user_id)

export const listTrackerEntries = async (userId) => {
  const { data, error } = await supabase
    .from('job_tracker_entries')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) { console.error('listTrackerEntries error:', error); return []; }
  return data || [];
};

export const saveTrackerEntry = async (userId, entry) => {
  const payload = {
    user_id: userId,
    role: entry.role,
    company: entry.company,
    location: entry.location || null,
    date: entry.date || null,
    status: entry.status || 'Saved',
    notes: entry.notes || null,
    resume_version_id: entry.resume_version_id || null,
    updated_at: new Date().toISOString(),
  };
  if (entry.id) {
    const { data, error } = await supabase
      .from('job_tracker_entries')
      .update(payload)
      .eq('id', entry.id)
      .eq('user_id', userId)
      .select()
      .single();
    if (error) { console.error('saveTrackerEntry (update) error:', error); return null; }
    return data;
  }
  const { data, error } = await supabase
    .from('job_tracker_entries')
    .insert(payload)
    .select()
    .single();
  if (error) { console.error('saveTrackerEntry (insert) error:', error); return null; }
  return data;
};

export const deleteTrackerEntry = async (userId, entryId) => {
  const { error } = await supabase
    .from('job_tracker_entries')
    .delete()
    .eq('id', entryId)
    .eq('user_id', userId);
  if (error) { console.error('deleteTrackerEntry error:', error); return false; }
  return true;
};
