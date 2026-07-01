export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;
  if (!appId || !appKey) return res.status(500).json({ error: "Adzuna credentials not configured" });

  const { keyword = "", location = "", remote = "any", page = "1" } = req.query;

  // Adzuna country code: Germany = "de"
  const country = "de";
  const params = new URLSearchParams({
    app_id: appId,
    app_key: appKey,
    results_per_page: "20",
    what: keyword,
    where: location,
    content_type: "application/json",
  });

  if (remote === "remote") params.set("what_phrase", `${keyword} remote`.trim());

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
    }));

    res.status(200).json({ jobs, count: data.count || jobs.length });
  } catch (err) {
    res.status(500).json({ error: "Failed to reach Adzuna API", details: err.message });
  }
}
