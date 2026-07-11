import { useState, useRef, useEffect } from "react";
import { callClaude, profileSummaryText, scoreJobMatch, friendlyError, safeLink, blockedJobSite } from "./matching";
import { getAuthHeader } from "./supabase";
import { CVDocument, CoverLetterTemplate, StaticResume, printDoc, downloadWord, cleanCVText, stripMarkdown, STRUCTURED_CV_INSTRUCTION, parseStructuredCV, structuredCVToText } from "./cvdoc";

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

export default function QuickApply({ profile, profiles = [], activeProfileId, onSwitchProfile, onGoToResume, prefillJob, checkAndConsumeCredit }) {
  const [url, setUrl] = useState(prefillJob?.url || "");
  const [jobText, setJobText] = useState(prefillJob?.description || "");
  const [inputMode, setInputMode] = useState(prefillJob?.description ? "paste" : "url");
  const [blockedSite, setBlockedSite] = useState(null); // name of an unsupported site the user pasted, or null
  const dismissedUrlRef = useRef("");

  // Detect a LinkedIn/Glassdoor URL as it's entered and pop the helper dialog.
  const onUrlChange = (value) => {
    setUrl(value);
    const site = blockedJobSite(value);
    // Only pop if it's a blocked site AND not the exact URL the user just dismissed,
    // so typing/editing the same link doesn't re-trigger on every keystroke.
    if (site && value !== dismissedUrlRef.current) setBlockedSite(site);
  };

  const dismissBlocked = () => { dismissedUrlRef.current = url; setBlockedSite(null); };

  // Quick Apply stays mounted across tab switches, so a new job handed over
  // from Find Jobs arrives as a prop change, not a fresh mount — apply it here.
  useEffect(() => {
    if (!prefillJob) return;
    if (prefillJob.description) { setJobText(prefillJob.description); setInputMode("paste"); }
    else if (prefillJob.url) {
      setUrl(prefillJob.url); setInputMode("url");
      const site = blockedJobSite(prefillJob.url);
      if (site) setBlockedSite(site);
    }
    setResult(null); setError("");
  }, [prefillJob]);
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  // Profile selector — global: picking here switches the app-wide active profile
  const selectedProfile = profile;

  const profileSummary = profileSummaryText(selectedProfile);

  const run = async () => {
    const input = inputMode === "url" ? url.trim() : jobText.trim();
    if (!input) {
      setError(inputMode === "url" ? "Paste a job posting URL first." : "Paste the job description first.");
      return;
    }

    // URL mode: validate BEFORE spending anything — an invalid link should
    // never fire an API call or consume a credit.
    let normalizedUrl = null;
    if (inputMode === "url") {
      const candidate = /^https?:\/\//i.test(input) ? input : `https://${input}`;
      try {
        const parsed = new URL(candidate);
        if (!parsed.hostname.includes(".")) throw new Error("no TLD");
        normalizedUrl = parsed.toString();
      } catch {
        setError("That doesn't look like a valid link. Check the URL, or paste the job description instead.");
        return;
      }
    }

    setLoading(true); setResult(null); setError("");
    try {
      setCurrentStep("reading");

      let jd;
      if (inputMode === "paste") {
        jd = input;
      } else {
        // Fetch and read the real posting FIRST — the credit is only consumed
        // once we actually have a job description in hand. A dead link, a
        // blocked site, or a login wall costs the user nothing.
        const authHeader = await getAuthHeader();
        const res = await fetch(`/api/fetch-job?url=${encodeURIComponent(normalizedUrl)}`, {
          headers: authHeader,
          signal: AbortSignal.timeout(20000),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.error || "We couldn't read that link. Please paste the job description instead.");
          setLoading(false);
          setCurrentStep(null);
          if (data.code === "BLOCKED_SOURCE" || data.code === "TOO_SHORT") setInputMode("paste");
          return;
        }
        jd = data.text;
      }

      // Job description secured — NOW consume the credit, right before the
      // AI calls it pays for.
      if (checkAndConsumeCredit && !(await checkAndConsumeCredit())) {
        setLoading(false);
        setCurrentStep(null);
        return;
      }

      setCurrentStep("scoring");
      const scoreData = await scoreJobMatch(selectedProfile, jd);

      setCurrentStep("cv");
      const tailoredCVRaw = await callClaude(
        `You are an expert CV writer for the German job market. Create a clean, ATS-optimised CV tailored to the target job.\n${STRUCTURED_CV_INSTRUCTION}`,
        `CANDIDATE:\n${profileSummary}\n\nTARGET JOB:\n${jd}\n\nProduce the tailored CV as JSON.`
      );
      const cvStructured = parseStructuredCV(tailoredCVRaw);
      if (cvStructured) {
        cvStructured.name = selectedProfile?.name || cvStructured.name || "";
        cvStructured.contact = contactLine || cvStructured.contact || "";
      }

      setCurrentStep("cover");
      const coverLetter = await callClaude(
        `Expert cover letter writer for English speakers applying to German companies.
CRITICAL RULES:
- Output ONLY the body paragraphs — no name, no date, no "Dear ...", no contact details, no company address, no sign-off. The document template supplies all of that separately.
- 3-4 strong paragraphs: a hook connecting the candidate to the role, evidence from their background, why this company, and a confident close.
- Use ONLY facts from the candidate background provided. Never invent employers, numbers, or achievements not given.
- Plain text, no markdown, no bullet points.
Output only the letter's paragraph text, nothing else.`,
        `CANDIDATE BACKGROUND:\n${profileSummary}\n\nJOB:\n${jd}\n\nWrite the letter body only.`
      );

      // Separately pull the role + company from the JD so the template header
      // is built from extracted facts, not left to the body text.
      let clRole = "", clCompany = "";
      try {
        const meta = await callClaude(
          `Extract the job title and hiring company from this job description. Return ONLY valid JSON: {"role":"","company":""}. If either is unknown, use an empty string. No markdown.`,
          jd.slice(0, 3000)
        );
        const parsed = JSON.parse(meta.replace(/```json|```/g, "").trim());
        clRole = parsed.role || "";
        clCompany = parsed.company || "";
      } catch { /* header just omits role/company if extraction fails */ }

      setResult({ jd, score: scoreData, cvStructured, tailoredCV: cvStructured ? structuredCVToText(cvStructured) : cleanCVText(stripMarkdown(tailoredCVRaw), selectedProfile?.name), coverLetter: cleanCVText(stripMarkdown(coverLetter), null), clRole, clCompany });
    } catch (e) {
      setError(friendlyError(e));
    }
    setLoading(false); setCurrentStep(null);
  };

  const contactLine = selectedProfile?.name
    ? [selectedProfile.email, selectedProfile.phone, safeLink(selectedProfile.linkedin), selectedProfile.location].filter(Boolean).join(" | ")
    : "";

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } } @media print { .no-print { display: none !important; } }`}</style>

      {/* Unsupported-source popup: fires the moment a LinkedIn/Glassdoor link is entered */}
      {blockedSite && (
        <div onClick={dismissBlocked}
          style={{ position: "fixed", inset: 0, background: "rgba(15,31,61,0.5)", backdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, padding: 16 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: C.white, borderRadius: 16, maxWidth: 420, width: "100%", padding: "24px 26px", boxShadow: "0 24px 70px rgba(15,31,61,0.35)" }}>
            <div style={{ fontSize: 30, marginBottom: 10 }}>🔗</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: C.navy, fontFamily: DISPLAY, marginBottom: 8 }}>
              {blockedSite} links aren’t supported
            </div>
            <div style={{ fontSize: 13.5, color: C.gray600, lineHeight: 1.6, marginBottom: 20 }}>
              {blockedSite} blocks automated access, so we can’t read the job posting from that link. Please open the posting, copy the job description text, and paste it here instead.
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={dismissBlocked}
                style={{ padding: "9px 16px", borderRadius: 9, border: `1px solid ${C.gray200}`, background: C.white, fontSize: 13, fontWeight: 600, color: C.gray600, cursor: "pointer", fontFamily: FONT }}>
                Cancel
              </button>
              <button onClick={() => { setUrl(""); setInputMode("paste"); setBlockedSite(null); }}
                style={{ padding: "9px 16px", borderRadius: 9, border: "none", background: C.accent, fontSize: 13, fontWeight: 700, color: C.white, cursor: "pointer", fontFamily: FONT }}>
                Paste job description
              </button>
            </div>
          </div>
        </div>
      )}

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
              <select value={activeProfileId || ""} onChange={e => onSwitchProfile(e.target.value)}
                style={{ flex: 1, padding: "6px 10px", borderRadius: 7, border: `0.5px solid ${C.gray200}`, fontSize: 13, color: C.gray800, background: C.white, fontFamily: FONT, outline: "none" }}>
                {profiles.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
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
            <>
              <input value={url} onChange={e => onUrlChange(e.target.value)} placeholder="https://boards.greenhouse.io/... or a company careers page"
                style={{ width: "100%", padding: "11px 14px", borderRadius: 8, border: `0.5px solid ${C.gray200}`, fontSize: 14, color: C.gray800, fontFamily: FONT, outline: "none" }}
                onFocus={e => e.target.style.borderColor = C.accent} onBlur={e => e.target.style.borderColor = C.gray200}
                onKeyDown={e => e.key === "Enter" && run()} />
              <div style={{ marginTop: 7, fontSize: 11.5, color: C.gray400, lineHeight: 1.5 }}>
                Works with most job boards and careers pages. LinkedIn and Glassdoor block automated access — for those, use “Paste job description”.
              </div>
            </>
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
            <div style={{ display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>
              <ScoreRing score={result.score.score} />
              <div style={{ flex: 1 }}>
                <div className="ja-grid2" style={{ gap: 10, marginBottom: 10 }}>
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
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button onClick={() => { if (onGoToResume) onGoToResume(result.tailoredCV, selectedProfile); }}
                  style={{ padding: "6px 13px", borderRadius: 6, border: `0.5px solid ${C.gray200}`, background: C.white, fontSize: 12, cursor: "pointer", color: C.gray600, fontFamily: FONT }}>
                  ✏️ Edit in Resume editor
                </button>
                <button onClick={() => navigator.clipboard.writeText(result.tailoredCV)}
                  style={{ padding: "6px 13px", borderRadius: 6, border: `0.5px solid ${C.gray200}`, background: C.white, fontSize: 12, cursor: "pointer", color: C.gray600, fontFamily: FONT }}>
                  📋 Copy text
                </button>
                <button onClick={() => downloadWord("cv-doc", `CV-${selectedProfile?.name || "JobMate"}`)}
                  style={{ padding: "6px 13px", borderRadius: 6, border: `0.5px solid ${C.gray200}`, background: C.white, fontSize: 12, cursor: "pointer", color: C.gray600, fontFamily: FONT, fontWeight: 600 }}>
                  📄 Word
                </button>
                <button onClick={() => printDoc("cv-doc")}
                  style={{ padding: "6px 13px", borderRadius: 6, border: `0.5px solid ${C.accent}`, background: C.accentLight, fontSize: 12, cursor: "pointer", color: C.accent, fontFamily: FONT, fontWeight: 600 }}>
                  📥 PDF
                </button>
              </div>
            </div>
            <div id="cv-doc" style={{ border: `0.5px solid ${C.gray200}`, borderRadius: 8, overflow: "hidden", maxHeight: 420, overflowY: "auto", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
              {result.cvStructured
                ? <StaticResume data={result.cvStructured} />
                : <CVDocument cvText={result.tailoredCV} name={selectedProfile?.name} contact={contactLine} />}
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
                <button onClick={() => downloadWord("cl-doc", `Cover-Letter-${selectedProfile?.name || "JobMate"}`)}
                  style={{ padding: "6px 13px", borderRadius: 6, border: `0.5px solid ${C.gray200}`, background: C.white, fontSize: 12, cursor: "pointer", color: C.gray600, fontFamily: FONT, fontWeight: 600 }}>
                  📄 Word
                </button>
                <button onClick={() => printDoc("cl-doc")}
                  style={{ padding: "6px 13px", borderRadius: 6, border: `0.5px solid ${C.accent}`, background: C.accentLight, fontSize: 12, cursor: "pointer", color: C.accent, fontFamily: FONT, fontWeight: 600 }}>
                  📥 PDF
                </button>
              </div>
            </div>
            <div id="cl-doc" style={{ border: `0.5px solid ${C.gray200}`, borderRadius: 8, overflow: "hidden", maxHeight: 420, overflowY: "auto", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
              <CoverLetterTemplate
                name={selectedProfile?.name}
                role={result.clRole}
                company={result.clCompany}
                contact={contactLine}
                body={result.coverLetter}
              />
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
