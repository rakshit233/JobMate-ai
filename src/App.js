import { useState, useEffect, useRef } from "react";
import ResumeEditor from "./ResumeEditor";
import ProfilePage, { EMPTY_PROFILE } from "./ProfilePage";
import QuickApply from "./QuickApply";
import InterviewPrep from "./InterviewPrep";
import SalaryCoach from "./SalaryCoach";
import LinkedInOptimizer from "./LinkedInOptimizer";
import FindJobs from "./FindJobs";
import LoginPage from "./LoginPage";
import { profileToCVText, resumeDataToCVText, friendlyError, safeLink } from "./matching";
import { CVDocument, CoverLetterTemplate, StaticResume, printDoc, downloadWord, cleanCVText, stripMarkdown, splitCVHeader, STRUCTURED_CV_INSTRUCTION, parseStructuredCV, structuredCVToText, salvageJsonText } from "./cvdoc";
import {
  supabase, signOut, getAuthHeader,
  listResumeVersions, saveResumeVersion, deleteResumeVersion, findBestMatchingVersion,
  listTrackerEntries, saveTrackerEntry, deleteTrackerEntry,
  listProfiles, insertProfile, updateProfileFields, deleteProfileRow, setActiveProfileRow,
  getSubscription, getUsageThisMonth, consumeUsageCredit, openBillingPortal,
} from "./supabase";
import PricingModal from "./PricingModal";

const C = {
  navy: "#0F1F3D",              // headings only — no longer a surface color
  sidebarBg: "rgba(255,255,255,0.92)",
  navHover: "rgba(37,99,235,0.06)",
  navActive: "linear-gradient(120deg, rgba(37,99,235,0.12), rgba(56,189,248,0.10))",
  cyan: "#38BDF8",
  accent: "#2563EB",
  accentLight: "#EFF6FF",
  gray50: "#F8FAFC",
  gray100: "#F1F5F9",
  gray200: "#E2E8F0",
  gray400: "#94A3B8",
  gray600: "#475569",
  gray800: "#1E293B",
  white: "#FFFFFF",
  green: "#16A34A",
  greenLight: "#F0FDF4",
  red: "#DC2626",
  redLight: "#FEF2F2",
};
const FONT = "'Inter', system-ui, sans-serif";
const DISPLAY = "'Plus Jakarta Sans', 'Inter', sans-serif";

// ── Shared UI ─────────────────────────────────────────────────────
const callClaude = async (system, user) => {
  const authHeader = await getAuthHeader();
  const res = await fetch("/api/claude", {
    method: "POST", headers: { "Content-Type": "application/json", ...authHeader },
    body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 1000, system, messages: [{ role: "user", content: user }] }),
  });
  const data = await res.json();
  return data.content?.[0]?.text || "";
};

const Spinner = () => <span style={{ display: "inline-block", width: 14, height: 14, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "white", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />;

// Animated number — eases up to its value, respects reduced motion
const CountUp = ({ value, style: s }) => {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !value) { setV(value); return; }
    let raf; const start = performance.now(); const dur = 700;
    const tick = (now) => {
      const p = Math.min((now - start) / dur, 1);
      setV(Math.round(value * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <div style={s}>{v}</div>;
};

const Label = ({ children }) => <label style={{ fontSize: 12, fontWeight: 600, color: C.gray600, display: "block", marginBottom: 5 }}>{children}</label>;

const Input = ({ value, onChange, placeholder, type = "text" }) => (
  <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
    style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: `0.5px solid ${C.gray200}`, fontSize: 13, color: C.gray800, background: C.white, outline: "none", fontFamily: FONT }}
    onFocus={e => e.target.style.borderColor = C.accent} onBlur={e => e.target.style.borderColor = C.gray200} />
);

const TextArea = ({ value, onChange, placeholder, rows = 5 }) => (
  <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows}
    style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: `0.5px solid ${C.gray200}`, fontSize: 13, lineHeight: 1.6, color: C.gray800, background: C.white, resize: "vertical", outline: "none", fontFamily: FONT }}
    onFocus={e => e.target.style.borderColor = C.accent} onBlur={e => e.target.style.borderColor = C.gray200} />
);

const Card = ({ children, style: s }) => (
  <div className="ja-card" style={{ background: C.white, borderRadius: 12, border: `0.5px solid ${C.gray200}`, padding: "18px 22px", ...s }}>{children}</div>
);

