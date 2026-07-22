import { useState, useRef } from "react";
import { callClaude, resumeDataToCVText, friendlyError, safeLink } from "./matching";
import { StaticResume } from "./cvdoc";
import { getAuthHeader } from "./supabase";

// ── ATS Scan ──────────────────────────────────────────────────────
// Scan a CV against ATS software. The CV comes from one of two sources,
// both rendered in the SAME polished resume template as the Resume editor:
//   • My profile   — the active saved profile, formatted
//   • Upload        — a PDF the user drops in, parsed by AI into the same shape
// Optionally paste a job description for real keyword matching.

const C = {
  navy: "#0F1F3D", accent: "#2563EB", accentLight: "#EFF6FF", accentBorder: "#BFDBFE",
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

// Convert a saved/parsed profile into the { name, contact, summary,
// experience[], education[], skills } shape StaticResume renders — the same
// mapping the Resume editor uses, so the preview looks identical.
const profileToResumeData = (p) => {
  if (!p || !p.name) return null;
  return {
    name: p.name,
    contact: [p.email, p.phone, safeLink(p.linkedin), p.location].filter(Boolean).join(" | "),
    summary: p.summary || "",
    education: (p.education || []).filter(e => e.school).map(e => ({
      school: e.school,
      degree: [e.degree, e.field].filter(Boolean).join(" · "),
      location: e.location,
      dates: [e.startDate, e.endDate || (e.current ? "Present" : "")].filter(Boolean).join(" – "),
    })),
    experience: (p.experience || []).filter(e => e.company).map(e => ({
      company: e.company, title: e.title, location: e.location,
      dates: [e.startDate, e.current ? "Present" : e.endDate].filter(Boolean).join(" – "),
      bullets: (e.bullets || []).filter(b => b && b.trim()),
    })),
    skills: (p.skills || []).join(" · "),
  };
};

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

const RESUME_PARSER_SYSTEM = `You are a resume parser. Extract all information from the resume and return ONLY a valid JSON object with this exact structure, no markdown, no backticks, no explanation:
{
  "name": "",
  "email": "",
  "phone": "",
  "location": "",
  "linkedin": "",
  "portfolio": "",
  "summary": "",
  "skills": ["skill1", "skill2"],
  "experience": [{"company":"","title":"","location":"","startDate":"","endDate":"","current":false,"bullets":[""]}],
  "education": [{"school":"","degree":"","field":"","location":"","startDate":"","endDate":"","gpa":""}],
  "languages": ["English"],
  "certifications": []
}`;

export default function ATSScan({ profile, profiles = [], activeProfileId, onSwitchProfile, checkAndConsumeCredit }) {
  const [source, setSource] = useState("profile"); // "profile" | "upload"
  const [uploadedProfile, setUploadedProfile] = useState(null);
  const [uploadedName, setUploadedName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef(null);

  const [jd, setJd] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // The resume data currently being scanned, formatted for StaticResume.
  const cvData = source === "profile" ? profileToResumeData(profile) : profileToResumeData(uploadedProfile);

  // ── PDF upload → AI parse (free, mirrors My Profile's uploader) ──
  const handleFile = async (file) => {
    if (!file || file.type !== "application/pdf") { setUploadError("Please upload a PDF file."); return; }
    setUploading(true); setUploadError(""); setResult(null);
    try {
      const base64 = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result.split(",")[1]);
        r.onerror = rej;
        r.readAsDataURL(file);
      });
      const authHeader = await getAuthHeader();
      const response = await fetch("/api/claude", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader },
        signal: AbortSignal.timeout(45000),
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 2000,
          system: RESUME_PARSER_SYSTEM,
          messages: [{
            role: "user",
            content: [
              { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } },
              { type: "text", text: "Parse this resume into the JSON structure specified. Extract every detail accurately." },
            ],
          }],
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error?.message || data?.error || `Request failed (${response.status})`);
      const parsed = JSON.parse((data.content?.[0]?.text || "").replace(/```json|```/g, "").trim());
      if (!parsed.name && !(parsed.experience || []).length) throw new SyntaxError("empty");
      setUploadedProfile(parsed);
      setUploadedName(file.name);
    } catch (e) {
      setUploadError(e.name === "TimeoutError"
        ? "That took too long to process. Please try again."
        : e instanceof SyntaxError
          ? "Couldn't read that PDF. Try another file, or scan your profile instead."
          : (e.message || "Something went wrong. Please try again."));
    }
    setUploading(false);
  };
  const onFileChange = (e) => { if (e.target.files[0]) handleFile(e.target.files[0]); };
  const onDrop = (e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); };

  // ── ATS scan (costs 1 credit) ────────────────────────────────────
  const scan = async () => {
    if (!cvData) return;
    if (checkAndConsumeCredit && !(await checkAndConsumeCredit())) return;
    setLoading(true); setResult(null); setError("");
    try {
      const cvText = resumeDataToCVText(cvData);
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
        `CV:\n${cvText}\n\n${jd.trim() ? `TARGET JOB:\n${jd}` : "No job description provided — evaluate against the CV's apparent target role."}\n\nReturn the ATS analysis as JSON.`
      );
      let parsed;
      try {
        parsed = JSON.parse(raw.replace(/```json|```/g, "").trim().replace(/,(\s*[}\]])/g, "$1"));
      } catch { throw new Error("The AI response came back malformed. Please try again."); }
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

  const toggleBtn = (val, label) => (
    <button onClick={() => { setSource(val); setResult(null); }}
      style={{ padding: "7px 16px", borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: "pointer",
        border: `1px solid ${source === val ? C.accent : C.gray200}`,
        background: source === val ? C.accentLight : C.white, color: source === val ? C.accent : C.gray600, fontFamily: FONT }}>
      {label}
    </button>
  );

  return (
    <div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Source toggle */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
        {toggleBtn("profile", "👤 My profile")}
        {toggleBtn("upload", "📤 Upload a resume")}
        {source === "profile" && profiles.length > 0 && (
          <select value={activeProfileId || ""} onChange={e => { onSwitchProfile(e.target.value); setResult(null); }}
            style={{ padding: "6px 10px", borderRadius: 7, border: `0.5px solid ${C.gray200}`, fontSize: 12.5, color: C.gray800, background: C.white, fontFamily: FONT, marginLeft: 4 }}>
            {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
      </div>

      <div className="ja-grid2" style={{ gap: 16, marginBottom: 14 }}>
        {/* CV column */}
        <div className="ja-card" style={{ background: C.white, borderRadius: 12, border: `0.5px solid ${C.gray200}`, padding: "16px 18px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: C.gray600 }}>Your CV *</label>
            {source === "upload" && uploadedProfile && (
              <button onClick={() => fileRef.current?.click()} style={{ fontSize: 11.5, fontWeight: 600, color: C.accent, background: "none", border: "none", cursor: "pointer", fontFamily: FONT }}>Replace file</button>
            )}
          </div>

          {source === "upload" && !uploadedProfile ? (
            // Drop zone
            <div onClick={() => fileRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              style={{ border: `2px dashed ${dragOver ? C.accent : C.gray200}`, borderRadius: 10, padding: "48px 20px", textAlign: "center", cursor: "pointer", background: dragOver ? C.accentLight : C.gray50, transition: "all 0.15s" }}>
              <input ref={fileRef} type="file" accept=".pdf" onChange={onFileChange} style={{ display: "none" }} />
              {uploading ? (
                <div style={{ fontSize: 13, color: C.gray600, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                  <span style={{ display: "inline-block", width: 20, height: 20, border: `2px solid ${C.gray200}`, borderTopColor: C.accent, borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
                  Reading your resume…
                </div>
              ) : (
                <>
                  <div style={{ fontSize: 30, marginBottom: 8 }}>📄</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: C.gray800, marginBottom: 4 }}>Drop your PDF resume here or click to upload</div>
                  <div style={{ fontSize: 12, color: C.gray400 }}>AI reads it and shows it in a clean template, ready to scan</div>
                </>
              )}
              {uploadError && <div style={{ marginTop: 12, fontSize: 12.5, color: C.red }}>{uploadError}</div>}
            </div>
          ) : cvData ? (
            // Formatted resume preview (same template as Resume editor)
            <>
              {source === "upload" && uploadedName && (
                <div style={{ fontSize: 11.5, color: C.gray400, marginBottom: 8 }}>📎 {uploadedName}</div>
              )}
              <div style={{ border: `0.5px solid ${C.gray200}`, borderRadius: 8, overflow: "hidden", maxHeight: 460, overflowY: "auto", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
                <StaticResume data={cvData} />
              </div>
              <input ref={fileRef} type="file" accept=".pdf" onChange={onFileChange} style={{ display: "none" }} />
            </>
          ) : (
            // Profile mode but the profile is empty
            <div style={{ padding: "40px 20px", textAlign: "center", color: C.gray400, fontSize: 13 }}>
              This profile is empty. Add your details in <strong style={{ color: C.gray600 }}>My profile</strong> first, or upload a resume.
            </div>
          )}
        </div>

        {/* Job description column */}
        <div className="ja-card" style={{ background: C.white, borderRadius: 12, border: `0.5px solid ${C.gray200}`, padding: "16px 18px" }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: C.gray600, display: "block", marginBottom: 10 }}>Job description (optional — enables keyword matching)</label>
          <textarea value={jd} onChange={e => setJd(e.target.value)} placeholder="Paste the job description to check your CV against it..." rows={18}
            style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: `0.5px solid ${C.gray200}`, fontSize: 13, lineHeight: 1.6, color: C.gray800, background: C.white, resize: "vertical", outline: "none", fontFamily: FONT }} />
        </div>
      </div>

      <button onClick={scan} disabled={loading || !cvData} className="ja-cta"
        style={{ width: "100%", padding: 13, borderRadius: 10, background: C.accent, color: C.white, fontSize: 14, fontWeight: 600, border: "none", cursor: (loading || !cvData) ? "not-allowed" : "pointer", fontFamily: DISPLAY, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: (loading || !cvData) ? 0.6 : 1 }}>
        {loading ? <><Spinner /> Scanning like an ATS...</> : "🛡️ Run ATS scan"}
      </button>
      {!loading && !cvData && (
        <div style={{ marginTop: 8, fontSize: 12, color: C.gray400, textAlign: "center" }}>
          {source === "upload" ? "Upload a resume to run the scan." : "Fill in your profile or upload a resume to run the scan."}
        </div>
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
