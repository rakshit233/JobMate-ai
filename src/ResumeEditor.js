import { useState, useRef, useEffect } from "react";

const C = {
  navy: "#0F1F3D",
  accent: "#2563EB",
  accentLight: "#EFF6FF",
  accentBorder: "#BFDBFE",
  purple: "#7C3AED",
  purpleLight: "#EDE9FE",
  green: "#16A34A",
  greenLight: "#F0FDF4",
  gray50: "#F8FAFC",
  gray100: "#F1F5F9",
  gray200: "#E2E8F0",
  gray300: "#CBD5E1",
  gray400: "#94A3B8",
  gray500: "#64748B",
  gray600: "#475569",
  gray700: "#334155",
  gray800: "#1E293B",
  white: "#FFFFFF",
};

const FONT = "'Inter', system-ui, sans-serif";
const DISPLAY = "'Plus Jakarta Sans', 'Inter', sans-serif";

// ── API ──────────────────────────────────────────────────────────
const callClaude = async (system, user) => {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "anthropic-dangerous-direct-browser-access": "true",
    },
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

// ── Default resume data ──────────────────────────────────────────
const DEFAULT = {
  name: "Your Name",
  contact: "email@example.com | LinkedIn | Location",
  summary: "Paste your professional summary here. Click any section to edit it directly.",
  education: [
    { school: "University Name", degree: "Degree · Field of Study", location: "City", dates: "01/2020 – 01/2024" },
  ],
  experience: [
    {
      company: "Company Name", title: "Job Title", location: "City", dates: "01/2022 – Present",
      bullets: ["Describe your key achievement here with measurable impact", "Add another accomplishment with numbers and results"],
    },
  ],
  skills: "Communication · Project Management · Microsoft Office · Leadership",
};

// ── Editable text ────────────────────────────────────────────────
const Editable = ({ value, onChange, tag: Tag = "span", style: s, multiline }) => {
  const ref = useRef();
  const [focused, setFocused] = useState(false);

  return (
    <Tag
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      onFocus={() => setFocused(true)}
      onBlur={e => { setFocused(false); onChange(e.currentTarget.innerText); }}
      style={{
        outline: "none",
        borderRadius: 3,
        padding: focused ? "1px 3px" : "1px 3px",
        background: focused ? "#FFF9C4" : "transparent",
        border: focused ? "1px dashed #F59E0B" : "1px solid transparent",
        cursor: "text",
        display: Tag === "div" ? "block" : "inline",
        minWidth: 20,
        whiteSpace: multiline ? "pre-wrap" : "normal",
        ...s,
      }}
      dangerouslySetInnerHTML={{ __html: value }}
    />
  );
};

