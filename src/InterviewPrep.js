import { useState } from "react";

const C = {
  navy: "#0F1F3D", accent: "#2563EB", accentLight: "#EFF6FF", accentBorder: "#BFDBFE",
  green: "#16A34A", greenLight: "#F0FDF4", greenBorder: "#BBF7D0",
  purple: "#7C3AED", purpleLight: "#EDE9FE", purpleBorder: "#DDD6FE",
  gray50: "#F8FAFC", gray100: "#F1F5F9", gray200: "#E2E8F0",
  gray400: "#94A3B8", gray600: "#475569", gray800: "#1E293B", white: "#FFFFFF",
};
const FONT = "'Inter', system-ui, sans-serif";
const DISPLAY = "'Plus Jakarta Sans', 'Inter', sans-serif";

const callClaude = async (system, user) => {
  const res = await fetch("/api/claude", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 1000, system, messages: [{ role: "user", content: user }] }),
  });
  const data = await res.json();
  return data.content?.[0]?.text || "";
};

const Spinner = () => <span style={{ display: "inline-block", width: 14, height: 14, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "white", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />;

export default function InterviewPrep({ profile }) {
  const [jd, setJd] = useState("");
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeQ, setActiveQ] = useState(null);
  const [userAnswer, setUserAnswer] = useState("");
  const [feedback, setFeedback] = useState("");
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [mode, setMode] = useState("questions"); // questions | practice

  const profileSummary = profile?.name
    ? `Name: ${profile.name}\nBackground: ${profile.summary || ""}\nSkills: ${(profile.skills || []).join(", ")}\nExperience: ${(profile.experience || []).filter(e => e.company).map(e => `${e.title} at ${e.company}`).join(", ")}`
    : "Generic candidate";

  const generate = async () => {
    if (!jd.trim()) return;
    setLoading(true); setQuestions([]); setActiveQ(null);
    try {
      const raw = await callClaude(
        `You are an expert interview coach for the German job market. Generate 8 likely interview questions for this role and candidate. Return ONLY valid JSON array, no markdown:
[{"question":"...","type":"behavioural|technical|motivational|situational","modelAnswer":"2-3 sentence strong answer using STAR method where relevant, tailored to the candidate"}]`,
        `CANDIDATE:\n${profileSummary}\n\nJOB DESCRIPTION:\n${jd}`
      );
      const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
      setQuestions(parsed);
      setMode("questions");
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const getFeedback = async () => {
    if (!userAnswer.trim() || !activeQ) return;
    setFeedbackLoading(true); setFeedback("");
    try {
      const fb = await callClaude(
        "You are an interview coach. Give concise, constructive feedback on the candidate's answer. Score it 1-10, mention 2 strengths and 1 improvement. Be encouraging but honest. Max 150 words.",
        `QUESTION: ${activeQ.question}\nCANDIDATE'S ANSWER: ${userAnswer}\nMODEL ANSWER: ${activeQ.modelAnswer}`
      );
      setFeedback(fb);
    } catch (e) { console.error(e); }
    setFeedbackLoading(false);
  };

  const typeColors = {
    behavioural: { bg: C.purpleLight, color: C.purple, border: C.purpleBorder },
    technical: { bg: "#E0F2FE", color: "#0369A1", border: "#BAE6FD" },
    motivational: { bg: C.greenLight, color: C.green, border: C.greenBorder },
    situational: { bg: "#FFFBEB", color: "#D97706", border: "#FDE68A" },
  };

  return (
    <div style={{ maxWidth: 860, margin: "0 auto" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Input */}
      <div style={{ background: C.white, borderRadius: 12, border: `0.5px solid ${C.gray200}`, padding: "20px 24px", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <div style={{ width: 36, height: 36, background: C.purpleLight, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🎤</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: C.navy, fontFamily: DISPLAY }}>Interview prep AI</div>
            <div style={{ fontSize: 12, color: C.gray400 }}>Paste a job description → get likely questions with model answers, then practice with AI feedback</div>
          </div>
        </div>
        {profile?.name && (
          <div style={{ background: C.greenLight, border: `0.5px solid ${C.greenBorder}`, borderRadius: 8, padding: "8px 12px", marginBottom: 12, fontSize: 13, color: C.green }}>
            ✅ Using {profile.name}'s profile for tailored questions
          </div>
        )}
        <textarea value={jd} onChange={e => setJd(e.target.value)} placeholder="Paste the job description you're preparing for..." rows={5}
          style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `0.5px solid ${C.gray200}`, fontSize: 13, lineHeight: 1.6, color: C.gray800, background: C.white, resize: "vertical", outline: "none", fontFamily: FONT }}
          onFocus={e => e.target.style.borderColor = C.accent} onBlur={e => e.target.style.borderColor = C.gray200} />
        <button onClick={generate} disabled={loading || !jd.trim()}
          style={{ width: "100%", marginTop: 10, padding: 12, borderRadius: 10, background: C.purple, color: C.white, fontSize: 14, fontWeight: 600, border: "none", cursor: "pointer", fontFamily: DISPLAY, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: loading ? 0.7 : 1 }}>
          {loading ? <><Spinner /> Generating questions...</> : "🎤 Generate interview questions"}
        </button>
      </div>

      {/* Questions */}
      {questions.length > 0 && mode === "questions" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: C.navy, fontFamily: DISPLAY }}>{questions.length} questions ready</div>
            <button onClick={() => setMode("practice")}
              style={{ padding: "7px 16px", borderRadius: 8, background: C.purple, color: C.white, border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: FONT }}>
              🎯 Start practice mode
            </button>
          </div>
          {questions.map((q, i) => {
            const tc = typeColors[q.type] || typeColors.behavioural;
            return (
              <div key={i} style={{ background: C.white, borderRadius: 12, border: `0.5px solid ${C.gray200}`, padding: "16px 20px", marginBottom: 10 }}>
                <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 10 }}>
                  <div style={{ width: 24, height: 24, borderRadius: "50%", background: C.purpleLight, color: C.purple, fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{i + 1}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 99, background: tc.bg, color: tc.color, border: `0.5px solid ${tc.border}` }}>{q.type}</span>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 500, color: C.gray800, lineHeight: 1.5 }}>{q.question}</div>
                  </div>
                </div>
                <div style={{ background: C.greenLight, borderRadius: 8, padding: "10px 14px", border: `0.5px solid ${C.greenBorder}` }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: C.green, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>Model answer</div>
                  <div style={{ fontSize: 13, color: C.gray800, lineHeight: 1.65 }}>{q.modelAnswer}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Practice mode */}
      {questions.length > 0 && mode === "practice" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: C.navy, fontFamily: DISPLAY }}>Practice mode</div>
            <button onClick={() => { setMode("questions"); setActiveQ(null); setFeedback(""); setUserAnswer(""); }}
              style={{ padding: "7px 14px", borderRadius: 8, background: C.gray100, color: C.gray600, border: "none", fontSize: 13, cursor: "pointer", fontFamily: FONT }}>
              ← Back to questions
            </button>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
            {questions.map((q, i) => (
              <button key={i} onClick={() => { setActiveQ(q); setUserAnswer(""); setFeedback(""); }}
                style={{ padding: "6px 14px", borderRadius: 8, fontSize: 13, cursor: "pointer", fontFamily: FONT, border: `0.5px solid ${activeQ === q ? C.purple : C.gray200}`, background: activeQ === q ? C.purpleLight : C.gray50, color: activeQ === q ? C.purple : C.gray600, fontWeight: activeQ === q ? 600 : 400 }}>
                Q{i + 1}
              </button>
            ))}
          </div>
          {activeQ && (
            <div style={{ background: C.white, borderRadius: 12, border: `0.5px solid ${C.gray200}`, padding: "20px 24px" }}>
              <div style={{ fontSize: 15, fontWeight: 500, color: C.gray800, marginBottom: 16, lineHeight: 1.5 }}>"{activeQ.question}"</div>
              <textarea value={userAnswer} onChange={e => setUserAnswer(e.target.value)} placeholder="Type your answer here... take your time, just like a real interview." rows={5}
                style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `0.5px solid ${C.gray200}`, fontSize: 13, lineHeight: 1.6, color: C.gray800, resize: "vertical", outline: "none", fontFamily: FONT, marginBottom: 10 }}
                onFocus={e => e.target.style.borderColor = C.purple} onBlur={e => e.target.style.borderColor = C.gray200} />
              <button onClick={getFeedback} disabled={feedbackLoading || !userAnswer.trim()}
                style={{ padding: "10px 20px", borderRadius: 8, background: C.purple, color: C.white, border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: FONT, display: "flex", alignItems: "center", gap: 6 }}>
                {feedbackLoading ? <><Spinner /> Getting feedback...</> : "Get AI feedback"}
              </button>
              {feedback && (
                <div style={{ marginTop: 14, background: C.purpleLight, borderRadius: 10, padding: "14px 16px", border: `0.5px solid ${C.purpleBorder}` }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: C.purple, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>AI coach feedback</div>
                  <div style={{ fontSize: 13, lineHeight: 1.7, color: C.gray800, whiteSpace: "pre-wrap" }}>{feedback}</div>
                  <div style={{ marginTop: 12, background: C.greenLight, borderRadius: 8, padding: "10px 12px", border: `0.5px solid ${C.greenBorder}` }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: C.green, marginBottom: 4 }}>Model answer</div>
                    <div style={{ fontSize: 13, color: C.gray800, lineHeight: 1.65 }}>{activeQ.modelAnswer}</div>
                  </div>
                </div>
              )}
            </div>
          )}
          {!activeQ && (
            <div style={{ background: C.gray50, borderRadius: 12, border: `0.5px solid ${C.gray200}`, padding: "40px 20px", textAlign: "center", color: C.gray400, fontSize: 14 }}>
              Select a question above to start practising
            </div>
          )}
        </div>
      )}
    </div>
  );
}
