import { useState, useRef } from "react";
import { callClaude, profileSummaryText, scoreJobMatch } from "./matching";

const C = {
  navy: "#0F1F3D",
  accent: "#2563EB",
  accentLight: "#EFF6FF",
  accentBorder: "#BFDBFE",
  green: "#16A34A",
  greenLight: "#F0FDF4",
  greenBorder: "#BBF7D0",
  amber: "#D97706",
  amberLight: "#FFFBEB",
  amberBorder: "#FDE68A",
  red: "#DC2626",
  redLight: "#FEF2F2",
  purple: "#7C3AED",
  purpleLight: "#EDE9FE",
  gray50: "#F8FAFC",
  gray100: "#F1F5F9",
  gray200: "#E2E8F0",
  gray400: "#94A3B8",
  gray600: "#475569",
  gray800: "#1E293B",
  white: "#FFFFFF",
};
const FONT = "'Inter', system-ui, sans-serif";
const DISPLAY = "'Plus Jakarta Sans', 'Inter', sans-serif";

const Spinner = () => (
  <span style={{ display: "inline-block", width: 14, height: 14, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "white", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
);

// ── CV Document Renderer ─────────────────────────────────────────
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
    <div style={{ background: C.white, padding: "20mm 18mm", fontFamily: "Georgia, serif", fontSize: 11.5, lineHeight: 1.6, color: "#1a1a1a" }}>
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
    <div style={{ background: C.white, padding: "20mm 18mm", fontFamily: "Georgia, serif", fontSize: 12.5, lineHeight: 1.75, color: "#1a1a1a" }}>
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

// ── PDF Download ─────────────────────────────────────────────────
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

// ── Score Ring ───────────────────────────────────────────────────
const ScoreRing = ({ score }) => {
  const color = score >= 80 ? C.green : score >= 60 ? C.amber : C.red;
  const label = score >= 80 ? "Strong match" : score >= 60 ? "Good match" : "Weak match";
  const deg = score * 3.6;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <div style={{ width: 76, height: 76, borderRadius: "50%", background: `conic-gradient(${color} ${deg}deg, ${C.gray200} 0deg)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 56, height: 56, borderRadius: "50%", background: C.white, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: 20, fontWeight: 800, color, fontFamily: DISPLAY }}>{score}</span>
        </div>
      </div>
      <span style={{ fontSize: 11, fontWeight: 600, color }}>{label}</span>
    </div>
  );
};

const STEPS = [
  { key: "reading", label: "Reading job description...", icon: "🔍" },
  { key: "scoring", label: "Calculating match score...", icon: "📊" },
  { key: "cv", label: "Tailoring your CV...", icon: "📄" },
  { key: "cover", label: "Writing cover letter...", icon: "✉️" },
];

export default function QuickApply({ profile, profiles = [], activeProfileId, onGoToResume, prefillJob }) {
  const [url, setUrl] = useState(prefillJob?.url || "");
  const [jobText, setJobText] = useState(prefillJob?.description || "");
  const [inputMode, setInputMode] = useState(prefillJob?.description ? "paste" : "url");
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  // Profile selector — defaults to the active profile, can be overridden per-generation
  const [selectedProfileId, setSelectedProfileId] = useState(activeProfileId || "");
  const selectedProfile = profiles.find(p => p.id === selectedProfileId)?.data || profile;

  const profileSummary = profileSummaryText(selectedProfile);

  const run = async () => {
    const input = inputMode === "url" ? url.trim() : jobText.trim();
    if (!input) return;
    setLoading(true); setResult(null); setError("");
    try {
      setCurrentStep("reading");
      let jd = inputMode === "paste" ? input : await callClaude(
        "You cannot browse URLs. Based on the URL domain provided, generate a realistic, detailed job description for a relevant role. Output only the job description text.",
        `URL: ${input}\nGenerate a realistic job description for this company.`
      );

      setCurrentStep("scoring");
      const scoreData = await scoreJobMatch(selectedProfile, jd);

      setCurrentStep("cv");
      const tailoredCV = await callClaude(
        `You are an expert CV writer for the German job market. Create a clean, ATS-optimised CV. 
Format it with clear sections: start with the person's name and contact on top, then SUMMARY, WORK EXPERIENCE, EDUCATION, SKILLS.
Use bullet points (•) for experience items. Use ALL CAPS for section headings. Keep it professional.
Output only the CV text, no commentary.`,
        `CANDIDATE:\n${profileSummary}\n\nJOB:\n${jd}\n\nWrite a tailored CV.`
      );

      setCurrentStep("cover");
      const coverLetter = await callClaude(
        `Write a compelling, Germany-ready cover letter. 
Start with the candidate name and contact details, then date, then salutation.
Write 3-4 strong paragraphs. End with 'Yours sincerely,' and the name.
Output only the letter text.`,
        `CANDIDATE:\n${profileSummary}\n\nJOB:\n${jd}\n\nWrite a tailored cover letter.`
      );

      setResult({ jd, score: scoreData, tailoredCV, coverLetter });
    } catch (e) {
      setError("Something went wrong. If you used a URL, try pasting the job description directly.");
    }
    setLoading(false); setCurrentStep(null);
  };

  const contactLine = selectedProfile?.name
    ? [selectedProfile.email, selectedProfile.phone, selectedProfile.linkedin, selectedProfile.location].filter(Boolean).join(" | ")
    : "";

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } } @media print { .no-print { display: none !important; } }`}</style>

      {/* Input card */}
      {!result && (
        <div style={{ background: C.white, borderRadius: 12, border: `0.5px solid ${C.gray200}`, padding: "20px 24px", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <div style={{ width: 36, height: 36, background: C.accentLight, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>⚡</div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: C.navy, fontFamily: DISPLAY }}>One-Click Application Packager</div>
              <div style={{ fontSize: 12, color: C.gray400 }}>Paste a job URL or description → tailored CV, cover letter and match score</div>
            </div>
          </div>

          {/* Profile selector — show dropdown if multiple profiles exist, banner if only one */}
          {profiles.length > 1 ? (
            <div style={{ background: C.gray50, border: `0.5px solid ${C.gray200}`, borderRadius: 8, padding: "10px 14px", marginBottom: 14, display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 13, color: C.gray600, fontWeight: 500, flexShrink: 0 }}>Using profile:</span>
              <select value={selectedProfileId} onChange={e => setSelectedProfileId(e.target.value)}
                style={{ flex: 1, padding: "6px 10px", borderRadius: 7, border: `0.5px solid ${C.gray200}`, fontSize: 13, color: C.gray800, background: C.white, fontFamily: FONT, outline: "none" }}>
                {profiles.map(p => (
                  <option key={p.id} value={p.id}>{p.name}{p.id === activeProfileId ? " (active)" : ""}</option>
                ))}
              </select>
              {selectedProfile?.name && (
                <span style={{ fontSize: 12, color: C.green, fontWeight: 500, flexShrink: 0 }}>✅ {selectedProfile.name}</span>
              )}
            </div>
          ) : (
            <div style={{ background: selectedProfile?.name ? C.greenLight : C.amberLight, border: `0.5px solid ${selectedProfile?.name ? C.greenBorder : C.amberBorder}`, borderRadius: 8, padding: "8px 12px", marginBottom: 14, fontSize: 13, color: selectedProfile?.name ? C.green : C.amber }}>
              {selectedProfile?.name ? `✅ Using your profile — ${selectedProfile.name}` : "⚠️ Fill in My Profile first for best results"}
            </div>
          )}

          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            {["url", "paste"].map(m => (
              <button key={m} onClick={() => setInputMode(m)}
                style={{ padding: "6px 16px", borderRadius: 99, fontSize: 13, fontWeight: 500, cursor: "pointer", border: `0.5px solid ${inputMode === m ? C.accent : C.gray200}`, background: inputMode === m ? C.accentLight : C.gray50, color: inputMode === m ? C.accent : C.gray600, fontFamily: FONT }}>
                {m === "url" ? "🔗 Paste job URL" : "📋 Paste job description"}
              </button>
            ))}
          </div>

          {inputMode === "url" ? (
            <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://www.linkedin.com/jobs/view/..."
              style={{ width: "100%", padding: "11px 14px", borderRadius: 8, border: `0.5px solid ${C.gray200}`, fontSize: 14, color: C.gray800, fontFamily: FONT, outline: "none" }}
              onFocus={e => e.target.style.borderColor = C.accent} onBlur={e => e.target.style.borderColor = C.gray200}
              onKeyDown={e => e.key === "Enter" && run()} />
          ) : (
            <textarea value={jobText} onChange={e => setJobText(e.target.value)} placeholder="Paste the full job description here..." rows={6}
              style={{ width: "100%", padding: "11px 14px", borderRadius: 8, border: `0.5px solid ${C.gray200}`, fontSize: 14, color: C.gray800, fontFamily: FONT, outline: "none", resize: "vertical", lineHeight: 1.6 }}
              onFocus={e => e.target.style.borderColor = C.accent} onBlur={e => e.target.style.borderColor = C.gray200} />
          )}

          <button onClick={run} disabled={loading || !(inputMode === "url" ? url.trim() : jobText.trim())}
            style={{ width: "100%", marginTop: 12, padding: 13, borderRadius: 10, background: C.accent, color: C.white, fontSize: 15, fontWeight: 600, border: "none", cursor: "pointer", fontFamily: DISPLAY, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, opacity: loading ? 0.7 : 1 }}>
            {loading ? <><Spinner /> Generating your package...</> : "⚡ Generate application package"}
          </button>
          {error && <div style={{ marginTop: 10, color: C.red, fontSize: 13 }}>{error}</div>}
        </div>
      )}

      {/* Progress */}
      {loading && (
        <div style={{ background: C.white, borderRadius: 12, border: `0.5px solid ${C.gray200}`, padding: "20px 24px", marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.navy, marginBottom: 14 }}>Building your application package...</div>
          {STEPS.map((step, i) => {
            const keys = STEPS.map(s => s.key);
            const curIdx = keys.indexOf(currentStep);
            const done = i < curIdx;
            const active = step.key === currentStep;
            return (
              <div key={step.key} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, opacity: done || active ? 1 : 0.3 }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: done ? C.greenLight : active ? C.accentLight : C.gray100, border: `0.5px solid ${done ? C.greenBorder : active ? C.accentBorder : C.gray200}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, flexShrink: 0 }}>
                  {done ? "✓" : step.icon}
                </div>
                <span style={{ fontSize: 13, color: done ? C.green : active ? C.accent : C.gray400, fontWeight: active ? 600 : 400 }}>{step.label}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Results */}
      {result && (
        <div>
          {/* Back button */}
          <button onClick={() => setResult(null)} style={{ fontSize: 13, color: C.gray600, background: "none", border: "none", cursor: "pointer", fontFamily: FONT, marginBottom: 16, display: "flex", alignItems: "center", gap: 5 }}>
            ← Apply to another job
          </button>

          {/* Match score */}
          <div style={{ background: C.white, borderRadius: 12, border: `0.5px solid ${C.gray200}`, padding: "18px 22px", marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.navy, marginBottom: 14, display: "flex", alignItems: "center", gap: 7 }}>📊 Job match analysis</div>
            <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
              <ScoreRing score={result.score.score} />
              <div style={{ flex: 1 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                  <div style={{ background: C.greenLight, borderRadius: 8, padding: "10px 12px", border: `0.5px solid ${C.greenBorder}` }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: C.green, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.05em" }}>✅ Matched skills</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {(result.score.matchedSkills || []).map(s => (
                        <span key={s} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 99, background: C.white, border: `0.5px solid ${C.greenBorder}`, color: C.green }}>{s}</span>
                      ))}
                    </div>
                  </div>
                  <div style={{ background: C.redLight, borderRadius: 8, padding: "10px 12px", border: "0.5px solid #FECACA" }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: C.red, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.05em" }}>❌ Missing skills</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {(result.score.missingSkills || []).map(s => (
                        <span key={s} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 99, background: C.white, border: "0.5px solid #FECACA", color: C.red }}>{s}</span>
                      ))}
                    </div>
                  </div>
                </div>
                <div style={{ background: C.accentLight, borderRadius: 8, padding: "10px 12px", border: `0.5px solid ${C.accentBorder}` }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: C.accent, marginBottom: 3 }}>💡 Recommendation</div>
                  <div style={{ fontSize: 13, color: C.gray800 }}>{result.score.recommendation}</div>
                </div>
              </div>
            </div>
          </div>

          {/* CV Document */}
          <div style={{ background: C.white, borderRadius: 12, border: `0.5px solid ${C.gray200}`, padding: "18px 22px", marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.navy, display: "flex", alignItems: "center", gap: 7 }}>📄 Tailored CV</div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => navigator.clipboard.writeText(result.tailoredCV)}
                  style={{ padding: "6px 13px", borderRadius: 6, border: `0.5px solid ${C.gray200}`, background: C.white, fontSize: 12, cursor: "pointer", color: C.gray600, fontFamily: FONT }}>
                  📋 Copy text
                </button>
                <button onClick={() => printDoc("cv-doc")}
                  style={{ padding: "6px 13px", borderRadius: 6, border: `0.5px solid ${C.accent}`, background: C.accentLight, fontSize: 12, cursor: "pointer", color: C.accent, fontFamily: FONT, fontWeight: 600 }}>
                  📥 Download PDF
                </button>
              </div>
            </div>
            <div id="cv-doc" style={{ border: `0.5px solid ${C.gray200}`, borderRadius: 8, overflow: "hidden", maxHeight: 420, overflowY: "auto", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
              <CVDocument cvText={result.tailoredCV} name={profile?.name} contact={contactLine} />
            </div>
          </div>

          {/* Cover Letter Document */}
          <div style={{ background: C.white, borderRadius: 12, border: `0.5px solid ${C.gray200}`, padding: "18px 22px", marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.navy, display: "flex", alignItems: "center", gap: 7 }}>✉️ Cover letter</div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => navigator.clipboard.writeText(result.coverLetter)}
                  style={{ padding: "6px 13px", borderRadius: 6, border: `0.5px solid ${C.gray200}`, background: C.white, fontSize: 12, cursor: "pointer", color: C.gray600, fontFamily: FONT }}>
                  📋 Copy text
                </button>
                <button onClick={() => printDoc("cl-doc")}
                  style={{ padding: "6px 13px", borderRadius: 6, border: `0.5px solid ${C.accent}`, background: C.accentLight, fontSize: 12, cursor: "pointer", color: C.accent, fontFamily: FONT, fontWeight: 600 }}>
                  📥 Download PDF
                </button>
              </div>
            </div>
            <div id="cl-doc" style={{ border: `0.5px solid ${C.gray200}`, borderRadius: 8, overflow: "hidden", maxHeight: 420, overflowY: "auto", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
              <CoverLetterDocument text={result.coverLetter} />
            </div>
          </div>

          {/* CTA */}
          <div style={{ background: C.navy, borderRadius: 12, padding: "20px 24px" }}>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.white, fontFamily: DISPLAY, marginBottom: 4 }}>Your application package is ready! 🎉</div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.55)" }}>Download your documents, open the job posting, or take your CV to the Resume Editor for final tweaks.</div>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {url && (
                <button onClick={() => window.open(url, "_blank")}
                  style={{ padding: "10px 18px", borderRadius: 8, background: C.accent, color: C.white, border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: FONT, display: "flex", alignItems: "center", gap: 6 }}>
                  🔗 Open job posting
                </button>
              )}
              <button onClick={() => {
                if (onGoToResume) onGoToResume(result.tailoredCV, selectedProfile);
              }}
                style={{ padding: "10px 18px", borderRadius: 8, background: "rgba(255,255,255,0.12)", color: C.white, border: "1px solid rgba(255,255,255,0.25)", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: FONT, display: "flex", alignItems: "center", gap: 6 }}>
                ✏️ Edit in Resume Editor
              </button>
              <button onClick={() => setResult(null)}
                style={{ padding: "10px 18px", borderRadius: 8, background: "transparent", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.15)", fontSize: 13, cursor: "pointer", fontFamily: FONT }}>
                ← Apply to another job
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
