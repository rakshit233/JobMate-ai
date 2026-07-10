import { useState, useRef } from "react";
import { isLikelyUrl, isLinkedInUrl } from "./matching";

const C = {
  navy: "#0F1F3D",
  accent: "#2563EB",
  accentLight: "#EFF6FF",
  accentBorder: "#BFDBFE",
  green: "#16A34A",
  greenLight: "#F0FDF4",
  gray50: "#F8FAFC",
  gray100: "#F1F5F9",
  gray200: "#E2E8F0",
  gray300: "#CBD5E1",
  gray400: "#94A3B8",
  gray600: "#475569",
  gray800: "#1E293B",
  white: "#FFFFFF",
  purple: "#7C3AED",
  purpleLight: "#EDE9FE",
};
const FONT = "'Inter', system-ui, sans-serif";
const DISPLAY = "'Plus Jakarta Sans', 'Inter', sans-serif";

const callClaude = async (system, user) => {
  const res = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });
  const data = await res.json();
  return data.content?.[0]?.text || "";
};

// ── UI helpers ───────────────────────────────────────────────────
const Label = ({ children, required }) => (
  <label style={{ fontSize: 12, fontWeight: 600, color: C.gray600, display: "block", marginBottom: 5 }}>
    {children}{required && <span style={{ color: C.accent, marginLeft: 2 }}>*</span>}
  </label>
);

const Field = ({ label, value, onChange, placeholder, required, multiline, rows = 3, error }) => (
  <div>
    <Label required={required}>{label}</Label>
    {multiline ? (
      <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows}
        style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: `1.5px solid ${C.gray200}`, fontSize: 13, lineHeight: 1.6, color: C.gray800, background: C.white, resize: "vertical", outline: "none", fontFamily: FONT }}
        onFocus={e => e.target.style.borderColor = C.accent}
        onBlur={e => e.target.style.borderColor = C.gray200}
      />
    ) : (
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: `1.5px solid ${error ? "#F87171" : C.gray200}`, fontSize: 13, color: C.gray800, background: C.white, outline: "none", fontFamily: FONT }}
        onFocus={e => e.target.style.borderColor = error ? "#F87171" : C.accent}
        onBlur={e => e.target.style.borderColor = error ? "#F87171" : C.gray200}
      />
    )}
    {error && <div style={{ marginTop: 4, fontSize: 11.5, color: "#DC2626" }}>{error}</div>}
  </div>
);

const Card = ({ children, style: s }) => (
  <div style={{ background: C.white, borderRadius: 12, border: `1.5px solid ${C.gray200}`, padding: "20px 24px", ...s }}>
    {children}
  </div>
);

const SectionTitle = ({ children, icon }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
    <span style={{ fontSize: 18 }}>{icon}</span>
    <h2 style={{ fontSize: 15, fontWeight: 700, color: C.navy, fontFamily: DISPLAY, margin: 0 }}>{children}</h2>
  </div>
);

const Pill = ({ children, onRemove }) => (
  <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 99, background: C.accentLight, color: C.accent, fontSize: 12, fontWeight: 500, border: `1px solid ${C.accentBorder}` }}>
    {children}
    {onRemove && <button onClick={onRemove} style={{ background: "none", border: "none", cursor: "pointer", color: C.accent, fontSize: 14, lineHeight: 1, padding: 0, fontFamily: FONT }}>×</button>}
  </span>
);

