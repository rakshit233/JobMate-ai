import { useState, useEffect } from "react";
import { callClaude, profileToCVText, friendlyError } from "./matching";

// ── ATS Scan ──────────────────────────────────────────────────────
// Paste a CV (or fill from profile) + optionally a job description →
// ATS compatibility score with a category breakdown, matched/missing
// keywords, and concrete fixes. Same AI pipeline + credit system as
// Quick Apply / CV Tailor.

const C = {
  navy: "#0F1F3D", accent: "#2563EB", accentLight: "#EFF6FF",
  green: "#16A34A", greenLight: "#F0FDF4", greenBorder: "#BBF7D0",
  amber: "#D97706", amberLight: "#FFFBEB",
  red: "#DC2626", redLight: "#FEF2F2", redBorder: "#FCA5A5",
  gray50: "#F8FAFC", gray100: "#F1F5F9", gray200: "#E2E8F0",
  gray400: "#94A3B8", gray600: "#475569", gray800: "#1E293B", white: "#FFFFFF",
};
const FONT = "'Inter', system-ui, sans-serif";
const DISPLAY = "'Plus Jakarta Sans', 'Inter', sans-serif";

const Spinner = () => <span style={{ display: "inline-block", width: 14, height: 14, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "white", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />;

const scoreColor = (s) => (s >= 75 ? C.green : s >= 50 ? C.amber : C.red);
const scoreBg = (s) => (s >= 75 ? C.greenLight : s >= 50 ? C.amberLight : C.redLight);

const ScoreBar = ({ label, score }) => (
  <div style={{ marginBottom: 12 }}>
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: C.gray600 }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 700, color: scoreColor(score) }}>{score}</span>
    </div>
    <div style={{ height: 6, borderRadius: 99, background: C.gray100, overflow: "hidden" }}>
      <div style={{ width: `${Math.max(2, Math.min(100, score))}%`, height: "100%", borderRadius: 99, background: scoreColor(score), transition: "width 0.6s ease" }} />
    </div>
  </div>
);

const SEVERITY = {
  high:   { label: "Critical", color: C.red,   bg: C.redLight },
  medium: { label: "Fix soon", color: C.amber, bg: C.amberLight },
  low:    { label: "Minor",    color: C.gray600, bg: C.gray100 },
};

