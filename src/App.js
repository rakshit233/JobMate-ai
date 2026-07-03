import { useState, useEffect } from "react";
import ResumeEditor from "./ResumeEditor";
import ProfilePage, { EMPTY_PROFILE } from "./ProfilePage";
import QuickApply from "./QuickApply";
import InterviewPrep from "./InterviewPrep";
import SalaryCoach from "./SalaryCoach";
import LinkedInOptimizer from "./LinkedInOptimizer";
import FindJobs from "./FindJobs";
import LoginPage from "./LoginPage";
import {
  supabase, signOut,
  listResumeVersions, saveResumeVersion, deleteResumeVersion, findBestMatchingVersion,
  listTrackerEntries, saveTrackerEntry, deleteTrackerEntry,
} from "./supabase";

const C = {
  navy: "#0F1F3D",
  navyHover: "rgba(255,255,255,0.06)",
  navyActive: "rgba(37,99,235,0.22)",
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
  const res = await fetch("/api/claude", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 1000, system, messages: [{ role: "user", content: user }] }),
  });
  const data = await res.json();
  return data.content?.[0]?.text || "";
};

const Spinner = () => <span style={{ display: "inline-block", width: 14, height: 14, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "white", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />;

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
  <div style={{ background: C.white, borderRadius: 12, border: `0.5px solid ${C.gray200}`, padding: "18px 22px", ...s }}>{children}</div>
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
const CVTailor = ({ profile, resumeVersions = [] }) => {
  const [cv, setCv] = useState(profile?.summary ? `${profile.name || ""}\n\n${profile.summary}\n\nSkills: ${(profile.skills || []).join(", ")}` : "");
  const [jd, setJd] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedVersionId, setSelectedVersionId] = useState(null);
  const [autoMatched, setAutoMatched] = useState(false);

  // Auto-select the version most recently tailored for a similar role, based on
  // job title appearing in the pasted JD. Keyword overlap only — no AI call needed.
  useEffect(() => {
    if (!resumeVersions.length || !jd.trim() || selectedVersionId) return;
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
      const d = best.data;
      setCv(`${d.name}\n${d.contact}\n\n${d.summary}\n\nSkills: ${d.skills}`);
    }
  }, [jd]);

  const applyVersion = (id) => {
    setSelectedVersionId(id);
    setAutoMatched(false);
    if (!id) return;
    const v = resumeVersions.find(x => x.id === id);
    if (!v) return;
    const d = v.data;
    setCv(`${d.name}\n${d.contact}\n\n${d.summary}\n\nSkills: ${d.skills}`);
  };

  return (
    <div>
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
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 14 }}>
        <Card><Label>Your current CV</Label><TextArea value={cv} onChange={setCv} placeholder="Paste your full CV text here..." rows={12} /></Card>
        <Card><Label>Job description</Label><TextArea value={jd} onChange={setJd} placeholder="Paste the full job description..." rows={12} /></Card>
      </div>
      <button onClick={async () => { setLoading(true); setResult(""); try { const r = await callClaude("You are an expert CV writer for the German job market. Rewrite and tailor the CV to match the job description. ATS-optimised, strong action verbs, concise. Output only the CV text.", `CV:\n${cv}\n\nJD:\n${jd}`); setResult(r); } catch(e){} setLoading(false); }} disabled={loading || !cv.trim() || !jd.trim()}
        style={{ width: "100%", padding: 13, borderRadius: 10, background: C.accent, color: C.white, fontSize: 14, fontWeight: 600, border: "none", cursor: "pointer", fontFamily: DISPLAY, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: loading ? 0.7 : 1 }}>
        {loading ? <><Spinner /> Tailoring...</> : "✨ Tailor my CV for this job"}
      </button>
      {result && <ResultBox content={result} />}
    </div>
  );
};

