import { useState, useEffect } from "react";

// ── Product tour ──────────────────────────────────────────────────
// A lightweight 6-step walkthrough shown once to new users (tracked in
// localStorage). Each step switches the app to the tab it describes, so
// the real page is visible behind the dimmed overlay — no screenshots,
// no external tour library.

const C = {
  navy: "#0F1F3D", accent: "#2563EB", accentLight: "#EFF6FF", cyan: "#38BDF8",
  gray200: "#E2E8F0", gray400: "#94A3B8", gray600: "#475569", white: "#FFFFFF",
};
const FONT = "'Inter', system-ui, sans-serif";
const DISPLAY = "'Plus Jakarta Sans', 'Inter', sans-serif";

const STEPS = [
  {
    tab: "profile",
    emoji: "👋",
    title: "Welcome to JobMate!",
    text: "Your AI copilot for landing a job in Germany — in English. This quick tour shows you around in under a minute. First stop: upload your resume once, and every tool pre-fills automatically.",
  },
  {
    tab: "apply",
    emoji: "⚡",
    title: "Quick apply — your one-click packager",
    text: "Paste any job URL or description and get a tailored CV, a cover letter, and a match score in one go. This is the fastest way from posting to application.",
  },
  {
    tab: "findjobs",
    emoji: "🔍",
    title: "Find English-friendly jobs",
    text: "Search live listings across Germany, filtered for English-speaking roles and scored against your profile — so you apply where you actually fit.",
  },
  {
    tab: "resume",
    emoji: "✏️",
    title: "Resume editor with an AI coach",
    text: "Click any text to edit it directly, switch layouts and fonts, and let the AI coach rewrite weak lines. Save up to 4 versions for different kinds of roles.",
  },
  {
    tab: "tracker",
    emoji: "📊",
    title: "Track every application",
    text: "Keep every application, its status, notes, and which CV version you sent — all in one place, from Saved to Offer.",
  },
  {
    tab: "interview",
    emoji: "🎤",
    title: "Prepare to win the offer",
    text: "Interview prep generates likely questions with model answers, Salary coach gives real German salary ranges and negotiation scripts, and the LinkedIn optimizer makes recruiters find you. Good luck! 🍀",
  },
];

export const TOUR_KEY = "jobmate_tour_done";

export default function TourGuide({ onNavigate, onClose }) {
  const [step, setStep] = useState(0);
  const s = STEPS[step];
  const last = step === STEPS.length - 1;

  // Show the real tab behind the overlay for each step
  useEffect(() => { onNavigate?.(s.tab); }, [step]);

  const finish = () => {
    try { localStorage.setItem(TOUR_KEY, "1"); } catch {}
    onClose();
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,31,61,0.55)", backdropFilter: "blur(2px)", zIndex: 400, display: "flex", alignItems: "flex-end", justifyContent: "center", padding: 20 }}>
      <div className="ja-page" style={{ background: C.white, borderRadius: 16, width: "100%", maxWidth: 440, padding: "24px 26px 20px", marginBottom: "8dvh", boxShadow: "0 24px 70px rgba(15,31,61,0.4)", fontFamily: FONT }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <div style={{ fontSize: 30, lineHeight: 1 }}>{s.emoji}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: DISPLAY, fontSize: 17, fontWeight: 700, color: C.navy, marginBottom: 6 }}>{s.title}</div>
            <div style={{ fontSize: 13, color: C.gray600, lineHeight: 1.6 }}>{s.text}</div>
          </div>
        </div>

        {/* Progress dots */}
        <div style={{ display: "flex", gap: 6, justifyContent: "center", margin: "18px 0 16px" }}>
          {STEPS.map((_, i) => (
            <span key={i} onClick={() => setStep(i)} style={{ width: i === step ? 22 : 8, height: 8, borderRadius: 99, cursor: "pointer", background: i === step ? `linear-gradient(90deg, ${C.accent}, ${C.cyan})` : C.gray200, transition: "all 0.25s ease" }} />
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={finish} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12.5, color: C.gray400, fontFamily: FONT, padding: "8px 4px" }}>
            Skip tour
          </button>
          <span style={{ flex: 1 }} />
          {step > 0 && (
            <button onClick={() => setStep(step - 1)}
              style={{ padding: "9px 16px", borderRadius: 9, border: `1px solid ${C.gray200}`, background: C.white, fontSize: 13, fontWeight: 600, color: C.gray600, cursor: "pointer", fontFamily: FONT }}>
              ← Back
            </button>
          )}
          <button onClick={() => (last ? finish() : setStep(step + 1))} className="ja-cta"
            style={{ padding: "9px 20px", borderRadius: 9, border: "none", background: C.accent, color: C.white, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: DISPLAY }}>
            {last ? "Get started 🚀" : `Next (${step + 1}/${STEPS.length})`}
          </button>
        </div>
      </div>
    </div>
  );
}
