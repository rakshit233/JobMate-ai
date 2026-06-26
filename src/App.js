import { useState } from "react";
import ResumeEditor from "./ResumeEditor";
import ProfilePage, { EMPTY_PROFILE } from "./ProfilePage";

const COLORS = {
  navy: "#0F1F3D",
  accent: "#2563EB",
  accentLight: "#EFF6FF",
  green: "#16A34A",
  greenLight: "#F0FDF4",
  red: "#DC2626",
  redLight: "#FEF2F2",
  gray50: "#F8FAFC",
  gray100: "#F1F5F9",
  gray200: "#E2E8F0",
  gray400: "#94A3B8",
  gray600: "#475569",
  gray800: "#1E293B",
  white: "#FFFFFF",
};

const FONTS = {
  display: "'Plus Jakarta Sans', 'Inter', sans-serif",
  body: "'Inter', 'system-ui', sans-serif",
};

const callClaude = async (systemPrompt, userPrompt) => {
  const res = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const data = await res.json();
  return data.content?.[0]?.text || "";
};

const Btn = ({ children, onClick, variant = "primary", disabled, style: s }) => {
  const base = { padding: "10px 20px", borderRadius: 8, fontFamily: FONTS.body, fontSize: 14, fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer", border: "none", transition: "all 0.15s", display: "inline-flex", alignItems: "center", gap: 6, opacity: disabled ? 0.6 : 1, ...s };
  const variants = {
    primary: { background: COLORS.accent, color: COLORS.white },
    secondary: { background: COLORS.white, color: COLORS.gray800, border: `1.5px solid ${COLORS.gray200}` },
  };
  return <button style={{ ...base, ...variants[variant] }} onClick={onClick} disabled={disabled}>{children}</button>;
};

const Label = ({ children }) => (
  <label style={{ fontSize: 13, fontWeight: 600, color: COLORS.gray600, display: "block", marginBottom: 6 }}>{children}</label>
);

const TextArea = ({ value, onChange, placeholder, rows = 5 }) => (
  <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows}
    style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1.5px solid ${COLORS.gray200}`, fontSize: 14, lineHeight: 1.6, color: COLORS.gray800, background: COLORS.white, resize: "vertical", outline: "none", fontFamily: FONTS.body }}
    onFocus={e => e.target.style.borderColor = COLORS.accent}
    onBlur={e => e.target.style.borderColor = COLORS.gray200}
  />
);

const Input = ({ value, onChange, placeholder, type = "text" }) => (
  <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
    style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1.5px solid ${COLORS.gray200}`, fontSize: 14, color: COLORS.gray800, background: COLORS.white, outline: "none", fontFamily: FONTS.body }}
    onFocus={e => e.target.style.borderColor = COLORS.accent}
    onBlur={e => e.target.style.borderColor = COLORS.gray200}
  />
);

const Card = ({ children, style: s }) => (
  <div style={{ background: COLORS.white, borderRadius: 12, border: `1.5px solid ${COLORS.gray200}`, padding: 24, ...s }}>{children}</div>
);

const ResultBox = ({ content }) => (
  <div style={{ background: COLORS.accentLight, border: `1.5px solid #BFDBFE`, borderRadius: 10, padding: 16, marginTop: 16 }}>
    <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.accent, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>Result — ready to use</div>
    <div style={{ fontSize: 14, lineHeight: 1.75, color: COLORS.gray800, whiteSpace: "pre-wrap" }}>{content}</div>
    <Btn variant="secondary" style={{ marginTop: 12, fontSize: 12, padding: "6px 12px" }} onClick={() => navigator.clipboard.writeText(content)}>📋 Copy</Btn>
  </div>
);

