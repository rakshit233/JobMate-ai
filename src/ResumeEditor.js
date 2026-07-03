import { useState, useRef, useEffect } from "react";

const C = {
  navy: "#0F1F3D", accent: "#2563EB", accentLight: "#EFF6FF", accentBorder: "#BFDBFE",
  purple: "#7C3AED", purpleLight: "#EDE9FE", purpleBorder: "#DDD6FE",
  green: "#16A34A", greenLight: "#F0FDF4", amber: "#D97706", red: "#DC2626",
  gray50: "#F8FAFC", gray100: "#F1F5F9", gray200: "#E2E8F0", gray300: "#CBD5E1",
  gray400: "#94A3B8", gray500: "#64748B", gray600: "#475569", gray700: "#334155",
  gray800: "#1E293B", white: "#FFFFFF",
};
const UI_FONT = "'Inter', system-ui, sans-serif";
const DISPLAY = "'Plus Jakarta Sans', 'Inter', sans-serif";

const SONNET = "claude-sonnet-4-6";
const HAIKU  = "claude-haiku-4-5-20251001";

// callClaude with explicit model param
const callClaude = async (system, user, model = HAIKU) => {
  const res = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, max_tokens: 1000, system, messages: [{ role: "user", content: user }] }),
  });
  const data = await res.json();
  return data.content?.[0]?.text || "";
};

// ── Default resume data ──────────────────────────────────────────
const DEFAULT = {
  name: "Your Name",
  contact: "email@example.com | LinkedIn | Location",
  summary: "Paste your professional summary here. Click any section to edit it directly.",
  education: [{ school: "University Name", degree: "Degree · Field of Study", location: "City", dates: "01/2020 – 01/2024" }],
  experience: [{ company: "Company Name", title: "Job Title", location: "City", dates: "01/2022 – Present", bullets: ["Describe your key achievement here with measurable impact", "Add another accomplishment with numbers and results"] }],
  skills: "Communication · Project Management · Microsoft Office · Leadership",
};

// ── Templates (layouts) ───────────────────────────────────────────
const TEMPLATES = {
  classic: {
    name: "Classic", desc: "Traditional, centered header — works everywhere",
    headerAlign: "center", accentColor: "#1E293B", sectionStyle: "underline", twoColumn: false,
  },
  modern: {
    name: "Modern", desc: "Left-aligned with accent color — clean and current",
    headerAlign: "left", accentColor: "#2563EB", sectionStyle: "bar", twoColumn: false,
  },
  minimal: {
    name: "Minimal", desc: "Lots of whitespace, no rules — elegant simplicity",
    headerAlign: "left", accentColor: "#1E293B", sectionStyle: "spacing", twoColumn: false,
  },
  compact: {
    name: "Compact", desc: "Sidebar layout — fits more on one page",
    headerAlign: "left", accentColor: "#0F1F3D", sectionStyle: "underline", twoColumn: true,
  },
};

// ── Fonts ──────────────────────────────────────────────────────────
const FONTS = {
  georgia: { name: "Georgia", css: "Georgia, 'Times New Roman', serif", category: "Serif" },
  helvetica: { name: "Helvetica", css: "'Helvetica Neue', Arial, sans-serif", category: "Sans-serif" },
  garamond: { name: "Garamond", css: "'EB Garamond', Garamond, serif", category: "Serif" },
  calibri: { name: "Calibri", css: "Calibri, 'Segoe UI', sans-serif", category: "Sans-serif" },
};

// ── Section registry ────────────────────────────────────────────────
const SECTION_LABELS = {
  summary: "Summary",
  experience: "Work Experience",
  education: "Education",
  skills: "Skills",
};
const DEFAULT_SECTION_ORDER = ["summary", "experience", "education", "skills"];

// ── Editable text ────────────────────────────────────────────────
const Editable = ({ value, onChange, tag: Tag = "span", style: s, multiline }) => {
  const [focused, setFocused] = useState(false);
  return (
    <Tag
      contentEditable suppressContentEditableWarning
      onFocus={() => setFocused(true)}
      onBlur={e => { setFocused(false); onChange(e.currentTarget.innerText); }}
      style={{
        outline: "none", borderRadius: 3, padding: "1px 3px",
        background: focused ? "#FFF9C4" : "transparent",
        border: focused ? "1px dashed #F59E0B" : "1px solid transparent",
        cursor: "text", display: Tag === "div" ? "block" : "inline",
        minWidth: 20, whiteSpace: multiline ? "pre-wrap" : "normal", ...s,
      }}
      dangerouslySetInnerHTML={{ __html: value }}
    />
  );
};