// ── Resume Preview ───────────────────────────────────────────────
const ResumePreview = ({ data, setData }) => {
  const updateExp = (i, field, val) => {
    const exp = [...data.experience];
    exp[i] = { ...exp[i], [field]: val };
    setData({ ...data, experience: exp });
  };
  const updateBullet = (ei, bi, val) => {
    const exp = [...data.experience];
    exp[ei].bullets[bi] = val;
    setData({ ...data, experience: exp });
  };
  const updateEdu = (i, field, val) => {
    const edu = [...data.education];
    edu[i] = { ...edu[i], [field]: val };
    setData({ ...data, education: edu });
  };

  const sectionHead = (title) => (
    <div style={{ borderBottom: "2px solid #1E293B", marginBottom: 6, marginTop: 14, paddingBottom: 2 }}>
      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#1E293B", textTransform: "uppercase" }}>{title}</span>
    </div>
  );

  return (
    <div style={{
      background: C.white, width: "100%", minHeight: "100%",
      padding: "40px 48px", fontFamily: "Georgia, 'Times New Roman', serif",
      fontSize: 13, lineHeight: 1.55, color: "#1a1a1a",
      boxShadow: "0 4px 24px rgba(0,0,0,0.10)",
    }}>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.01em", color: "#0F1F3D" }}>
          <Editable value={data.name} onChange={v => setData({ ...data, name: v })} style={{ fontSize: 22, fontWeight: 700 }} />
        </div>
        <div style={{ fontSize: 12, color: "#475569", marginTop: 3 }}>
          <Editable value={data.contact} onChange={v => setData({ ...data, contact: v })} style={{ fontSize: 12 }} />
        </div>
      </div>

      {/* Summary */}
      {sectionHead("Summary")}
      <div style={{ fontSize: 12.5, lineHeight: 1.65, color: "#334155" }}>
        <Editable tag="div" multiline value={data.summary} onChange={v => setData({ ...data, summary: v })} />
      </div>

      {/* Education */}
      {sectionHead("Education")}
      {data.education.map((edu, i) => (
        <div key={i} style={{ marginBottom: 6 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={{ fontWeight: 700, fontSize: 12.5 }}>
              <Editable value={edu.school} onChange={v => updateEdu(i, "school", v)} />
            </span>
            <span style={{ fontSize: 11.5, color: "#475569" }}>
              <Editable value={edu.location} onChange={v => updateEdu(i, "location", v)} />
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontStyle: "italic", fontSize: 12, color: "#334155" }}>
              <Editable value={edu.degree} onChange={v => updateEdu(i, "degree", v)} />
            </span>
            <span style={{ fontSize: 11.5, color: "#475569" }}>
              <Editable value={edu.dates} onChange={v => updateEdu(i, "dates", v)} />
            </span>
          </div>
        </div>
      ))}

      {/* Experience */}
      {sectionHead("Work Experience")}
      {data.experience.map((exp, i) => (
        <div key={i} style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={{ fontWeight: 700, fontSize: 13 }}>
              <Editable value={exp.company} onChange={v => updateExp(i, "company", v)} />
            </span>
            <span style={{ fontSize: 11.5, color: "#475569" }}>
              <Editable value={exp.location} onChange={v => updateExp(i, "location", v)} />
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontStyle: "italic", fontSize: 12, color: "#334155" }}>
              <Editable value={exp.title} onChange={v => updateExp(i, "title", v)} />
            </span>
            <span style={{ fontSize: 11.5, color: "#475569" }}>
              <Editable value={exp.dates} onChange={v => updateExp(i, "dates", v)} />
            </span>
          </div>
          <ul style={{ margin: "4px 0 0 16px", padding: 0 }}>
            {exp.bullets.map((b, bi) => (
              <li key={bi} style={{ fontSize: 12, lineHeight: 1.6, color: "#334155", marginBottom: 2 }}>
                <Editable value={b} onChange={v => updateBullet(i, bi, v)} style={{ fontSize: 12 }} />
              </li>
            ))}
          </ul>
        </div>
      ))}

      {/* Skills */}
      {sectionHead("Skills")}
      <div style={{ fontSize: 12.5, color: "#334155" }}>
        <Editable tag="div" value={data.skills} onChange={v => setData({ ...data, skills: v })} />
      </div>

      <div style={{ marginTop: 20, fontSize: 10, color: C.gray300, textAlign: "center", fontFamily: FONT }}>
        Click any text to edit • Changes save automatically
      </div>
    </div>
  );
};

