import { useState, useRef, useEffect } from "react";
import { callClaude, SONNET, HAIKU } from "./matching";

const C = {
  navy: "#0F1F3D", accent: "#2563EB", accentLight: "#EFF6FF", accentBorder: "#BFDBFE",
  green: "#16A34A", greenLight: "#F0FDF4", greenBorder: "#BBF7D0",
  amber: "#D97706", amberLight: "#FFFBEB", amberBorder: "#FDE68A",
  red: "#DC2626", redLight: "#FEF2F2",
  purple: "#7C3AED", purpleLight: "#EDE9FE", purpleBorder: "#DDD6FE",
  gray50: "#F8FAFC", gray100: "#F1F5F9", gray200: "#E2E8F0",
  gray400: "#94A3B8", gray600: "#475569", gray800: "#1E293B", white: "#FFFFFF",
};
const FONT = "'Inter', system-ui, sans-serif";
const DISPLAY = "'Plus Jakarta Sans', 'Inter', sans-serif";

const Spinner = ({ color }) => <span style={{ display: "inline-block", width: 14, height: 14, border: `2px solid ${color ? color+"33" : "rgba(255,255,255,0.3)"}`, borderTopColor: color || "white", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />;

const SpeechRecognition = typeof window !== "undefined" ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;

const typeColors = {
  behavioural: { bg: C.purpleLight, color: C.purple, border: C.purpleBorder },
  technical: { bg: "#E0F2FE", color: "#0369A1", border: "#BAE6FD" },
  motivational: { bg: C.greenLight, color: C.green, border: C.greenBorder },
  situational: { bg: C.amberLight, color: C.amber, border: C.amberBorder },
};

const QUESTION_TIME = 120; // seconds per question in session mode

// ── Question generation view ──────────────────────────────────────
const QuestionGenerator = ({ profile, jd, setJd, onGenerated, loading, setLoading }) => {
  const profileSummary = profile?.name
    ? `Name: ${profile.name}\nBackground: ${profile.summary || ""}\nSkills: ${(profile.skills || []).join(", ")}\nExperience: ${(profile.experience || []).filter(e => e.company).map(e => `${e.title} at ${e.company}`).join(", ")}`
    : "Generic candidate";

  const generate = async () => {
    if (!jd.trim()) return;
    setLoading(true);
    try {
      const raw = await callClaude(
        `You are an expert interview coach for the German job market. Generate 8 likely interview questions for this role and candidate. Return ONLY valid JSON array, no markdown:
[{"question":"...","type":"behavioural|technical|motivational|situational","modelAnswer":"2-3 sentence strong answer using STAR method where relevant, tailored to the candidate"}]`,
        `CANDIDATE:\n${profileSummary}\n\nJOB DESCRIPTION:\n${jd}`,
        SONNET
      );
      const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
      onGenerated(parsed);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  return (
    <div style={{ background: C.white, borderRadius: 12, border: `0.5px solid ${C.gray200}`, padding: "20px 24px", marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <div style={{ width: 36, height: 36, background: C.purpleLight, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🎤</div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: C.navy, fontFamily: DISPLAY }}>Interview prep AI</div>
          <div style={{ fontSize: 12, color: C.gray400 }}>Paste a job description → get likely questions, then practice in a live mock session</div>
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
      {!loading && !jd.trim() && (
        <div style={{ marginTop: 8, fontSize: 12, color: C.gray400, textAlign: "center" }}>Paste a job description to generate questions.</div>
      )}
    </div>
  );
};

// ── Static questions browse view ──────────────────────────────────
const QuestionsList = ({ questions, onStartSession }) => (
  <div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
      <div style={{ fontSize: 15, fontWeight: 600, color: C.navy, fontFamily: DISPLAY }}>{questions.length} questions ready</div>
      <button onClick={() => onStartSession(questions.map((_, i) => i))}
        style={{ padding: "8px 18px", borderRadius: 8, background: C.purple, color: C.white, border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: FONT }}>
        🎯 Start mock interview session
      </button>
    </div>
    {questions.map((q, i) => {
      const tc = typeColors[q.type] || typeColors.behavioural;
      return (
        <div key={i} style={{ background: C.white, borderRadius: 12, border: `0.5px solid ${C.gray200}`, padding: "16px 20px", marginBottom: 10 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 10 }}>
            <div style={{ width: 24, height: 24, borderRadius: "50%", background: C.purpleLight, color: C.purple, fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{i + 1}</div>
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 99, background: tc.bg, color: tc.color, border: `0.5px solid ${tc.border}`, marginBottom: 6, display: "inline-block" }}>{q.type}</span>
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
);

// ── Timer ring ───────────────────────────────────────────────────
const TimerRing = ({ seconds, total }) => {
  const pct = Math.max(0, seconds / total);
  const color = pct > 0.5 ? C.green : pct > 0.2 ? C.amber : C.red;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return (
    <div style={{ width: 56, height: 56, borderRadius: "50%", background: `conic-gradient(${color} ${pct * 360}deg, ${C.gray100} 0deg)`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <div style={{ width: 46, height: 46, borderRadius: "50%", background: C.white, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color }}>
        {mins}:{secs.toString().padStart(2, "0")}
      </div>
    </div>
  );
};

// ── Mock interview session ──────────────────────────────────────
const MockSession = ({ questions, queue, onExit, onReplayWeak }) => {
  const [idx, setIdx] = useState(0);
  const [answer, setAnswer] = useState("");
  const [timeLeft, setTimeLeft] = useState(QUESTION_TIME);
  const [running, setRunning] = useState(true);
  const [feedback, setFeedback] = useState(null);
  const [loadingFeedback, setLoadingFeedback] = useState(false);
  const [results, setResults] = useState([]); // {qIndex, score, feedback}
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef(null);
  const timerRef = useRef(null);

  const qIndex = queue[idx];
  const q = questions[qIndex];
  const isLast = idx === queue.length - 1;

  useEffect(() => {
    if (!running || feedback) return;
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(timerRef.current); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [running, feedback, idx]);

  useEffect(() => {
    setAnswer(""); setTimeLeft(QUESTION_TIME); setFeedback(null); setRunning(true);
  }, [idx]);

  const toggleListening = () => {
    if (!SpeechRecognition) return;
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.onresult = (event) => {
      let transcript = "";
      for (let i = 0; i < event.results.length; i++) transcript += event.results[i][0].transcript + " ";
      setAnswer(transcript.trim());
    };
    recognition.onend = () => setListening(false);
    recognition.start();
    recognitionRef.current = recognition;
    setListening(true);
  };

  const submitAnswer = async () => {
    clearInterval(timerRef.current);
    setRunning(false);
    if (!answer.trim()) { setAnswer("(No answer given — time ran out or skipped)"); }
    setLoadingFeedback(true);
    try {
      const raw = await callClaude(
        `You are an interview coach. Evaluate the candidate's answer. Return ONLY valid JSON, no markdown:
{"score":7,"clarity":"1-2 sentence note on clarity","structure":"1-2 sentence note on STAR/structure use","improvedAnswer":"a tightened, stronger version of their answer in 2-3 sentences"}`,
        `QUESTION: ${q.question}\nCANDIDATE'S ANSWER: ${answer || "No answer given"}\nMODEL ANSWER FOR REFERENCE: ${q.modelAnswer}`,
        HAIKU
      );
      const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
      setFeedback(parsed);
      setResults(r => [...r.filter(x => x.qIndex !== qIndex), { qIndex, score: parsed.score, feedback: parsed }]);
    } catch (e) {
      setFeedback({ score: 0, clarity: "Couldn't generate feedback.", structure: "", improvedAnswer: "" });
    }
    setLoadingFeedback(false);
  };

  const next = () => {
    if (isLast) {
      onExit(results);
    } else {
      setIdx(i => i + 1);
    }
  };

  const avgScore = results.length > 0 ? (results.reduce((a, r) => a + r.score, 0) / results.length).toFixed(1) : null;

  return (
    <div style={{ maxWidth: 760, margin: "0 auto" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } } @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>

      {/* Session header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.navy, fontFamily: DISPLAY }}>Question {idx + 1} of {queue.length}</div>
          {avgScore && <div style={{ fontSize: 12, color: C.gray600 }}>Running average: <span style={{ fontWeight: 700, color: C.purple }}>{avgScore}/10</span></div>}
        </div>
        <button onClick={() => onExit(results)} style={{ padding: "6px 14px", borderRadius: 8, background: C.gray100, color: C.gray600, border: "none", fontSize: 12, cursor: "pointer", fontFamily: FONT }}>
          End session
        </button>
      </div>

      {/* Progress dots */}
      <div style={{ display: "flex", gap: 5, marginBottom: 18 }}>
        {queue.map((qi, i) => {
          const res = results.find(r => r.qIndex === qi);
          const color = i === idx ? C.purple : res ? (res.score >= 7 ? C.green : res.score >= 4 ? C.amber : C.red) : C.gray200;
          return <div key={i} style={{ flex: 1, height: 4, borderRadius: 99, background: color }} />;
        })}
      </div>

      <div style={{ background: C.white, borderRadius: 12, border: `0.5px solid ${C.gray200}`, padding: "22px 26px" }}>
        {!feedback ? (
          <>
            <div style={{ display: "flex", gap: 16, alignItems: "flex-start", marginBottom: 18 }}>
              <TimerRing seconds={timeLeft} total={QUESTION_TIME} />
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 99, background: (typeColors[q.type] || typeColors.behavioural).bg, color: (typeColors[q.type] || typeColors.behavioural).color, marginBottom: 8, display: "inline-block" }}>{q.type}</span>
                <div style={{ fontSize: 16, fontWeight: 500, color: C.gray800, lineHeight: 1.5 }}>{q.question}</div>
              </div>
            </div>

            <div style={{ position: "relative" }}>
              <textarea value={answer} onChange={e => setAnswer(e.target.value)} placeholder="Type your answer here — or use the mic to speak it..." rows={6}
                style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: `1.5px solid ${listening ? C.red : C.gray200}`, fontSize: 13.5, lineHeight: 1.65, color: C.gray800, resize: "vertical", outline: "none", fontFamily: FONT }} />
              {SpeechRecognition && (
                <button onClick={toggleListening}
                  style={{ position: "absolute", right: 10, bottom: 10, width: 34, height: 34, borderRadius: "50%", background: listening ? C.red : C.purpleLight, color: listening ? C.white : C.purple, border: "none", cursor: "pointer", fontSize: 15, animation: listening ? "pulse 1.2s infinite" : "none" }}
                  title={listening ? "Stop recording" : "Speak your answer"}>
                  🎙️
                </button>
              )}
            </div>
            {listening && <div style={{ fontSize: 11, color: C.red, marginTop: 6 }}>● Listening...</div>}

            <button onClick={submitAnswer} disabled={loadingFeedback}
              style={{ width: "100%", marginTop: 14, padding: 12, borderRadius: 10, background: C.purple, color: C.white, fontSize: 14, fontWeight: 600, border: "none", cursor: "pointer", fontFamily: DISPLAY, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: loadingFeedback ? 0.7 : 1 }}>
              {loadingFeedback ? <><Spinner /> Getting feedback...</> : "Submit answer →"}
            </button>
          </>
        ) : (
          <>
            <div style={{ fontSize: 14, fontWeight: 500, color: C.gray600, marginBottom: 14, lineHeight: 1.5 }}>"{q.question}"</div>

            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
              <div style={{ width: 60, height: 60, borderRadius: "50%", background: feedback.score >= 7 ? C.greenLight : feedback.score >= 4 ? C.amberLight : C.redLight, border: `2px solid ${feedback.score >= 7 ? C.green : feedback.score >= 4 ? C.amber : C.red}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 800, color: feedback.score >= 7 ? C.green : feedback.score >= 4 ? C.amber : C.red, fontFamily: DISPLAY }}>
                {feedback.score}
              </div>
              <div style={{ fontSize: 13, color: C.gray600 }}>out of 10</div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
              <div style={{ background: C.accentLight, borderRadius: 8, padding: "10px 14px", border: `0.5px solid ${C.accentBorder}` }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: C.accent, marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.05em" }}>Clarity</div>
                <div style={{ fontSize: 13, color: C.gray800, lineHeight: 1.6 }}>{feedback.clarity}</div>
              </div>
              <div style={{ background: C.purpleLight, borderRadius: 8, padding: "10px 14px", border: `0.5px solid ${C.purpleBorder}` }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: C.purple, marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.05em" }}>Structure (STAR)</div>
                <div style={{ fontSize: 13, color: C.gray800, lineHeight: 1.6 }}>{feedback.structure}</div>
              </div>
              <div style={{ background: C.greenLight, borderRadius: 8, padding: "10px 14px", border: `0.5px solid ${C.greenBorder}` }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: C.green, marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.05em" }}>Suggested improved answer</div>
                <div style={{ fontSize: 13, color: C.gray800, lineHeight: 1.65 }}>{feedback.improvedAnswer}</div>
              </div>
            </div>

            <button onClick={next}
              style={{ width: "100%", padding: 12, borderRadius: 10, background: C.purple, color: C.white, fontSize: 14, fontWeight: 600, border: "none", cursor: "pointer", fontFamily: DISPLAY }}>
              {isLast ? "Finish session →" : "Next question →"}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

// ── Session summary ──────────────────────────────────────────────
const SessionSummary = ({ questions, results, onReplayWeak, onBackToQuestions }) => {
  const avg = results.length > 0 ? (results.reduce((a, r) => a + r.score, 0) / results.length).toFixed(1) : 0;
  const weak = results.filter(r => r.score < 6).map(r => r.qIndex);

  return (
    <div style={{ maxWidth: 760, margin: "0 auto" }}>
      <div style={{ background: C.white, borderRadius: 12, border: `0.5px solid ${C.gray200}`, padding: "24px 28px", textAlign: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: C.gray600, marginBottom: 6 }}>Session complete</div>
        <div style={{ fontSize: 40, fontWeight: 800, color: avg >= 7 ? C.green : avg >= 4 ? C.amber : C.red, fontFamily: DISPLAY }}>{avg}/10</div>
        <div style={{ fontSize: 13, color: C.gray400, marginTop: 4 }}>average score across {results.length} questions</div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
        {results.map(r => (
          <div key={r.qIndex} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: C.white, borderRadius: 10, border: `0.5px solid ${C.gray200}`, padding: "10px 16px" }}>
            <div style={{ fontSize: 13, color: C.gray800, flex: 1, marginRight: 14 }}>{questions[r.qIndex].question}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: r.score >= 7 ? C.green : r.score >= 4 ? C.amber : C.red, flexShrink: 0 }}>{r.score}/10</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        {weak.length > 0 && (
          <button onClick={() => onReplayWeak(weak)}
            style={{ flex: 1, padding: 12, borderRadius: 10, background: C.amber, color: C.white, fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer", fontFamily: FONT }}>
            🔄 Replay {weak.length} weak question{weak.length > 1 ? "s" : ""}
          </button>
        )}
        <button onClick={onBackToQuestions}
          style={{ flex: 1, padding: 12, borderRadius: 10, background: C.gray100, color: C.gray600, fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer", fontFamily: FONT }}>
          ← Back to all questions
        </button>
      </div>
    </div>
  );
};

// ── Main export ──────────────────────────────────────────────────
export default function InterviewPrep({ profile }) {
  const [jd, setJd] = useState("");
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState("setup"); // setup | list | session | summary
  const [sessionQueue, setSessionQueue] = useState([]);
  const [sessionResults, setSessionResults] = useState([]);

  const handleGenerated = (parsed) => { setQuestions(parsed); setMode("list"); };
  const startSession = (queue) => { setSessionQueue(queue); setMode("session"); };
  const endSession = (results) => { setSessionResults(results); setMode("summary"); };
  const replayWeak = (queue) => { setSessionQueue(queue); setMode("session"); };

  if (!SpeechRecognition && typeof window !== "undefined" && mode === "session") {
    // graceful — mic button simply won't render, handled inline already
  }

  return (
    <div>
      {mode === "setup" && (
        <QuestionGenerator profile={profile} jd={jd} setJd={setJd} onGenerated={handleGenerated} loading={loading} setLoading={setLoading} />
      )}

      {mode === "list" && (
        <div style={{ maxWidth: 860, margin: "0 auto" }}>
          <button onClick={() => setMode("setup")} style={{ fontSize: 12, color: C.gray600, background: "none", border: "none", cursor: "pointer", fontFamily: FONT, marginBottom: 14, display: "flex", alignItems: "center", gap: 4 }}>
            ← New job description
          </button>
          <QuestionsList questions={questions} onStartSession={startSession} />
        </div>
      )}

      {mode === "session" && (
        <MockSession questions={questions} queue={sessionQueue} onExit={endSession} />
      )}

      {mode === "summary" && (
        <SessionSummary questions={questions} results={sessionResults} onReplayWeak={replayWeak} onBackToQuestions={() => setMode("list")} />
      )}
    </div>
  );
}
