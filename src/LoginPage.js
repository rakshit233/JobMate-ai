import { useEffect, useRef, useState } from "react";
import { signInWithGoogle, signInWithMagicLink } from "./supabase";
import { track } from "@vercel/analytics";

// ── Design tokens ─────────────────────────────────────────────────
const T = {
  bg: "#060D1F",          // deep space navy
  panel: "#0B1730",       // raised panel
  panelBorder: "rgba(56,189,248,0.14)",
  blue: "#2563EB",        // brand electric blue
  cyan: "#38BDF8",        // glow cyan
  text: "#F1F5F9",
  muted: "rgba(226,232,240,0.62)",
  faint: "rgba(226,232,240,0.35)",
};
const DISPLAY = "'Space Grotesk', 'Plus Jakarta Sans', sans-serif";
const BODY = "'Inter', system-ui, sans-serif";

// ── Small building blocks ────────────────────────────────────────
const GoogleButton = ({ large }) => (
  <button onClick={() => { track("signup_click", { location: large ? "hero" : "nav" }); signInWithGoogle(); }} className="jm-cta"
    style={{
      display: "inline-flex", alignItems: "center", gap: 10,
      padding: large ? "15px 30px" : "10px 20px",
      borderRadius: 12, border: "none", cursor: "pointer",
      background: `linear-gradient(135deg, ${T.blue}, ${T.cyan})`,
      color: "#fff", fontSize: large ? 16 : 13.5, fontWeight: 600, fontFamily: BODY,
      boxShadow: "0 0 32px rgba(37,99,235,0.45)",
    }}>
    <svg width={large ? 18 : 15} height={large ? 18 : 15} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#fff" d="M21.35 11.1H12v2.9h5.35c-.5 2.5-2.6 4.3-5.35 4.3a5.8 5.8 0 1 1 0-11.6c1.5 0 2.85.55 3.9 1.45l2.15-2.15A8.9 8.9 0 0 0 12 3.5a8.5 8.5 0 1 0 0 17c4.9 0 8.5-3.45 8.5-8.3 0-.37-.05-.74-.15-1.1z"/>
    </svg>
    {large ? "Start free with Google" : "Sign in"}
  </button>
);

