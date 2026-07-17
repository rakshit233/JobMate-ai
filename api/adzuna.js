import { requireUser } from "./_auth.js";

// Job search endpoint — merges two sources:
//   • Adzuna   (keyword search, salary data; needs API credentials)
//   • Arbeitnow (free German job board API, no key; explicit remote flag,
//               strong on English-speaking startup/tech roles)
// Either source failing degrades gracefully to the other's results.

// German-language detection: listings written in German are full of these
// stopwords; an English-language ad contains almost none of them. Far more
// reliable than checking for the word "english" (German ads name English
// skills too) or English-looking job titles (German ads reuse them).
const GERMAN_STOPWORDS = /\b(und|oder|für|wir|sie|der|die|das|mit|bei|eine|einen|deine|unsere|ihre|sowie|bereich|aufgaben|kenntnisse|erfahrung|unterstützung|zum|zur|als|werden|bieten)\b/gi;
const looksGerman = (text) => {
  const hits = (text.match(GERMAN_STOPWORDS) || []).length;
  const words = text.split(/\s+/).length || 1;
  return hits / words > 0.04; // >4% German stopwords → German-language ad
};
const isEnglishFriendly = (text) =>
  !looksGerman(text) || /\benglish[\s-]speaking\b|\benglish\b.{0,30}\b(required|fluent|working language)\b/i.test(text);

const REMOTE_RX = /\b(remote|home[\s-]?office|homeoffice|work from home|100%\s*remote|fully remote|remote-first)\b/i;
const HYBRID_RX = /\bhybrid\b/i;
const workTypeOf = (text) => (REMOTE_RX.test(text) ? "remote" : HYBRID_RX.test(text) ? "hybrid" : "onsite");

const stripHtml = (html) => (html || "").replace(/<[^>]+>/g, " ").replace(/\s{2,}/g, " ").trim();

// ── Adzuna ────────────────────────────────────────────────────────
const fetchAdzuna = async ({ appId, appKey, keyword, location, page }) => {
  const params = new URLSearchParams({
    app_id: appId,
    app_key: appKey,
    // Fetch a bigger page so post-filtering (work type / English) still
    // leaves a useful number of results to show.
    results_per_page: "50",
    what: keyword || "english",
    sort_by: "relevance",
  });
  // `where` is a place WITHIN Germany (the /jobs/de/ path already limits the
  // country). Passing "Germany" as a place matches nothing — for an
  // all-of-Germany search, omit the parameter entirely.
  if (location) params.set("where", location);

  const response = await fetch(`https://api.adzuna.com/v1/api/jobs/de/search/${page}?${params.toString()}`, {
    headers: { Accept: "application/json" },
  });
  const bodyText = await response.text();
  let data;
  try { data = JSON.parse(bodyText); } catch {
    throw new Error(response.status === 429
      ? "Adzuna rate limit reached. Please wait a minute and try again."
      : `Adzuna returned an unexpected response (${response.status}).`);
  }
  if (!response.ok) throw new Error(data.exception || data.error || `Adzuna API error (${response.status})`);

  const jobs = (data.results || []).map(j => {
    const text = `${j.title || ""} ${j.description || ""}`;
    return {
      id: `adz-${j.id}`,
      title: j.title,
      company: j.company?.display_name || "Unknown company",
      location: j.location?.display_name || "Germany",
      salaryMin: j.salary_min || null,
      salaryMax: j.salary_max || null,
      description: j.description,
      url: j.redirect_url,
      created: j.created,
      contractType: j.contract_type || null,
      englishFriendly: isEnglishFriendly(text),
      workType: workTypeOf(text),
      source: "Adzuna",
    };
  });
  return { jobs, count: data.count || jobs.length };
};

