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


const downloadPDF = (elementId, filename) => {
  const el = document.getElementById(elementId);
  if (!el) return;
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
      @page { margin: 0; size: A4; }
      @media print { .no-print { display: none !important; } [contenteditable] { background: transparent !important; border: none !important; } }
      html, body { margin: 0; padding: 0; height: auto !important; font-family: Georgia, serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; max-width: 210mm; overflow: hidden; }
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