// Passwordless email login — an alternative to Google for people who don't
// want to use a Google account. Shows inline success/error, no page reload.
const MagicLinkForm = ({ compact }) => {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("idle"); // idle | sending | sent | error
  const [msg, setMsg] = useState("");

  const submit = async () => {
    const clean = email.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean)) {
      setStatus("error"); setMsg("Please enter a valid email address."); return;
    }
    setStatus("sending"); setMsg("");
    track("signup_click", { location: "magic_link" });
    const { error } = await signInWithMagicLink(clean);
    if (error) {
      setStatus("error");
      setMsg(error.message || "Couldn't send the link. Please try again.");
    } else {
      setStatus("sent");
      setMsg(`Check your inbox — we sent a sign-in link to ${clean}.`);
    }
  };

  if (status === "sent") {
    return (
      <div style={{ marginTop: 14, padding: "12px 16px", borderRadius: 12, background: "rgba(56,189,248,0.08)", border: `1px solid ${T.panelBorder}`, maxWidth: 420 }}>
        <div style={{ fontSize: 14, color: T.text, fontWeight: 600, marginBottom: 3 }}>✉️ Magic link sent</div>
        <div style={{ fontSize: 13, color: T.muted, lineHeight: 1.55 }}>{msg}</div>
        <button onClick={() => { setStatus("idle"); setEmail(""); }}
          style={{ marginTop: 8, background: "none", border: "none", color: T.cyan, fontSize: 12.5, cursor: "pointer", padding: 0, fontFamily: BODY }}>
          Use a different email
        </button>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 14, maxWidth: 420 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input
          type="email"
          value={email}
          onChange={e => { setEmail(e.target.value); if (status === "error") setStatus("idle"); }}
          onKeyDown={e => e.key === "Enter" && submit()}
          placeholder="you@email.com"
          style={{
            flex: "1 1 200px", minWidth: 0, padding: "12px 14px", borderRadius: 10,
            border: `1px solid ${status === "error" ? "rgba(248,113,113,0.6)" : T.panelBorder}`,
            background: "rgba(255,255,255,0.04)", color: T.text, fontSize: 14, fontFamily: BODY, outline: "none",
          }}
        />
        <button onClick={submit} disabled={status === "sending"}
          style={{
            padding: "12px 20px", borderRadius: 10, border: `1px solid ${T.panelBorder}`,
            background: "rgba(255,255,255,0.04)", color: T.text, fontSize: 14, fontWeight: 600,
            cursor: status === "sending" ? "default" : "pointer", fontFamily: BODY, whiteSpace: "nowrap",
            opacity: status === "sending" ? 0.6 : 1,
          }}>
          {status === "sending" ? "Sending…" : "Email me a link"}
        </button>
      </div>
      {status === "error" && <div style={{ marginTop: 7, fontSize: 12.5, color: "#F87171" }}>{msg}</div>}
      {!compact && status !== "error" && <div style={{ marginTop: 7, fontSize: 12, color: T.faint }}>No password needed — we'll email you a one-time sign-in link.</div>}
    </div>
  );
};

// Divider with "or" label, for separating Google from email login
const OrDivider = () => (
  <div style={{ display: "flex", alignItems: "center", gap: 12, maxWidth: 420, margin: "16px 0 2px" }}>
    <div style={{ flex: 1, height: 1, background: T.panelBorder }} />
    <span style={{ fontSize: 12, color: T.faint }}>or</span>
    <div style={{ flex: 1, height: 1, background: T.panelBorder }} />
  </div>
);

// Animated counter for the hero match-score ring
const useCountUp = (target, duration = 1600, delay = 600) => {
  const [val, setVal] = useState(0);
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) { setVal(target); return; }
    let raf; const start = performance.now() + delay;
    const tick = (now) => {
      if (now < start) { raf = requestAnimationFrame(tick); return; }
      const p = Math.min((now - start) / duration, 1);
      setVal(Math.round(target * (1 - Math.pow(1 - p, 3)))); // ease-out cubic
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, delay]);
  return val;
};

// Scroll-triggered reveal wrapper
const Reveal = ({ children, delay = 0 }) => {
  const ref = useRef();
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) { el.style.opacity = 1; el.style.transform = "none"; return; }
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        el.style.transitionDelay = `${delay}ms`;
        el.classList.add("jm-revealed");
        obs.disconnect();
      }
    }, { threshold: 0.15 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [delay]);
  return <div ref={ref} className="jm-reveal">{children}</div>;
};