// ── Arbeitnow ─────────────────────────────────────────────────────
// Free public API, Germany-focused, no credentials. It has no keyword
// parameter, so keyword/location matching happens here on the results.
const fetchArbeitnow = async ({ keyword, location }) => {
  const response = await fetch("https://www.arbeitnow.com/api/job-board-api", {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`Arbeitnow API error (${response.status})`);
  const data = await response.json();

  const kw = keyword.toLowerCase();
  const loc = location.toLowerCase();

  const jobs = (data.data || [])
    .map(j => {
      const description = stripHtml(j.description);
      const text = `${j.title || ""} ${description}`;
      return {
        id: `arb-${j.slug}`,
        title: j.title,
        company: j.company_name || "Unknown company",
        location: j.location || "Germany",
        salaryMin: null,
        salaryMax: null,
        description,
        url: j.url,
        // created_at is a unix timestamp in seconds
        created: j.created_at ? new Date(j.created_at * 1000).toISOString() : null,
        contractType: Array.isArray(j.job_types) && j.job_types.length ? j.job_types.join(", ") : null,
        englishFriendly: isEnglishFriendly(text),
        // Arbeitnow has an explicit remote flag — trust it, fall back to text
        workType: j.remote ? "remote" : workTypeOf(text),
        _tags: (j.tags || []).join(" ").toLowerCase(),
      };
    })
    .filter(j => {
      // Keyword: match against title, tags, or description
      if (kw && !(`${j.title} ${j._tags} ${j.description}`.toLowerCase().includes(kw))) return false;
      // Location: match city name; remote jobs satisfy any location
      if (loc && !(j.location.toLowerCase().includes(loc) || j.workType === "remote")) return false;
      return true;
    })
    .map(({ _tags, ...j }) => ({ ...j, source: "Arbeitnow" }));

  return { jobs, count: jobs.length };
};

// ── Handler ───────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  // Reject the call before it touches any job API if there's no valid logged-in user.
  const user = await requireUser(req, res);
  if (!user) return; // requireUser already sent the 401/500 response

  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;

  let { keyword = "", location = "", remote = "any", page = "1" } = req.query;
  keyword = keyword.trim();
  location = location.trim();

  // Legacy "Remote" city option: it isn't a place — search all of Germany
  // and apply the remote work-type filter instead.
  if (location.toLowerCase() === "remote") { location = ""; remote = "remote"; }

  // Query both sources in parallel; one failing must not kill the search.
  const [adzunaResult, arbeitnowResult] = await Promise.allSettled([
    appId && appKey
      ? fetchAdzuna({ appId, appKey, keyword, location, page })
      : Promise.reject(new Error("Adzuna credentials not configured")),
    fetchArbeitnow({ keyword, location }),
  ]);

  const adzuna = adzunaResult.status === "fulfilled" ? adzunaResult.value : null;
  const arbeitnow = arbeitnowResult.status === "fulfilled" ? arbeitnowResult.value : null;

  if (!adzuna && !arbeitnow) {
    return res.status(502).json({
      error: "Job search is temporarily unavailable. Please try again.",
      details: `Adzuna: ${adzunaResult.reason?.message} · Arbeitnow: ${arbeitnowResult.reason?.message}`,
    });
  }

  // Merge — Adzuna first (keyword-relevance sorted), then Arbeitnow extras.
  // Dedupe on normalized title+company since the same posting can be on both.
  const seen = new Set();
  let jobs = [...(adzuna?.jobs || []), ...(arbeitnow?.jobs || [])].filter(j => {
    const key = `${(j.title || "").toLowerCase().trim()}|${(j.company || "").toLowerCase().trim()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Work-type filter — applied to results, not the search keyword, so a
  // remote search still finds ads that say "home office", and "onsite"
  // actually filters.
  if (remote === "remote") jobs = jobs.filter(j => j.workType === "remote");
  if (remote === "hybrid") jobs = jobs.filter(j => j.workType === "hybrid" || j.workType === "remote");
  if (remote === "onsite") jobs = jobs.filter(j => j.workType === "onsite");

  res.status(200).json({
    jobs,
    count: (adzuna?.count || 0) + (arbeitnow?.count || 0),
    sources: { adzuna: !!adzuna, arbeitnow: !!arbeitnow },
  });
}
