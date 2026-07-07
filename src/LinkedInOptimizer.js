import { useState } from "react";
import { getAuthHeader } from "./supabase";
import { friendlyError } from "./matching";

const C = {
  navy: "#0F1F3D", accent: "#2563EB", accentLight: "#EFF6FF", accentBorder: "#BFDBFE",
  green: "#16A34A", greenLight: "#F0FDF4", greenBorder: "#BBF7D0",
  blue: "#185FA5", blueLight: "#E6F1FB", blueBorder: "#B5D4F4",
  gray50: "#F8FAFC", gray100: "#F1F5F9", gray200: "#E2E8F0",
  gray400: "#94A3B8", gray600: "#475569", gray800: "#1E293B", white: "#FFFFFF",
};
const FONT = "'Inter', system-ui, sans-serif";
const DISPLAY = "'Plus Jakarta Sans', 'Inter', sans-serif";

const callClaude = async (system, user) => {
  const authHeader = await getAuthHeader();
  const res = await fetch("/api/claude", {
    method: "POST", headers: { "Content-Type": "application/json", ...authHeader },
    body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 1000, system, messages: [{ role: "user", content: user }] }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || data?.error || `Request failed (${res.status})`);
  return data.content?.[0]?.text || "";
};

const Spinner = () => <span style={{ display: "inline-block", width: 14, height: 14, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "white", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />;

const CopyBtn = ({ text, style: s }) => {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      style={{ padding: "5px 12px", borderRadius: 6, border: `0.5px solid ${C.gray200}`, background: C.white, fontSize: 12, cursor: "pointer", color: copied ? C.green : C.gray600, fontFamily: FONT, ...s }}>
      {copied ? "✓ Copied!" : "📋 Copy"}
    </button>
  );
};

const ScoreBar = ({ label, score, color }) => (
  <div style={{ marginBottom: 10 }}>
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
      <span style={{ fontSize: 12, color: C.gray600 }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 600, color }}>{score}/10</span>
    </div>
    <div style={{ height: 6, background: C.gray100, borderRadius: 99, overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${score * 10}%`, background: color, borderRadius: 99, transition: "width 0.6s ease" }} />
    </div>
  </div>
);

export default function LinkedInOptimizer({ profile }) {
  const [about, setAbout] = useState("");
  const [headline, setHeadline] = useState("");
  const [targetRole, setTargetRole] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const profileHint = profile?.name
    ? `Candidate: ${profile.name}. Skills: ${(profile.skills || []).join(", ")}. Experience: ${(profile.experience || []).filter(e => e.company).map(e => `${e.title} at ${e.company}`).join(", ")}.`
    : "";

  const optimize = async () => {
    setLoading(true); setResult(null); setError("");
    try {
      const raw = await callClaude(
        `You are a LinkedIn optimization expert for the German job market. Analyse and rewrite the profile. Return ONLY valid JSON, no markdown:
{
  "scores": {"headline": 7, "about": 5, "keywords": 6, "overall": 6},
  "issues": ["issue1", "issue2"],
  "optimizedHeadline": "...",
  "optimizedAbout": "...",
  "keywordsToAdd": ["keyword1", "keyword2", "keyword3"],
  "germanTips": ["tip specifically for German recruiters"]
}`,
        `CURRENT HEADLINE: ${headline || "Not provided"}\nCURRENT ABOUT: ${about || "Not provided"}\nTARGET ROLE: ${targetRole || "Not specified"}\n${profileHint}`
      );
      const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
      setResult(parsed);
    } catch (e) { setError(friendlyError(e)); }
    setLoading(false);
  };

  const scoreColor = s => s >= 8 ? C.green : s >= 6 ? C.accent : "#D97706";

  return (
    <div style={{ maxWidth: 860, margin: "0 auto" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <div style={{ background: C.white, borderRadius: 12, border: `0.5px solid ${C.gray200}`, padding: "20px 24px", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <div style={{ width: 36, height: 36, background: C.blueLight, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>💼</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: C.navy, fontFamily: DISPLAY }}>LinkedIn profile optimizer</div>
            <div style={{ fontSize: 12, color: C.gray400 }}>Rewrite your headline and About section to attract German recruiters</div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: C.gray600, display: "block", marginBottom: 5 }}>Current headline</label>
            <input value={headline} onChange={e => setHeadline(e.target.value)} placeholder="e.g. MBA Student | Project Management | Berlin"
              style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: `0.5px solid ${C.gray200}`, fontSize: 13, color: C.gray800, outline: "none", fontFamily: FONT }}
              onFocus={e => e.target.style.borderColor = C.accent} onBlur={e => e.target.style.borderColor = C.gray200} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: C.gray600, display: "block", marginBottom: 5 }}>Target role</label>
            <input value={targetRole} onChange={e => setTargetRole(e.target.value)} placeholder="e.g. Project Manager at a German tech company"
              style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: `0.5px solid ${C.gray200}`, fontSize: 13, color: C.gray800, outline: "none", fontFamily: FONT }}
              onFocus={e => e.target.style.borderColor = C.accent} onBlur={e => e.target.style.borderColor = C.gray200} />
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: C.gray600, display: "block", marginBottom: 5 }}>Current About section</label>
          <textarea value={about} onChange={e => setAbout(e.target.value)} placeholder="Paste your current LinkedIn About section here..." rows={5}
            style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: `0.5px solid ${C.gray200}`, fontSize: 13, lineHeight: 1.6, color: C.gray800, resize: "vertical", outline: "none", fontFamily: FONT }}
            onFocus={e => e.target.style.borderColor = C.accent} onBlur={e => e.target.style.borderColor = C.gray200} />
        </div>

        <button onClick={optimize} disabled={loading || (!about.trim() && !headline.trim())} className="ja-lift"
          style={{ width: "100%", padding: 12, borderRadius: 10, background: C.blue, color: C.white, fontSize: 14, fontWeight: 600, border: "none", cursor: "pointer", fontFamily: DISPLAY, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: loading ? 0.7 : 1 }}>
          {loading ? <><Spinner /> Optimising your profile...</> : "💼 Optimise for German recruiters"}
        </button>
        {error && <div style={{ marginTop: 12, fontSize: 13, color: "#DC2626", background: "#FEF2F2", border: "0.5px solid #FCA5A5", borderRadius: 8, padding: "8px 12px" }}>{error}</div>}
      </div>

      {result && (
        <div className="ja-split-240">
          {/* Scores */}
          <div className="ja-stagger" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ background: C.white, borderRadius: 12, border: `0.5px solid ${C.gray200}`, padding: "16px 18px" }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.navy, marginBottom: 14 }}>Profile scores</div>
              <ScoreBar label="Headline" score={result.scores?.headline} color={scoreColor(result.scores?.headline)} />
              <ScoreBar label="About" score={result.scores?.about} color={scoreColor(result.scores?.about)} />
              <ScoreBar label="Keywords" score={result.scores?.keywords} color={scoreColor(result.scores?.keywords)} />
              <div style={{ borderTop: `0.5px solid ${C.gray100}`, paddingTop: 10, marginTop: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: C.navy }}>Overall</span>
                  <span style={{ fontSize: 20, fontWeight: 700, color: scoreColor(result.scores?.overall), fontFamily: DISPLAY }}>{result.scores?.overall}/10</span>
                </div>
              </div>
            </div>

            <div style={{ background: C.white, borderRadius: 12, border: `0.5px solid ${C.gray200}`, padding: "16px 18px" }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.navy, marginBottom: 10 }}>Issues found</div>
              {(result.issues || []).map((issue, i) => (
                <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8, fontSize: 12, color: C.gray800, lineHeight: 1.5 }}>
                  <span style={{ color: "#DC2626", flexShrink: 0 }}>✗</span>{issue}
                </div>
              ))}
            </div>

            <div style={{ background: C.white, borderRadius: 12, border: `0.5px solid ${C.gray200}`, padding: "16px 18px" }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.navy, marginBottom: 10 }}>Keywords to add</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {(result.keywordsToAdd || []).map(k => (
                  <span key={k} style={{ fontSize: 11, padding: "3px 9px", borderRadius: 99, background: C.accentLight, color: C.accent, border: `0.5px solid ${C.accentBorder}` }}>{k}</span>
                ))}
              </div>
            </div>
          </div>

          {/* Optimised content */}
          <div className="ja-stagger" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ background: C.white, borderRadius: 12, border: `0.5px solid ${C.gray200}`, padding: "16px 18px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.navy }}>✨ Optimised headline</div>
                <CopyBtn text={result.optimizedHeadline} />
              </div>
              <div style={{ background: C.greenLight, borderRadius: 8, padding: "12px 14px", border: `0.5px solid ${C.greenBorder}`, fontSize: 14, fontWeight: 500, color: C.gray800 }}>
                {result.optimizedHeadline}
              </div>
            </div>

            <div style={{ background: C.white, borderRadius: 12, border: `0.5px solid ${C.gray200}`, padding: "16px 18px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.navy }}>✨ Optimised About section</div>
                <CopyBtn text={result.optimizedAbout} />
              </div>
              <div style={{ background: C.greenLight, borderRadius: 8, padding: "12px 14px", border: `0.5px solid ${C.greenBorder}`, fontSize: 13, color: C.gray800, lineHeight: 1.75, whiteSpace: "pre-wrap", maxHeight: 280, overflowY: "auto" }}>
                {result.optimizedAbout}
              </div>
            </div>

            <div style={{ background: C.white, borderRadius: 12, border: `0.5px solid ${C.gray200}`, padding: "16px 18px" }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.navy, marginBottom: 10 }}>🇩🇪 German recruiter tips</div>
              {(result.germanTips || []).map((tip, i) => (
                <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8, fontSize: 13, color: C.gray800, lineHeight: 1.55 }}>
                  <span style={{ color: C.green, flexShrink: 0 }}>✓</span>{tip}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