// ── AI Coach Panel ───────────────────────────────────────────────
const QUICK_ACTIONS = [
  { label: "Improve summary", prompt: (r) => `Rewrite this resume summary to be more compelling and impactful (2-3 sentences max): "${r.summary}". Return ONLY the improved summary text, nothing else.`, field: "summary" },
  { label: "Boost work descriptions", prompt: (r) => `Improve these work experience bullet points to be more impactful with stronger action verbs and measurable results:\n${r.experience.map(e => e.bullets.join("\n")).join("\n")}\n\nReturn ONLY the improved bullets, one per line, no extra text.`, field: "bullets" },
  { label: "ATS scan", prompt: (r) => `Analyze this resume for ATS (Applicant Tracking System) compatibility. Check for: keyword optimization, formatting issues, missing sections, weak phrases. Give a score out of 100 and 3-5 specific actionable improvements.\n\nResume:\n${JSON.stringify(r)}`, field: "chat" },
  { label: "Strengthen skills", prompt: (r) => `Based on this resume's experience, suggest 8-10 strong professional skills to add or improve in the skills section. Format as: Skill1 · Skill2 · Skill3 etc.\n\nCurrent skills: ${r.skills}\nExperience: ${r.experience.map(e => e.title + " at " + e.company).join(", ")}`, field: "skills" },
  { label: "Fix bullet points", prompt: (r) => `Rewrite these bullet points to start with strong action verbs and include measurable impact:\n${r.experience.flatMap(e => e.bullets).join("\n")}\n\nReturn ONLY improved bullets, one per line.`, field: "bullets" },
  { label: "Full ATS scan", prompt: (r) => `Do a comprehensive ATS audit of this resume. Score each section (Summary, Experience, Education, Skills) out of 10. List top 5 improvements with specific examples.\n\nResume: ${JSON.stringify(r)}`, field: "chat" },
];