// ── Section renderers (shared across templates) ─────────────────
const SectionHeading = ({ title, style, sectionStyle, accentColor }) => {
  if (sectionStyle === "bar") {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, marginBottom: 6, ...style }}>
        <div style={{ width: 4, height: 14, background: accentColor, borderRadius: 2 }} />
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", color: accentColor, textTransform: "uppercase" }}>{title}</span>
      </div>
    );
  }
  if (sectionStyle === "spacing") {
    return (
      <div style={{ marginTop: 20, marginBottom: 8, ...style }}>
        <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.14em", color: accentColor, textTransform: "uppercase" }}>{title}</span>
      </div>
    );
  }
  // underline (default/classic/compact)
  return (
    <div style={{ borderBottom: `2px solid ${accentColor}`, marginBottom: 6, marginTop: 14, paddingBottom: 2, ...style }}>
      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: accentColor, textTransform: "uppercase" }}>{title}</span>
    </div>
  );
};

const SummarySection = ({ data, setData, accentColor, sectionStyle }) => (
  <div>
    <SectionHeading title="Summary" sectionStyle={sectionStyle} accentColor={accentColor} />
    <div style={{ fontSize: 12.5, lineHeight: 1.65, color: "#334155" }}>
      <Editable tag="div" multiline value={data.summary} onChange={v => setData({ ...data, summary: v })} />
    </div>
  </div>
);

