import { requireUser } from "./_auth.js";

// Sites that reliably block server-side fetching. We detect these up front and
// tell the user honestly instead of returning a login wall as if it were a job.
const BLOCKED_HOSTS = [
  { match: /(^|\.)linkedin\.com$/i, name: "LinkedIn" },
  { match: /(^|\.)glassdoor\.[a-z.]+$/i, name: "Glassdoor" },
];

// Strip HTML down to readable text.
const htmlToText = (html) => {
  let s = html;
  // Drop non-content blocks entirely (including their contents)
  s = s.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ");
  s = s.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ");
  s = s.replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ");
  s = s.replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, " ");
  s = s.replace(/<nav\b[^>]*>[\s\S]*?<\/nav>/gi, " ");
  s = s.replace(/<footer\b[^>]*>[\s\S]*?<\/footer>/gi, " ");
  s = s.replace(/<header\b[^>]*>[\s\S]*?<\/header>/gi, " ");
  s = s.replace(/<!--[\s\S]*?-->/g, " ");
  // Keep line structure for block elements so bullet lists survive
  s = s.replace(/<\/(p|div|li|h[1-6]|br|tr)>/gi, "\n");
  s = s.replace(/<li\b[^>]*>/gi, "\n• ");
  s = s.replace(/<br\s*\/?>/gi, "\n");
  // Remove all remaining tags
  s = s.replace(/<[^>]+>/g, " ");
  // Decode entities. Named entities matter here: German postings are full of
  // &uuml; &ouml; &auml; &szlig; and currency/dash symbols.
  const NAMED = {
    nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'",
    euro: "€", pound: "£", mdash: "—", ndash: "–", hellip: "…",
    auml: "ä", ouml: "ö", uuml: "ü", Auml: "Ä", Ouml: "Ö", Uuml: "Ü",
    szlig: "ß", eacute: "é", egrave: "è", agrave: "à", ccedil: "ç",
    copy: "©", reg: "®", trade: "™", bull: "•", middot: "·", deg: "°",
    rsquo: "'", lsquo: "'", rdquo: "\u201D", ldquo: "\u201C",
  };
  s = s.replace(/&#39;/g, "'");
  s = s.replace(/&([a-zA-Z][a-zA-Z0-9]*);/g, (m, name) => (name in NAMED ? NAMED[name] : m));
  s = s.replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)));
  s = s.replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d));
  // Collapse whitespace
  s = s.replace(/[ \t\u00a0]+/g, " ");
  s = s.replace(/\n\s*\n\s*\n+/g, "\n\n");
  return s.trim();
};

// Some job boards embed the posting as JSON-LD (schema.org JobPosting).
// When present this is far cleaner than scraping the rendered HTML.
const extractJsonLdJob = (html) => {
  const blocks = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];
  for (const block of blocks) {
    const inner = block.replace(/<script[^>]*>/i, "").replace(/<\/script>/i, "");
    let parsed;
    try { parsed = JSON.parse(inner.trim()); } catch { continue; }
    const candidates = Array.isArray(parsed) ? parsed : [parsed, ...(parsed["@graph"] || [])];
    for (const node of candidates) {
      if (!node || typeof node !== "object") continue;
      const type = node["@type"];
      const isJob = type === "JobPosting" || (Array.isArray(type) && type.includes("JobPosting"));
      if (!isJob) continue;
      const parts = [
        node.title && `Job title: ${node.title}`,
        node.hiringOrganization?.name && `Company: ${node.hiringOrganization.name}`,
        node.jobLocation?.address?.addressLocality && `Location: ${node.jobLocation.address.addressLocality}`,
        node.employmentType && `Employment type: ${[].concat(node.employmentType).join(", ")}`,
        node.description && htmlToText(node.description),
      ].filter(Boolean);
      if (parts.length) return parts.join("\n");
    }
  }
  return null;
};

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const user = await requireUser(req, res);
  if (!user) return;

  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "Missing url parameter" });

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return res.status(400).json({ error: "That doesn't look like a valid URL." });
  }
  if (!/^https?:$/.test(parsed.protocol)) {
    return res.status(400).json({ error: "Only http and https links are supported." });
  }

  // Known-blocked sites: fail fast with an honest, specific message.
  const blocked = BLOCKED_HOSTS.find(b => b.match.test(parsed.hostname));
  if (blocked) {
    return res.status(422).json({
      error: `We currently can't fetch job posts from ${blocked.name} — it blocks automated access. Please copy the job description and paste it in instead.`,
      code: "BLOCKED_SOURCE",
      source: blocked.name,
    });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    const response = await fetch(parsed.toString(), {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        // Identify as a normal browser; many boards 403 unknown agents.
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9,de;q=0.8",
      },
    }).finally(() => clearTimeout(timeout));

    if (!response.ok) {
      const hint = (response.status === 403 || response.status === 401)
        ? "This site blocked our request."
        : `The page returned an error (${response.status}).`;
      return res.status(422).json({
        error: `${hint} Please paste the job description text instead.`,
        code: "FETCH_FAILED",
        status: response.status,
      });
    }

    const contentType = response.headers.get("content-type") || "";
    if (!/text\/html|application\/xhtml/i.test(contentType)) {
      return res.status(422).json({
        error: "That link isn't a readable web page. Please paste the job description instead.",
        code: "NOT_HTML",
      });
    }

    const html = (await response.text()).slice(0, 800000);

    // Prefer structured JSON-LD, fall back to stripped HTML text.
    const text = extractJsonLdJob(html) || htmlToText(html);

    // A login wall or bot check usually yields very little usable text.
    if (!text || text.length < 350) {
      return res.status(422).json({
        error: "We couldn't read a job description from that link — it may require a login. Please paste the job description instead.",
        code: "TOO_SHORT",
      });
    }

    // Trim to something sane for the model.
    res.status(200).json({
      text: text.slice(0, 12000),
      sourceUrl: parsed.toString(),
      host: parsed.hostname,
    });
  } catch (err) {
    const aborted = err?.name === "AbortError";
    res.status(422).json({
      error: aborted
        ? "That page took too long to respond. Please paste the job description instead."
        : "We couldn't reach that link. Please paste the job description instead.",
      code: aborted ? "TIMEOUT" : "UNREACHABLE",
      details: err?.message,
    });
  }
}