const AICoach = ({ data, setData }) => {
  const [messages, setMessages] = useState([
    { role: "assistant", text: "Hi! I'm your AI Resume Coach. Click a quick improvement or ask me anything about your resume." }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeAction, setActiveAction] = useState(null);
  const chatRef = useRef();

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages]);

  const applyToResume = (field, text) => {
    if (field === "summary") {
      setData(d => ({ ...d, summary: text.trim() }));
    } else if (field === "skills") {
      const match = text.match(/[A-Za-z][^.\n]*·[^.\n]*/);
      if (match) setData(d => ({ ...d, skills: match[0].trim() }));
      else setData(d => ({ ...d, skills: text.trim() }));
    } else if (field === "bullets") {
      const lines = text.trim().split("\n").filter(l => l.trim() && !l.match(/^\d+\./));
      if (lines.length > 0) {
        setData(d => {
          const exp = d.experience.map((e, i) => {
            const chunk = lines.slice(i * e.bullets.length, (i + 1) * e.bullets.length);
            return chunk.length > 0 ? { ...e, bullets: chunk.map(l => l.replace(/^[-•]\s*/, "")) } : e;
          });
          return { ...d, experience: exp };
        });
      }
    }
  };

  const runAction = async (action) => {
    setActiveAction(action.label);
    setLoading(true);
    const userMsg = { role: "user", text: action.label };
    setMessages(m => [...m, userMsg]);
    try {
      const result = await callClaude(
        "You are an expert resume coach and ATS specialist. Be concise and actionable.",
        action.prompt(data)
      );
      const assistantMsg = { role: "assistant", text: result, field: action.field, actionLabel: action.label };
      setMessages(m => [...m, assistantMsg]);
    } catch {
      setMessages(m => [...m, { role: "assistant", text: "Something went wrong. Please try again." }]);
    }
    setLoading(false);
    setActiveAction(null);
  };

  const sendChat = async () => {
    if (!input.trim() || loading) return;
    const userText = input.trim();
    setInput("");
    setMessages(m => [...m, { role: "user", text: userText }]);
    setLoading(true);
    try {
      const result = await callClaude(
        `You are an expert resume coach. The user's resume data: ${JSON.stringify(data)}. Help them improve their resume. Be specific and actionable. Keep responses concise (under 150 words unless asked for more).`,
        userText
      );
      setMessages(m => [...m, { role: "assistant", text: result, field: "chat" }]);
    } catch {
      setMessages(m => [...m, { role: "assistant", text: "Something went wrong. Please try again." }]);
    }
    setLoading(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: C.white, borderLeft: `1.5px solid ${C.gray200}` }}>
      {/* Header */}
      <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.gray200}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <div style={{ width: 32, height: 32, background: C.purpleLight, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>🤖</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.navy, fontFamily: DISPLAY }}>AI Resume Coach</div>
            <div style={{ fontSize: 11, color: C.green, fontWeight: 600 }}>● ATS scoring active</div>
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div style={{ padding: "14px 16px", borderBottom: `1px solid ${C.gray100}` }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: C.gray400, textTransform: "uppercase", marginBottom: 10 }}>Quick improvements</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {QUICK_ACTIONS.map(a => (
            <button key={a.label} onClick={() => runAction(a)} disabled={loading}
              style={{
                padding: "5px 10px", borderRadius: 99, fontSize: 11.5, fontWeight: 500, cursor: loading ? "not-allowed" : "pointer",
                border: `1px solid ${activeAction === a.label ? C.purple : C.gray200}`,
                background: activeAction === a.label ? C.purpleLight : C.gray50,
                color: activeAction === a.label ? C.purple : C.gray600,
                fontFamily: FONT, transition: "all 0.15s", opacity: loading && activeAction !== a.label ? 0.5 : 1,
              }}>
              {activeAction === a.label ? "⏳ " : ""}{a.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chat messages */}
      <div ref={chatRef} style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: 12 }}>
        {messages.map((msg, i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: msg.role === "user" ? "flex-end" : "flex-start" }}>
            <div style={{
              maxWidth: "90%", padding: "10px 13px", borderRadius: msg.role === "user" ? "12px 12px 3px 12px" : "12px 12px 12px 3px",
              background: msg.role === "user" ? C.accent : C.gray50,
              color: msg.role === "user" ? C.white : C.gray800,
              fontSize: 13, lineHeight: 1.6, fontFamily: FONT,
              border: msg.role === "assistant" ? `1px solid ${C.gray200}` : "none",
              whiteSpace: "pre-wrap",
            }}>
              {msg.text}
            </div>
            {msg.role === "assistant" && msg.field && msg.field !== "chat" && (
              <button onClick={() => applyToResume(msg.field, msg.text)}
                style={{ marginTop: 6, padding: "5px 12px", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", border: `1px solid ${C.green}`, background: C.greenLight, color: C.green, fontFamily: FONT }}>
                ✅ Apply to resume
              </button>
            )}
          </div>
        ))}
        {loading && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: C.gray400, fontSize: 13 }}>
            <span style={{ display: "inline-block", width: 6, height: 6, background: C.purple, borderRadius: "50%", animation: "pulse 1s infinite" }} />
            <span style={{ display: "inline-block", width: 6, height: 6, background: C.purple, borderRadius: "50%", animation: "pulse 1s 0.2s infinite" }} />
            <span style={{ display: "inline-block", width: 6, height: 6, background: C.purple, borderRadius: "50%", animation: "pulse 1s 0.4s infinite" }} />
          </div>
        )}
      </div>

      {/* Input */}
      <div style={{ padding: "12px 16px", borderTop: `1px solid ${C.gray200}`, display: "flex", gap: 8, alignItems: "flex-end" }}>
        <textarea
          value={input} onChange={e => setInput(e.target.value)} placeholder="e.g. Improve my summary, or add Docker to my skills..."
          rows={2} disabled={loading}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(); } }}
          style={{ flex: 1, padding: "9px 12px", borderRadius: 8, border: `1.5px solid ${C.gray200}`, fontSize: 13, lineHeight: 1.5, resize: "none", outline: "none", fontFamily: FONT, color: C.gray800, background: C.gray50 }}
          onFocus={e => e.target.style.borderColor = C.purple}
          onBlur={e => e.target.style.borderColor = C.gray200}
        />
        <button onClick={sendChat} disabled={loading || !input.trim()}
          style={{ width: 38, height: 38, borderRadius: 8, background: C.purple, border: "none", cursor: loading || !input.trim() ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, opacity: loading || !input.trim() ? 0.5 : 1, flexShrink: 0 }}>
          ↑
        </button>
      </div>
      <div style={{ padding: "4px 16px 10px", fontSize: 10, color: C.gray300, fontFamily: FONT }}>Enter to send · Shift+Enter for new line</div>

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 0.3; transform: scale(0.8); } 50% { opacity: 1; transform: scale(1.2); } }
      `}</style>
    </div>
  );
};

// ── Main export ──────────────────────────────────────────────────
function profileToResumeData(profile) {
  if (!profile || !profile.name) return DEFAULT;
  return {
    name: profile.name || DEFAULT.name,
    contact: [profile.email, profile.phone, profile.linkedin, profile.location].filter(Boolean).join(" | ") || DEFAULT.contact,
    summary: profile.summary || DEFAULT.summary,
    education: profile.education?.filter(e => e.school).map(e => ({
      school: e.school,
      degree: [e.degree, e.field].filter(Boolean).join(" · "),
      location: e.location,
      dates: [e.startDate, e.endDate || (e.current ? "Present" : "")].filter(Boolean).join(" – "),
    })) || DEFAULT.education,
    experience: profile.experience?.filter(e => e.company).map(e => ({
      company: e.company,
      title: e.title,
      location: e.location,
      dates: [e.startDate, e.current ? "Present" : e.endDate].filter(Boolean).join(" – "),
      bullets: e.bullets?.filter(b => b.trim()) || [""],
    })) || DEFAULT.experience,
    skills: profile.skills?.join(" · ") || DEFAULT.skills,
  };
}

export default function ResumeEditor({ onBack, profile }) {
  const [data, setData] = useState(() => profileToResumeData(profile));

  // When profile changes (user saves profile), update resume data
  const prevProfile = typeof window !== "undefined" ? window.__jm_prev_profile : null;
  if (profile && profile !== prevProfile && typeof window !== "undefined") {
    window.__jm_prev_profile = profile;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", fontFamily: FONT, background: C.gray100 }}>
      {/* Top bar */}
      <div style={{ background: C.navy, padding: "0 24px", height: 52, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {onBack && (
            <button onClick={onBack} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.6)", cursor: "pointer", fontSize: 13, fontFamily: FONT, display: "flex", alignItems: "center", gap: 4 }}>
              ← Back
            </button>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontFamily: DISPLAY, fontSize: 16, fontWeight: 800, color: C.white }}>JobMate</span>
            <span style={{ fontSize: 10, fontWeight: 700, color: C.accent, background: "rgba(37,99,235,0.25)", padding: "2px 7px", borderRadius: 99 }}>AI</span>
            <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 12 }}>/ Resume Editor</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => {
            const text = `${data.name}\n${data.contact}\n\nSUMMARY\n${data.summary}\n\nEDUCATION\n${data.education.map(e => `${e.school} | ${e.degree} | ${e.location} | ${e.dates}`).join("\n")}\n\nEXPERIENCE\n${data.experience.map(e => `${e.company} | ${e.title} | ${e.location} | ${e.dates}\n${e.bullets.map(b => "• " + b).join("\n")}`).join("\n\n")}\n\nSKILLS\n${data.skills}`;
            navigator.clipboard.writeText(text);
          }} style={{ padding: "6px 14px", borderRadius: 6, background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", color: C.white, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: FONT }}>
            📋 Copy resume
          </button>
        </div>
      </div>

      {/* Split layout */}
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 360px", overflow: "hidden" }}>
        {/* Left: Resume preview */}
        <div style={{ overflowY: "auto", padding: "32px 40px", background: C.gray100 }}>
          <ResumePreview data={data} setData={setData} />
        </div>

        {/* Right: AI Coach */}
        <div style={{ overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <AICoach data={data} setData={setData} />
        </div>
      </div>
    </div>
  );
}