// ── Hero product mock (the signature element) ─────────────────────
const HeroMock = () => {
  const score = useCountUp(87);
  return (
    <div style={{ position: "relative", width: "100%", maxWidth: 460, margin: "0 auto" }}>
      {/* Glassy job card */}
      <div className="jm-load jm-load-4" style={{
        background: "rgba(11,23,48,0.72)", backdropFilter: "blur(14px)",
        border: `1px solid ${T.panelBorder}`, borderRadius: 20, padding: "26px 28px",
        boxShadow: "0 24px 80px rgba(2,8,23,0.7)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
          <div>
            <div style={{ fontSize: 11, color: T.faint, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8, fontFamily: BODY }}>Job posting detected</div>
            <div style={{ fontFamily: DISPLAY, fontSize: 19, fontWeight: 600, color: T.text, marginBottom: 4 }}>Product Manager</div>
            <div style={{ fontSize: 13, color: T.muted }}>Zalando · Berlin · Hybrid</div>
            <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
              <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 99, background: "rgba(56,189,248,0.12)", color: T.cyan, border: "1px solid rgba(56,189,248,0.25)" }}>🇬🇧 English OK</span>
              <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 99, background: "rgba(37,99,235,0.14)", color: "#93C5FD", border: "1px solid rgba(37,99,235,0.3)" }}>€65–80K</span>
            </div>
          </div>
          {/* Match ring */}
          <div style={{ position: "relative", width: 92, height: 92, flexShrink: 0 }}>
            <div className="jm-ring-glow" style={{
              width: "100%", height: "100%", borderRadius: "50%",
              background: `conic-gradient(${T.cyan} ${score * 3.6}deg, rgba(148,163,184,0.12) 0deg)`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <div style={{ width: 72, height: 72, borderRadius: "50%", background: T.panel, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontFamily: DISPLAY, fontSize: 24, fontWeight: 700, color: T.cyan, lineHeight: 1 }}>{score}</span>
                <span style={{ fontSize: 9, color: T.faint, marginTop: 2 }}>match</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating result cards */}
      <div className="jm-float-a" style={{
        position: "absolute", top: -26, left: -34,
        background: "rgba(11,23,48,0.9)", border: `1px solid ${T.panelBorder}`, borderRadius: 12,
        padding: "10px 16px", fontSize: 12.5, color: T.text, display: "flex", alignItems: "center", gap: 8,
        boxShadow: "0 12px 40px rgba(2,8,23,0.6)",
      }}>
        <span style={{ color: "#4ADE80" }}>✓</span> CV tailored in 12s
      </div>
      <div className="jm-float-b" style={{
        position: "absolute", bottom: -24, right: -28,
        background: "rgba(11,23,48,0.9)", border: `1px solid ${T.panelBorder}`, borderRadius: 12,
        padding: "10px 16px", fontSize: 12.5, color: T.text, display: "flex", alignItems: "center", gap: 8,
        boxShadow: "0 12px 40px rgba(2,8,23,0.6)",
      }}>
        <span style={{ color: "#4ADE80" }}>✓</span> Cover letter ready
      </div>
    </div>
  );
};

// ── Content data ──────────────────────────────────────────────────
const FEATURES = [
  { icon: "⚡", title: "Quick apply", body: "Paste any job URL. Get a tailored CV, cover letter and match score in one click." },
  { icon: "🔍", title: "Find jobs", body: "Live English-friendly listings across Germany, scored against your profile." },
  { icon: "✏️", title: "Resume editor", body: "Four layouts, live editing, and an AI coach that rewrites weak lines on the spot." },
  { icon: "🎤", title: "Interview prep", body: "A timed mock session with voice answers and structured feedback per question." },
  { icon: "💰", title: "Salary coach", body: "Real German salary ranges plus word-for-word negotiation scripts." },
  { icon: "💼", title: "LinkedIn optimizer", body: "Rewrites your headline and About section for German recruiters." },
  { icon: "📊", title: "Job tracker", body: "Every application, its status, and which CV version you sent — in one place." },
  { icon: "📄", title: "CV tailor", body: "Rewrites your CV against any job description to pass ATS screening." },
];

const STEPS = [
  { n: "01", title: "Upload your CV once", body: "AI reads it and builds your profile — up to four versions for different roles." },
  { n: "02", title: "Paste any job posting", body: "JobMate scores your fit, rewrites your CV and drafts the cover letter." },
  { n: "03", title: "Apply and track", body: "Download polished PDFs, then follow every application through to offer." },
];

