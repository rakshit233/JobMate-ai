import { useState } from "react";

const C = {
  navy: "#0F1F3D", accent: "#2563EB", accentLight: "#EFF6FF", accentBorder: "#BFDBFE",
  green: "#16A34A", greenLight: "#F0FDF4", greenBorder: "#BBF7D0",
  amber: "#D97706", amberLight: "#FFFBEB", amberBorder: "#FDE68A",
  gray50: "#F8FAFC", gray100: "#F1F5F9", gray200: "#E2E8F0",
  gray400: "#94A3B8", gray600: "#475569", gray800: "#1E293B", white: "#FFFFFF",
};
const FONT = "'Inter', system-ui, sans-serif";
const DISPLAY = "'Plus Jakarta Sans', 'Inter', sans-serif";

const callClaude = async (system, user) => {
  const res = await fetch("/api/claude", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 1000, system, messages: [{ role: "user", content: user }] }),
  });
  const data = await res.json();
  return data.content?.[0]?.text || "";
};

const Spinner = () => <span style={{ display: "inline-block", width: 14, height: 14, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "white", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />;

const CITIES = ["Berlin", "Munich", "Hamburg", "Frankfurt", "Cologne", "Stuttgart", "Düsseldorf", "Remote"];
const LEVELS = ["Junior (0–2 years)", "Mid-level (3–5 years)", "Senior (5–8 years)", "Lead / Manager (8+ years)"];

export default function SalaryCoach({ profile }) {
  const [role, setRole] = useState(profile?.experience?.[0]?.title || "");
  const [city, setCity] = useState("Berlin");
  const [level, setLevel] = useState(LEVELS[1]);
  const [jd, setJd] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    setLoading(true); setResult(null);
    try {
      const raw = await callClaude(
        `You are a German job market salary expert. Based on real German market data for 2025-2026, provide salary guidance. Return ONLY valid JSON, no markdown:
{
  "salaryRange": {"min": 55000, "mid": 65000, "max": 78000},
  "currency": "EUR",
  "negotiationScripts": [
    {"scenario": "When asked your expectations", "script": "..."},
    {"scenario": "When they make an offer below your range", "script": "..."},
    {"scenario": "Countering with confidence", "script": "..."}
  ],
  "tips": ["tip1", "tip2", "tip3"],
  "germanContext": "One sentence about this role in the German market specifically"
}`,
        `Role: ${role}\nCity: ${city}\nExperience level: ${level}\nJob description: ${jd || "Not provided"}`
      );
      const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
      setResult(parsed);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const SalaryBar = ({ min, mid, max }) => (
    <div style={{ padding: "20px 0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        {[{ l: "Minimum", v: min, c: C.amber }, { l: "Target", v: mid, c: C.green }, { l: "Maximum", v: max, c: C.accent }].map(({ l, v, c }) => (
          <div key={l} style={{ textAlign: "center" }}>
            <div style={{ fontSize: 11, color: C.gray400, marginBottom: 2 }}>{l}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: c, fontFamily: DISPLAY }}>€{v?.toLocaleString()}</div>
          </div>
        ))}
      </div>
      <div style={{ position: "relative", height: 12, background: C.gray100, borderRadius: 99, overflow: "hidden", margin: "8px 0" }}>
        <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: "100%", background: `linear-gradient(to right, ${C.amberLight} 0%, ${C.greenLight} 50%, ${C.accentLight} 100%)`, borderRadius: 99 }} />
        <div style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", top: -2, width: 16, height: 16, background: C.green, borderRadius: "50%", border: "2px solid white" }} />
      </div>
      <div style={{ fontSize: 12, color: C.gray400, textAlign: "center" }}>Annual gross salary in Germany</div>
    </div>
  );

  return (
    <div style={{ maxWidth: 860, margin: "0 auto" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <div className="ja-split-380" style={!result ? { gridTemplateColumns: "1fr" } : undefined}>
        {/* Input */}
        <div style={{ background: C.white, borderRadius: 12, border: `0.5px solid ${C.gray200}`, padding: "20px 24px", alignSelf: "start" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <div style={{ width: 36, height: 36, background: C.amberLight, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>💰</div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: C.navy, fontFamily: DISPLAY }}>Salary negotiation coach</div>
              <div style={{ fontSize: 12, color: C.gray400 }}>German market salary ranges and negotiation scripts</div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: C.gray600, display: "block", marginBottom: 5 }}>Job title *</label>
              <input value={role} onChange={e => setRole(e.target.value)} placeholder="e.g. Product Manager"
                style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: `0.5px solid ${C.gray200}`, fontSize: 13, color: C.gray800, outline: "none", fontFamily: FONT }}
                onFocus={e => e.target.style.borderColor = C.accent} onBlur={e => e.target.style.borderColor = C.gray200} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: C.gray600, display: "block", marginBottom: 5 }}>City</label>
              <select value={city} onChange={e => setCity(e.target.value)}
                style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: `0.5px solid ${C.gray200}`, fontSize: 13, color: C.gray800, background: C.white, fontFamily: FONT }}>
                {CITIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: C.gray600, display: "block", marginBottom: 5 }}>Experience level</label>
              <select value={level} onChange={e => setLevel(e.target.value)}
                style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: `0.5px solid ${C.gray200}`, fontSize: 13, color: C.gray800, background: C.white, fontFamily: FONT }}>
                {LEVELS.map(l => <option key={l}>{l}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: C.gray600, display: "block", marginBottom: 5 }}>Job description (optional)</label>
              <textarea value={jd} onChange={e => setJd(e.target.value)} placeholder="Paste the JD for more accurate ranges..." rows={3}
                style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: `0.5px solid ${C.gray200}`, fontSize: 13, lineHeight: 1.6, color: C.gray800, resize: "vertical", outline: "none", fontFamily: FONT }}
                onFocus={e => e.target.style.borderColor = C.accent} onBlur={e => e.target.style.borderColor = C.gray200} />
            </div>
          </div>

          <button onClick={generate} disabled={loading || !role.trim()} className="ja-lift"
            style={{ width: "100%", marginTop: 14, padding: 12, borderRadius: 10, background: C.amber, color: C.white, fontSize: 14, fontWeight: 600, border: "none", cursor: "pointer", fontFamily: DISPLAY, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: loading ? 0.7 : 1 }}>
            {loading ? <><Spinner /> Researching salaries...</> : "💰 Get salary guidance"}
          </button>
        </div>

        {/* Results */}
        {result && (
          <div className="ja-stagger" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ background: C.white, borderRadius: 12, border: `0.5px solid ${C.gray200}`, padding: "18px 22px" }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.navy, marginBottom: 4 }}>Salary range — {role} in {city}</div>
              <div style={{ fontSize: 12, color: C.gray400, marginBottom: 4 }}>{level}</div>
              {result.germanContext && <div style={{ fontSize: 13, color: C.gray600, marginBottom: 4, fontStyle: "italic" }}>{result.germanContext}</div>}
              <SalaryBar min={result.salaryRange?.min} mid={result.salaryRange?.mid} max={result.salaryRange?.max} />
            </div>

            <div style={{ background: C.white, borderRadius: 12, border: `0.5px solid ${C.gray200}`, padding: "18px 22px" }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.navy, marginBottom: 14 }}>💬 Negotiation scripts</div>
              {(result.negotiationScripts || []).map((s, i) => (
                <div key={i} style={{ marginBottom: 12, paddingBottom: 12, borderBottom: i < result.negotiationScripts.length - 1 ? `0.5px solid ${C.gray100}` : "none" }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: C.amber, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.04em" }}>{s.scenario}</div>
                  <div style={{ background: C.amberLight, borderRadius: 8, padding: "10px 14px", border: `0.5px solid ${C.amberBorder}`, fontSize: 13, color: C.gray800, lineHeight: 1.65, fontStyle: "italic" }}>
                    "{s.script}"
                  </div>
                  <button onClick={() => navigator.clipboard.writeText(s.script)}
                    style={{ marginTop: 6, padding: "4px 10px", borderRadius: 6, fontSize: 11, cursor: "pointer", border: `0.5px solid ${C.gray200}`, background: C.white, color: C.gray600, fontFamily: FONT }}>
                    📋 Copy
                  </button>
                </div>
              ))}
            </div>

            <div style={{ background: C.white, borderRadius: 12, border: `0.5px solid ${C.gray200}`, padding: "18px 22px" }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.navy, marginBottom: 12 }}>🇩🇪 Germany-specific tips</div>
              {(result.tips || []).map((t, i) => (
                <div key={i} style={{ display: "flex", gap: 10, marginBottom: 10, alignItems: "flex-start" }}>
                  <div style={{ width: 20, height: 20, borderRadius: "50%", background: C.greenLight, border: `0.5px solid ${C.greenBorder}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: C.green, fontWeight: 700, flexShrink: 0 }}>{i + 1}</div>
                  <div style={{ fontSize: 13, color: C.gray800, lineHeight: 1.6 }}>{t}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