// ── Cover Letter ──────────────────────────────────────────────────
const CoverLetter = ({ profile }) => {
  const [name, setName] = useState(profile?.name || "");
  const [role, setRole] = useState("");
  const [company, setCompany] = useState("");
  const [bg, setBg] = useState(profile?.summary || "");
  const [jd, setJd] = useState("");
  const [tone, setTone] = useState("professional");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 14 }}>
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
      <button onClick={async () => { setLoading(true); setResult(""); try { const r = await callClaude("Expert cover letter writer for English speakers applying to German companies. Strong hook, connects background to role, confident close. 300-350 words. Output only the letter.", `Name:${name}\nRole:${role}\nCompany:${company}\nBackground:${bg}\nJD:${jd}\nTone:${tone}`); setResult(r); } catch(e){} setLoading(false); }} disabled={loading || !name || !role || !company || !bg}
        style={{ width: "100%", padding: 13, borderRadius: 10, background: C.accent, color: C.white, fontSize: 14, fontWeight: 600, border: "none", cursor: "pointer", fontFamily: DISPLAY, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: loading ? 0.7 : 1 }}>
        {loading ? <><Spinner /> Writing...</> : "✨ Generate cover letter"}
      </button>
      {result && <ResultBox content={result} />}
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
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 10, marginBottom: 18 }}>
        {STATUSES.map(s => {
          const cfg = STATUS_CONFIG[s];
          return <div key={s} style={{ background: cfg.bg, borderRadius: 10, padding: "12px 14px", textAlign: "center" }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: cfg.color, fontFamily: DISPLAY }}>{counts[s]}</div>
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
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
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
                <td style={{ padding:"10px 14px", fontSize:11, color:C.gray600 }}>{versionName(job.resume_version_id)}</td>
                <td style={{ padding:"10px 14px", fontSize:12, color:C.gray400, maxWidth:120, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{job.notes||"—"}</td>
                <td style={{ padding:"10px 14px", whiteSpace:"nowrap" }}>
                  <button onClick={() => { setForm({...job}); setEditId(job.id); setShowForm(true); }} style={{ background:"none", border:"none", cursor:"pointer", color:C.accent, fontSize:12, fontWeight:600, marginRight:8, fontFamily:FONT }}>Edit</button>
                  <button onClick={() => onDeleteJob(job.id)} style={{ background:"none", border:"none", cursor:"pointer", color:C.red, fontSize:12, fontWeight:600, fontFamily:FONT }}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      {showForm && (
        <div style={{ position:"fixed", inset:0, background:"rgba(15,31,61,0.45)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:100 }}>
          <div style={{ background:C.white, borderRadius:14, padding:24, width:"100%", maxWidth:460 }}>
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
    style={{ display:"flex", alignItems:"center", gap:9, padding:"8px 10px", borderRadius:8, cursor:"pointer", width:"100%", border:"none", textAlign:"left", fontFamily:FONT, background: active ? C.navyActive : "transparent", transition:"background 0.12s" }}
    onMouseOver={e => { if(!active) e.currentTarget.style.background = C.navyHover; }}
    onMouseOut={e => { if(!active) e.currentTarget.style.background = "transparent"; }}>
    <i className={`ti ${icon}`} style={{ fontSize:15, color: active ? "#93C5FD" : "rgba(255,255,255,0.45)", flexShrink:0 }} aria-hidden="true" />
    <span style={{ fontSize:13, color: active ? "#fff" : "rgba(255,255,255,0.6)", fontWeight: active ? 500 : 400 }}>{label}</span>
  </button>
);

const NavSection = ({ label, children }) => (
  <div style={{ marginBottom:18 }}>
    <div style={{ fontSize:10, fontWeight:500, color:"rgba(255,255,255,0.28)", letterSpacing:"0.07em", textTransform:"uppercase", padding:"0 10px", marginBottom:4 }}>{label}</div>
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
  // ── Multi-profile state (up to 4 named profiles) ─────────────
  const [profiles, setProfiles] = useState(() => {
    try {
      const saved = localStorage.getItem("jobmate_profiles");
      if (saved) return JSON.parse(saved);
      // Migrate from old single-profile storage
      const legacy = localStorage.getItem("jobmate_profile");
      if (legacy) {
        const legacyProfile = JSON.parse(legacy);
        return [{ id: "1", name: "Default", data: legacyProfile }];
      }
    } catch {}
    return [{ id: "1", name: "Default", data: EMPTY_PROFILE }];
  });
  const [activeProfileId, setActiveProfileId] = useState(() => {
    try { return localStorage.getItem("jobmate_active_profile_id") || "1"; } catch { return "1"; }
  });

  const activeProfile = profiles.find(p => p.id === activeProfileId)?.data || EMPTY_PROFILE;

  const saveProfiles = (newProfiles, newActiveId) => {
    try {
      localStorage.setItem("jobmate_profiles", JSON.stringify(newProfiles));
      if (newActiveId) localStorage.setItem("jobmate_active_profile_id", newActiveId);
    } catch {}
  };

  const setActiveProfileData = (data) => {
    const updated = profiles.map(p => p.id === activeProfileId ? { ...p, data } : p);
    setProfiles(updated);
    saveProfiles(updated, activeProfileId);
  };

  const switchProfile = (id) => {
    setActiveProfileId(id);
    localStorage.setItem("jobmate_active_profile_id", id);
  };

  const addProfile = (name) => {
    if (profiles.length >= 4) return;
    const id = Date.now().toString();
    const newProfiles = [...profiles, { id, name, data: EMPTY_PROFILE }];
    setProfiles(newProfiles);
    setActiveProfileId(id);
    saveProfiles(newProfiles, id);
  };

  const renameProfile = (id, name) => {
    const updated = profiles.map(p => p.id === id ? { ...p, name } : p);
    setProfiles(updated);
    saveProfiles(updated, activeProfileId);
  };

  const deleteProfile = (id) => {
    if (profiles.length <= 1) return; // always keep at least one
    const updated = profiles.filter(p => p.id !== id);
    const newActiveId = activeProfileId === id ? updated[0].id : activeProfileId;
    setProfiles(updated);
    setActiveProfileId(newActiveId);
    saveProfiles(updated, newActiveId);
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
  }, [user]);

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
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT, color: C.gray400, fontSize: 14 }}>
        Loading JobMate...
      </div>
    );
  }

  if (!user) return <LoginPage />;

  const page = PAGES[active];

  return (
    <div style={{ display:"flex", height:"100vh", fontFamily:FONT, background:C.gray50 }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
        @keyframes pageIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
        .page-anim { animation: pageIn 0.32s ease; }
        button { transition: transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease, border-color 0.15s ease, opacity 0.15s ease; }
        button:active { transform: scale(0.98); }
        select, input, textarea { transition: border-color 0.15s ease, box-shadow 0.15s ease; }
        @media (prefers-reduced-motion: reduce) {
          .page-anim { animation: none; }
          button { transition: none; }
        }
      `}</style>

      {/* Sidebar */}
      <div style={{ width:210, background:C.navy, display:"flex", flexDirection:"column", flexShrink:0, height:"100vh", overflow:"hidden" }}>
        {/* Logo */}
        <div style={{ padding:"16px 14px 14px", display:"flex", alignItems:"center", gap:9, borderBottom:"0.5px solid rgba(255,255,255,0.08)" }}>
          <div style={{ width:28, height:28, background:C.accent, borderRadius:7, display:"flex", alignItems:"center", justifyContent:"center" }}>🎯</div>
          <span style={{ fontFamily:DISPLAY, fontSize:16, fontWeight:700, color:"#fff" }}>JobMate</span>
          <span style={{ fontSize:9, fontWeight:700, color:C.accent, background:"rgba(37,99,235,0.2)", padding:"2px 6px", borderRadius:99 }}>AI</span>
        </div>

        {/* Nav */}
        <div style={{ flex:1, padding:"12px 8px", overflowY:"auto" }}>
          <NavSection label="Me">
            <NavItem icon="ti-user" label="My profile" id="profile" active={active==="profile"} onClick={setActive} />
            <NavItem icon="ti-layout-kanban" label="Job tracker" id="tracker" active={active==="tracker"} onClick={setActive} />
          </NavSection>

          <NavSection label="Apply">
            <NavItem icon="ti-bolt" label="Quick apply" id="apply" active={active==="apply"} onClick={setActive} />
            <NavItem icon="ti-search" label="Find jobs" id="findjobs" active={active==="findjobs"} onClick={setActive} />
            <NavItem icon="ti-file-text" label="CV tailor" id="cv" active={active==="cv"} onClick={setActive} />
            <NavItem icon="ti-mail" label="Cover letter" id="cover" active={active==="cover"} onClick={setActive} />
            <NavItem icon="ti-edit" label="Resume editor" id="resume" active={active==="resume"} onClick={setActive} />
          </NavSection>

          <NavSection label="Prepare">
            <NavItem icon="ti-microphone" label="Interview prep" id="interview" active={active==="interview"} onClick={setActive} />
            <NavItem icon="ti-currency-euro" label="Salary coach" id="salary" active={active==="salary"} onClick={setActive} />
            <NavItem icon="ti-brand-linkedin" label="LinkedIn" id="linkedin" active={active==="linkedin"} onClick={setActive} />
          </NavSection>
        </div>

        {/* User footer */}
        <div style={{ padding:"10px 12px", borderTop:"0.5px solid rgba(255,255,255,0.08)" }}>
          <div style={{ display:"flex", alignItems:"center", gap:9 }}>
            {user.user_metadata?.avatar_url
              ? <img src={user.user_metadata.avatar_url} alt="" style={{ width:28, height:28, borderRadius:"50%", flexShrink:0 }} onError={e => e.target.style.display='none'} />
              : <div style={{ width:28, height:28, borderRadius:"50%", background:C.accent, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:700, color:"#fff", flexShrink:0 }}>
                  {(activeProfile?.name || user.user_metadata?.full_name || user.email || "JM").split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase()}
                </div>}
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:12, color:"rgba(255,255,255,0.85)", fontWeight:500, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{activeProfile?.name || user.user_metadata?.full_name || user.email}</div>
              <button onClick={signOut} style={{ fontSize:10, color:"rgba(255,255,255,0.35)", background:"none", border:"none", cursor:"pointer", padding:0, fontFamily:FONT }}>Sign out</button>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
        {/* Page header — hidden for Resume Editor since it needs full height */}
        {active !== "resume" && (
          <div style={{ background:C.white, borderBottom:`0.5px solid ${C.gray200}`, padding:"18px 28px" }}>
            <h1 style={{ fontFamily:DISPLAY, fontSize:20, fontWeight:700, color:C.navy, margin:"0 0 3px" }}>{page.title}</h1>
            <p style={{ fontSize:13, color:C.gray400, margin:0 }}>{page.sub}</p>
          </div>
        )}

        {/* Page body — key retriggers the fade-in on every tab switch */}
        <div key={active} className="page-anim" style={{ flex:1, overflowY: active === "resume" ? "hidden" : "auto", padding: active === "resume" ? 0 : "24px 28px" }}>
          {dataLoading && active === "tracker" && <div style={{ fontSize:13, color:C.gray400, marginBottom:12 }}>Loading your applications…</div>}
          {active === "profile"   && <ProfilePage
                                      profiles={profiles}
                                      activeProfileId={activeProfileId}
                                      profile={activeProfile}
                                      setProfile={setActiveProfileData}
                                      onSwitch={switchProfile}
                                      onAdd={addProfile}
                                      onRename={renameProfile}
                                      onDelete={deleteProfile}
                                    />}
          {active === "tracker"   && <JobTracker jobs={jobs} onSaveJob={handleSaveJob} onDeleteJob={handleDeleteJob} resumeVersions={resumeVersions} />}
          {active === "apply"     && <QuickApply profile={activeProfile} profiles={profiles} activeProfileId={activeProfileId} onGoToResume={goToResumeEditor} prefillJob={prefillJob} />}
          {active === "findjobs"  && <FindJobs profile={activeProfile} onQuickApply={goToQuickApplyWithJob} onSaveToTracker={saveJobToTracker} />}
          {active === "cv"        && <CVTailor profile={activeProfile} resumeVersions={resumeVersions} />}
          {active === "cover"     && <CoverLetter profile={activeProfile} />}
          {active === "interview" && <InterviewPrep profile={activeProfile} />}
          {active === "salary"    && <SalaryCoach profile={activeProfile} />}
          {active === "linkedin"  && <LinkedInOptimizer profile={activeProfile} />}
          {active === "resume"    && <ResumeEditor
                                      profile={activeProfile}
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