// ── Page ──────────────────────────────────────────────────────────
export default function LoginPage() {
  return (
    <div style={{ background: T.bg, minHeight: "100vh", fontFamily: BODY, overflowX: "hidden", position: "relative" }}>
      <style>{`
        .jm-reveal { opacity: 0; transform: translateY(26px); transition: opacity 0.7s ease, transform 0.7s ease; }
        .jm-revealed { opacity: 1 !important; transform: none !important; }
        .jm-load { opacity: 0; animation: jmUp 0.8s ease forwards; }
        .jm-load-1 { animation-delay: 0.05s; } .jm-load-2 { animation-delay: 0.18s; }
        .jm-load-3 { animation-delay: 0.32s; } .jm-load-4 { animation-delay: 0.5s; }
        @keyframes jmUp { from { opacity: 0; transform: translateY(22px); } to { opacity: 1; transform: none; } }
        .jm-orb { position: absolute; border-radius: 50%; filter: blur(90px); pointer-events: none; }
        .jm-orb-1 { width: 480px; height: 480px; background: rgba(37,99,235,0.22); top: -140px; right: -120px; animation: jmDrift1 14s ease-in-out infinite alternate; }
        .jm-orb-2 { width: 380px; height: 380px; background: rgba(56,189,248,0.13); bottom: 8%; left: -140px; animation: jmDrift2 18s ease-in-out infinite alternate; }
        @keyframes jmDrift1 { to { transform: translate(-50px, 60px); } }
        @keyframes jmDrift2 { to { transform: translate(70px, -40px); } }
        .jm-float-a { animation: jmFloatA 5.5s ease-in-out infinite; }
        .jm-float-b { animation: jmFloatB 6.5s ease-in-out infinite; }
        @keyframes jmFloatA { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-9px); } }
        @keyframes jmFloatB { 0%,100% { transform: translateY(0); } 50% { transform: translateY(8px); } }
        .jm-ring-glow { box-shadow: 0 0 34px rgba(56,189,248,0.35); }
        .jm-cta { transition: transform 0.18s ease, box-shadow 0.18s ease; }
        .jm-cta:hover { transform: translateY(-2px); box-shadow: 0 0 48px rgba(56,189,248,0.55); }
        .jm-card { transition: transform 0.22s ease, border-color 0.22s ease, box-shadow 0.22s ease; }
        .jm-card:hover { transform: translateY(-5px); border-color: rgba(56,189,248,0.4); box-shadow: 0 18px 50px rgba(2,8,23,0.55); }
        .jm-grid-bg { position: absolute; inset: 0; pointer-events: none;
          background-image: linear-gradient(rgba(56,189,248,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(56,189,248,0.045) 1px, transparent 1px);
          background-size: 56px 56px;
          mask-image: radial-gradient(ellipse 90% 60% at 50% 0%, black 30%, transparent 75%); }
        @media (prefers-reduced-motion: reduce) {
          .jm-load, .jm-reveal { opacity: 1 !important; transform: none !important; animation: none !important; transition: none !important; }
          .jm-orb-1, .jm-orb-2, .jm-float-a, .jm-float-b { animation: none !important; }
        }
        @media (max-width: 900px) { .jm-hero-grid { grid-template-columns: 1fr !important; gap: 56px !important; } .jm-features { grid-template-columns: 1fr 1fr !important; } }
        @media (max-width: 560px) { .jm-features { grid-template-columns: 1fr !important; } .jm-steps { grid-template-columns: 1fr !important; } .jm-h1 { font-size: 38px !important; } }
      `}</style>

      {/* Ambient background */}
      <div className="jm-orb jm-orb-1" aria-hidden="true" />
      <div className="jm-orb jm-orb-2" aria-hidden="true" />
      <div className="jm-grid-bg" aria-hidden="true" />

      {/* Nav */}
      <nav style={{ position: "relative", zIndex: 5, maxWidth: 1140, margin: "0 auto", padding: "22px 28px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: `linear-gradient(135deg, ${T.blue}, ${T.cyan})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>🎯</div>
          <span style={{ fontFamily: DISPLAY, fontSize: 19, fontWeight: 700, color: T.text }}>JobMate</span>
          <span style={{ fontSize: 9, fontWeight: 700, color: T.cyan, background: "rgba(56,189,248,0.12)", border: "1px solid rgba(56,189,248,0.25)", padding: "2px 7px", borderRadius: 99, letterSpacing: "0.06em" }}>AI</span>
        </div>
        <GoogleButton />
      </nav>

      {/* Hero */}
      <header style={{ position: "relative", zIndex: 5, maxWidth: 1140, margin: "0 auto", padding: "72px 28px 110px" }}>
        <div className="jm-hero-grid" style={{ display: "grid", gridTemplateColumns: "1.05fr 0.95fr", gap: 48, alignItems: "center" }}>
          <div>
            <div className="jm-load jm-load-1" style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12.5, color: T.cyan, border: "1px solid rgba(56,189,248,0.28)", background: "rgba(56,189,248,0.07)", borderRadius: 99, padding: "6px 14px", marginBottom: 26, letterSpacing: "0.04em" }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: T.cyan, display: "inline-block" }} />
              For English speakers job-hunting in Germany
            </div>
            <h1 className="jm-load jm-load-2 jm-h1" style={{ fontFamily: DISPLAY, fontSize: 54, fontWeight: 700, lineHeight: 1.08, color: T.text, letterSpacing: "-0.02em", margin: "0 0 22px" }}>
              Land your job in Germany.<br />
              <span style={{ background: `linear-gradient(90deg, ${T.cyan}, ${T.blue})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>In English.</span>
            </h1>
            <p className="jm-load jm-load-3" style={{ fontSize: 17, lineHeight: 1.65, color: T.muted, maxWidth: 480, margin: "0 0 34px" }}>
              JobMate turns any job posting into a tailored CV, cover letter and interview prep — built for internationals navigating the German market, from ATS screening to salary talks.
            </p>
            <div className="jm-load jm-load-4" style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
              <GoogleButton large />
              <span style={{ fontSize: 13, color: T.faint }}>Free to start · No card needed</span>
            </div>
            <div className="jm-load jm-load-4">
              <OrDivider />
              <MagicLinkForm />
            </div>
          </div>
          <HeroMock />
        </div>
      </header>

      {/* Stats strip */}
      <Reveal>
        <div style={{ position: "relative", zIndex: 5, maxWidth: 1140, margin: "0 auto", padding: "0 28px 90px" }}>
          <div style={{ display: "flex", justifyContent: "center", gap: 0, borderTop: `1px solid ${T.panelBorder}`, borderBottom: `1px solid ${T.panelBorder}`, flexWrap: "wrap" }}>
            {[["8", "AI tools in one app"], ["🇩🇪", "Built for the German market"], ["🇬🇧", "English-friendly job search"], ["4", "Resume versions per profile"]].map(([big, label], i) => (
              <div key={i} style={{ padding: "26px 40px", textAlign: "center", flex: "1 1 200px" }}>
                <div style={{ fontFamily: DISPLAY, fontSize: 28, fontWeight: 700, color: T.text, marginBottom: 4 }}>{big}</div>
                <div style={{ fontSize: 12.5, color: T.faint }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </Reveal>

      {/* Features */}
      <section style={{ position: "relative", zIndex: 5, maxWidth: 1140, margin: "0 auto", padding: "0 28px 110px" }}>
        <Reveal>
          <div style={{ textAlign: "center", marginBottom: 54 }}>
            <div style={{ fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase", color: T.cyan, marginBottom: 14 }}>Everything in one place</div>
            <h2 style={{ fontFamily: DISPLAY, fontSize: 36, fontWeight: 700, color: T.text, letterSpacing: "-0.01em", margin: 0 }}>
              Your entire job hunt, powered by AI
            </h2>
          </div>
        </Reveal>
        <div className="jm-features" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={i * 60}>
              <div className="jm-card" style={{ background: T.panel, border: `1px solid ${T.panelBorder}`, borderRadius: 16, padding: "24px 22px", height: "100%" }}>
                <div style={{ fontSize: 24, marginBottom: 14 }}>{f.icon}</div>
                <div style={{ fontFamily: DISPLAY, fontSize: 16, fontWeight: 600, color: T.text, marginBottom: 8 }}>{f.title}</div>
                <div style={{ fontSize: 13, lineHeight: 1.6, color: T.muted }}>{f.body}</div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* How it works — a real sequence, so numbering carries meaning */}
      <section style={{ position: "relative", zIndex: 5, maxWidth: 1140, margin: "0 auto", padding: "0 28px 110px" }}>
        <Reveal>
          <h2 style={{ fontFamily: DISPLAY, fontSize: 36, fontWeight: 700, color: T.text, letterSpacing: "-0.01em", textAlign: "center", margin: "0 0 54px" }}>
            From posting to application in minutes
          </h2>
        </Reveal>
        <div className="jm-steps" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          {STEPS.map((s, i) => (
            <Reveal key={s.n} delay={i * 120}>
              <div style={{ borderLeft: `2px solid rgba(56,189,248,0.35)`, padding: "6px 0 6px 22px" }}>
                <div style={{ fontFamily: DISPLAY, fontSize: 13, color: T.cyan, letterSpacing: "0.1em", marginBottom: 10 }}>{s.n}</div>
                <div style={{ fontFamily: DISPLAY, fontSize: 18, fontWeight: 600, color: T.text, marginBottom: 8 }}>{s.title}</div>
                <div style={{ fontSize: 13.5, lineHeight: 1.65, color: T.muted }}>{s.body}</div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Germany focus */}
      <section style={{ position: "relative", zIndex: 5, maxWidth: 1140, margin: "0 auto", padding: "0 28px 110px" }}>
        <Reveal>
          <div style={{ background: `linear-gradient(135deg, rgba(37,99,235,0.14), rgba(56,189,248,0.06))`, border: `1px solid ${T.panelBorder}`, borderRadius: 24, padding: "54px 48px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40, alignItems: "center" }} className="jm-hero-grid">
            <div>
              <h2 style={{ fontFamily: DISPLAY, fontSize: 30, fontWeight: 700, color: T.text, letterSpacing: "-0.01em", margin: "0 0 16px" }}>
                Made for the German market — not adapted to it
              </h2>
              <p style={{ fontSize: 14.5, lineHeight: 1.7, color: T.muted, margin: 0 }}>
                German salary benchmarks, English-friendly job filtering, and interview questions the way German companies actually ask them. JobMate knows the difference between a CV and a Lebenslauf.
              </p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {["English-friendly filter on every job search", "Salary ranges from real German market data", "Negotiation scripts that work with German HR", "Interview prep tuned to German company culture"].map(item => (
                <div key={item} style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 14, color: T.text, lineHeight: 1.5 }}>
                  <span style={{ color: T.cyan, flexShrink: 0 }}>→</span> {item}
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </section>

      {/* Final CTA */}
      <section style={{ position: "relative", zIndex: 5, maxWidth: 700, margin: "0 auto", padding: "0 28px 130px", textAlign: "center" }}>
        <Reveal>
          <h2 style={{ fontFamily: DISPLAY, fontSize: 40, fontWeight: 700, color: T.text, letterSpacing: "-0.015em", margin: "0 0 18px" }}>
            Your next role is waiting
          </h2>
          <p style={{ fontSize: 15.5, color: T.muted, margin: "0 0 34px", lineHeight: 1.65 }}>
            Join JobMate free and send your first tailored application in the next ten minutes.
          </p>
          <GoogleButton large />
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <OrDivider />
            <MagicLinkForm compact />
          </div>
        </Reveal>
      </section>

      {/* Footer */}
      <footer style={{ position: "relative", zIndex: 5, borderTop: `1px solid ${T.panelBorder}` }}>
        <div style={{ maxWidth: 1140, margin: "0 auto", padding: "26px 28px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <span style={{ fontSize: 12.5, color: T.faint }}>© 2026 JobMate — app.jobmate.tech</span>
          <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
            <a href="/privacy" style={{ fontSize: 12.5, color: T.muted, textDecoration: "none" }}>Privacy Policy</a>
            <span style={{ fontSize: 12.5, color: T.faint }}>Built for English speakers in Germany 🇩🇪</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
