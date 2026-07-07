import { getAuthHeader } from "./supabase";
// Shared matching logic — used by Quick Apply and Find Jobs
// Single source of truth so both features score consistently.

const SONNET = "claude-sonnet-4-6";
const HAIKU  = "claude-haiku-4-5-20251001";

// callClaude accepts an optional model param.
// Default is Haiku for lightweight/scoring tasks; pass SONNET for writing tasks.
export const callClaude = async (system, user, model = HAIKU) => {
  const authHeader = await getAuthHeader();
  const res = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader },
    body: JSON.stringify({ model, max_tokens: 2000, system, messages: [{ role: "user", content: user }] }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || data?.error || `Request failed (${res.status})`);
  return data.content?.[0]?.text || "";
};

export { SONNET, HAIKU };

export const profileSummaryText = (profile) => {
  if (!profile?.name) return "Generic candidate — no profile saved.";
  return `Name: ${profile.name}
Summary: ${profile.summary || ""}
Skills: ${(profile.skills || []).join(", ")}
Experience: ${(profile.experience || []).filter(e => e.company).map(e =>
  `${e.title} at ${e.company} (${e.startDate}–${e.current ? "Present" : e.endDate}): ${(e.bullets || []).join("; ")}`
).join("\n")}
Education: ${(profile.education || []).filter(e => e.school).map(e => `${e.degree} at ${e.school}`).join(", ")}`;
};

// Single job scoring — used by Quick Apply (one job, full detail)
export const scoreJobMatch = async (profile, jobDescription) => {
  const raw = await callClaude(
    `Analyse candidate vs job and return ONLY valid JSON (no markdown):
{"score":78,"matchedSkills":["skill1","skill2"],"missingSkills":["skill3"],"recommendation":"one sentence"}`,
    `CANDIDATE:\n${profileSummaryText(profile)}\n\nJOB:\n${jobDescription}`
  );
  return JSON.parse(raw.replace(/```json|```/g, "").trim());
};

// Batch scoring — used by Find Jobs (many jobs, lightweight score only)
// Scores multiple job listings in one call to avoid N separate API round-trips.
export const scoreJobBatch = async (profile, jobs) => {
  const jobList = jobs.map((j, i) => `[${i}] ${j.title} at ${j.company}: ${(j.description || "").slice(0, 300)}`).join("\n\n");
  const raw = await callClaude(
    `You are a job matching engine. For each job listed (indexed [0], [1], etc.), score how well it matches the candidate's profile from 0-100. Return ONLY a valid JSON array, no markdown:
[{"index":0,"score":72},{"index":1,"score":45}]`,
    `CANDIDATE:\n${profileSummaryText(profile)}\n\nJOBS:\n${jobList}`
  );
  try {
    const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
    const scoreMap = {};
    parsed.forEach(p => { scoreMap[p.index] = p.score; });
    return jobs.map((j, i) => ({ ...j, matchScore: scoreMap[i] ?? null }));
  } catch {
    return jobs.map(j => ({ ...j, matchScore: null }));
  }
};

// ── CV text builders ─────────────────────────────────────────────
// Turn a saved profile into full CV text (used to pre-fill CV Tailor).
export const profileToCVText = (profile) => {
  if (!profile?.name) return "";
  const contact = [profile.email, profile.phone, profile.location, profile.linkedin, profile.portfolio].filter(Boolean).join(" | ");
  const exp = (profile.experience || []).filter(e => e.company).map(e =>
    `${e.title || ""} — ${e.company}${e.location ? `, ${e.location}` : ""} (${e.startDate || ""}–${e.current ? "Present" : e.endDate || ""})\n${(e.bullets || []).filter(b => b && b.trim()).map(b => `• ${b}`).join("\n")}`
  ).join("\n\n");
  const edu = (profile.education || []).filter(e => e.school).map(e =>
    `${[e.degree, e.field].filter(Boolean).join(" · ")} — ${e.school}${e.location ? `, ${e.location}` : ""} (${e.startDate || ""}–${e.endDate || ""})`
  ).join("\n");
  return [
    profile.name,
    contact,
    profile.summary ? `\nSUMMARY\n${profile.summary}` : "",
    exp ? `\nEXPERIENCE\n${exp}` : "",
    edu ? `\nEDUCATION\n${edu}` : "",
    (profile.skills || []).length ? `\nSKILLS\n${profile.skills.join(", ")}` : "",
  ].filter(Boolean).join("\n");
};

// Turn a saved resume version's data object into full CV text.
export const resumeDataToCVText = (d) => {
  if (!d) return "";
  const exp = (d.experience || []).filter(e => e.company).map(e =>
    `${e.title || ""} — ${e.company}${e.location ? `, ${e.location}` : ""} (${e.dates || ""})\n${(e.bullets || []).filter(b => b && b.trim()).map(b => `• ${b}`).join("\n")}`
  ).join("\n\n");
  const edu = (d.education || []).filter(e => e.school).map(e =>
    `${e.degree || ""} — ${e.school}${e.location ? `, ${e.location}` : ""} (${e.dates || ""})`
  ).join("\n");
  return [
    d.name, d.contact,
    d.summary ? `\nSUMMARY\n${d.summary}` : "",
    exp ? `\nEXPERIENCE\n${exp}` : "",
    edu ? `\nEDUCATION\n${edu}` : "",
    d.skills ? `\nSKILLS\n${d.skills}` : "",
  ].filter(Boolean).join("\n");
};

// ── User-facing error messages ───────────────────────────────────
// Turns raw fetch/JSON/API failures into a short, honest message the user
// can act on — instead of a spinner that silently dies.
export const friendlyError = (err) => {
  const msg = (err && (err.message || err.toString())) || "";
  if (/credit|billing|balance/i.test(msg)) return "Our AI service is temporarily unavailable. Please try again shortly.";
  if (/401|unauthor|session|expired/i.test(msg)) return "Your session expired. Please refresh the page and sign in again.";
  if (/429|rate|too many/i.test(msg)) return "We're getting a lot of requests right now. Please wait a moment and try again.";
  if (/network|failed to fetch|timeout/i.test(msg)) return "Network hiccup — check your connection and try again.";
  if (/JSON|parse|unexpected/i.test(msg)) return "The AI response came back malformed. Please try again.";
  return "Something went wrong. Please try again in a moment.";
};

// Wraps callClaude so HTTP errors (like 400 out-of-credits) become thrown
// Errors carrying the real API message, instead of an empty string that
// silently breaks JSON.parse downstream.
export const callClaudeChecked = async (system, user, model = HAIKU) => {
  const authHeader = await getAuthHeader();
  const res = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader },
    body: JSON.stringify({ model, max_tokens: 2000, system, messages: [{ role: "user", content: user }] }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const apiMsg = data?.error?.message || data?.error || `Request failed (${res.status})`;
    throw new Error(apiMsg);
  }
  return data.content?.[0]?.text || "";
};
