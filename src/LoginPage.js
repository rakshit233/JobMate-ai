import { signInWithGoogle } from './supabase';

const C = {
  navy: "#0F1F3D",
  accent: "#2563EB",
  accentLight: "#EFF6FF",
  gray200: "#E2E8F0",
  gray400: "#94A3B8",
  gray600: "#475569",
  gray800: "#1E293B",
  white: "#FFFFFF",
};

const FONT = "'Inter', system-ui, sans-serif";
const DISPLAY = "'Plus Jakarta Sans', 'Inter', sans-serif";

export default function LoginPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#F8FAFC", display: "flex", flexDirection: "column", fontFamily: FONT }}>
      {/* Header */}
      <div style={{ background: C.navy, padding: "0 32px", height: 60, display: "flex", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, background: C.accent, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>🎯</div>
          <span style={{ fontFamily: DISPLAY, fontSize: 18, fontWeight: 800, color: C.white }}>JobMate</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: C.accent, background: "rgba(37,99,235,0.25)", padding: "2px 8px", borderRadius: 99 }}>AI</span>
        </div>
      </div>

      {/* Main */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 20px" }}>
        <div style={{ width: "100%", maxWidth: 420, textAlign: "center" }}>
          {/* Logo mark */}
          <div style={{ width: 64, height: 64, background: C.accentLight, borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, margin: "0 auto 24px" }}>🎯</div>

          <h1 style={{ fontFamily: DISPLAY, fontSize: 26, fontWeight: 800, color: C.navy, marginBottom: 10, letterSpacing: "-0.02em" }}>
            Welcome to JobMate AI
          </h1>
          <p style={{ fontSize: 15, color: C.gray600, lineHeight: 1.6, marginBottom: 32 }}>
            Your AI-powered job search assistant for landing jobs in Germany. Tailor CVs, write cover letters, and track applications — all in one place.
          </p>

          {/* Google Sign In */}
          <button
            onClick={signInWithGoogle}
            style={{
              width: "100%", padding: "13px 20px", borderRadius: 10,
              background: C.white, border: `1.5px solid ${C.gray200}`,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 12,
              fontSize: 15, fontWeight: 600, color: C.gray800, cursor: "pointer",
              fontFamily: FONT, boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
              transition: "all 0.15s",
            }}
            onMouseOver={e => e.currentTarget.style.borderColor = C.accent}
            onMouseOut={e => e.currentTarget.style.borderColor = C.gray200}
          >
            {/* Google SVG icon */}
            <svg width="20" height="20" viewBox="0 0 48 48">
              <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
              <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
              <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
              <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
            </svg>
            Continue with Google
          </button>

          <p style={{ fontSize: 12, color: C.gray400, marginTop: 20, lineHeight: 1.6 }}>
            By signing in, you agree to our Terms of Service.<br />
            Your data is private and never shared.
          </p>

          {/* Features preview */}
          <div style={{ marginTop: 40, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, textAlign: "left" }}>
            {[
              { icon: "📄", title: "CV Tailor", desc: "Tailor your CV to any job in seconds" },
              { icon: "✉️", title: "Cover Letter", desc: "Germany-ready cover letters instantly" },
              { icon: "✏️", title: "Resume Editor", desc: "Live editor with AI coach" },
              { icon: "📊", title: "Job Tracker", desc: "Track all your applications" },
            ].map(f => (
              <div key={f.title} style={{ background: C.white, border: `1.5px solid ${C.gray200}`, borderRadius: 10, padding: "12px 14px" }}>
                <div style={{ fontSize: 20, marginBottom: 4 }}>{f.icon}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.navy, marginBottom: 2 }}>{f.title}</div>
                <div style={{ fontSize: 12, color: C.gray600, lineHeight: 1.4 }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
