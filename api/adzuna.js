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
  const params = new URLSearchParams({
    app_id: appId,
    app_key: appKey,
    results_per_page: "20",
    what: baseKeyword || englishSignal,      // user keyword, fallback to "english"
    where: location || "Germany",            // default to all of Germany if blank
    content_type: "application/json",
    sort_by: "relevance",
  });

  // If user typed a keyword, add english as a secondary phrase filter
  // so we get roles where the listing itself mentions "english"
  if (baseKeyword) {
    params.set("what_and", baseKeyword);     // all words in keyword must appear
    params.set("what", baseKeyword);
    // Add "english" as an OR term to surface English-friendly listings higher
    params.set("what_or", `${baseKeyword} english international`);
  }

  // Remote filter: append to keyword phrase
  if (remote === "remote") {
    const current = params.get("what_or") || "";
    params.set("what_or", `${current} remote`.trim());
  }
  if (remote === "hybrid") {
    const current = params.get("what_or") || "";
    params.set("what_or", `${current} hybrid`.trim());
  }

  const url = `https://api.adzuna.com/v1/api/jobs/${country}/search/${page}?${params.toString()}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data.exception || "Adzuna API error" });
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
    res.status(500).json({ error: "Failed to reach Adzuna API", details: err.message });
  }
}
