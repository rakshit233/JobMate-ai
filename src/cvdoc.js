// Shared CV/letter document rendering + helpers.
// Used by Quick Apply and CV Tailor so both features present identical,
// professional documents with the same cleanup pipeline.

// Convert accidental markdown output to the plain-text conventions the
// document renderer expects: "## Heading" -> "HEADING", "* item" -> "• item",
// strip **bold** markers and ---/*** divider lines.
export const stripMarkdown = (text) => {
  if (!text) return text;
  return text.split("\n").map(line => {
    let t = line;
    const h = t.match(/^\s*#{1,6}\s+(.*)$/);
    if (h) return h[1].toUpperCase();
    if (/^\s*([-*_=]\s*){3,}$/.test(t)) return ""; // ---, ***, ===
    t = t.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/__([^_]+)__/g, "$1");
    t = t.replace(/^(\s*)[*-]\s+/, "$1• ");
    return t;
  }).join("\n").replace(/\n{3,}/g, "\n\n").trim();
};

// Split a full CV text into { name, contact, body }. The first non-empty line
// is treated as the name when it isn't an ALL-CAPS section heading; a
// following line containing | or @ is treated as the contact line.
export const splitCVHeader = (text) => {
  if (!text) return { name: "", contact: "", body: "" };
  const lines = text.split("\n");
  let name = "", contact = "";
  let i = 0;
  while (i < lines.length && !lines[i].trim()) i++;
  const first = (lines[i] || "").trim();
  const isHeading = first === first.toUpperCase() && first.length > 3;
  if (first && !isHeading && !first.includes("|") && !first.includes("@")) {
    name = first; i++;
    while (i < lines.length && !lines[i].trim()) i++;
    const second = (lines[i] || "").trim();
    if (second && (second.includes("|") || second.includes("@"))) { contact = second; i++; }
  }
  return { name, contact, body: lines.slice(i).join("\n").trim() };
};

// Post-process AI CV output defensively: even with strict prompts, models
// occasionally repeat the name header or emit placeholder/junk lines.
const cleanCVText = (text, name) => {
  if (!text) return text;
  const lines = text.split("\n");
  const cleaned = [];
  const nameNorm = (name || "").trim().toLowerCase();
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const t = line.trim();
    // Drop a line that is just the candidate's name (duplicate header), only near the top
    if (cleaned.length < 3 && nameNorm && t.toLowerCase() === nameNorm) continue;
    // Drop a duplicated contact line near the top (email/phone separated by |) — the template renders contact itself
    if (cleaned.length < 3 && t.includes("|") && (t.includes("@") || /\+?\d[\d\s()/-]{6,}/.test(t))) continue;
    // Drop lines that are mostly bracketed placeholders: [Phone], [Email], etc.
    if (/\[(phone|email|address|linkedin|profile|city|website|date)[^\]]*\]/i.test(t)) continue;
    // Drop junk bullets and dash-only filler: "• --", "--", "•", "···"
    if (/^([•\-–—·.\s])+$/.test(t) && t.length > 0) continue;
    cleaned.push(line);
  }
  return cleaned.join("\n").replace(/\n{3,}/g, "\n\n").trim();
};