const EducationSection = ({ data, setData, accentColor, sectionStyle }) => {
  const updateEdu = (i, field, val) => {
    const edu = [...data.education]; edu[i] = { ...edu[i], [field]: val }; setData({ ...data, education: edu });
  };
  return (
    <div>
      <SectionHeading title="Education" sectionStyle={sectionStyle} accentColor={accentColor} />
      {data.education.map((edu, i) => (
        <div key={i} style={{ marginBottom: 6 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
            <span style={{ fontWeight: 700, fontSize: 12.5, flex: 1, minWidth: 0 }}><Editable value={edu.school} onChange={v => updateEdu(i, "school", v)} /></span>
            <span style={{ fontSize: 11.5, color: "#475569", flexShrink: 0, whiteSpace: "nowrap" }}><Editable value={edu.location} onChange={v => updateEdu(i, "location", v)} /></span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
            <span style={{ fontStyle: "italic", fontSize: 12, color: "#334155", flex: 1, minWidth: 0 }}><Editable value={edu.degree} onChange={v => updateEdu(i, "degree", v)} /></span>
            <span style={{ fontSize: 11.5, color: "#475569", flexShrink: 0, whiteSpace: "nowrap" }}><Editable value={edu.dates} onChange={v => updateEdu(i, "dates", v)} /></span>
          </div>
        </div>
      ))}
    </div>
  );
};

const ExperienceSection = ({ data, setData, accentColor, sectionStyle }) => {
  const updateExp = (i, field, val) => { const exp = [...data.experience]; exp[i] = { ...exp[i], [field]: val }; setData({ ...data, experience: exp }); };
  const updateBullet = (ei, bi, val) => { const exp = [...data.experience]; exp[ei].bullets[bi] = val; setData({ ...data, experience: exp }); };
  return (
    <div>
      <SectionHeading title="Work Experience" sectionStyle={sectionStyle} accentColor={accentColor} />
      {data.experience.map((exp, i) => (
        <div key={i} style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
            <span style={{ fontWeight: 700, fontSize: 13, flex: 1, minWidth: 0 }}><Editable value={exp.company} onChange={v => updateExp(i, "company", v)} /></span>
            <span style={{ fontSize: 11.5, color: "#475569", flexShrink: 0, whiteSpace: "nowrap" }}><Editable value={exp.location} onChange={v => updateExp(i, "location", v)} /></span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
            <span style={{ fontStyle: "italic", fontSize: 12, color: "#334155", flex: 1, minWidth: 0 }}><Editable value={exp.title} onChange={v => updateExp(i, "title", v)} /></span>
            <span style={{ fontSize: 11.5, color: "#475569", flexShrink: 0, whiteSpace: "nowrap" }}><Editable value={exp.dates} onChange={v => updateExp(i, "dates", v)} /></span>
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
    </div>
  );
};

const SkillsSection = ({ data, setData, accentColor, sectionStyle }) => (
  <div>
    <SectionHeading title="Skills" sectionStyle={sectionStyle} accentColor={accentColor} />
    <div style={{ fontSize: 12.5, color: "#334155" }}>
      <Editable tag="div" value={data.skills} onChange={v => setData({ ...data, skills: v })} />
    </div>
  </div>
);

const SECTION_COMPONENTS = {
  summary: SummarySection, experience: ExperienceSection, education: EducationSection, skills: SkillsSection,
};

// ── Resume Preview (template + font + order aware) ───────────────
const ResumePreview = ({ data, setData, template, font, sectionOrder }) => {
  const tpl = TEMPLATES[template];
  const fontCss = FONTS[font].css;
  const accentColor = tpl.accentColor;

  const headerBlock = (
    <div style={{ textAlign: tpl.headerAlign, marginBottom: 16 }}>
      <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.01em", color: tpl.headerAlign === "center" ? "#0F1F3D" : accentColor }}>
        <Editable value={data.name} onChange={v => setData({ ...data, name: v })} style={{ fontSize: 22, fontWeight: 700 }} />
      </div>
      <div style={{ fontSize: 12, color: "#475569", marginTop: 3 }}>
        <Editable value={data.contact} onChange={v => setData({ ...data, contact: v })} style={{ fontSize: 12 }} />
      </div>
      {tpl.headerAlign === "left" && <div style={{ height: 2, width: 50, background: accentColor, marginTop: 10, borderRadius: 1 }} />}
    </div>
  );

  const sectionsContent = sectionOrder.map(key => {
    const SectionComp = SECTION_COMPONENTS[key];
    if (!SectionComp) return null;
    return <SectionComp key={key} data={data} setData={setData} accentColor={accentColor} sectionStyle={tpl.sectionStyle} />;
  });

  if (tpl.twoColumn) {
    // Compact template: sidebar with contact/skills, main with summary/experience/education
    const sidebarKeys = ["skills"];
    const mainKeys = sectionOrder.filter(k => !sidebarKeys.includes(k));
    return (
      <div style={{ background: C.white, width: "100%", minHeight: "100%", fontFamily: fontCss, fontSize: 13, lineHeight: 1.55, color: "#1a1a1a", boxShadow: "0 4px 24px rgba(0,0,0,0.10)", display: "flex" }}>
        <div style={{ width: "32%", background: "#F8FAFC", padding: "32px 18px", borderRight: `2px solid ${accentColor}` }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: accentColor, marginBottom: 4, lineHeight: 1.3 }}>
            <Editable value={data.name} onChange={v => setData({ ...data, name: v })} />
          </div>
          <div style={{ fontSize: 10.5, color: "#475569", marginBottom: 18, lineHeight: 1.6 }}>
            <Editable tag="div" value={data.contact} onChange={v => setData({ ...data, contact: v })} />
          </div>
          {sidebarKeys.map(key => {
            const SectionComp = SECTION_COMPONENTS[key];
            return SectionComp ? <SectionComp key={key} data={data} setData={setData} accentColor={accentColor} sectionStyle="spacing" /> : null;
          })}
        </div>
        <div style={{ flex: 1, padding: "32px 28px" }}>
          {mainKeys.map(key => {
            const SectionComp = SECTION_COMPONENTS[key];
            return SectionComp ? <SectionComp key={key} data={data} setData={setData} accentColor={accentColor} sectionStyle={tpl.sectionStyle} /> : null;
          })}
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: C.white, width: "100%", padding: "20mm 18mm", fontFamily: fontCss, fontSize: 11.5, lineHeight: 1.55, color: "#1a1a1a", boxShadow: "0 4px 24px rgba(0,0,0,0.10)" }}>
      {headerBlock}
      {sectionsContent}
      <div className="no-print" style={{ marginTop: 20, fontSize: 10, color: C.gray300, textAlign: "center", fontFamily: UI_FONT }}>
        Click any text to edit • Changes save automatically
      </div>
    </div>
  );
};

// ── Design Panel (Templates / Fonts / Layout tabs) ────────────────
const DesignPanel = ({ template, setTemplate, font, setFont, sectionOrder, setSectionOrder }) => {
  const [tab, setTab] = useState("templates");

  const moveSection = (idx, dir) => {
    const newOrder = [...sectionOrder];
    const target = idx + dir;
    if (target < 0 || target >= newOrder.length) return;
    [newOrder[idx], newOrder[target]] = [newOrder[target], newOrder[idx]];
    setSectionOrder(newOrder);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Sub-tabs */}
      <div style={{ display: "flex", borderBottom: `1px solid ${C.gray200}`, padding: "0 16px" }}>
        {[{ id: "templates", label: "Layout", icon: "📐" }, { id: "fonts", label: "Font", icon: "🔤" }, { id: "order", label: "Sections", icon: "↕️" }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ padding: "12px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", border: "none", background: "none", color: tab === t.id ? C.purple : C.gray400, borderBottom: `2px solid ${tab === t.id ? C.purple : "transparent"}`, fontFamily: UI_FONT, display: "flex", alignItems: "center", gap: 5 }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      <div style={{ padding: 16, overflowY: "auto", flex: 1 }}>
        {tab === "templates" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {Object.entries(TEMPLATES).map(([key, t]) => (
              <button key={key} onClick={() => setTemplate(key)}
                style={{ textAlign: "left", padding: "12px 14px", borderRadius: 10, border: `1.5px solid ${template === key ? C.purple : C.gray200}`, background: template === key ? C.purpleLight : C.white, cursor: "pointer", fontFamily: UI_FONT }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: template === key ? C.purple : C.gray800 }}>{t.name}</span>
                  {template === key && <span style={{ fontSize: 11, color: C.purple }}>✓ Active</span>}
                </div>
                <div style={{ fontSize: 11.5, color: C.gray500, lineHeight: 1.4 }}>{t.desc}</div>
              </button>
            ))}
          </div>
        )}

        {tab === "fonts" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {Object.entries(FONTS).map(([key, f]) => (
              <button key={key} onClick={() => setFont(key)}
                style={{ textAlign: "left", padding: "12px 14px", borderRadius: 10, border: `1.5px solid ${font === key ? C.purple : C.gray200}`, background: font === key ? C.purpleLight : C.white, cursor: "pointer", fontFamily: UI_FONT }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 16, fontFamily: f.css, color: font === key ? C.purple : C.gray800 }}>{f.name}</span>
                  {font === key && <span style={{ fontSize: 11, color: C.purple }}>✓</span>}
                </div>
                <div style={{ fontSize: 11, color: C.gray400, marginTop: 2 }}>{f.category}</div>
              </button>
            ))}
          </div>
        )}

        {tab === "order" && (
          <div>
            <div style={{ fontSize: 11.5, color: C.gray500, marginBottom: 12, lineHeight: 1.5 }}>Use the arrows to rearrange the order sections appear in your resume.</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {sectionOrder.map((key, i) => (
                <div key={key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 12px", borderRadius: 8, border: `1px solid ${C.gray200}`, background: C.gray50 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: C.gray800 }}>{SECTION_LABELS[key]}</span>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button onClick={() => moveSection(i, -1)} disabled={i === 0}
                      style={{ width: 24, height: 24, borderRadius: 6, border: `1px solid ${C.gray200}`, background: C.white, cursor: i === 0 ? "not-allowed" : "pointer", opacity: i === 0 ? 0.3 : 1, fontSize: 11, color: C.gray600 }}>↑</button>
                    <button onClick={() => moveSection(i, 1)} disabled={i === sectionOrder.length - 1}
                      style={{ width: 24, height: 24, borderRadius: 6, border: `1px solid ${C.gray200}`, background: C.white, cursor: i === sectionOrder.length - 1 ? "not-allowed" : "pointer", opacity: i === sectionOrder.length - 1 ? 0.3 : 1, fontSize: 11, color: C.gray600 }}>↓</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ── AI Coach Panel ───────────────────────────────────────────────
const QUICK_ACTIONS = [
  { label: "Improve summary", prompt: (r) => `Rewrite this resume summary to be more compelling and impactful (2-3 sentences max): "${r.summary}". Return ONLY the improved summary text, nothing else.`, field: "summary" },
  { label: "Boost work descriptions", prompt: (r) => `Improve these work experience bullet points to be more impactful with stronger action verbs and measurable results:\n${r.experience.map(e => e.bullets.join("\n")).join("\n")}\n\nReturn ONLY the improved bullets, one per line, no extra text.`, field: "bullets" },
  { label: "ATS scan", prompt: (r) => `Analyze this resume for ATS compatibility. Give a score out of 100 and 3-5 actionable improvements.\n\nResume:\n${JSON.stringify(r)}`, field: "chat" },
  { label: "Strengthen skills", prompt: (r) => `Based on this resume's experience, suggest 8-10 strong professional skills. Format as: Skill1 · Skill2 · Skill3 etc.\n\nCurrent skills: ${r.skills}\nExperience: ${r.experience.map(e => e.title + " at " + e.company).join(", ")}`, field: "skills" },
  { label: "Fix bullet points", prompt: (r) => `Rewrite these bullet points to start with strong action verbs and include measurable impact:\n${r.experience.flatMap(e => e.bullets).join("\n")}\n\nReturn ONLY improved bullets, one per line.`, field: "bullets" },
  { label: "Full ATS scan", prompt: (r) => `Do a comprehensive ATS audit. Score each section out of 10. List top 5 improvements.\n\nResume: ${JSON.stringify(r)}`, field: "chat" },
];

const AICoach = ({ data, setData }) => {
  const [messages, setMessages] = useState([{ role: "assistant", text: "Hi! I'm your AI Resume Coach. Click a quick improvement or ask me anything." }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeAction, setActiveAction] = useState(null);
  const chatRef = useRef();

  useEffect(() => { if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight; }, [messages]);

  const applyToResume = (field, text) => {
    if (field === "summary") setData(d => ({ ...d, summary: text.trim() }));
    else if (field === "skills") {
      const match = text.match(/[A-Za-z][^.\n]*·[^.\n]*/);
      setData(d => ({ ...d, skills: (match ? match[0] : text).trim() }));
    } else if (field === "bullets") {
      const lines = text.trim().split("\n").filter(l => l.trim() && !l.match(/^\d+\./));
      if (lines.length > 0) setData(d => {
        const exp = d.experience.map((e, i) => {
          const chunk = lines.slice(i * e.bullets.length, (i + 1) * e.bullets.length);
          return chunk.length > 0 ? { ...e, bullets: chunk.map(l => l.replace(/^[-•]\s*/, "")) } : e;
        });
        return { ...d, experience: exp };
      });
    }
  };

  const runAction = async (action) => {
    setActiveAction(action.label); setLoading(true);
    setMessages(m => [...m, { role: "user", text: action.label }]);
    try {
      const result = await callClaude("You are an expert resume coach and ATS specialist. Be concise and actionable.", action.prompt(data), HAIKU);
      setMessages(m => [...m, { role: "assistant", text: result, field: action.field }]);
    } catch { setMessages(m => [...m, { role: "assistant", text: "Something went wrong. Please try again." }]); }
    setLoading(false); setActiveAction(null);
  };

  const sendChat = async () => {
    if (!input.trim() || loading) return;
    const userText = input.trim(); setInput("");
    setMessages(m => [...m, { role: "user", text: userText }]);
    setLoading(true);
    try {
      const result = await callClaude(`You are an expert resume coach. The user's resume data: ${JSON.stringify(data)}. Be specific and actionable. Keep responses under 150 words unless asked for more.`, userText, SONNET);
      setMessages(m => [...m, { role: "assistant", text: result, field: "chat" }]);
    } catch { setMessages(m => [...m, { role: "assistant", text: "Something went wrong. Please try again." }]); }
    setLoading(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: C.white }}>
      <div style={{ padding: "14px 16px", borderBottom: `1px solid ${C.gray200}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <div style={{ width: 30, height: 30, background: C.purpleLight, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>🤖</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.navy, fontFamily: DISPLAY }}>AI Resume Coach</div>
            <div style={{ fontSize: 10, color: C.green, fontWeight: 600 }}>● ATS scoring active</div>
          </div>
        </div>
      </div>
      <div style={{ padding: "12px 14px", borderBottom: `1px solid ${C.gray100}` }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
          {QUICK_ACTIONS.map(a => (
            <button key={a.label} onClick={() => runAction(a)} disabled={loading}
              style={{ padding: "4px 9px", borderRadius: 99, fontSize: 11, fontWeight: 500, cursor: loading ? "not-allowed" : "pointer", border: `1px solid ${activeAction === a.label ? C.purple : C.gray200}`, background: activeAction === a.label ? C.purpleLight : C.gray50, color: activeAction === a.label ? C.purple : C.gray600, fontFamily: UI_FONT, opacity: loading && activeAction !== a.label ? 0.5 : 1 }}>
              {activeAction === a.label ? "⏳ " : ""}{a.label}
            </button>
          ))}
        </div>
      </div>
      <div ref={chatRef} style={{ flex: 1, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
        {messages.map((msg, i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: msg.role === "user" ? "flex-end" : "flex-start" }}>
            <div style={{ maxWidth: "90%", padding: "9px 12px", borderRadius: msg.role === "user" ? "12px 12px 3px 12px" : "12px 12px 12px 3px", background: msg.role === "user" ? C.accent : C.gray50, color: msg.role === "user" ? C.white : C.gray800, fontSize: 12.5, lineHeight: 1.55, fontFamily: UI_FONT, border: msg.role === "assistant" ? `1px solid ${C.gray200}` : "none", whiteSpace: "pre-wrap" }}>
              {msg.text}
            </div>
            {msg.role === "assistant" && msg.field && msg.field !== "chat" && (
              <button onClick={() => applyToResume(msg.field, msg.text)}
                style={{ marginTop: 5, padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer", border: `1px solid ${C.green}`, background: C.greenLight, color: C.green, fontFamily: UI_FONT }}>
                ✅ Apply to resume
              </button>
            )}
          </div>
        ))}
        {loading && <div style={{ display: "flex", gap: 6, color: C.gray400, fontSize: 12 }}>
          <span style={{ width: 5, height: 5, background: C.purple, borderRadius: "50%", animation: "pulse 1s infinite" }} />
          <span style={{ width: 5, height: 5, background: C.purple, borderRadius: "50%", animation: "pulse 1s 0.2s infinite" }} />
          <span style={{ width: 5, height: 5, background: C.purple, borderRadius: "50%", animation: "pulse 1s 0.4s infinite" }} />
        </div>}
      </div>
      <div style={{ padding: "10px 14px", borderTop: `1px solid ${C.gray200}`, display: "flex", gap: 7, alignItems: "flex-end" }}>
        <textarea value={input} onChange={e => setInput(e.target.value)} placeholder="Ask the AI coach..." rows={2} disabled={loading}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(); } }}
          style={{ flex: 1, padding: "8px 11px", borderRadius: 8, border: `1.5px solid ${C.gray200}`, fontSize: 12.5, lineHeight: 1.5, resize: "none", outline: "none", fontFamily: UI_FONT, color: C.gray800, background: C.gray50 }} />
        <button onClick={sendChat} disabled={loading || !input.trim()}
          style={{ width: 36, height: 36, borderRadius: 8, background: C.purple, border: "none", cursor: loading || !input.trim() ? "not-allowed" : "pointer", fontSize: 15, opacity: loading || !input.trim() ? 0.5 : 1, flexShrink: 0, color: "#fff" }}>↑</button>
      </div>
      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 0.3; transform: scale(0.8); } 50% { opacity: 1; transform: scale(1.2); } }
        @keyframes spin { to { transform: rotate(360deg); } }
        @media print { .no-print { display: none !important; } [contenteditable] { background: transparent !important; border: none !important; } }
      `}</style>
    </div>
  );
};

// ── Helpers ──────────────────────────────────────────────────────
// ── Version selector bar ───────────────────────────────────────────
const VersionBar = ({ versions, currentVersionId, onSelect, onSaveAsNew, onSaveCurrent, onRename, onDelete, hasUnsaved }) => {
  const [showNewInput, setShowNewInput] = useState(false);
  const [newName, setNewName] = useState("");
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState("");

  const current = versions.find(v => v.id === currentVersionId);

  return (
    <div style={{ background: C.gray50, borderBottom: `1px solid ${C.gray200}`, padding: "8px 24px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: C.gray500, textTransform: "uppercase", letterSpacing: "0.05em" }}>Version:</span>

      <select
        value={currentVersionId || ""}
        onChange={e => onSelect(e.target.value)}
        style={{ padding: "5px 10px", borderRadius: 7, border: `1px solid ${C.gray200}`, fontSize: 12.5, color: C.gray800, background: C.white, fontFamily: UI_FONT, maxWidth: 200 }}
      >
        <option value="">— Unsaved / default —</option>
        {versions.map(v => <option key={v.id} value={v.id}>{v.name}{v.last_tailored_role ? ` (${v.last_tailored_role})` : ""}</option>)}
      </select>

      {hasUnsaved && <span style={{ fontSize: 11, color: C.amber, fontWeight: 600 }}>● unsaved changes</span>}

      {current && renamingId !== current.id && (
        <button onClick={() => { setRenamingId(current.id); setRenameValue(current.name); }}
          style={{ fontSize: 12, color: C.gray600, background: "none", border: `1px solid ${C.gray200}`, borderRadius: 6, padding: "4px 9px", cursor: "pointer", fontFamily: UI_FONT }}>
          Rename
        </button>
      )}
      {current && renamingId === current.id && (
        <span style={{ display: "flex", gap: 4 }}>
          <input value={renameValue} onChange={e => setRenameValue(e.target.value)} autoFocus
            style={{ padding: "4px 8px", borderRadius: 6, border: `1px solid ${C.purple}`, fontSize: 12.5, fontFamily: UI_FONT, width: 140 }} />
          <button onClick={() => { onRename(current.id, renameValue); setRenamingId(null); }}
            style={{ fontSize: 12, color: C.white, background: C.purple, border: "none", borderRadius: 6, padding: "4px 9px", cursor: "pointer", fontFamily: UI_FONT }}>✓</button>
        </span>
      )}

      <span style={{ flex: 1 }} />

      {current && (
        <button onClick={() => onSaveCurrent()}
          style={{ fontSize: 12, fontWeight: 600, color: C.purple, background: C.purpleLight, border: `1px solid ${C.purpleBorder}`, borderRadius: 6, padding: "5px 12px", cursor: "pointer", fontFamily: UI_FONT }}>
          💾 Save changes
        </button>
      )}

      {!showNewInput ? (
        <button onClick={() => { setShowNewInput(true); setNewName(""); }}
          style={{ fontSize: 12, fontWeight: 600, color: C.white, background: C.accent, border: "none", borderRadius: 6, padding: "5px 12px", cursor: "pointer", fontFamily: UI_FONT }}>
          + Save as new version
        </button>
      ) : (
        <span style={{ display: "flex", gap: 4 }}>
          <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. PM roles" autoFocus
            style={{ padding: "5px 9px", borderRadius: 6, border: `1px solid ${C.accent}`, fontSize: 12.5, fontFamily: UI_FONT, width: 130 }}
            onKeyDown={e => { if (e.key === "Enter" && newName.trim()) { onSaveAsNew(newName.trim()); setShowNewInput(false); } }} />
          <button onClick={() => { if (newName.trim()) { onSaveAsNew(newName.trim()); setShowNewInput(false); } }}
            style={{ fontSize: 12, color: C.white, background: C.accent, border: "none", borderRadius: 6, padding: "5px 9px", cursor: "pointer", fontFamily: UI_FONT }}>Save</button>
          <button onClick={() => setShowNewInput(false)}
            style={{ fontSize: 12, color: C.gray600, background: "none", border: `1px solid ${C.gray200}`, borderRadius: 6, padding: "5px 9px", cursor: "pointer", fontFamily: UI_FONT }}>Cancel</button>
        </span>
      )}

      {current && (
        <button onClick={() => { if (window.confirm(`Delete "${current.name}"?`)) onDelete(current.id); }}
          style={{ fontSize: 12, color: C.red, background: "none", border: "none", cursor: "pointer", fontFamily: UI_FONT }}>
          Delete
        </button>
      )}
    </div>
  );
};

function profileToResumeData(profile) {
  if (!profile || !profile.name) return DEFAULT;
  return {
    name: profile.name || DEFAULT.name,
    contact: [profile.email, profile.phone, profile.linkedin, profile.location].filter(Boolean).join(" | ") || DEFAULT.contact,
    summary: profile.summary || DEFAULT.summary,
    education: profile.education?.filter(e => e.school).map(e => ({ school: e.school, degree: [e.degree, e.field].filter(Boolean).join(" · "), location: e.location, dates: [e.startDate, e.endDate || (e.current ? "Present" : "")].filter(Boolean).join(" – ") })) || DEFAULT.education,
    experience: profile.experience?.filter(e => e.company).map(e => ({ company: e.company, title: e.title, location: e.location, dates: [e.startDate, e.current ? "Present" : e.endDate].filter(Boolean).join(" – "), bullets: e.bullets?.filter(b => b.trim()) || [""] })) || DEFAULT.experience,
    skills: profile.skills?.join(" · ") || DEFAULT.skills,
  };
}

// ── Main export ──────────────────────────────────────────────────
// versions / onSaveVersion / onDeleteVersion are optional — editor still works
// stand-alone (e.g. unauthenticated preview) if they're not passed.
export default function ResumeEditor({ profile, quickApplyCV, resumeVersions = [], onSaveVersion, onDeleteVersion }) {
  const initialVersion = quickApplyCV ? null : (resumeVersions[0] || null);

  const [data, setData] = useState(() => {
    if (initialVersion) return initialVersion.data;
    if (quickApplyCV) {
      const lines = quickApplyCV.split("\n");
      const nameL = lines[0]?.trim() || profile?.name || "Your Name";
      const contactL = lines[1]?.trim() || [profile?.email, profile?.phone, profile?.location].filter(Boolean).join(" | ");
      return { ...profileToResumeData(profile), name: nameL, contact: contactL };
    }
    return profileToResumeData(profile);
  });
  const [currentVersionId, setCurrentVersionId] = useState(initialVersion?.id || null);
  const [lastSavedData, setLastSavedData] = useState(initialVersion?.data || null);

  // Re-seed resume data when profile changes (e.g. user switches active profile,
  // or fills in profile for the first time), but only if user hasn't selected a
  // saved resume version — that takes precedence over the profile.
  useEffect(() => {
    if (!profile?.name) return;
    if (currentVersionId) return; // saved version selected — don't overwrite
    setData(profileToResumeData(profile));
  }, [profile?.name, profile?.summary, profile?.skills?.length]);
  const [template, setTemplate] = useState("classic");
  const [font, setFont] = useState("georgia");
  const [sectionOrder, setSectionOrder] = useState(DEFAULT_SECTION_ORDER);
  const [panelTab, setPanelTab] = useState("design"); // "design" or "ai"

  const hasUnsaved = currentVersionId && JSON.stringify(data) !== JSON.stringify(lastSavedData);

  const selectVersion = (id) => {
    if (!id) { setCurrentVersionId(null); setLastSavedData(null); return; }
    const v = resumeVersions.find(x => x.id === id);
    if (!v) return;
    setData(v.data);
    setCurrentVersionId(v.id);
    setLastSavedData(v.data);
  };

  const saveAsNew = async (name) => {
    if (!onSaveVersion) return;
    const saved = await onSaveVersion({ name, data, last_tailored_role: data.experience?.[0]?.title || null });
    if (saved) { setCurrentVersionId(saved.id); setLastSavedData(saved.data); }
  };

  const saveCurrent = async () => {
    if (!onSaveVersion || !currentVersionId) return;
    const existing = resumeVersions.find(v => v.id === currentVersionId);
    const saved = await onSaveVersion({ id: currentVersionId, name: existing?.name || "Default", data, last_tailored_role: data.experience?.[0]?.title || null });
    if (saved) setLastSavedData(saved.data);
  };

  const renameVersion = async (id, newName) => {
    if (!onSaveVersion) return;
    const existing = resumeVersions.find(v => v.id === id);
    if (!existing) return;
    await onSaveVersion({ id, name: newName, data: existing.data, last_tailored_role: existing.last_tailored_role });
  };

  const deleteVersion = async (id) => {
    if (!onDeleteVersion) return;
    await onDeleteVersion(id);
    if (currentVersionId === id) { setCurrentVersionId(null); setLastSavedData(null); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", fontFamily: UI_FONT, background: C.gray100 }}>
      {/* Slim toolbar — consistent with app header style, no duplicate JobMate logo */}
      <div style={{ background: C.white, borderBottom: `0.5px solid ${C.gray200}`, padding: "12px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div>
          <h1 style={{ fontFamily: DISPLAY, fontSize: 18, fontWeight: 700, color: C.navy, margin: "0 0 2px" }}>Resume editor</h1>
          <p style={{ fontSize: 12, color: C.gray400, margin: 0 }}>Click any text to edit directly • Choose a layout, font and section order on the right</p>
        </div>
        <button onClick={() => {
          const win = window.open("", "_blank");
          const el = document.getElementById("resume-preview-print");
          win.document.write(`<html><head><title>Resume</title><style>
            @page { margin: 0; size: A4; }
            @media print { .no-print { display: none !important; } [contenteditable] { background: transparent !important; border: none !important; } }
            html, body { margin: 0; padding: 0; height: auto !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; max-width: 210mm; overflow: hidden; }
            * { box-sizing: border-box; }
          </style></head><body style="margin:0;padding:0">${el.innerHTML}</body></html>`);
          win.document.close(); win.focus();
          setTimeout(() => { win.print(); win.close(); }, 400);
        }} style={{ padding: "8px 18px", borderRadius: 8, background: C.accent, color: C.white, border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: UI_FONT, display: "flex", alignItems: "center", gap: 6 }}>
          📥 Download PDF
        </button>
      </div>

      {/* Version selector */}
      {onSaveVersion && (
        <VersionBar
          versions={resumeVersions}
          currentVersionId={currentVersionId}
          onSelect={selectVersion}
          onSaveAsNew={saveAsNew}
          onSaveCurrent={saveCurrent}
          onRename={renameVersion}
          onDelete={deleteVersion}
          hasUnsaved={hasUnsaved}
        />
      )}

      {/* 3-column layout: preview | design/ai toggle panel */}
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 380px", overflow: "hidden" }}>
        {/* Left: Resume preview */}
        <div style={{ overflowY: "auto", padding: "28px 36px", background: C.gray100 }}>
          <div id="resume-preview-print">
            <ResumePreview data={data} setData={setData} template={template} font={font} sectionOrder={sectionOrder} />
          </div>
        </div>

        {/* Right: Design / AI Coach panel */}
        <div style={{ overflow: "hidden", display: "flex", flexDirection: "column", borderLeft: `1.5px solid ${C.gray200}`, background: C.white }}>
          {/* Panel toggle */}
          <div style={{ display: "flex", borderBottom: `1.5px solid ${C.gray200}`, flexShrink: 0 }}>
            <button onClick={() => setPanelTab("design")}
              style={{ flex: 1, padding: "12px 0", fontSize: 13, fontWeight: 700, cursor: "pointer", border: "none", background: panelTab === "design" ? C.purpleLight : C.white, color: panelTab === "design" ? C.purple : C.gray400, fontFamily: UI_FONT, borderBottom: `2px solid ${panelTab === "design" ? C.purple : "transparent"}` }}>
              🎨 Design
            </button>
            <button onClick={() => setPanelTab("ai")}
              style={{ flex: 1, padding: "12px 0", fontSize: 13, fontWeight: 700, cursor: "pointer", border: "none", background: panelTab === "ai" ? C.purpleLight : C.white, color: panelTab === "ai" ? C.purple : C.gray400, fontFamily: UI_FONT, borderBottom: `2px solid ${panelTab === "ai" ? C.purple : "transparent"}` }}>
              🤖 AI Coach
            </button>
          </div>

          <div style={{ flex: 1, overflow: "hidden" }}>
            {panelTab === "design"
              ? <DesignPanel template={template} setTemplate={setTemplate} font={font} setFont={setFont} sectionOrder={sectionOrder} setSectionOrder={setSectionOrder} />
              : <AICoach data={data} setData={setData} />}
          </div>
        </div>
      </div>
    </div>
  );
}
