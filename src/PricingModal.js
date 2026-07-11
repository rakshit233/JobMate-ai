import { useState } from "react";
import { startCheckout } from "./supabase";

const C = {
  navy: "#0F1F3D", accent: "#2563EB", accentLight: "#EFF6FF", accentBorder: "#BFDBFE",
  cyan: "#38BDF8", green: "#16A34A", greenLight: "#F0FDF4",
  gray50: "#F8FAFC", gray100: "#F1F5F9", gray200: "#E2E8F0",
  gray400: "#94A3B8", gray600: "#475569", gray800: "#1E293B", white: "#FFFFFF",
};
const FONT = "'Inter', system-ui, sans-serif";
const DISPLAY = "'Plus Jakarta Sans', 'Inter', sans-serif";

const FREE_FEATURES = ["3 AI generations / month", "Quick Apply, CV tailor, Cover letter & Resume AI Coach", "Unlimited Find Jobs search", "Unlimited profiles & job tracker"];
const PRO_FEATURES = ["Unlimited AI generations", "Everything in Free", "Priority support", "Cancel anytime"];

const Check = ({ color }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginTop: 2 }}>
    <circle cx="8" cy="8" r="8" fill={color} opacity="0.15" />
    <path d="M4.5 8.2l2.2 2.2 4.8-4.8" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// reason: "limit" (hit the monthly cap) | "manual" (clicked Upgrade from the sidebar)
export default function PricingModal({ open, onClose, reason = "manual", remaining = null }) {
  const [loading, setLoading] = useState(false);
  if (!open) return null;

  const upgrade = async () => {
    setLoading(true);
    const ok = await startCheckout();
    if (!ok) setLoading(false);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,31,61,0.5)", backdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, padding: 16 }}
      onClick={onClose}>
      <div className="ja-page" style={{ background: C.white, borderRadius: 18, width: "100%", maxWidth: 560, maxHeight: "90dvh", overflowY: "auto", boxShadow: "0 24px 70px rgba(15,31,61,0.35)" }}
        onClick={e => e.stopPropagation()}>
        <div style={{ padding: "22px 28px 0", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.accent, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 4 }}>
              {reason === "limit" ? "Monthly free limit reached" : "Upgrade"}
            </div>
            <h2 style={{ fontFamily: DISPLAY, fontSize: 22, fontWeight: 700, color: C.navy, margin: 0 }}>
              {reason === "limit" ? "You've used all 3 free generations this month" : "Go unlimited with JobMate Pro"}
            </h2>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: C.gray400, padding: 4 }}>✕</button>
        </div>

        <p style={{ padding: "10px 28px 0", fontSize: 13.5, color: C.gray600, lineHeight: 1.6 }}>
          {reason === "limit"
            ? "Your free credits reset next calendar month, or upgrade now for unlimited CV tailoring, cover letters, and AI coaching."
            : "Unlock unlimited AI generations across Quick Apply, CV tailor, Cover letter, and Resume editor."}
        </p>

        <div className="ja-grid2" style={{ gap: 12, padding: "20px 24px 24px" }}>
          <div style={{ border: `1px solid ${C.gray200}`, borderRadius: 14, padding: "18px 18px 20px" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.gray600 }}>Free</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: C.navy, fontFamily: DISPLAY, margin: "4px 0 14px" }}>€0</div>
            {FREE_FEATURES.map(f => (
              <div key={f} style={{ display: "flex", gap: 8, marginBottom: 9, fontSize: 12.5, color: C.gray600, lineHeight: 1.4 }}>
                <Check color={C.gray400} />{f}
              </div>
            ))}
          </div>

          <div style={{ border: `1.5px solid ${C.accent}`, borderRadius: 14, padding: "18px 18px 20px", position: "relative", background: "linear-gradient(180deg, rgba(37,99,235,0.04), transparent)" }}>
            <div style={{ position: "absolute", top: -11, right: 16, fontSize: 10.5, fontWeight: 700, color: "#fff", background: `linear-gradient(120deg, ${C.accent}, ${C.cyan})`, padding: "3px 10px", borderRadius: 99 }}>RECOMMENDED</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.accent }}>Pro</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: C.navy, fontFamily: DISPLAY, margin: "4px 0 14px" }}>€12<span style={{ fontSize: 13, fontWeight: 500, color: C.gray400 }}>/mo</span></div>
            {PRO_FEATURES.map(f => (
              <div key={f} style={{ display: "flex", gap: 8, marginBottom: 9, fontSize: 12.5, color: C.gray800, fontWeight: 500, lineHeight: 1.4 }}>
                <Check color={C.accent} />{f}
              </div>
            ))}
          </div>
        </div>

        <div style={{ padding: "0 28px 28px" }}>
          <button onClick={upgrade} disabled={loading} className="ja-cta"
            style={{ width: "100%", padding: 14, borderRadius: 12, background: C.accent, color: "#fff", border: "none", fontSize: 15, fontWeight: 700, cursor: loading ? "default" : "pointer", fontFamily: DISPLAY, opacity: loading ? 0.75 : 1 }}>
            {loading ? "Redirecting to checkout…" : "Upgrade to Pro — €12/month"}
          </button>
          <div style={{ textAlign: "center", fontSize: 11.5, color: C.gray400, marginTop: 10 }}>
            Secure checkout via Stripe · Cancel anytime · VAT included where applicable
          </div>
        </div>
      </div>
    </div>
  );
}