export default function ATSScan({ profile, profiles = [], activeProfileId, onSwitchProfile, checkAndConsumeCredit }) {
  const [cv, setCv] = useState(profileToCVText(profile));
  const [jd, setJd] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Seed the CV box once the profile arrives from Supabase (same late-load
  // pattern as CV Tailor) — never overwrite text the user already entered.
  useEffect(() => {
    if (profile?.name && !cv.trim()) setCv(profileToCVText(profile));
  }, [profile?.name]); // eslint-disable-line

  const scan = async () => {
    if (checkAndConsumeCredit && !(await checkAndConsumeCredit())) return;
    setLoading(true); setResult(null); setError("");
    try {
      const raw = await callClaude(
        `You are an ATS (Applicant Tracking System) expert for the German job market. Analyse the CV the way real ATS software parses it. Return ONLY valid JSON (no markdown, no backticks):
{
  "overall": 72,
  "scores": { "keywords": 65, "formatting": 80, "sections": 75, "impact": 60 },
  "matchedKeywords": ["skill the CV shares with the job"],
  "missingKeywords": ["important term from the job the CV lacks"],
  "issues": [{ "severity": "high|medium|low", "text": "specific problem, one sentence" }],
  "fixes": ["concrete, actionable improvement, one sentence each"]
}
Rules:
- "keywords": how well the CV's terms match the job description (or the CV's own target field if no JD given).
- "formatting": ATS-parseability — standard section headings, no tables/columns/graphics implied, consistent dates, parseable contact line.
- "sections": presence and completeness of Summary, Experience, Education, Skills.
- "impact": measurable achievements, action verbs, quantified results.
- If no job description is provided, set matchedKeywords/missingKeywords from the CV's apparent target role.
- 3-6 issues, 3-5 fixes. Be specific to THIS CV — never generic advice.`,
        `CV:\n${cv}\n\n${jd.trim() ? `TARGET JOB:\n${jd}` : "No job description provided — evaluate against the CV's apparent target role."}\n\nReturn the ATS analysis as JSON.`
      );
      let parsed;
      try {
        parsed = JSON.parse(raw.replace(/```json|```/g, "").trim().replace(/,(\s*[}\]])/g, "$1"));
      } catch {
        throw new Error("The AI response came back malformed. Please try again.");
      }
      setResult({
        overall: Math.max(0, Math.min(100, parsed.overall || 0)),
        scores: parsed.scores || {},
        matchedKeywords: Array.isArray(parsed.matchedKeywords) ? parsed.matchedKeywords : [],
        missingKeywords: Array.isArray(parsed.missingKeywords) ? parsed.missingKeywords : [],
        issues: Array.isArray(parsed.issues) ? parsed.issues : [],
        fixes: Array.isArray(parsed.fixes) ? parsed.fixes : [],
      });
    } catch (e) { setError(friendlyError(e)); }
    setLoading(false);
  };

  return (
    <div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Fill from profile */}
      <div style={{ marginBottom: 14, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: C.gray600 }}>Fill from profile:</span>
        <select value={activeProfileId || ""} onChange={e => onSwitchProfile(e.target.value)}
          style={{ padding: "5px 10px", borderRadius: 7, border: `0.5px solid ${C.gray200}`, fontSize: 12.5, color: C.gray800, background: C.white, fontFamily: FONT }}>
          {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <button onClick={() => setCv(profileToCVText(profile))} disabled={!profile?.name} className="ja-lift"
          style={{ padding: "5px 13px", borderRadius: 7, border: "none", background: C.accentLight, color: C.accent, fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: FONT, opacity: profile?.name ? 1 : 0.5 }}>
          ↻ Fill CV
        </button>
      </div>

      <div className="ja-grid2" style={{ gap: 16, marginBottom: 14 }}>
        <div className="ja-card" style={{ background: C.white, borderRadius: 12, border: `0.5px solid ${C.gray200}`, padding: "18px 22px" }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: C.gray600, display: "block", marginBottom: 5 }}>Your CV *</label>
          <textarea value={cv} onChange={e => setCv(e.target.value)} placeholder="Paste your full CV text here..." rows={12}
            style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: `0.5px solid ${C.gray200}`, fontSize: 13, lineHeight: 1.6, color: C.gray800, background: C.white, resize: "vertical", outline: "none", fontFamily: FONT }} />
        </div>
        <div className="ja-card" style={{ background: C.white, borderRadius: 12, border: `0.5px solid ${C.gray200}`, padding: "18px 22px" }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: C.gray600, display: "block", marginBottom: 5 }}>Job description (optional — enables keyword matching)</label>
          <textarea value={jd} onChange={e => setJd(e.target.value)} placeholder="Paste the job description to check your CV against it..." rows={12}
            style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: `0.5px solid ${C.gray200}`, fontSize: 13, lineHeight: 1.6, color: C.gray800, background: C.white, resize: "vertical", outline: "none", fontFamily: FONT }} />
        </div>
      </div>

      <button onClick={scan} disabled={loading || !cv.trim()} className="ja-cta"
        style={{ width: "100%", padding: 13, borderRadius: 10, background: C.accent, color: C.white, fontSize: 14, fontWeight: 600, border: "none", cursor: "pointer", fontFamily: DISPLAY, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: loading ? 0.7 : 1 }}>
        {loading ? <><Spinner /> Scanning like an ATS...</> : "🛡️ Run ATS scan"}
      </button>
      {!loading && !cv.trim() && (
        <div style={{ marginTop: 8, fontSize: 12, color: C.gray400, textAlign: "center" }}>Add your CV to run the scan.</div>
      )}
      {error && <div style={{ marginTop: 12, fontSize: 13, color: C.red, background: C.redLight, border: `0.5px solid ${C.redBorder}`, borderRadius: 8, padding: "8px 12px" }}>{error}</div>}

      {result && (
        <div className="ja-stagger" style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Overall + breakdown */}
          <div className="ja-card" style={{ background: C.white, borderRadius: 12, border: `0.5px solid ${C.gray200}`, padding: "20px 24px", display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ textAlign: "center", flexShrink: 0 }}>
              <div style={{ width: 92, height: 92, borderRadius: "50%", background: scoreBg(result.overall), border: `3px solid ${scoreColor(result.overall)}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: 28, fontWeight: 800, color: scoreColor(result.overall), fontFamily: DISPLAY, lineHeight: 1 }}>{result.overall}</span>
                <span style={{ fontSize: 10, color: C.gray400, marginTop: 2 }}>/ 100</span>
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.gray600, marginTop: 6 }}>ATS score</div>
            </div>
            <div style={{ flex: 1, minWidth: 220 }}>
              <ScoreBar label="Keyword match" score={result.scores.keywords ?? 0} />
              <ScoreBar label="Formatting & parseability" score={result.scores.formatting ?? 0} />
              <ScoreBar label="Section completeness" score={result.scores.sections ?? 0} />
              <ScoreBar label="Impact & action verbs" score={result.scores.impact ?? 0} />
            </div>
          </div>

          {/* Keywords */}
          {(result.matchedKeywords.length > 0 || result.missingKeywords.length > 0) && (
            <div className="ja-grid2" style={{ gap: 14 }}>
              <div className="ja-card" style={{ background: C.white, borderRadius: 12, border: `0.5px solid ${C.gray200}`, padding: "16px 20px" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.green, marginBottom: 10 }}>✓ Keywords found ({result.matchedKeywords.length})</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {result.matchedKeywords.map(k => (
                    <span key={k} style={{ fontSize: 11.5, padding: "3px 10px", borderRadius: 99, background: C.greenLight, color: C.green, border: `0.5px solid ${C.greenBorder}` }}>{k}</span>
                  ))}
                </div>
              </div>
              <div className="ja-card" style={{ background: C.white, borderRadius: 12, border: `0.5px solid ${C.gray200}`, padding: "16px 20px" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.red, marginBottom: 10 }}>✗ Missing keywords ({result.missingKeywords.length})</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {result.missingKeywords.map(k => (
                    <span key={k} style={{ fontSize: 11.5, padding: "3px 10px", borderRadius: 99, background: C.redLight, color: C.red, border: `0.5px solid ${C.redBorder}` }}>{k}</span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Issues */}
          {result.issues.length > 0 && (
            <div className="ja-card" style={{ background: C.white, borderRadius: 12, border: `0.5px solid ${C.gray200}`, padding: "16px 20px" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.navy, marginBottom: 10 }}>⚠️ Issues detected</div>
              {result.issues.map((issue, i) => {
                const sev = SEVERITY[issue.severity] || SEVERITY.low;
                return (
                  <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 8 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: sev.color, background: sev.bg, padding: "2px 8px", borderRadius: 99, flexShrink: 0, marginTop: 1 }}>{sev.label}</span>
                    <span style={{ fontSize: 13, color: C.gray800, lineHeight: 1.5 }}>{issue.text}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Fixes */}
          {result.fixes.length > 0 && (
            <div className="ja-card" style={{ background: C.accentLight, borderRadius: 12, border: `0.5px solid #BFDBFE`, padding: "16px 20px" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.accent, marginBottom: 10 }}>💡 How to improve</div>
              {result.fixes.map((f, i) => (
                <div key={i} style={{ display: "flex", gap: 8, marginBottom: 7, fontSize: 13, color: C.gray800, lineHeight: 1.5 }}>
                  <span style={{ color: C.accent, fontWeight: 700 }}>{i + 1}.</span>{f}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
