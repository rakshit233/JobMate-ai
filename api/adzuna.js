import { requireUser } from "./_auth.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  // Reject the call before it touches Adzuna if there's no valid logged-in user.
  const user = await requireUser(req, res);
  if (!user) return; // requireUser already sent the 401/500 response

  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;
  if (!appId || !appKey) return res.status(500).json({ error: "Adzuna credentials not configured" });

  let { keyword = "", location = "", remote = "any", page = "1" } = req.query;

  // Legacy "Remote" city option: it isn't a place — search all of Germany
  // and apply the remote work-type filter instead.
  if (location.trim().toLowerCase() === "remote") { location = ""; remote = "remote"; }

  // Always search Germany — this is a Germany-focused job platform for English speakers
  const country = "de";

  // Build the keyword query:
  // We always inject English-language signals so results skew toward English-speaking roles.
  // Common patterns: "english", "international", or roles in tech/finance/startups
  // that are predominantly English-language in Germany.
  const englishSignal = "english";
  const baseKeyword = keyword.trim();

  // Keep the query simple: one `what` for the user's keyword. The previous
  // version combined what + what_and + what_or, which over-constrained the
  // search (all conditions are ANDed by Adzuna) and could zero out results.
  // Work-type and English-friendliness are filtered on the results below —
  // Adzuna's free API has no work-type or language parameter, and stuffing
  // words like "remote" into `what` excludes jobs that say "home office".
  const params = new URLSearchParams({
    app_id: appId,
    app_key: appKey,
    // Fetch a bigger page so post-filtering (work type / English) still
    // leaves a useful number of results to show.
    results_per_page: "50",
    what: baseKeyword || englishSignal,
    sort_by: "relevance",
  });
  // `where` is a place WITHIN Germany (the /jobs/de/ path already limits the
  // country). Passing "Germany" as a place matches nothing — for an
  // all-of-Germany search, omit the parameter entirely.
  if (location.trim()) params.set("where", location.trim());

  const url = `https://api.adzuna.com/v1/api/jobs/${country}/search/${page}?${params.toString()}`;

  try {
    const response = await fetch(url, { headers: { Accept: "application/json" } });

    // Read the body as text first so a non-JSON error page (rate-limit HTML,
    // gateway error, etc.) doesn't throw inside .json() and get mislabelled
    // as a network failure.
    const bodyText = await response.text();
    let data;
    try {
      data = JSON.parse(bodyText);
    } catch {
      // Adzuna returned something that isn't JSON — surface its status + a snippet.
      return res.status(response.status || 502).json({
        error: response.status === 429
          ? "Adzuna rate limit reached. Please wait a minute and try again."
          : "Adzuna returned an unexpected response.",
        status: response.status,
        details: bodyText.slice(0, 200),
      });
    }

    if (!response.ok) {
      return res.status(response.status).json({
        error: data.exception || data.error || "Adzuna API error",
        status: response.status,
      });
    }

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

    const REMOTE_RX = /\b(remote|home[\s-]?office|homeoffice|work from home|100%\s*remote|fully remote|remote-first)\b/i;
    const HYBRID_RX = /\bhybrid\b/i;

    let jobs = (data.results || []).map(j => {
      const text = `${j.title || ""} ${j.description || ""}`;
      return {
        id: j.id,
        title: j.title,
        company: j.company?.display_name || "Unknown company",
        location: j.location?.display_name || "Germany",
        salaryMin: j.salary_min || null,
        salaryMax: j.salary_max || null,
        description: j.description,
        url: j.redirect_url,
        created: j.created,
        contractType: j.contract_type || null,
        // English-friendly = the ad itself is written in English, or it
        // explicitly asks for English-speaking candidates.
        englishFriendly: !looksGerman(text) || /\benglish[\s-]speaking\b|\benglish\b.{0,30}\b(required|fluent|working language)\b/i.test(text),
        workType: REMOTE_RX.test(text) ? "remote" : HYBRID_RX.test(text) ? "hybrid" : "onsite",
      };
    });

    // Work-type filter — applied to results, not the search keyword, so a
    // remote search still finds ads that say "home office", and "onsite"
    // actually filters (it previously did nothing).
    if (remote === "remote") jobs = jobs.filter(j => j.workType === "remote");
    if (remote === "hybrid") jobs = jobs.filter(j => j.workType === "hybrid" || j.workType === "remote");
    if (remote === "onsite") jobs = jobs.filter(j => j.workType === "onsite");

    res.status(200).json({ jobs, count: data.count || jobs.length });
  } catch (err) {
    res.status(502).json({ error: "Failed to reach Adzuna API", details: err.message });
  }
}