const CVDocument = ({ cvText, name, contact }) => {
  const lines = cvText.split("\n");
  const sections = [];
  let current = null;

  lines.forEach(line => {
    const trimmed = line.trim();
    if (!trimmed) return;
    if (trimmed === trimmed.toUpperCase() && trimmed.length > 3 && !trimmed.includes("|") && !trimmed.match(/^\+/)) {
      if (current) sections.push(current);
      current = { heading: trimmed, items: [] };
    } else {
      if (!current) current = { heading: null, items: [] };
      current.items.push(trimmed);
    }
  });
  if (current) sections.push(current);

  return (
    <div style={{ background: "#FFFFFF", padding: "20mm 18mm", fontFamily: "Georgia, serif", fontSize: 11.5, lineHeight: 1.6, color: "#1a1a1a" }}>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 16, borderBottom: "2px solid #1E293B", paddingBottom: 12 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#0F1F3D", letterSpacing: "-0.01em" }}>{name || "Your Name"}</div>
        <div style={{ fontSize: 11, color: "#475569", marginTop: 3, fontFamily: "Arial, sans-serif" }}>{contact || ""}</div>
      </div>
      {sections.map((sec, i) => (
        <div key={i} style={{ marginBottom: 12 }}>
          {sec.heading && (
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", color: "#1E293B", borderBottom: "1.5px solid #1E293B", paddingBottom: 2, marginBottom: 6 }}>
              {sec.heading}
            </div>
          )}
          {sec.items.map((item, j) => {
            const isBullet = item.startsWith("•") || item.startsWith("-");
            const isDate = item.match(/\d{2}\/\d{4}/);
            return (
              <div key={j} style={{
                fontSize: isBullet ? 11 : 12,
                marginBottom: isBullet ? 2 : 4,
                paddingLeft: isBullet ? 12 : 0,
                color: isBullet ? "#334155" : "#1a1a1a",
                fontWeight: isDate ? 400 : item.includes("|") ? 700 : 400,
                fontStyle: item.includes("—") || item.includes("·") ? "italic" : "normal",
                fontFamily: isBullet || isDate ? "Arial, sans-serif" : "Georgia, serif",
              }}>
                {item.replace(/^[-•]\s*/, isBullet ? "• " : "")}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
};

// ── Cover Letter Document Renderer ───────────────────────────────
const CoverLetterDocument = ({ text }) => {
  const paragraphs = text.split("\n").filter(l => l.trim());
  return (
    <div style={{ background: "#FFFFFF", padding: "20mm 18mm", fontFamily: "Georgia, serif", fontSize: 12.5, lineHeight: 1.75, color: "#1a1a1a" }}>
      {paragraphs.map((para, i) => {
        const isHeader = i < 4 && !para.startsWith("Dear") && !para.match(/^[A-Z][a-z]/);
        const isGreeting = para.startsWith("Dear");
        const isSignoff = para.startsWith("Yours") || para.startsWith("Best") || para.startsWith("Kind");
        return (
          <div key={i} style={{
            marginBottom: isGreeting || isSignoff ? 16 : 8,
            fontFamily: isHeader ? "Arial, sans-serif" : "Georgia, serif",
            fontSize: isHeader ? 11 : 12.5,
            color: isHeader ? "#475569" : "#1a1a1a",
            borderBottom: i === 0 ? "1px solid #E2E8F0" : "none",
            paddingBottom: i === 0 ? 12 : 0,
            marginTop: i === 0 ? 0 : undefined,
          }}>
            {para}
          </div>
        );
      })}
    </div>
  );
};

// ── Structured Cover Letter Template ────────────────────────────────
// Unlike CoverLetterDocument above (which guesses structure from raw AI
// text), this renders a fixed, polished layout from data the app already
// has — name, role, contact, company, date come from the form/profile, not
// the AI. Only `body` (the letter's paragraphs) comes from the model. This
// avoids ever trusting AI-generated text to format a header correctly, and
// matches a standard modern cover-letter layout: bold name, role subtitle,
// contact block, divider, recipient + date row, salutation, paragraphs, sign-off.
const CoverLetterTemplate = ({ name, role, contact, hiringManager = "Hiring Manager", company, companyAddress, date, body, signoff = "Warmest regards," }) => {
  const paragraphs = (body || "")
    .split(/\n\s*\n/)
    .map(p => p.replace(/\n/g, " ").trim())
    .filter(Boolean);
  const contactLines = (contact || "").split("|").map(s => s.trim()).filter(Boolean);
  const today = date || new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <div style={{ background: "#FFFFFF", padding: "20mm 18mm", fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif", fontSize: 12.5, lineHeight: 1.65, color: "#1a1a1a" }}>
      {/* Header: name + role + contact */}
      <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.01em", color: "#0F172A" }}>{name || "Your Name"}</div>
      {role && <div style={{ fontSize: 14.5, fontWeight: 700, color: "#334155", marginTop: 3 }}>{role}</div>}
      {contactLines.length > 0 && (
        <div style={{ marginTop: 10, fontSize: 11.5, color: "#64748B", lineHeight: 1.6 }}>
          {contactLines.map((line, i) => <div key={i}>{line}</div>)}
        </div>
      )}
      <div style={{ height: 2, background: "#0F172A", marginTop: 16, marginBottom: 20 }} />

      {/* Recipient + date */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 22 }}>
        <div style={{ fontSize: 12 }}>
          <div style={{ fontWeight: 700 }}>{hiringManager}</div>
          {company && <div style={{ fontWeight: 700 }}>{company}</div>}
          {companyAddress && <div style={{ color: "#64748B", marginTop: 1 }}>{companyAddress}</div>}
        </div>
        <div style={{ fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>{today}</div>
      </div>

      <div style={{ fontWeight: 600, marginBottom: 14 }}>Dear {hiringManager},</div>

      {paragraphs.map((p, i) => (
        <p key={i} style={{ margin: "0 0 14px", fontSize: 12.5, lineHeight: 1.75 }}>{p}</p>
      ))}

      <div style={{ marginTop: 10 }}>
        <div>{signoff}</div>
        <div style={{ fontWeight: 700, marginTop: 2 }}>{name || "Your Name"}</div>
      </div>
    </div>
  );
};


// ── Static (read-only) Resume — Classic template ────────────────────
// Renders the SAME polished layout as the Resume editor's "Classic" template,
// but read-only from a plain data object. Used by Quick Apply and CV Tailor so
// their generated CVs look identical to the editor. Expected shape:
//   { name, contact, summary, skills,
//     experience: [{ company, title, location, dates, bullets: [] }],
//     education:  [{ school, degree, location, dates }] }
const CLASSIC_ACCENT = "#1E293B";
const RESUME_FONT = "'Helvetica Neue', Arial, sans-serif";

const StaticHeading = ({ title }) => (
  <div style={{ borderBottom: `2px solid ${CLASSIC_ACCENT}`, marginBottom: 6, marginTop: 14, paddingBottom: 2 }}>
    <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: CLASSIC_ACCENT, textTransform: "uppercase" }}>{title}</span>
  </div>
);

export const StaticResume = ({ data }) => {
  if (!data) return null;
  const exp = Array.isArray(data.experience) ? data.experience : [];
  const edu = Array.isArray(data.education) ? data.education : [];
  const skills = Array.isArray(data.skills) ? data.skills.join(" \u00b7 ") : (data.skills || "");

  return (
    <div style={{ background: "#FFFFFF", padding: "20mm 18mm", fontFamily: RESUME_FONT, fontSize: 11.5, lineHeight: 1.55, color: "#1a1a1a" }}>
      <div style={{ textAlign: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.01em", color: "#0F1F3D" }}>{data.name || ""}</div>
        {data.contact && <div style={{ fontSize: 12, color: "#475569", marginTop: 3 }}>{data.contact}</div>}
      </div>

      {data.summary && (
        <div>
          <StaticHeading title="Summary" />
          <div style={{ fontSize: 12.5, lineHeight: 1.65, color: "#334155", whiteSpace: "pre-wrap" }}>{data.summary}</div>
        </div>
      )}

      {exp.length > 0 && (
        <div>
          <StaticHeading title="Work Experience" />
          {exp.map((e, i) => (
            <div key={i} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                <span style={{ fontWeight: 700, fontSize: 13, flex: 1, minWidth: 0 }}>{e.company}</span>
                <span style={{ fontSize: 11.5, color: "#475569", flexShrink: 0, whiteSpace: "nowrap" }}>{e.location}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <span style={{ fontStyle: "italic", fontSize: 12, color: "#334155", flex: 1, minWidth: 0 }}>{e.title}</span>
                <span style={{ fontSize: 11.5, color: "#475569", flexShrink: 0, whiteSpace: "nowrap" }}>{e.dates}</span>
              </div>
              {Array.isArray(e.bullets) && e.bullets.length > 0 && (
                <ul style={{ margin: "4px 0 0 16px", padding: 0 }}>
                  {e.bullets.filter(Boolean).map((b, bi) => (
                    <li key={bi} style={{ fontSize: 12, lineHeight: 1.6, color: "#334155", marginBottom: 2 }}>{b}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}

      {edu.length > 0 && (
        <div>
          <StaticHeading title="Education" />
          {edu.map((ed, i) => (
            <div key={i} style={{ marginBottom: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                <span style={{ fontWeight: 700, fontSize: 12.5, flex: 1, minWidth: 0 }}>{ed.school}</span>
                <span style={{ fontSize: 11.5, color: "#475569", flexShrink: 0, whiteSpace: "nowrap" }}>{ed.location}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <span style={{ fontStyle: "italic", fontSize: 12, color: "#334155", flex: 1, minWidth: 0 }}>{ed.degree}</span>
                <span style={{ fontSize: 11.5, color: "#475569", flexShrink: 0, whiteSpace: "nowrap" }}>{ed.dates}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {skills && (
        <div>
          <StaticHeading title="Skills" />
          <div style={{ fontSize: 12.5, color: "#334155" }}>{skills}</div>
        </div>
      )}
    </div>
  );
};

const downloadPDF = (elementId, filename) => {
  const el = document.getElementById(elementId);  if (!el) return;
  const content = el.innerText;
  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

const printDoc = (elementId) => {
  const el = document.getElementById(elementId);
  if (!el) return;
  const win = window.open("", "_blank");
  win.document.write(`
    <html><head><title>JobMate Document</title>
    <style>
      /* @page margin repeats on EVERY physical page — the element's own 20mm
         screen padding is stripped below, otherwise page 2+ would have no
         margins (padding only wraps the element once, not each page). */
      @page { margin: 20mm 18mm; size: A4; }
      @media print { .no-print { display: none !important; } [contenteditable] { background: transparent !important; border: none !important; } }
      /* No overflow:hidden here — it makes content jump to page 2 leaving
         page 1 partly blank (same fix as the Resume editor's print path). */
      html, body { margin: 0; padding: 0; height: auto !important; font-family: Georgia, serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; max-width: 210mm; }
      body > div { padding: 0 !important; }
      * { box-sizing: border-box; }
    </style></head>
    <body>${el.innerHTML}</body></html>
  `);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); win.close(); }, 500);
};



// Export a rendered document element as a Word file (.doc). Uses the
// Word-HTML format: the exact rendered markup wrapped in an MS Office
// envelope. Opens in Word, LibreOffice, and Google Docs with formatting
// intact, and stays fully editable — no extra dependencies needed.
export const downloadWord = (elementId, filename = "document") => {
  const el = document.getElementById(elementId);
  if (!el) return;
  const safe = filename.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-") || "document";
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>${safe}</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom><w:DoNotOptimizeForBrowser/></w:WordDocument></xml><![endif]-->
<style>@page { size: A4; margin: 1.5cm 2cm; } body { font-family: Georgia, serif; } * { box-sizing: border-box; }</style>
</head><body>${el.innerHTML}</body></html>`;
  const blob = new Blob(["\ufeff", html], { type: "application/msword" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `${safe}.doc`;
  a.click();
  URL.revokeObjectURL(url);
};

export { cleanCVText, CVDocument, CoverLetterDocument, CoverLetterTemplate, downloadPDF, printDoc };

// ── Structured CV generation helpers ─────────────────────────────
// The JSON shape StaticResume consumes. Shared so Quick Apply and CV Tailor
// produce identical structure.
export const STRUCTURED_CV_INSTRUCTION = `Return ONLY valid JSON (no markdown, no backticks, no commentary) with EXACTLY this shape:
{
  "name": "",
  "contact": "",
  "summary": "",
  "experience": [{"company":"","title":"","location":"","dates":"","bullets":["",""]}],
  "education": [{"school":"","degree":"","location":"","dates":""}],
  "skills": ""
}
Rules:
- Use ONLY facts from the candidate information provided. NEVER invent employers, dates, numbers, or achievements.
- "dates" is a single string like "01/2022 – Present". "degree" combines degree and field, e.g. "B.Sc. · Computer Science".
- "skills" is a single string of skills separated by " · ".
- Tailor the summary and bullet points to the target job, emphasising relevant experience, but never fabricate.
- Do not use placeholders like [Phone] or [Email]. Omit anything not provided.`;

// Parse the AI's JSON CV, tolerating markdown fences or stray prose around it.
// Returns a normalized object, or null if nothing usable was found.
export const parseStructuredCV = (text) => {
  if (!text) return null;
  let raw = text.replace(/```json|```/g, "").trim();
  // If the model wrapped JSON in prose, grab the outermost {...}.
  const first = raw.indexOf("{");
  const last = raw.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) raw = raw.slice(first, last + 1);

  const tryParse = (s) => { try { return JSON.parse(s); } catch { return undefined; } };

  let obj = tryParse(raw);
  if (obj === undefined) {
    // Repair the single most common LLM mistake: trailing commas before } or ].
    // e.g. {"a":1,} or ["x","y",]  →  {"a":1} / ["x","y"]
    const repaired = raw.replace(/,(\s*[}\]])/g, "$1");
    obj = tryParse(repaired);
  }
  if (obj === undefined || !obj || typeof obj !== "object") return null;
  // Must look like a CV, not some other JSON — require at least one known field.
  if (!("name" in obj) && !("experience" in obj) && !("summary" in obj) && !("skills" in obj)) return null;

  return {
    name: obj.name || "",
    contact: obj.contact || "",
    summary: obj.summary || "",
    experience: Array.isArray(obj.experience) ? obj.experience.map(e => ({
      company: e.company || "", title: e.title || "", location: e.location || "", dates: e.dates || "",
      bullets: Array.isArray(e.bullets) ? e.bullets.filter(Boolean) : [],
    })) : [],
    education: Array.isArray(obj.education) ? obj.education.map(ed => ({
      school: ed.school || "", degree: ed.degree || "", location: ed.location || "", dates: ed.dates || "",
    })) : [],
    skills: Array.isArray(obj.skills) ? obj.skills.join(" \u00b7 ") : (obj.skills || ""),
  };
};

// Last-resort safety net: if a "text" CV still looks like raw JSON (parsing
// failed AND it wasn't caught), pull human-readable strings out of it so the
// user never sees literal braces and quotes. Best-effort only.
export const salvageJsonText = (text) => {
  if (!text) return text;
  const t = text.trim();
  const looksLikeJson = t.startsWith("{") && t.includes('"');
  if (!looksLikeJson) return text;
  // Try a tolerant parse first (reusing the same trailing-comma repair).
  const parsed = parseStructuredCV(t);
  if (parsed) return structuredCVToText(parsed);
  // If even that fails, strip JSON syntax to leave the readable values.
  return t
    .replace(/^[\s{[]+|[\s}\]]+$/g, "")
    .split("\n")
    .map(line => {
      const m = line.match(/^\s*"[^"]+"\s*:\s*"?(.*?)"?,?\s*$/);
      return m ? m[1] : "";
    })
    .filter(Boolean)
    .join("\n")
    .trim() || "Your tailored CV was generated but couldn't be formatted. Please try again.";
};

// Flatten a structured CV back to plain text — for Copy-to-clipboard and as the
// source for Word/PDF when needed.
export const structuredCVToText = (data) => {  if (!data) return "";
  const lines = [];
  if (data.summary) { lines.push("SUMMARY", data.summary, ""); }
  if (data.experience?.length) {
    lines.push("WORK EXPERIENCE");
    data.experience.forEach(e => {
      lines.push(`${e.company}${e.location ? " — " + e.location : ""}`);
      lines.push(`${e.title}${e.dates ? " (" + e.dates + ")" : ""}`);
      (e.bullets || []).forEach(b => lines.push("• " + b));
      lines.push("");
    });
  }
  if (data.education?.length) {
    lines.push("EDUCATION");
    data.education.forEach(ed => {
      lines.push(`${ed.school}${ed.location ? " — " + ed.location : ""}`);
      lines.push(`${ed.degree}${ed.dates ? " (" + ed.dates + ")" : ""}`);
      lines.push("");
    });
  }
  if (data.skills) { lines.push("SKILLS", data.skills); }
  return lines.join("\n").trim();
};