const Spinner = () => (
  <span style={{ display: "inline-block", width: 14, height: 14, border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "white", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
);

const CVTailor = () => {
  const [cv, setCv] = useState("");
  const [jd, setJd] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const run = async () => {
    setLoading(true); setResult(""); setError("");
    try {
      const out = await callClaude(
        `You are an expert CV writer specialising in the German job market for English-speaking candidates. Rewrite and tailor the candidate's CV to match the job description. Highlight relevant skills and achievements, use strong action verbs, optimise for ATS, and keep it concise. Output only the full tailored CV text.`,
        `MY CV:\n${cv}\n\nJOB DESCRIPTION:\n${jd}\n\nTailor my CV for this role.`
      );
      setResult(out);
    } catch (e) { setError("Something went wrong. Please try again."); }
    setLoading(false);
  };

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 16 }}>
        <Card><Label>Your current CV</Label><TextArea value={cv} onChange={setCv} placeholder="Paste your full CV text here..." rows={12} /></Card>
        <Card><Label>Job description</Label><TextArea value={jd} onChange={setJd} placeholder="Paste the full job description here..." rows={12} /></Card>
      </div>
      <Btn onClick={run} disabled={loading || !cv.trim() || !jd.trim()} style={{ width: "100%", justifyContent: "center", padding: "13px 20px", fontSize: 15 }}>
        {loading ? <><Spinner /> Tailoring your CV...</> : "✨ Tailor my CV for this job"}
      </Btn>
      {error && <div style={{ marginTop: 12, color: COLORS.red, fontSize: 13 }}>{error}</div>}
      {result && <ResultBox content={result} />}
    </div>
  );
};

