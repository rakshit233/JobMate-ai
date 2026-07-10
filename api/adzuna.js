import { requireUser } from "./_auth.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  // Reject the call before it touches Adzuna if there's no valid logged-in user.
  const user = await requireUser(req, res);
  if (!user) return; // requireUser already sent the 401/500 response

  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;
  if (!appId || !appKey) return res.status(500).json({ error: "Adzuna credentials not configured" });

  const { keyword = "", location = "", remote = "any", page = "1" } = req.query;

  // Always search Germany — this is a Germany-focused job platform for English speakers
  const country = "de";

  // Build the keyword query:
  // We always inject English-language signals so results skew toward English-speaking roles.
  // Common patterns: "english", "international", or roles in tech/finance/startups
  // that are predominantly English-language in Germany.
  const englishSignal = "english";
  const baseKeyword = keyword.trim();

  // "what_or" = any of these words appear in the listing (broad match)
  // "what" = all words must appear (strict match — too restrictive for english filter)
  // Strategy: use "what" for the user's keyword, "what_or" to bias toward english roles
  // Keep the query simple: one `what` for the user's keyword. The previous
  // version combined what + what_and + what_or, which over-constrained the
  // search (all conditions are ANDed by Adzuna) and could zero out results.
  // English-friendliness is handled client-side, where we can explain it.
  const params = new URLSearchParams({
    app_id: appId,
    app_key: appKey,
    results_per_page: "20",
    what: baseKeyword || englishSignal,
    where: location || "Germany",
    sort_by: "relevance",
  });

  // Remote/hybrid preference: fold into the keyword rather than adding
  // more AND constraints.
  if (remote === "remote") params.set("what", `${params.get("what")} remote`.trim());
  if (remote === "hybrid") params.set("what", `${params.get("what")} hybrid`.trim());

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

    const jobs = (data.results || []).map(j => ({
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
      // Flag if listing explicitly mentions English — used by the frontend to show a badge
      englishFriendly: !!(j.description || "").toLowerCase().match(/\benglish\b|\binternational\b|\benglish.speaking\b/),
    }));

    res.status(200).json({ jobs, count: data.count || jobs.length });
  } catch (err) {
    res.status(502).json({ error: "Failed to reach Adzuna API", details: err.message });
  }
}