const Spinner = ({ color = C.white }) => (
  <span style={{ display: "inline-block", width: 14, height: 14, border: `2px solid rgba(255,255,255,0.3)`, borderTopColor: color, borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
);

// ── Default empty profile ────────────────────────────────────────
export const EMPTY_PROFILE = {
  name: "", email: "", phone: "", location: "", linkedin: "", portfolio: "",
  summary: "",
  skills: [],
  experience: [{ company: "", title: "", location: "", startDate: "", endDate: "", current: false, bullets: [""] }],
  education: [{ school: "", degree: "", field: "", location: "", startDate: "", endDate: "", gpa: "" }],
  languages: [],
  certifications: [],
};

export default function ProfilePage({ profiles = [], activeProfileId, profile, setProfile, onSwitch, onAdd, onRename, onDelete }) {
  const [uploading, setUploading] = useState(false);
  const [uploadDone, setUploadDone] = useState(false);
  const [saved, setSaved] = useState(false);
  const [skillInput, setSkillInput] = useState("");
  const [langInput, setLangInput] = useState("");
  const [certInput, setCertInput] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const [newProfileName, setNewProfileName] = useState("");
  const [showNewInput, setShowNewInput] = useState(false);
  const fileRef = useRef();

  // ── PDF reading & AI parsing ─────────────────────────────────
  const handleFile = async (file) => {
    if (!file || file.type !== "application/pdf") {
      alert("Please upload a PDF file.");
      return;
    }
    setUploading(true);
    setUploadDone(false);
    try {
      // Read PDF as base64
      const base64 = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result.split(",")[1]);
        r.onerror = rej;
        r.readAsDataURL(file);
      });

      // Send to Claude with PDF document block
      const response = await fetch("/api/claude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
          system: `You are a resume parser. Extract all information from the resume and return ONLY a valid JSON object with this exact structure, no markdown, no backticks, no explanation:
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
}`,
          messages: [{
            role: "user",
            content: [
              { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } },
              { type: "text", text: "Parse this resume into the JSON structure specified. Extract every detail accurately." }
            ]
          }]
        }),
      });

      const data = await response.json();
      const text = data.content?.[0]?.text || "";

      // Parse JSON response
      const clean = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);

      // Merge with empty profile to ensure all fields exist
      setProfile({
        ...EMPTY_PROFILE,
        ...parsed,
        experience: parsed.experience?.length ? parsed.experience : EMPTY_PROFILE.experience,
        education: parsed.education?.length ? parsed.education : EMPTY_PROFILE.education,
        skills: parsed.skills || [],
        languages: parsed.languages || [],
        certifications: parsed.certifications || [],
      });
      setUploadDone(true);
    } catch (e) {
      console.error(e);
      alert("Couldn't parse the PDF. Please fill in your details manually below.");
    }
    setUploading(false);
  };

  const onFileChange = (e) => { if (e.target.files[0]) handleFile(e.target.files[0]); };
  const onDrop = (e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); };

  // ── Experience helpers ───────────────────────────────────────
  const updateExp = (i, field, val) => {
    const exp = [...profile.experience];
    exp[i] = { ...exp[i], [field]: val };
    setProfile({ ...profile, experience: exp });
  };
  const updateBullet = (ei, bi, val) => {
    const exp = [...profile.experience];
    exp[ei].bullets[bi] = val;
    setProfile({ ...profile, experience: exp });
  };
  const addBullet = (ei) => {
    const exp = [...profile.experience];
    exp[ei].bullets = [...exp[ei].bullets, ""];
    setProfile({ ...profile, experience: exp });
  };
  const removeBullet = (ei, bi) => {
    const exp = [...profile.experience];
    exp[ei].bullets = exp[ei].bullets.filter((_, i) => i !== bi);
    setProfile({ ...profile, experience: exp });
  };
  const addExp = () => setProfile({ ...profile, experience: [...profile.experience, { company: "", title: "", location: "", startDate: "", endDate: "", current: false, bullets: [""] }] });
  const removeExp = (i) => setProfile({ ...profile, experience: profile.experience.filter((_, idx) => idx !== i) });

  // ── Education helpers ────────────────────────────────────────
  const updateEdu = (i, field, val) => {
    const edu = [...profile.education];
    edu[i] = { ...edu[i], [field]: val };
    setProfile({ ...profile, education: edu });
  };
  const addEdu = () => setProfile({ ...profile, education: [...profile.education, { school: "", degree: "", field: "", location: "", startDate: "", endDate: "", gpa: "" }] });
  const removeEdu = (i) => setProfile({ ...profile, education: profile.education.filter((_, idx) => idx !== i) });

  // ── Skills ───────────────────────────────────────────────────
  const addSkill = (e) => {
    if ((e.key === "Enter" || e.key === ",") && skillInput.trim()) {
      e.preventDefault();
      if (!profile.skills.includes(skillInput.trim())) setProfile({ ...profile, skills: [...profile.skills, skillInput.trim()] });
      setSkillInput("");
    }
  };
  const removeSkill = (s) => setProfile({ ...profile, skills: profile.skills.filter(x => x !== s) });

  const addLang = (e) => {
    if ((e.key === "Enter" || e.key === ",") && langInput.trim()) {
      e.preventDefault();
      if (!profile.languages.includes(langInput.trim())) setProfile({ ...profile, languages: [...profile.languages, langInput.trim()] });
      setLangInput("");
    }
  };

  const addCert = (e) => {
    if ((e.key === "Enter") && certInput.trim()) {
      e.preventDefault();
      if (!profile.certifications.includes(certInput.trim())) setProfile({ ...profile, certifications: [...profile.certifications, certInput.trim()] });
      setCertInput("");
    }
  };

  const handleSave = () => {
    // Trigger App.js to persist via setActiveProfileData (called on every field change already)
    // localStorage write happens inside saveProfiles in App.js — nothing extra needed here.
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const inputStyle = { width: "100%", padding: "9px 12px", borderRadius: 8, border: `1.5px solid ${C.gray200}`, fontSize: 13, color: C.gray800, background: C.white, outline: "none", fontFamily: FONT };

  return (
    <div style={{ maxWidth: 800, margin: "0 auto" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* ── Profile switcher ── */}
      <div style={{ background: C.white, borderRadius: 12, border: `0.5px solid ${C.gray200}`, padding: "14px 20px", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: C.gray600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Profile:</span>

          {/* Profile tabs */}
          {profiles.map(p => (
            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 0 }}>
              {renamingId === p.id ? (
                <span style={{ display: "flex", gap: 4 }}>
                  <input value={renameValue} onChange={e => setRenameValue(e.target.value)} autoFocus
                    style={{ padding: "4px 8px", borderRadius: 6, border: `1px solid ${C.accent}`, fontSize: 12.5, fontFamily: FONT, width: 120 }}
                    onKeyDown={e => { if (e.key === "Enter") { onRename(p.id, renameValue); setRenamingId(null); } if (e.key === "Escape") setRenamingId(null); }} />
                  <button onClick={() => { onRename(p.id, renameValue); setRenamingId(null); }}
                    style={{ padding: "4px 8px", borderRadius: 6, background: C.accent, color: C.white, border: "none", fontSize: 12, cursor: "pointer", fontFamily: FONT }}>✓</button>
                </span>
              ) : (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                  <button onClick={() => onSwitch(p.id)}
                    style={{ padding: "5px 14px", borderRadius: 99, fontSize: 12.5, fontWeight: p.id === activeProfileId ? 600 : 400, cursor: "pointer", border: `1.5px solid ${p.id === activeProfileId ? C.accent : C.gray200}`, background: p.id === activeProfileId ? C.accentLight : C.gray50, color: p.id === activeProfileId ? C.accent : C.gray600, fontFamily: FONT }}>
                    {p.name}
                  </button>
                  {p.id === activeProfileId && (
                    <>
                      <button onClick={() => { setRenamingId(p.id); setRenameValue(p.name); }}
                        style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: C.gray400, padding: "0 2px", fontFamily: FONT }} title="Rename">✏️</button>
                      {profiles.length > 1 && (
                        <button onClick={() => { if (window.confirm(`Delete "${p.name}"?`)) onDelete(p.id); }}
                          style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: C.gray400, padding: "0 2px", fontFamily: FONT }} title="Delete">✕</button>
                      )}
                    </>
                  )}
                </span>
              )}
            </div>
          ))}

          {/* Add new profile */}
          {profiles.length < 4 && (
            showNewInput ? (
              <span style={{ display: "flex", gap: 4 }}>
                <input value={newProfileName} onChange={e => setNewProfileName(e.target.value)} placeholder="e.g. PM roles" autoFocus
                  style={{ padding: "4px 8px", borderRadius: 6, border: `1px solid ${C.accent}`, fontSize: 12.5, fontFamily: FONT, width: 110 }}
                  onKeyDown={e => { if (e.key === "Enter" && newProfileName.trim()) { onAdd(newProfileName.trim()); setNewProfileName(""); setShowNewInput(false); } if (e.key === "Escape") setShowNewInput(false); }} />
                <button onClick={() => { if (newProfileName.trim()) { onAdd(newProfileName.trim()); setNewProfileName(""); setShowNewInput(false); } }}
                  style={{ padding: "4px 8px", borderRadius: 6, background: C.accent, color: C.white, border: "none", fontSize: 12, cursor: "pointer", fontFamily: FONT }}>Add</button>
                <button onClick={() => setShowNewInput(false)}
                  style={{ padding: "4px 8px", borderRadius: 6, background: C.gray100, color: C.gray600, border: "none", fontSize: 12, cursor: "pointer", fontFamily: FONT }}>Cancel</button>
              </span>
            ) : (
              <button onClick={() => setShowNewInput(true)}
                style={{ padding: "5px 12px", borderRadius: 99, fontSize: 12, fontWeight: 500, cursor: "pointer", border: `1.5px dashed ${C.gray300}`, background: "transparent", color: C.gray600, fontFamily: FONT }}>
                + New profile
              </button>
            )
          )}

          {profiles.length >= 4 && (
            <span style={{ fontSize: 11, color: C.gray400 }}>Max 4 profiles reached</span>
          )}
        </div>

        <div style={{ marginTop: 8, fontSize: 11, color: C.gray400 }}>
          Each profile has its own CV, experience and skills — switching profiles updates the Resume Editor automatically.
        </div>
      </div>

      {/* Upload zone */}
      <Card style={{ marginBottom: 20, background: dragOver ? C.accentLight : C.white }}>
        <SectionTitle icon="📤">Upload your resume</SectionTitle>
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => fileRef.current.click()}
          style={{
            border: `2px dashed ${dragOver ? C.accent : C.gray200}`, borderRadius: 10, padding: "32px 20px",
            textAlign: "center", cursor: "pointer", transition: "all 0.15s",
            background: dragOver ? C.accentLight : C.gray50,
          }}
        >
          <input ref={fileRef} type="file" accept=".pdf" onChange={onFileChange} style={{ display: "none" }} />
          {uploading ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
              <Spinner color={C.accent} />
              <p style={{ fontSize: 14, color: C.accent, fontWeight: 600, margin: 0 }}>Reading your resume with AI...</p>
              <p style={{ fontSize: 12, color: C.gray400, margin: 0 }}>This takes about 10 seconds</p>
            </div>
          ) : uploadDone ? (
            <div>
              <div style={{ fontSize: 28, marginBottom: 8 }}>✅</div>
              <p style={{ fontSize: 14, fontWeight: 600, color: C.green, margin: "0 0 4px" }}>Resume parsed successfully!</p>
              <p style={{ fontSize: 12, color: C.gray400, margin: 0 }}>Review and edit the details below, then save your profile.</p>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 32, marginBottom: 10 }}>📄</div>
              <p style={{ fontSize: 14, fontWeight: 600, color: C.gray800, margin: "0 0 4px" }}>Drop your PDF resume here or click to upload</p>
              <p style={{ fontSize: 12, color: C.gray400, margin: 0 }}>AI will read it and fill in all your details automatically</p>
            </div>
          )}
        </div>
        <div style={{ textAlign: "center", marginTop: 12, fontSize: 12, color: C.gray400 }}>
          — or fill in your details manually below —
        </div>
      </Card>

      {/* Personal info */}
      <Card style={{ marginBottom: 16 }}>
        <SectionTitle icon="👤">Personal information</SectionTitle>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <Field label="Full name" required value={profile.name} onChange={v => setProfile({ ...profile, name: v })} placeholder="e.g. Rakshit Tiwari" />
          <Field label="Email" value={profile.email} onChange={v => setProfile({ ...profile, email: v })} placeholder="your@email.com" />
          <Field label="Phone" value={profile.phone} onChange={v => setProfile({ ...profile, phone: v })} placeholder="+49 123 456 789" />
          <Field label="Location" value={profile.location} onChange={v => setProfile({ ...profile, location: v })} placeholder="Berlin, Germany" />
          <Field label="LinkedIn URL" value={profile.linkedin} onChange={v => setProfile({ ...profile, linkedin: v })} placeholder="linkedin.com/in/yourname"
            error={profile.linkedin?.trim() && !isLinkedInUrl(profile.linkedin) ? "Enter a valid LinkedIn link, e.g. linkedin.com/in/yourname — invalid links are left out of your CV" : ""} />
          <Field label="Portfolio / Website" value={profile.portfolio} onChange={v => setProfile({ ...profile, portfolio: v })} placeholder="yourwebsite.com"
            error={profile.portfolio?.trim() && !isLikelyUrl(profile.portfolio) ? "Enter a valid link, e.g. yourwebsite.com — invalid links are left out of your CV" : ""} />
        </div>
        <div style={{ marginTop: 14 }}>
          <Field label="Professional summary" multiline rows={4} value={profile.summary} onChange={v => setProfile({ ...profile, summary: v })} placeholder="A brief 2-3 sentence summary of your professional background and goals..." />
        </div>
      </Card>

      {/* Skills */}
      <Card style={{ marginBottom: 16 }}>
        <SectionTitle icon="⚡">Skills</SectionTitle>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
          {profile.skills.map(s => <Pill key={s} onRemove={() => removeSkill(s)}>{s}</Pill>)}
        </div>
        <input value={skillInput} onChange={e => setSkillInput(e.target.value)} onKeyDown={addSkill}
          placeholder="Type a skill and press Enter (e.g. Project Management)"
          style={{ ...inputStyle, marginTop: 4 }}
          onFocus={e => e.target.style.borderColor = C.accent}
          onBlur={e => e.target.style.borderColor = C.gray200}
        />
        <p style={{ fontSize: 11, color: C.gray400, marginTop: 6 }}>Press Enter or comma to add each skill</p>
      </Card>

      {/* Experience */}
      <Card style={{ marginBottom: 16 }}>
        <SectionTitle icon="💼">Work experience</SectionTitle>
        {profile.experience.map((exp, i) => (
          <div key={i} style={{ marginBottom: 20, paddingBottom: 20, borderBottom: i < profile.experience.length - 1 ? `1px solid ${C.gray100}` : "none" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: C.navy }}>Position {i + 1}</span>
              {profile.experience.length > 1 && (
                <button onClick={() => removeExp(i)} style={{ background: "none", border: "none", cursor: "pointer", color: C.gray400, fontSize: 12, fontFamily: FONT }}>Remove</button>
              )}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <Field label="Job title" value={exp.title} onChange={v => updateExp(i, "title", v)} placeholder="e.g. Product Manager" />
              <Field label="Company" value={exp.company} onChange={v => updateExp(i, "company", v)} placeholder="e.g. Zalando" />
              <Field label="Location" value={exp.location} onChange={v => updateExp(i, "location", v)} placeholder="e.g. Berlin" />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <Field label="Start date" value={exp.startDate} onChange={v => updateExp(i, "startDate", v)} placeholder="01/2023" />
                <Field label="End date" value={exp.endDate} onChange={v => updateExp(i, "endDate", v)} placeholder={exp.current ? "Present" : "12/2024"} />
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <input type="checkbox" id={`current-${i}`} checked={exp.current} onChange={e => updateExp(i, "current", e.target.checked)} />
              <label htmlFor={`current-${i}`} style={{ fontSize: 12, color: C.gray600, cursor: "pointer" }}>I currently work here</label>
            </div>
            <Label>Key achievements / responsibilities</Label>
            {exp.bullets.map((b, bi) => (
              <div key={bi} style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                <span style={{ paddingTop: 9, color: C.gray400, fontSize: 12 }}>•</span>
                <input value={b} onChange={e => updateBullet(i, bi, e.target.value)} placeholder="Describe a key achievement with measurable impact..."
                  style={{ ...inputStyle, flex: 1 }}
                  onFocus={e => e.target.style.borderColor = C.accent}
                  onBlur={e => e.target.style.borderColor = C.gray200}
                />
                {exp.bullets.length > 1 && (
                  <button onClick={() => removeBullet(i, bi)} style={{ background: "none", border: "none", cursor: "pointer", color: C.gray400, fontSize: 16, padding: "0 4px" }}>×</button>
                )}
              </div>
            ))}
            <button onClick={() => addBullet(i)} style={{ fontSize: 12, color: C.accent, background: "none", border: "none", cursor: "pointer", fontFamily: FONT, marginTop: 4 }}>+ Add bullet point</button>
          </div>
        ))}
        <button onClick={addExp} style={{ fontSize: 13, color: C.accent, background: C.accentLight, border: `1px solid ${C.accentBorder}`, borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontFamily: FONT, fontWeight: 600, width: "100%", marginTop: 4 }}>
          + Add another position
        </button>
      </Card>

      {/* Education */}
      <Card style={{ marginBottom: 16 }}>
        <SectionTitle icon="🎓">Education</SectionTitle>
        {profile.education.map((edu, i) => (
          <div key={i} style={{ marginBottom: 16, paddingBottom: 16, borderBottom: i < profile.education.length - 1 ? `1px solid ${C.gray100}` : "none" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: C.navy }}>Degree {i + 1}</span>
              {profile.education.length > 1 && (
                <button onClick={() => removeEdu(i)} style={{ background: "none", border: "none", cursor: "pointer", color: C.gray400, fontSize: 12, fontFamily: FONT }}>Remove</button>
              )}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="School / University" value={edu.school} onChange={v => updateEdu(i, "school", v)} placeholder="e.g. University of Europe" />
              <Field label="Degree" value={edu.degree} onChange={v => updateEdu(i, "degree", v)} placeholder="e.g. Master of Business Administration" />
              <Field label="Field of study" value={edu.field} onChange={v => updateEdu(i, "field", v)} placeholder="e.g. Project Management" />
              <Field label="Location" value={edu.location} onChange={v => updateEdu(i, "location", v)} placeholder="e.g. Berlin" />
              <Field label="Start date" value={edu.startDate} onChange={v => updateEdu(i, "startDate", v)} placeholder="01/2025" />
              <Field label="End date" value={edu.endDate} onChange={v => updateEdu(i, "endDate", v)} placeholder="01/2026" />
              <Field label="GPA / Grade (optional)" value={edu.gpa} onChange={v => updateEdu(i, "gpa", v)} placeholder="e.g. 3.8/4.0 or 7.4/10" />
            </div>
          </div>
        ))}
        <button onClick={addEdu} style={{ fontSize: 13, color: C.accent, background: C.accentLight, border: `1px solid ${C.accentBorder}`, borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontFamily: FONT, fontWeight: 600, width: "100%", marginTop: 4 }}>
          + Add another degree
        </button>
      </Card>

      {/* Languages & Certifications */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
        <Card>
          <SectionTitle icon="🌍">Languages</SectionTitle>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
            {profile.languages.map(l => <Pill key={l} onRemove={() => setProfile({ ...profile, languages: profile.languages.filter(x => x !== l) })}>{l}</Pill>)}
          </div>
          <input value={langInput} onChange={e => setLangInput(e.target.value)} onKeyDown={addLang}
            placeholder="e.g. English (Native)"
            style={{ ...inputStyle }}
            onFocus={e => e.target.style.borderColor = C.accent}
            onBlur={e => e.target.style.borderColor = C.gray200}
          />
          <p style={{ fontSize: 11, color: C.gray400, marginTop: 6 }}>Press Enter to add</p>
        </Card>
        <Card>
          <SectionTitle icon="🏆">Certifications</SectionTitle>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
            {profile.certifications.map(c => <Pill key={c} onRemove={() => setProfile({ ...profile, certifications: profile.certifications.filter(x => x !== c) })}>{c}</Pill>)}
          </div>
          <input value={certInput} onChange={e => setCertInput(e.target.value)} onKeyDown={addCert}
            placeholder="e.g. PMP, AWS Solutions Architect"
            style={{ ...inputStyle }}
            onFocus={e => e.target.style.borderColor = C.accent}
            onBlur={e => e.target.style.borderColor = C.gray200}
          />
          <p style={{ fontSize: 11, color: C.gray400, marginTop: 6 }}>Press Enter to add</p>
        </Card>
      </div>

      {/* Save button */}
      <div style={{ position: "sticky", bottom: 0, background: "rgba(248,250,252,0.95)", padding: "16px 0", backdropFilter: "blur(8px)", borderTop: `1px solid ${C.gray200}` }}>
        <button onClick={handleSave}
          style={{ width: "100%", padding: "13px", borderRadius: 10, background: saved ? C.green : C.accent, color: C.white, fontSize: 15, fontWeight: 700, border: "none", cursor: "pointer", fontFamily: DISPLAY, transition: "background 0.2s", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          {saved ? "✅ Profile saved! Resume Editor is now pre-filled." : "💾 Save profile"}
        </button>
        {!saved && <p style={{ textAlign: "center", fontSize: 12, color: C.gray400, marginTop: 8 }}>Your profile data will pre-fill the Resume Editor automatically</p>}
      </div>
    </div>
  );
}