const CoverLetter = () => {
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [company, setCompany] = useState("");
  const [background, setBackground] = useState("");
  const [jd, setJd] = useState("");
  const [tone, setTone] = useState("professional");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const run = async () => {
    setLoading(true); setResult(""); setError("");
    try {
      const out = await callClaude(
        `You are an expert career coach helping English speakers get jobs in Germany. Write a compelling, personalised cover letter that opens with a strong hook, connects the candidate's background to the role, and ends with a confident close. Follow German professional letter conventions. 300-400 words. Output only the cover letter.`,
        `Name: ${name}\nRole: ${role}\nCompany: ${company}\nBackground: ${background}\nJob description: ${jd || "Not provided"}\nTone: ${tone}`
      );
      setResult(out);
    } catch (e) { setError("Something went wrong. Please try again."); }
    setLoading(false);
  };

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 16 }}>
        <Card>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div><Label>Your full name</Label><Input value={name} onChange={setName} placeholder="e.g. Sarah Johnson" /></div>
            <div><Label>Role applying for</Label><Input value={role} onChange={setRole} placeholder="e.g. Senior Product Manager" /></div>
            <div><Label>Company name</Label><Input value={company} onChange={setCompany} placeholder="e.g. Zalando" /></div>
            <div>
              <Label>Tone</Label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {["professional", "enthusiastic", "concise", "creative"].map(t => (
                  <button key={t} onClick={() => setTone(t)}
                    style={{ padding: "6px 14px", borderRadius: 99, fontSize: 13, fontWeight: 500, cursor: "pointer", border: `1.5px solid ${tone === t ? COLORS.accent : COLORS.gray200}`, background: tone === t ? COLORS.accentLight : COLORS.white, color: tone === t ? COLORS.accent : COLORS.gray600, fontFamily: FONTS.body }}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Card>
        <Card>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div><Label>Your key background & experiences</Label><TextArea value={background} onChange={setBackground} placeholder="e.g. 5 years in B2B SaaS product management..." rows={5} /></div>
            <div><Label>Job description (optional)</Label><TextArea value={jd} onChange={setJd} placeholder="Paste for a more tailored letter..." rows={4} /></div>
          </div>
        </Card>
      </div>
      <Btn onClick={run} disabled={loading || !name || !role || !company || !background} style={{ width: "100%", justifyContent: "center", padding: "13px 20px", fontSize: 15 }}>
        {loading ? <><Spinner /> Writing your cover letter...</> : "✨ Generate cover letter"}
      </Btn>
      {error && <div style={{ marginTop: 12, color: COLORS.red, fontSize: 13 }}>{error}</div>}
      {result && <ResultBox content={result} />}
    </div>
  );
};

const STATUS_CONFIG = {
  "Saved":     { color: COLORS.gray600, bg: COLORS.gray100 },
  "Applied":   { color: "#0369A1",      bg: "#E0F2FE" },
  "Interview": { color: "#7C3AED",      bg: "#EDE9FE" },
  "Offer":     { color: COLORS.green,   bg: COLORS.greenLight },
  "Rejected":  { color: COLORS.red,     bg: COLORS.redLight },
};
const STATUSES = Object.keys(STATUS_CONFIG);

const JobTracker = () => {
  const [jobs, setJobs] = useState([
    { id: 1, role: "Product Manager", company: "Zalando", location: "Berlin", date: "2026-06-10", status: "Interview", notes: "2nd round June 28" },
    { id: 2, role: "Marketing Lead", company: "HelloFresh", location: "Berlin", date: "2026-06-15", status: "Applied", notes: "" },
  ]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ role: "", company: "", location: "", date: "", status: "Saved", notes: "" });

  const openAdd = () => { setForm({ role: "", company: "", location: "", date: "", status: "Saved", notes: "" }); setEditId(null); setShowForm(true); };
  const openEdit = (job) => { setForm({ ...job }); setEditId(job.id); setShowForm(true); };
  const save = () => {
    if (!form.role || !form.company) return;
    if (editId) setJobs(jobs.map(j => j.id === editId ? { ...form, id: editId } : j));
    else setJobs([...jobs, { ...form, id: Date.now() }]);
    setShowForm(false);
  };
  const counts = STATUSES.reduce((a, s) => ({ ...a, [s]: jobs.filter(j => j.status === s).length }), {});

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginBottom: 20 }}>
        {STATUSES.map(s => {
          const cfg = STATUS_CONFIG[s];
          return (
            <div key={s} style={{ background: cfg.bg, borderRadius: 10, padding: "14px 16px", textAlign: "center" }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: cfg.color, fontFamily: FONTS.display }}>{counts[s]}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: cfg.color, marginTop: 2 }}>{s}</div>
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: COLORS.navy }}>{jobs.length} applications tracked</div>
        <Btn onClick={openAdd} style={{ fontSize: 13, padding: "8px 16px" }}>+ Add job</Btn>
      </div>
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: COLORS.gray50, borderBottom: `1.5px solid ${COLORS.gray200}` }}>
              {["Role", "Company", "Location", "Date", "Status", "Notes", ""].map(h => (
                <th key={h} style={{ padding: "10px 16px", fontSize: 12, fontWeight: 700, color: COLORS.gray600, textAlign: "left" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {jobs.map((job, i) => (
              <tr key={job.id} style={{ borderBottom: `1px solid ${COLORS.gray100}`, background: i % 2 === 0 ? COLORS.white : COLORS.gray50 }}>
                <td style={{ padding: "12px 16px", fontSize: 14, fontWeight: 600 }}>{job.role}</td>
                <td style={{ padding: "12px 16px", fontSize: 14, color: COLORS.gray600 }}>{job.company}</td>
                <td style={{ padding: "12px 16px", fontSize: 13, color: COLORS.gray400 }}>{job.location}</td>
                <td style={{ padding: "12px 16px", fontSize: 13, color: COLORS.gray400 }}>{job.date}</td>
                <td style={{ padding: "12px 16px" }}>
                  <select value={job.status} onChange={e => setJobs(jobs.map(j => j.id === job.id ? { ...j, status: e.target.value } : j))}
                    style={{ fontSize: 12, fontWeight: 600, padding: "3px 8px", borderRadius: 99, border: "none", cursor: "pointer", color: STATUS_CONFIG[job.status].color, background: STATUS_CONFIG[job.status].bg, fontFamily: FONTS.body }}>
                    {STATUSES.map(s => <option key={s}>{s}</option>)}
                  </select>
                </td>
                <td style={{ padding: "12px 16px", fontSize: 13, color: COLORS.gray400, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{job.notes || "—"}</td>
                <td style={{ padding: "12px 16px", whiteSpace: "nowrap" }}>
                  <button onClick={() => openEdit(job)} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.accent, fontSize: 13, fontWeight: 600, marginRight: 8, fontFamily: FONTS.body }}>Edit</button>
                  <button onClick={() => setJobs(jobs.filter(j => j.id !== job.id))} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.red, fontSize: 13, fontWeight: 600, fontFamily: FONTS.body }}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,31,61,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div style={{ background: COLORS.white, borderRadius: 16, padding: 28, width: "100%", maxWidth: 480 }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: COLORS.navy, marginBottom: 20 }}>{editId ? "Edit application" : "Add new job"}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div><Label>Job title *</Label><Input value={form.role} onChange={v => setForm({ ...form, role: v })} placeholder="e.g. Product Manager" /></div>
              <div><Label>Company *</Label><Input value={form.company} onChange={v => setForm({ ...form, company: v })} placeholder="e.g. Zalando" /></div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div><Label>Location</Label><Input value={form.location} onChange={v => setForm({ ...form, location: v })} placeholder="e.g. Berlin" /></div>
                <div><Label>Date applied</Label><Input type="date" value={form.date} onChange={v => setForm({ ...form, date: v })} /></div>
              </div>
              <div>
                <Label>Status</Label>
                <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1.5px solid ${COLORS.gray200}`, fontSize: 14, color: COLORS.gray800, background: COLORS.white, fontFamily: FONTS.body }}>
                  {STATUSES.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div><Label>Notes</Label><TextArea value={form.notes} onChange={v => setForm({ ...form, notes: v })} placeholder="Interview date, contact name..." rows={3} /></div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
              <Btn variant="secondary" onClick={() => setShowForm(false)}>Cancel</Btn>
              <Btn onClick={save} disabled={!form.role || !form.company}>Save</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const TABS = [
  { id: "profile", icon: "👤", label: "My Profile" },
  { id: "cv", icon: "📄", label: "CV Tailor" },
  { id: "cover", icon: "✉️", label: "Cover Letter" },
  { id: "tracker", icon: "📊", label: "Job Tracker" },
  { id: "resume", icon: "✏️", label: "Resume Editor" },
];

export default function App() {
  const [activeTab, setActiveTab] = useState("profile");
  const [profile, setProfile] = useState(EMPTY_PROFILE);

  if (activeTab === "resume") {
    return <ResumeEditor onBack={() => setActiveTab("cv")} profile={profile} />;
  }

  return (
    <div style={{ minHeight: "100vh", background: COLORS.gray50 }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ background: COLORS.navy, padding: "0 32px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 60 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, background: COLORS.accent, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>🎯</div>
            <span style={{ fontFamily: FONTS.display, fontSize: 18, fontWeight: 800, color: COLORS.white }}>JobMate</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: COLORS.accent, background: "rgba(37,99,235,0.25)", padding: "2px 8px", borderRadius: 99 }}>AI</span>
          </div>
          <a href="https://jobmate.tech" style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", textDecoration: "none" }}>← Back to jobmate.tech</a>
        </div>
      </div>
      <div style={{ background: COLORS.white, borderBottom: `1.5px solid ${COLORS.gray200}`, padding: "0 32px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", gap: 4 }}>
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              style={{ padding: "16px 20px", fontSize: 14, fontWeight: 600, cursor: "pointer", border: "none", background: "none", color: activeTab === tab.id ? COLORS.accent : COLORS.gray400, borderBottom: `2.5px solid ${activeTab === tab.id ? COLORS.accent : "transparent"}`, transition: "all 0.15s", display: "flex", alignItems: "center", gap: 7, fontFamily: FONTS.body }}>
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
      </div>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 32px" }}>
        <div style={{ marginBottom: 24 }}>
          {activeTab === "profile" && <><h1 style={{ fontFamily: FONTS.display, fontSize: 22, fontWeight: 800, color: COLORS.navy, marginBottom: 6 }}>My Profile</h1><p style={{ fontSize: 14, color: COLORS.gray600 }}>Upload your resume or fill in your details — this pre-fills your Resume Editor and AI tools automatically.</p></>}
          {activeTab === "cv" && <><h1 style={{ fontFamily: FONTS.display, fontSize: 22, fontWeight: 800, color: COLORS.navy, marginBottom: 6 }}>AI CV Tailor</h1><p style={{ fontSize: 14, color: COLORS.gray600 }}>Paste your CV and the job description — AI rewrites your CV to match the role and pass ATS screening.</p></>}
          {activeTab === "cover" && <><h1 style={{ fontFamily: FONTS.display, fontSize: 22, fontWeight: 800, color: COLORS.navy, marginBottom: 6 }}>Cover Letter Generator</h1><p style={{ fontSize: 14, color: COLORS.gray600 }}>Get a personalised, Germany-ready cover letter in seconds.</p></>}
          {activeTab === "tracker" && <><h1 style={{ fontFamily: FONTS.display, fontSize: 22, fontWeight: 800, color: COLORS.navy, marginBottom: 6 }}>Job Tracker</h1><p style={{ fontSize: 14, color: COLORS.gray600 }}>Track every application in one place.</p></>}
        </div>
        {activeTab === "profile" && <ProfilePage profile={profile} setProfile={setProfile} />}
        {activeTab === "cv" && <CVTailor />}
        {activeTab === "cover" && <CoverLetter />}
        {activeTab === "tracker" && <JobTracker />}
      </div>
    </div>
  );
}