const ResultBox = ({ content }) => (
  <div style={{ background: C.accentLight, border: `0.5px solid #BFDBFE`, borderRadius: 10, padding: 16, marginTop: 14 }}>
    <div style={{ fontSize: 11, fontWeight: 700, color: C.accent, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>Result — ready to use</div>
    <div style={{ fontSize: 13, lineHeight: 1.75, color: C.gray800, whiteSpace: "pre-wrap" }}>{content}</div>
    <button onClick={() => navigator.clipboard.writeText(content)}
      style={{ marginTop: 10, padding: "5px 12px", borderRadius: 6, border: `0.5px solid ${C.gray200}`, background: C.white, fontSize: 12, cursor: "pointer", color: C.gray600, fontFamily: FONT }}>
      📋 Copy
    </button>
  </div>
);

// ── CV Tailor ─────────────────────────────────────────────────────
const CVTailor = ({ profile, profiles = [], activeProfileId, onSwitchProfile, onGoToResume, resumeVersions = [], checkAndConsumeCredit }) => {
  const [cv, setCv] = useState(profileToCVText(profile));

  // Same late-load race as CoverLetter: seed the CV box once the profile
  // actually arrives from Supabase, but never overwrite user-entered text.
  useEffect(() => {
    if (profile?.name && !cv.trim()) setCv(profileToCVText(profile));
  }, [profile?.name]);
  const [jd, setJd] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [cvView, setCvView] = useState("edit"); // edit | preview
  const [selectedVersionId, setSelectedVersionId] = useState(null);
  const [autoMatched, setAutoMatched] = useState(false);
  const [manualFill, setManualFill] = useState(false); // true after user explicitly fills from a profile

  // Auto-select the version most recently tailored for a similar role, based on
  // job title appearing in the pasted JD. Keyword overlap only — no AI call needed.
  useEffect(() => {
    if (!resumeVersions.length || !jd.trim() || selectedVersionId || manualFill) return;
    const firstLine = jd.trim().split("\n")[0].toLowerCase();
    const words = firstLine.split(/\s+/).filter(w => w.length > 2);
    let best = null, bestScore = 0;
    for (const v of resumeVersions) {
      const role = (v.last_tailored_role || "").toLowerCase();
      const score = words.reduce((acc, w) => acc + (role.includes(w) ? 1 : 0), 0);
      if (score > bestScore) { bestScore = score; best = v; }
    }
    if (best) {
      setSelectedVersionId(best.id);
      setAutoMatched(true);
      setCv(resumeDataToCVText(best.data));
    }
  }, [jd]);

  const applyVersion = (id) => {
    setSelectedVersionId(id);
    setAutoMatched(false);
    setManualFill(false);
    if (!id) return;
    const v = resumeVersions.find(x => x.id === id);
    if (!v) return;
    setCv(resumeDataToCVText(v.data));
  };

  return (
    <div>
      <div style={{ marginBottom: 14, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: C.gray600 }}>Fill from profile:</span>
        <select value={activeProfileId || ""} onChange={e => onSwitchProfile(e.target.value)}
          style={{ padding: "5px 10px", borderRadius: 7, border: `0.5px solid ${C.gray200}`, fontSize: 12.5, color: C.gray800, background: C.white, fontFamily: FONT }}>
          {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <button onClick={() => { setCv(profileToCVText(profile)); setSelectedVersionId(null); setAutoMatched(false); setManualFill(true); }}
          disabled={!profile?.name}
          className="ja-lift"
          style={{ padding: "5px 13px", borderRadius: 7, border: "none", background: C.accentLight, color: C.accent, fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: FONT, opacity: profile?.name ? 1 : 0.5 }}>
          ↻ Fill CV
        </button>
        {!profile?.name && <span style={{ fontSize: 11, color: C.gray400 }}>This profile is empty — add details in My profile first</span>}
      </div>
      {resumeVersions.length > 0 && (
        <div style={{ marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: C.gray600 }}>Resume version:</span>
          <select value={selectedVersionId || ""} onChange={e => applyVersion(e.target.value)}
            style={{ padding: "5px 10px", borderRadius: 7, border: `0.5px solid ${C.gray200}`, fontSize: 12.5, color: C.gray800, background: C.white, fontFamily: FONT }}>
            <option value="">— Use profile default —</option>
            {resumeVersions.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
          {autoMatched && <span style={{ fontSize: 11, color: C.accent }}>✓ Auto-matched to job title</span>}
        </div>
      )}
      <div className="ja-grid2" style={{ gap: 16, marginBottom: 14 }}>
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <Label>Your current CV</Label>
            <div style={{ display: "flex", gap: 4 }}>
              {["edit", "preview"].map(v => (
                <button key={v} onClick={() => setCvView(v)}
                  style={{ padding: "3px 12px", borderRadius: 99, fontSize: 11.5, fontWeight: 600, cursor: "pointer", border: `0.5px solid ${cvView === v ? C.accent : C.gray200}`, background: cvView === v ? C.accentLight : C.white, color: cvView === v ? C.accent : C.gray400, fontFamily: FONT }}>
                  {v === "edit" ? "✏️ Edit" : "👁 Preview"}
                </button>
              ))}
            </div>
          </div>
          {cvView === "edit" ? (
            <TextArea value={cv} onChange={setCv} placeholder="Paste your full CV text here..." rows={12} />
          ) : (
            (() => {
              const h = splitCVHeader(cv);
              return (
                <div style={{ border: `0.5px solid ${C.gray200}`, borderRadius: 8, maxHeight: 320, overflowY: "auto", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
                  {cv.trim()
                    ? <CVDocument cvText={h.body} name={h.name || profile?.name} contact={h.contact} />
                    : <div style={{ padding: 24, fontSize: 13, color: C.gray400, textAlign: "center" }}>Nothing to preview yet — fill or paste your CV first.</div>}
                </div>
              );
            })()
          )}
        </Card>
        <Card><Label>Job description</Label><TextArea value={jd} onChange={setJd} placeholder="Paste the full job description..." rows={12} /></Card>
      </div>
      <button onClick={async () => {
        if (checkAndConsumeCredit && !(await checkAndConsumeCredit())) return;
        setLoading(true); setResult(""); setError("");
        try {
          const r = await callClaude(
            `You are an expert CV writer for the German job market. Rewrite and tailor the candidate's CV to match the target job. ATS-optimised, strong action verbs, concise.\n${STRUCTURED_CV_INSTRUCTION}`,
            `CANDIDATE CV:\n${cv}\n\nTARGET JOB:\n${jd}\n\nProduce the tailored CV as JSON.`
          );
          const structured = parseStructuredCV(r);
          if (structured) {
            // Fill header identity from the profile/pasted CV, not the model.
            structured.name = splitCVHeader(cv).name || profile?.name || structured.name || "";
            structured.contact = splitCVHeader(cv).contact || [profile?.email, profile?.phone, profile?.location, safeLink(profile?.linkedin)].filter(Boolean).join(" | ") || structured.contact || "";
            setResult({ structured, text: structuredCVToText(structured) });
          } else {
            // Fallback: model didn't return usable JSON — keep the old text render.
            setResult({ structured: null, text: salvageJsonText(cleanCVText(stripMarkdown(r), splitCVHeader(cv).name || profile?.name)) });
          }
        } catch(e){ setError(friendlyError(e)); }
        setLoading(false);
      }} disabled={loading || !cv.trim() || !jd.trim()}
        className="ja-cta" style={{ width: "100%", padding: 13, borderRadius: 10, background: C.accent, color: C.white, fontSize: 14, fontWeight: 600, border: "none", cursor: "pointer", fontFamily: DISPLAY, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: loading ? 0.7 : 1 }}>
        {loading ? <><Spinner /> Tailoring...</> : "✨ Tailor my CV for this job"}
      </button>
      {!loading && (!cv.trim() || !jd.trim()) && (
        <div style={{ marginTop: 8, fontSize: 12, color: C.gray400, textAlign: "center" }}>
          Add {[!cv.trim() && "your CV", !jd.trim() && "the job description"].filter(Boolean).join(" and ")} to enable tailoring.
        </div>
      )}
      {error && <div style={{ marginTop: 12, fontSize: 13, color: "#DC2626", background: "#FEF2F2", border: "0.5px solid #FCA5A5", borderRadius: 8, padding: "8px 12px" }}>{error}</div>}
      {result && (() => {
        const inHeader = splitCVHeader(cv);
        const docName = (result.structured && result.structured.name) || inHeader.name || profile?.name || "";
        const docContact = (result.structured && result.structured.contact) || inHeader.contact || [profile?.email, profile?.phone, profile?.location, safeLink(profile?.linkedin)].filter(Boolean).join(" | ");
        return (
          <Card style={{ marginTop: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.accent, letterSpacing: "0.08em", textTransform: "uppercase" }}>✨ Tailored CV — ready to use</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button onClick={() => navigator.clipboard.writeText(result.text)}
                  style={{ padding: "6px 13px", borderRadius: 6, border: `0.5px solid ${C.gray200}`, background: C.white, fontSize: 12, cursor: "pointer", color: C.gray600, fontFamily: FONT }}>
                  📋 Copy text
                </button>
                {onGoToResume && (
                  <button onClick={() => onGoToResume(result.text, profile)}
                    style={{ padding: "6px 13px", borderRadius: 6, border: `0.5px solid ${C.gray200}`, background: C.white, fontSize: 12, cursor: "pointer", color: C.gray600, fontFamily: FONT }}>
                    ✏️ Edit in Resume editor
                  </button>
                )}
                <button onClick={() => downloadWord("cvtailor-doc", `CV-${docName || "JobMate"}`)}
                  style={{ padding: "6px 13px", borderRadius: 6, border: `0.5px solid ${C.gray200}`, background: C.white, fontSize: 12, cursor: "pointer", color: C.gray600, fontFamily: FONT, fontWeight: 600 }}>
                  📄 Word
                </button>
                <button onClick={() => printDoc("cvtailor-doc")}
                  style={{ padding: "6px 13px", borderRadius: 6, border: `0.5px solid ${C.accent}`, background: C.accentLight, fontSize: 12, cursor: "pointer", color: C.accent, fontFamily: FONT, fontWeight: 600 }}>
                  📥 PDF
                </button>
              </div>
            </div>
            <div id="cvtailor-doc" style={{ border: `0.5px solid ${C.gray200}`, borderRadius: 8, overflow: "hidden", maxHeight: 480, overflowY: "auto", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
              {result.structured
                ? <StaticResume data={result.structured} />
                : <CVDocument cvText={result.text} name={docName} contact={docContact} />}
            </div>
          </Card>
        );
      })()}
    </div>
  );
};

// ── Cover Letter ──────────────────────────────────────────────────
const CoverLetter = ({ profile, checkAndConsumeCredit }) => {
  const [name, setName] = useState(profile?.name || "");
  const [role, setRole] = useState("");
  const [company, setCompany] = useState("");
  const [bg, setBg] = useState(profile?.summary || "");

  // This tab stays mounted from app load, which can be BEFORE profiles
  // finish loading from Supabase — so the initial useState seeding sees an
  // empty profile. Seed again when the data arrives, but only into fields
  // the user hasn't touched.
  useEffect(() => {
    if (profile?.name && !name) setName(profile.name);
    if (profile?.summary && !bg) setBg(profile.summary);
  }, [profile?.name, profile?.summary]);
  const [jd, setJd] = useState("");
  const [tone, setTone] = useState("professional");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  return (
    <div>
      <div className="ja-grid2" style={{ gap: 16, marginBottom: 14 }}>
        <Card>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div><Label>Your full name</Label><Input value={name} onChange={setName} placeholder="e.g. Rakshit Tiwari" /></div>
            <div><Label>Role applying for</Label><Input value={role} onChange={setRole} placeholder="e.g. Product Manager" /></div>
            <div><Label>Company name</Label><Input value={company} onChange={setCompany} placeholder="e.g. Zalando" /></div>
            <div>
              <Label>Tone</Label>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {["professional","enthusiastic","concise","creative"].map(t => (
                  <button key={t} onClick={() => setTone(t)} style={{ padding: "5px 13px", borderRadius: 99, fontSize: 12, fontWeight: 500, cursor: "pointer", border: `0.5px solid ${tone===t ? C.accent : C.gray200}`, background: tone===t ? C.accentLight : C.gray50, color: tone===t ? C.accent : C.gray600, fontFamily: FONT }}>
                    {t.charAt(0).toUpperCase()+t.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Card>
        <Card>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div><Label>Your key background</Label><TextArea value={bg} onChange={setBg} placeholder="e.g. 3 years in project management, MBA Berlin..." rows={5} /></div>
            <div><Label>Job description (optional)</Label><TextArea value={jd} onChange={setJd} placeholder="Paste for a more tailored letter..." rows={4} /></div>
          </div>
        </Card>
      </div>
      <button onClick={async () => {
        if (checkAndConsumeCredit && !(await checkAndConsumeCredit())) return;
        setLoading(true); setResult(""); setError("");
        try {
          const r = await callClaude(
            `Expert cover letter writer for English speakers applying to German companies.
CRITICAL RULES:
- Output ONLY the body paragraphs — no name, no date, no "Dear Hiring Manager", no company address, no sign-off. The document template supplies all of that separately.
- 3-4 strong paragraphs: a hook connecting the candidate to the role, evidence from their background, why this company, and a confident close.
- Use ONLY facts from the background provided. Never invent employers, numbers, or achievements not given.
- Plain text, no markdown, no bullet points.
Output only the letter's paragraph text, nothing else.`,
            `Name:${name}\nRole:${role}\nCompany:${company}\nBackground:${bg}\nJD:${jd}\nTone:${tone}\n\nWrite the letter body only.`
          );
          setResult(stripMarkdown(r));
        } catch(e){ setError(friendlyError(e)); }
        setLoading(false);
      }} disabled={loading || !name || !role || !company || !bg}
        className="ja-cta" style={{ width: "100%", padding: 13, borderRadius: 10, background: C.accent, color: C.white, fontSize: 14, fontWeight: 600, border: "none", cursor: "pointer", fontFamily: DISPLAY, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: loading ? 0.7 : 1 }}>
        {loading ? <><Spinner /> Writing...</> : "✨ Generate cover letter"}
      </button>
      {!loading && (!name || !role || !company || !bg) && (
        <div style={{ marginTop: 8, fontSize: 12, color: C.gray400, textAlign: "center" }}>
          Fill in {[!name && "your name", !role && "the role", !company && "the company", !bg && "your background"].filter(Boolean).join(", ")} to enable generation.
        </div>
      )}
      {error && <div style={{ marginTop: 12, fontSize: 13, color: "#DC2626", background: "#FEF2F2", border: "0.5px solid #FCA5A5", borderRadius: 8, padding: "8px 12px" }}>{error}</div>}
      {result && (() => {
        const contactLine = [profile?.email, profile?.phone, profile?.location, safeLink(profile?.linkedin)].filter(Boolean).join(" | ");
        return (
          <Card style={{ marginTop: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.accent, letterSpacing: "0.08em", textTransform: "uppercase" }}>✨ Cover letter — ready to use</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button onClick={() => navigator.clipboard.writeText(result)}
                  style={{ padding: "6px 13px", borderRadius: 6, border: `0.5px solid ${C.gray200}`, background: C.white, fontSize: 12, cursor: "pointer", color: C.gray600, fontFamily: FONT }}>
                  📋 Copy text
                </button>
                <button onClick={() => downloadWord("coverletter-doc", `Cover-Letter-${name || "JobMate"}`)}
                  style={{ padding: "6px 13px", borderRadius: 6, border: `0.5px solid ${C.gray200}`, background: C.white, fontSize: 12, cursor: "pointer", color: C.gray600, fontFamily: FONT, fontWeight: 600 }}>
                  📄 Word
                </button>
                <button onClick={() => printDoc("coverletter-doc")}
                  style={{ padding: "6px 13px", borderRadius: 6, border: `0.5px solid ${C.accent}`, background: C.accentLight, fontSize: 12, cursor: "pointer", color: C.accent, fontFamily: FONT, fontWeight: 600 }}>
                  📥 PDF
                </button>
              </div>
            </div>
            <div id="coverletter-doc" style={{ border: `0.5px solid ${C.gray200}`, borderRadius: 8, overflow: "hidden", maxHeight: 480, overflowY: "auto", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
              <CoverLetterTemplate
                name={name}
                role={role}
                company={company}
                contact={contactLine}
                body={result}
              />
            </div>
          </Card>
        );
      })()}
    </div>
  );
};

// ── Job Tracker ───────────────────────────────────────────────────
const STATUS_CONFIG = {
  "Saved":     { color: C.gray600, bg: C.gray100 },
  "Applied":   { color: "#0369A1", bg: "#E0F2FE" },
  "Interview": { color: "#7C3AED", bg: "#EDE9FE" },
  "Offer":     { color: C.green,   bg: C.greenLight },
  "Rejected":  { color: C.red,     bg: C.redLight },
};
const STATUSES = Object.keys(STATUS_CONFIG);

const JobTracker = ({ jobs, onSaveJob, onDeleteJob, resumeVersions }) => {
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ role: "", company: "", location: "", date: "", status: "Saved", notes: "", resume_version_id: null });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.role || !form.company) return;
    setSaving(true);
    await onSaveJob(editId ? { ...form, id: editId } : form);
    setSaving(false);
    setShowForm(false);
  };
  const counts = STATUSES.reduce((a, s) => ({ ...a, [s]: jobs.filter(j => j.status === s).length }), {});

  const versionName = (id) => resumeVersions.find(v => v.id === id)?.name || "—";

  return (
    <div>
      <div className="ja-stats" style={{ marginBottom: 18 }}>
        {STATUSES.map(s => {
          const cfg = STATUS_CONFIG[s];
          return <div key={s} style={{ background: cfg.bg, borderRadius: 10, padding: "12px 14px", textAlign: "center" }}>
            <CountUp value={counts[s]} style={{ fontSize: 22, fontWeight: 700, color: cfg.color, fontFamily: DISPLAY }} />
            <div style={{ fontSize: 11, fontWeight: 600, color: cfg.color, marginTop: 2 }}>{s}</div>
          </div>;
        })}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.gray800 }}>{jobs.length} applications</div>
        <button onClick={() => { setForm({ role:"",company:"",location:"",date:"",status:"Saved",notes:"",resume_version_id:null }); setEditId(null); setShowForm(true); }}
          style={{ padding: "7px 16px", borderRadius: 8, background: C.accent, color: C.white, border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: FONT }}>+ Add job</button>
      </div>
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div className="ja-scrollx">
        <table style={{ width: "100%", minWidth: 680, borderCollapse: "collapse" }}>
          <thead><tr style={{ background: C.gray50, borderBottom: `0.5px solid ${C.gray200}` }}>
            {["Role","Company","Location","Date","Status","CV version","Notes",""].map(h => <th key={h} style={{ padding: "9px 14px", fontSize: 11, fontWeight: 700, color: C.gray600, textAlign: "left" }}>{h}</th>)}
          </tr></thead>
          <tbody>
            {jobs.map((job, i) => (
              <tr key={job.id} style={{ borderBottom: `0.5px solid ${C.gray100}`, background: i%2===0 ? C.white : C.gray50 }}>
                <td style={{ padding:"10px 14px", fontSize:13, fontWeight:600, color:C.gray800 }}>{job.role}</td>
                <td style={{ padding:"10px 14px", fontSize:13, color:C.gray600 }}>{job.company}</td>
                <td style={{ padding:"10px 14px", fontSize:12, color:C.gray400 }}>{job.location}</td>
                <td style={{ padding:"10px 14px", fontSize:12, color:C.gray400 }}>{job.date}</td>
                <td style={{ padding:"10px 14px" }}>
                  <select value={job.status} onChange={e => onSaveJob({ ...job, status: e.target.value })}
                    style={{ fontSize:11, fontWeight:600, padding:"2px 7px", borderRadius:99, border:"none", cursor:"pointer", color:STATUS_CONFIG[job.status].color, background:STATUS_CONFIG[job.status].bg, fontFamily:FONT }}>
                    {STATUSES.map(s => <option key={s}>{s}</option>)}
                  </select>
                </td>
                <td title={versionName(job.resume_version_id)} style={{ padding:"10px 14px", fontSize:11, color:C.gray600, maxWidth:140, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{versionName(job.resume_version_id)}</td>
                <td style={{ padding:"10px 14px", fontSize:12, color:C.gray400, maxWidth:120, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{job.notes||"—"}</td>
                <td style={{ padding:"10px 14px", whiteSpace:"nowrap" }}>
                  <button onClick={() => { setForm({...job}); setEditId(job.id); setShowForm(true); }} style={{ background:"none", border:"none", cursor:"pointer", color:C.accent, fontSize:12, fontWeight:600, marginRight:8, fontFamily:FONT }}>Edit</button>
                  <button onClick={() => onDeleteJob(job.id)} style={{ background:"none", border:"none", cursor:"pointer", color:C.red, fontSize:12, fontWeight:600, fontFamily:FONT }}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </Card>
      {showForm && (
        <div style={{ position:"fixed", inset:0, background:"rgba(15,31,61,0.45)", backdropFilter:"blur(3px)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:220, padding:16 }}>
          <div className="ja-page" style={{ background:C.white, borderRadius:14, padding:24, width:"100%", maxWidth:460, maxHeight:"90dvh", overflowY:"auto" }}>
            <div style={{ fontSize:15, fontWeight:700, color:C.navy, marginBottom:18 }}>{editId?"Edit application":"Add new job"}</div>
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              <div><Label>Job title *</Label><Input value={form.role} onChange={v=>setForm({...form,role:v})} placeholder="e.g. Product Manager" /></div>
              <div><Label>Company *</Label><Input value={form.company} onChange={v=>setForm({...form,company:v})} placeholder="e.g. Zalando" /></div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                <div><Label>Location</Label><Input value={form.location} onChange={v=>setForm({...form,location:v})} placeholder="Berlin" /></div>
                <div><Label>Date</Label><Input type="date" value={form.date} onChange={v=>setForm({...form,date:v})} /></div>
              </div>
              <div><Label>Status</Label>
                <select value={form.status} onChange={e=>setForm({...form,status:e.target.value})} style={{ width:"100%", padding:"9px 12px", borderRadius:8, border:`0.5px solid ${C.gray200}`, fontSize:13, color:C.gray800, background:C.white, fontFamily:FONT }}>
                  {STATUSES.map(s=><option key={s}>{s}</option>)}
                </select>
              </div>
              <div><Label>CV version sent</Label>
                <select value={form.resume_version_id || ""} onChange={e=>setForm({...form,resume_version_id: e.target.value || null})} style={{ width:"100%", padding:"9px 12px", borderRadius:8, border:`0.5px solid ${C.gray200}`, fontSize:13, color:C.gray800, background:C.white, fontFamily:FONT }}>
                  <option value="">— Not tracked —</option>
                  {resumeVersions.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </div>
              <div><Label>Notes</Label><TextArea value={form.notes} onChange={v=>setForm({...form,notes:v})} placeholder="Interview date, follow-up needed..." rows={2} /></div>
            </div>
            <div style={{ display:"flex", gap:10, marginTop:18, justifyContent:"flex-end" }}>
              <button onClick={()=>setShowForm(false)} style={{ padding:"8px 18px", borderRadius:8, border:`0.5px solid ${C.gray200}`, background:C.white, fontSize:13, cursor:"pointer", fontFamily:FONT }}>Cancel</button>
              <button onClick={save} disabled={!form.role||!form.company||saving} style={{ padding:"8px 18px", borderRadius:8, background:C.accent, color:C.white, border:"none", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:FONT, opacity: saving ? 0.6 : 1 }}>{saving ? "Saving…" : "Save"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Nav item ─────────────────────────────────────────────────────
const NavItem = ({ icon, label, id, active, onClick }) => (
  <button onClick={() => onClick(id)}
    style={{ position:"relative", display:"flex", alignItems:"center", gap:9, padding:"8px 10px", borderRadius:9, cursor:"pointer", width:"100%", border:"none", textAlign:"left", fontFamily:FONT, background: active ? C.navActive : "transparent", transition:"background 0.15s" }}
    onMouseOver={e => { if(!active) e.currentTarget.style.background = C.navHover; }}
    onMouseOut={e => { if(!active) e.currentTarget.style.background = "transparent"; }}>
    {active && <span style={{ position:"absolute", left:0, top:7, bottom:7, width:3, borderRadius:99, background:`linear-gradient(${C.accent}, ${C.cyan})`, boxShadow:"0 0 10px rgba(56,189,248,0.6)" }} />}
    <i className={`ti ${icon}`} style={{ fontSize:15, color: active ? C.accent : C.gray400, flexShrink:0, marginLeft: active ? 4 : 0, transition:"margin 0.15s, color 0.15s" }} aria-hidden="true" />
    <span style={{ fontSize:13, color: active ? C.navy : C.gray600, fontWeight: active ? 600 : 400 }}>{label}</span>
  </button>
);

const NavSection = ({ label, children }) => (
  <div style={{ marginBottom:18 }}>
    <div style={{ fontSize:10, fontWeight:600, color:C.gray400, letterSpacing:"0.07em", textTransform:"uppercase", padding:"0 10px", marginBottom:4 }}>{label}</div>
    {children}
  </div>
);

// ── Page metadata ─────────────────────────────────────────────────
const PAGES = {
  profile:   { title:"My profile",       sub:"Upload your resume or fill in your details — pre-fills all AI tools automatically." },
  tracker:   { title:"Job tracker",      sub:"Track every application in one place — status, notes, and follow-ups." },
  apply:     { title:"Quick apply",      sub:"Paste a job URL or description — get a tailored CV, cover letter and match score instantly." },
  cv:        { title:"CV tailor",        sub:"Paste your CV and a job description — AI rewrites it to match the role and pass ATS screening." },
  cover:     { title:"Cover letter",     sub:"Get a personalised, Germany-ready cover letter in seconds." },
  resume:    { title:"Resume editor",    sub:"Live editable resume with AI coach panel — click any text to edit." },
  findjobs:  { title:"Find jobs",        sub:"Search live job listings from Adzuna, scored against your saved profile." },
  interview: { title:"Interview prep",   sub:"Get tailored questions with model answers, then practice in a live mock session." },
  salary:    { title:"Salary coach",     sub:"German market salary ranges and word-for-word negotiation scripts." },
  linkedin:  { title:"LinkedIn optimizer", sub:"Rewrite your headline and About section to attract German recruiters." },
};

// ── Main App ──────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [active, setActive] = useState("apply");
  const [navOpen, setNavOpen] = useState(false);
  const go = (id) => { setActive(id); setNavOpen(false); };
  const pageBodyRef = useRef(null);
  useEffect(() => { pageBodyRef.current?.scrollTo?.({ top: 0 }); }, [active]);
  // ── Multi-profile state (up to 4 named profiles) — Supabase-backed ──
  // Profiles used to live only in this browser's localStorage. They now live
  // in Supabase so the same profile is visible from any logged-in client,
  // including the browser extension (which can't read this site's localStorage).
  const [profiles, setProfiles] = useState([]); // [{ id, name, data }]
  const [activeProfileId, setActiveProfileId] = useState(null);
  const [profilesLoading, setProfilesLoading] = useState(true);
  const profileSaveTimers = useRef({});

  const activeProfile = profiles.find(p => p.id === activeProfileId)?.data || EMPTY_PROFILE;

  // ── Billing / paywall ──────────────────────────────────────────
  const [billing, setBilling] = useState({ plan: "free", remaining: 3, limit: 3 }); // optimistic default
  const [pricingOpen, setPricingOpen] = useState(false);
  const [pricingReason, setPricingReason] = useState("manual");
  const [upgradeToast, setUpgradeToast] = useState(false);

  const refreshBilling = async (uid) => {
    const id = uid || user?.id;
    if (!id) return;
    const [sub, used] = await Promise.all([getSubscription(id), getUsageThisMonth(id)]);
    const plan = sub?.plan === "pro" && (sub?.status === "active" || sub?.status === "trialing") ? "pro" : "free";
    setBilling({ plan, remaining: plan === "pro" ? null : Math.max(0, 3 - used), limit: 3, used });
  };

  useEffect(() => { if (user) refreshBilling(user.id); }, [user?.id]);

  // Coming back from Stripe Checkout: the webhook may take a few seconds to
  // land, so poll briefly instead of showing stale "free" state.
  useEffect(() => {
    if (!user) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("upgraded") === "1") {
      setUpgradeToast(true);
      window.history.replaceState({}, "", window.location.pathname);
      let attempts = 0;
      const poll = setInterval(async () => {
        attempts++;
        await refreshBilling(user.id);
        if (attempts >= 6) clearInterval(poll);
      }, 2000);
      setTimeout(() => setUpgradeToast(false), 8000);
      return () => clearInterval(poll);
    }
    if (params.get("upgrade_canceled") === "1") {
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [user?.id]);

  // Call this before starting any gated AI action (Quick apply, CV tailor,
  // Cover letter, Resume editor AI Coach). Returns true if the caller should
  // proceed, false if the paywall was shown instead.
  const checkAndConsumeCredit = async () => {
    const result = await consumeUsageCredit();
    // Server/network problem: let the user work, don't touch the badge, never
    // show the paywall for our own errors.
    if (result.degraded) return true;
    if (result.plan === "pro") { setBilling(b => ({ ...b, plan: "pro", remaining: null })); return true; }
    if (!result.allowed) {
      setBilling(b => ({ ...b, plan: "free", remaining: 0 }));
      setPricingReason("limit");
      setPricingOpen(true);
      return false;
    }
    setBilling(b => ({ ...b, plan: "free", remaining: result.remaining ?? b.remaining }));
    return true;
  };

  // One-time migration for existing users: if this account has no profiles
  // in Supabase yet, pull whatever was saved locally (new-format array, then
  // the older single-profile key) and push it up. After this runs once,
  // Supabase is the only source of truth for this account.
  const migrateLocalProfiles = async (userId) => {
    let localProfiles = null;
    try {
      const saved = localStorage.getItem("jobmate_profiles");
      if (saved) localProfiles = JSON.parse(saved);
      else {
        const legacy = localStorage.getItem("jobmate_profile");
        if (legacy) localProfiles = [{ id: "1", name: "Default", data: JSON.parse(legacy) }];
      }
    } catch {}
    if (!localProfiles || !localProfiles.length) localProfiles = [{ id: "1", name: "Default", data: EMPTY_PROFILE }];

    let localActiveId;
    try { localActiveId = localStorage.getItem("jobmate_active_profile_id"); } catch {}

    const inserted = [];
    for (const p of localProfiles) {
      const isActive = p.id === localActiveId;
      const row = await insertProfile(userId, p.name, p.data || EMPTY_PROFILE, isActive);
      if (row) inserted.push(row);
    }
    if (inserted.length && !inserted.some(r => r.is_active)) {
      await setActiveProfileRow(userId, inserted[0].id);
      inserted[0].is_active = true;
    }
    return inserted;
  };

  useEffect(() => {
    if (!user) { setProfiles([]); setActiveProfileId(null); return; }
    setProfilesLoading(true);
    listProfiles(user.id).then(async (rows) => {
      const finalRows = rows.length ? rows : await migrateLocalProfiles(user.id);
      setProfiles(finalRows.map(r => ({ id: r.id, name: r.name, data: r.data || EMPTY_PROFILE })));
      const active = finalRows.find(r => r.is_active) || finalRows[0];
      setActiveProfileId(active ? active.id : null);
    }).finally(() => setProfilesLoading(false));
  }, [user?.id]);

  // Edits apply to local state immediately so typing feels instant, and are
  // pushed to Supabase after a short pause so we're not hitting the database
  // on every keystroke.
  const setActiveProfileData = (data) => {
    setProfiles(prev => prev.map(p => p.id === activeProfileId ? { ...p, data } : p));
    if (!user || !activeProfileId) return;
    clearTimeout(profileSaveTimers.current[activeProfileId]);
    profileSaveTimers.current[activeProfileId] = setTimeout(() => {
      updateProfileFields(user.id, activeProfileId, { data });
    }, 700);
  };

  const switchProfile = (id) => {
    setActiveProfileId(id);
    if (user) setActiveProfileRow(user.id, id);
  };

  const addProfile = async (name) => {
    if (!user || profiles.length >= 4) return;
    const row = await insertProfile(user.id, name, EMPTY_PROFILE, false);
    if (!row) return;
    setProfiles(prev => [...prev, { id: row.id, name: row.name, data: row.data || EMPTY_PROFILE }]);
    switchProfile(row.id);
  };

  const renameProfile = (id, name) => {
    setProfiles(prev => prev.map(p => p.id === id ? { ...p, name } : p));
    if (user) updateProfileFields(user.id, id, { name });
  };

  const deleteProfile = async (id) => {
    if (profiles.length <= 1 || !user) return; // always keep at least one
    const updated = profiles.filter(p => p.id !== id);
    const newActiveId = activeProfileId === id ? updated[0].id : activeProfileId;
    setProfiles(updated);
    setActiveProfileId(newActiveId);
    await deleteProfileRow(user.id, id);
    if (activeProfileId === id) await setActiveProfileRow(user.id, newActiveId);
  };
  const [quickApplyCV, setQuickApplyCV] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [resumeVersions, setResumeVersions] = useState([]);
  const [prefillJob, setPrefillJob] = useState(null);
  const [dataLoading, setDataLoading] = useState(false);

  // Auth listener
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Load user data once logged in
  useEffect(() => {
    if (!user) { setJobs([]); setResumeVersions([]); return; }
    setDataLoading(true);
    Promise.all([listTrackerEntries(user.id), listResumeVersions(user.id)])
      .then(([trackerData, versionData]) => {
        setJobs(trackerData);
        setResumeVersions(versionData);
      })
      .finally(() => setDataLoading(false));
  }, [user?.id]);

  const goToResumeEditor = (cvText) => { setQuickApplyCV(cvText); setActive("resume"); };

  // Find Jobs → Quick Apply handoff: pre-fill the job URL/description, switch tab
  const goToQuickApplyWithJob = (job) => {
    setPrefillJob({ url: job.url, description: job.description || `${job.title} at ${job.company}\n${job.location}` });
    setActive("apply");
  };

  // Find Jobs → Job Tracker handoff: save as a tracked application with status "Saved"
  const saveJobToTracker = async (job) => {
    if (!user) return;
    if (jobs.some(j => j.role === job.title && j.company === job.company)) return; // avoid duplicate
    const bestVersion = findBestMatchingVersion(resumeVersions, job.title);
    const saved = await saveTrackerEntry(user.id, {
      role: job.title, company: job.company, location: job.location,
      date: new Date().toISOString().slice(0, 10), status: "Saved",
      notes: `Found via Find Jobs · ${job.url}`,
      resume_version_id: bestVersion?.id || null,
    });
    if (saved) setJobs(prev => [saved, ...prev]);
  };

  // Job Tracker save/delete — Supabase-backed
  const handleSaveJob = async (entry) => {
    if (!user) return;
    const saved = await saveTrackerEntry(user.id, entry);
    if (!saved) return;
    setJobs(prev => entry.id ? prev.map(j => j.id === saved.id ? saved : j) : [saved, ...prev]);
  };
  const handleDeleteJob = async (id) => {
    if (!user) return;
    const ok = await deleteTrackerEntry(user.id, id);
    if (ok) setJobs(prev => prev.filter(j => j.id !== id));
  };

  // Resume version save/delete — Supabase-backed
  const handleSaveResumeVersion = async (version) => {
    if (!user) return null;
    const saved = await saveResumeVersion(user.id, version);
    if (!saved) return null;
    setResumeVersions(prev => version.id ? prev.map(v => v.id === saved.id ? saved : v) : [saved, ...prev]);
    return saved;
  };
  const handleDeleteResumeVersion = async (id) => {
    if (!user) return;
    const ok = await deleteResumeVersion(user.id, id);
    if (ok) setResumeVersions(prev => prev.filter(v => v.id !== id));
  };

  if (authLoading) {
    return (
      <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", gap: 14, alignItems: "center", justifyContent: "center", fontFamily: FONT, color: C.gray400, fontSize: 14 }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: `linear-gradient(135deg, ${C.accent}, ${C.cyan})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, animation: "ja-pulse 1.6s ease-in-out infinite" }}>🎯</div>
        Loading JobMate...
      </div>
    );
  }

  if (!user) return <LoginPage />;

  const page = PAGES[active];

  return (
    <div className="ja-shell" style={{ display:"flex", fontFamily:FONT, position:"relative" }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
      `}</style>

      {/* Ambient aurora */}
      <div aria-hidden="true">
        <div className="ja-orb ja-orb-1" />
        <div className="ja-orb ja-orb-2" />
      </div>

      <PricingModal open={pricingOpen} onClose={() => setPricingOpen(false)} reason={pricingReason} remaining={billing.remaining} />
      {upgradeToast && (
        <div className="ja-page" style={{ position:"fixed", top:16, right:16, zIndex:310, background:C.white, border:`1px solid ${C.gray200}`, borderRadius:12, padding:"12px 18px", boxShadow:"0 10px 30px rgba(15,31,61,0.18)", fontSize:13, color:C.navy, fontWeight:600 }}>
          🎉 Payment received — activating your Pro plan…
        </div>
      )}

      {/* Mobile top bar */}
      <div className="ja-appbar">
        <button onClick={() => setNavOpen(true)} aria-label="Open menu"
          style={{ width:38, height:38, borderRadius:10, border:`0.5px solid ${C.gray200}`, background:C.white, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
          <i className="ti ti-menu-2" style={{ fontSize:18, color:C.navy }} aria-hidden="true" />
        </button>
        <div style={{ width:26, height:26, background:`linear-gradient(135deg, ${C.accent}, ${C.cyan})`, borderRadius:7, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13 }}>🎯</div>
        <span style={{ fontFamily:DISPLAY, fontSize:15, fontWeight:700, color:C.navy }}>JobMate</span>
        <span style={{ fontSize:12, color:C.gray400, marginLeft:"auto", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:140 }}>{page.title}</span>
      </div>

      {/* Drawer backdrop (mobile) */}
      {navOpen && <div className="ja-overlay" onClick={() => setNavOpen(false)} />}

      {/* Sidebar — light glass */}
      <div className={`ja-sidebar${navOpen ? " open" : ""}`}
        style={{ width:226, background:C.sidebarBg, backdropFilter:"blur(16px)", WebkitBackdropFilter:"blur(16px)", borderRight:`1px solid ${C.gray200}`, display:"flex", flexDirection:"column", flexShrink:0, height:"100%", overflow:"hidden" }}>
        {/* Logo */}
        <div style={{ padding:"16px 14px 14px", display:"flex", alignItems:"center", gap:9, borderBottom:`1px solid ${C.gray100}` }}>
          <div style={{ width:28, height:28, background:`linear-gradient(135deg, ${C.accent}, ${C.cyan})`, borderRadius:7, display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 4px 14px rgba(37,99,235,0.35)" }}>🎯</div>
          <span style={{ fontFamily:DISPLAY, fontSize:16, fontWeight:700, color:C.navy }}>JobMate</span>
          <span style={{ fontSize:9, fontWeight:700, color:C.accent, background:C.accentLight, border:`0.5px solid rgba(37,99,235,0.25)`, padding:"2px 6px", borderRadius:99, animation:"ja-pulse 3s ease-in-out infinite" }}>AI</span>
          <button onClick={() => setNavOpen(false)} aria-label="Close menu" className="ja-nav-close"
            style={{ marginLeft:"auto", background:"none", border:"none", cursor:"pointer", color:C.gray400, fontSize:16, display: navOpen ? "block" : "none" }}>✕</button>
        </div>

        {/* Nav */}
        <div style={{ flex:1, padding:"12px 8px", overflowY:"auto" }}>
          <NavSection label="Me">
            <NavItem icon="ti-user" label="My profile" id="profile" active={active==="profile"} onClick={go} />
            <NavItem icon="ti-layout-kanban" label="Job tracker" id="tracker" active={active==="tracker"} onClick={go} />
          </NavSection>

          <NavSection label="Apply">
            <NavItem icon="ti-bolt" label="Quick apply" id="apply" active={active==="apply"} onClick={go} />
            <NavItem icon="ti-search" label="Find jobs" id="findjobs" active={active==="findjobs"} onClick={go} />
            <NavItem icon="ti-file-text" label="CV tailor" id="cv" active={active==="cv"} onClick={go} />
            <NavItem icon="ti-mail" label="Cover letter" id="cover" active={active==="cover"} onClick={go} />
            <NavItem icon="ti-edit" label="Resume editor" id="resume" active={active==="resume"} onClick={go} />
          </NavSection>

          <NavSection label="Prepare">
            <NavItem icon="ti-microphone" label="Interview prep" id="interview" active={active==="interview"} onClick={go} />
            <NavItem icon="ti-currency-euro" label="Salary coach" id="salary" active={active==="salary"} onClick={go} />
            <NavItem icon="ti-brand-linkedin" label="LinkedIn" id="linkedin" active={active==="linkedin"} onClick={go} />
          </NavSection>
        </div>

        {/* Plan badge */}
        <div style={{ padding:"0 12px 10px" }}>
          {billing.plan === "pro" ? (
            <button onClick={openBillingPortal}
              style={{ width:"100%", display:"flex", alignItems:"center", justifyContent:"space-between", padding:"8px 12px", borderRadius:10, border:`1px solid ${C.accent}30`, background:`linear-gradient(120deg, ${C.accentLight}, rgba(56,189,248,0.08))`, cursor:"pointer", fontFamily:FONT }}>
              <span style={{ fontSize:12, fontWeight:700, color:C.accent }}>✨ Pro plan</span>
              <span style={{ fontSize:10.5, color:C.gray400 }}>Manage →</span>
            </button>
          ) : (
            <button onClick={() => { setPricingReason("manual"); setPricingOpen(true); }}
              style={{ width:"100%", display:"flex", alignItems:"center", justifyContent:"space-between", padding:"8px 12px", borderRadius:10, border:`0.5px solid ${C.gray200}`, background:C.gray50, cursor:"pointer", fontFamily:FONT }}>
              <span style={{ fontSize:12, fontWeight:600, color:C.gray600 }}>{billing.remaining ?? 3}/{billing.limit ?? 3} free left</span>
              <span style={{ fontSize:10.5, fontWeight:700, color:C.accent }}>Upgrade →</span>
            </button>
          )}
        </div>

        {/* User footer */}
        <div style={{ padding:"10px 12px", borderTop:`1px solid ${C.gray100}` }}>
          <div style={{ display:"flex", alignItems:"center", gap:9 }}>
            {user.user_metadata?.avatar_url
              ? <img src={user.user_metadata.avatar_url} alt="" style={{ width:28, height:28, borderRadius:"50%", flexShrink:0 }} onError={e => e.target.style.display='none'} />
              : <div style={{ width:28, height:28, borderRadius:"50%", background:`linear-gradient(135deg, ${C.accent}, ${C.cyan})`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:700, color:"#fff", flexShrink:0 }}>
                  {(activeProfile?.name || user.user_metadata?.full_name || user.email || "JM").split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase()}
                </div>}
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:12, color:C.gray800, fontWeight:500, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{activeProfile?.name || user.user_metadata?.full_name || user.email}</div>
              <button onClick={signOut} style={{ fontSize:10, color:C.gray400, background:"none", border:"none", cursor:"pointer", padding:0, fontFamily:FONT }}>Sign out</button>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="ja-main" style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", position:"relative", zIndex:1, minWidth:0 }}>
        {/* Page header — hidden for Resume Editor since it needs full height */}
        {active !== "resume" && (
          <div style={{ background:"rgba(255,255,255,0.7)", backdropFilter:"blur(10px)", borderBottom:`1px solid ${C.gray200}`, padding:"16px 28px" }}>
            <h1 style={{ fontFamily:DISPLAY, fontSize:20, fontWeight:700, margin:"0 0 3px", background:`linear-gradient(100deg, ${C.navy} 60%, ${C.accent})`, WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>{page.title}</h1>
            <p style={{ fontSize:13, color:C.gray400, margin:0 }}>{page.sub}</p>
          </div>
        )}

        {/* Page body. Quick apply, Find jobs, CV tailor and Cover letter stay
            mounted and are hidden with CSS so their results and form state
            survive tab switches. Other pages mount/unmount as before. */}
        <div ref={pageBodyRef} className={active === "resume" ? "" : "ja-page-pad"} style={{ flex:1, overflowY: active === "resume" ? "hidden" : "auto", padding: active === "resume" ? 0 : "24px 28px" }}>
          {dataLoading && active === "tracker" && <div style={{ fontSize:13, color:C.gray400, marginBottom:12 }}>Loading your applications…</div>}
          {profilesLoading && active === "profile" && <div style={{ fontSize:13, color:C.gray400, marginBottom:12 }}>Loading your profiles…</div>}
          {active === "profile"   && <div key="profile" className="ja-page"><ProfilePage
                                      profiles={profiles}
                                      activeProfileId={activeProfileId}
                                      profile={activeProfile}
                                      setProfile={setActiveProfileData}
                                      onSwitch={switchProfile}
                                      onAdd={addProfile}
                                      onRename={renameProfile}
                                      onDelete={deleteProfile}
                                    /></div>}
          {active === "tracker"   && <div key="tracker" className="ja-page"><JobTracker jobs={jobs} onSaveJob={handleSaveJob} onDeleteJob={handleDeleteJob} resumeVersions={resumeVersions} /></div>}
          <div className="ja-page" style={{ display: active === "apply" ? "block" : "none" }}>
            <QuickApply profile={activeProfile} profiles={profiles} activeProfileId={activeProfileId} onSwitchProfile={switchProfile} onGoToResume={goToResumeEditor} prefillJob={prefillJob} checkAndConsumeCredit={checkAndConsumeCredit} />
          </div>
          <div className="ja-page" style={{ display: active === "findjobs" ? "block" : "none" }}>
            <FindJobs profile={activeProfile} onQuickApply={goToQuickApplyWithJob} onSaveToTracker={saveJobToTracker} />
          </div>
          <div className="ja-page" style={{ display: active === "cv" ? "block" : "none" }}>
            <CVTailor profile={activeProfile} profiles={profiles} activeProfileId={activeProfileId} onSwitchProfile={switchProfile} onGoToResume={goToResumeEditor} resumeVersions={resumeVersions} checkAndConsumeCredit={checkAndConsumeCredit} />
          </div>
          <div className="ja-page" style={{ display: active === "cover" ? "block" : "none" }}>
            <CoverLetter profile={activeProfile} checkAndConsumeCredit={checkAndConsumeCredit} />
          </div>
          {active === "interview" && <div key="interview" className="ja-page"><InterviewPrep profile={activeProfile} /></div>}
          {active === "salary"    && <div key="salary" className="ja-page"><SalaryCoach profile={activeProfile} /></div>}
          {active === "linkedin"  && <div key="linkedin" className="ja-page"><LinkedInOptimizer profile={activeProfile} /></div>}
          {active === "resume"    && <ResumeEditor
                                      profile={activeProfile}
                                      profiles={profiles}
                                      activeProfileId={activeProfileId}
                                      onSwitchProfile={switchProfile}
                                      checkAndConsumeCredit={checkAndConsumeCredit}
                                      quickApplyCV={quickApplyCV}
                                      resumeVersions={resumeVersions}
                                      onSaveVersion={handleSaveResumeVersion}
                                      onDeleteVersion={handleDeleteResumeVersion}
                                    />}
        </div>
      </div>
    </div>
  );
}
