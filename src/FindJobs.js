import { useState } from "react";
import { scoreJobBatch } from "./matching";
import { getAuthHeader } from "./supabase";

const C = {
  navy: "#0F1F3D", accent: "#2563EB", accentLight: "#EFF6FF", accentBorder: "#BFDBFE",
  green: "#16A34A", greenLight: "#F0FDF4", greenBorder: "#BBF7D0",
  amber: "#D97706", amberLight: "#FFFBEB", amberBorder: "#FDE68A",
  red: "#DC2626", redLight: "#FEF2F2", blue: "#185FA5", blueLight: "#E6F1FB", blueBorder: "#B5D4F4",
  gray50: "#F8FAFC", gray100: "#F1F5F9", gray200: "#E2E8F0",
  gray400: "#94A3B8", gray600: "#475569", gray800: "#1E293B", white: "#FFFFFF",
};
const FONT = "'Inter', system-ui, sans-serif";
const DISPLAY = "'Plus Jakarta Sans', 'Inter', sans-serif";

const Spinner = () => <span style={{ display: "inline-block", width: 14, height: 14, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "white", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />;

const scoreColor = s => s === null ? C.gray400 : s >= 75 ? C.green : s >= 50 ? C.amber : C.red;
const scoreBg = s => s === null ? C.gray100 : s >= 75 ? C.greenLight : s >= 50 ? C.amberLight : C.redLight;

const JobCard = ({ job, profile, onQuickApply, onSave }) => {
  const [saved, setSaved] = useState(false);
  const salaryText = job.salaryMin || job.salaryMax
    ? `€${Math.round((job.salaryMin || 0) / 1000)}K${job.salaryMax ? `–€${Math.round(job.salaryMax / 1000)}K` : "+"}`
    : null;

  // How long ago was this posted?
  const postedAgo = job.created ? (() => {
    const days = Math.floor((Date.now() - new Date(job.created)) / 86400000);
    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days}d ago`;
    if (days < 30) return `${Math.floor(days / 7)}w ago`;
    return `${Math.floor(days / 30)}mo ago`;
  })() : null;

  return (
    <div className="ja-card" style={{ background: C.white, borderRadius: 12, border: `0.5px solid ${C.gray200}`, padding: "16px 20px" }}>

      <div style={{ display: "flex", justifyContent: "space-between", gap: 14 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.navy, marginBottom: 3, lineHeight: 1.3 }}>{job.title}</div>
          <div style={{ fontSize: 12.5, color: C.gray600, marginBottom: 8 }}>{job.company} · {job.location}</div>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center" }}>
            {/* English-friendly badge — shown when listing explicitly mentions English */}
            {job.englishFriendly && (
              <span style={{ fontSize: 11, padding: "2px 9px", borderRadius: 99, background: C.blueLight, color: C.blue, border: `0.5px solid ${C.blueBorder}`, fontWeight: 600 }}>
                🇬🇧 English OK
              </span>
            )}
            {salaryText && (
              <span style={{ fontSize: 11, padding: "2px 9px", borderRadius: 99, background: C.greenLight, color: C.green, border: `0.5px solid ${C.greenBorder}`, fontWeight: 600 }}>
                {salaryText}
              </span>
            )}
            {job.contractType && (
              <span style={{ fontSize: 11, padding: "2px 9px", borderRadius: 99, background: C.gray100, color: C.gray600 }}>
                {job.contractType}
              </span>
            )}
            {(job.workType === "remote" || job.workType === "hybrid") && (
              <span style={{ fontSize: 11, padding: "2px 9px", borderRadius: 99, background: C.accentLight, color: C.accent, border: `0.5px solid ${C.accentBorder}`, fontWeight: 600 }}>
                {job.workType === "remote" ? "🏠 Remote" : "🔀 Hybrid"}
              </span>
            )}
            {postedAgo && (
              <span style={{ fontSize: 11, color: C.gray400, marginLeft: 2 }}>{postedAgo}</span>
            )}
          </div>
        </div>

        {/* Match score ring */}
        {job.matchScore !== undefined && (
          <div style={{ flexShrink: 0, textAlign: "center" }}>
            <div style={{ width: 44, height: 44, borderRadius: "50%", background: scoreBg(job.matchScore), border: `1.5px solid ${scoreColor(job.matchScore)}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: scoreColor(job.matchScore) }}>
              {job.matchScore === null ? "—" : job.matchScore}
            </div>
            <div style={{ fontSize: 9, color: C.gray400, marginTop: 2 }}>match</div>
          </div>
        )}
      </div>

      {/* Short description preview */}
      {job.description && (
        <div style={{ marginTop: 10, fontSize: 12, color: C.gray600, lineHeight: 1.55, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
          {job.description}
        </div>
      )}

      {!profile?.name && (
        <div style={{ marginTop: 8, fontSize: 11, color: C.amber, background: C.amberLight, border: `0.5px solid ${C.amberBorder}`, borderRadius: 6, padding: "5px 9px" }}>
          ⚠️ Save your profile to see personalised match scores
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button onClick={() => onQuickApply(job)}
          style={{ flex: 1, padding: "8px 0", borderRadius: 8, background: C.accent, color: C.white, border: "none", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: FONT }}>
          ⚡ Quick apply
        </button>
        <button onClick={() => { onSave(job); setSaved(true); }} disabled={saved}
          style={{ padding: "8px 14px", borderRadius: 8, background: saved ? C.greenLight : C.white, color: saved ? C.green : C.gray600, border: `0.5px solid ${saved ? C.greenBorder : C.gray200}`, fontSize: 12.5, fontWeight: 600, cursor: saved ? "default" : "pointer", fontFamily: FONT }}>
          {saved ? "✓ Saved" : "📌 Save"}
        </button>
        <a href={job.url} target="_blank" rel="noopener noreferrer"
          style={{ padding: "8px 14px", borderRadius: 8, background: C.white, color: C.gray600, border: `0.5px solid ${C.gray200}`, fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: FONT, textDecoration: "none", display: "flex", alignItems: "center" }}>
          View →
        </a>
      </div>
    </div>
  );
};

// German city suggestions for location autocomplete feel.
// "Remote" is deliberately not a city — it's covered by the work-type filter.
const CITIES = ["Berlin", "Munich", "Hamburg", "Frankfurt", "Cologne", "Stuttgart", "Düsseldorf"];

export default function FindJobs({ profile, onQuickApply, onSaveToTracker }) {
  const [keyword, setKeyword] = useState("");
  const [location, setLocation] = useState("Berlin");
  const [remote, setRemote] = useState("any");
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [scoring, setScoring] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);
  const [englishOnly, setEnglishOnly] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  const [filteredOut, setFilteredOut] = useState(0); // jobs hidden by the English-only filter

  const search = async (englishOverride) => {
    const useEnglishFilter = typeof englishOverride === "boolean" ? englishOverride : englishOnly;
    setLoading(true); setError(""); setJobs([]); setSearched(true); setFilteredOut(0);
    try {
      const params = new URLSearchParams({ keyword, location, remote });
      const authHeader = await getAuthHeader();
      const res = await fetch(`/api/adzuna?${params.toString()}`, {
        headers: authHeader,
        signal: AbortSignal.timeout(30000),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const detail = data.details ? ` (${String(data.details).slice(0, 120)})` : "";
        throw new Error((data.error || "Search failed") + detail);
      }

      setTotalCount(data.count || 0);

      let results = data.jobs || [];
      const rawCount = results.length;

      // English filter — the API now detects the ad's actual language
      // (German-stopword heuristic), so rely on its flag directly. The old
      // title-word fallback ("Manager", "Consultant"…) let German-language
      // ads through because German postings reuse English job titles.
      if (useEnglishFilter) {
        results = results.filter(j => j.englishFriendly);
        setFilteredOut(rawCount - results.length);
      }

      if (results.length === 0) { setJobs([]); return; }

      if (profile?.name) {
        setScoring(true);
        try {
          const scored = await scoreJobBatch(profile, results);
          setJobs(scored);
        } catch {
          setJobs(results.map(j => ({ ...j, matchScore: null })));
        }
      } else {
        setJobs(results.map(j => ({ ...j, matchScore: null })));
      }
    } catch (e) {
      const msg = e.name === "TimeoutError"
        ? "The search took too long to respond. Please try again."
        : (e.message || "Something went wrong. Please try again.");
      setError(msg);
    } finally {
      // Whatever happens, never leave a spinner running.
      setLoading(false);
      setScoring(false);
    }
  };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Search bar */}
      <div style={{ background: C.white, borderRadius: 12, border: `0.5px solid ${C.gray200}`, padding: "18px 22px", marginBottom: 20 }}>

        {/* Context banner */}
        <div style={{ background: C.blueLight, border: `0.5px solid ${C.blueBorder}`, borderRadius: 8, padding: "8px 12px", marginBottom: 14, fontSize: 12.5, color: C.blue, display: "flex", alignItems: "center", gap: 7 }}>
          🇩🇪 Searching English-friendly jobs across Germany — powered by Adzuna
        </div>

        <div className="ja-search-grid" style={{ marginBottom: 12 }}>
          <input value={keyword} onChange={e => setKeyword(e.target.value)} placeholder="Job title (e.g. Product Manager, Software Engineer)"
            style={{ padding: "9px 12px", borderRadius: 8, border: `0.5px solid ${C.gray200}`, fontSize: 13, color: C.gray800, outline: "none", fontFamily: FONT }}
            onFocus={e => e.target.style.borderColor = C.accent} onBlur={e => e.target.style.borderColor = C.gray200}
            onKeyDown={e => e.key === "Enter" && search()} />

          <select value={location} onChange={e => setLocation(e.target.value)}
            style={{ padding: "9px 10px", borderRadius: 8, border: `0.5px solid ${C.gray200}`, fontSize: 13, color: C.gray800, background: C.white, fontFamily: FONT }}>
            {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
            <option value="">All of Germany</option>
          </select>

          <select value={remote} onChange={e => setRemote(e.target.value)}
            style={{ padding: "9px 10px", borderRadius: 8, border: `0.5px solid ${C.gray200}`, fontSize: 13, color: C.gray800, background: C.white, fontFamily: FONT }}>
            <option value="any">Any type</option>
            <option value="remote">Remote</option>
            <option value="hybrid">Hybrid</option>
            <option value="onsite">Onsite</option>
          </select>
        </div>

        {/* English filter toggle */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 7, cursor: "pointer", fontSize: 12.5, color: C.gray600, fontFamily: FONT, userSelect: "none" }}>
            <input type="checkbox" checked={englishOnly} onChange={e => setEnglishOnly(e.target.checked)}
              style={{ width: 14, height: 14, cursor: "pointer", accentColor: C.accent }} />
            🇬🇧 English-friendly jobs only
          </label>
          <span style={{ fontSize: 11, color: C.gray400 }}>— filters for listings that mention English or have international job titles</span>
        </div>

        <button onClick={() => search()} disabled={loading} className="ja-cta"
          style={{ width: "100%", padding: 12, borderRadius: 10, background: C.accent, color: C.white, fontSize: 14, fontWeight: 600, border: "none", cursor: loading ? "not-allowed" : "pointer", fontFamily: DISPLAY, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: loading ? 0.7 : 1 }}>
          {loading ? <><Spinner /> Searching jobs in Germany...</> : "🔍 Search jobs"}
        </button>

        {error && <div style={{ marginTop: 10, fontSize: 13, color: C.red }}>{error}</div>}
      </div>

      {/* Scoring progress */}
      {scoring && (
        <div style={{ textAlign: "center", padding: "12px 0", fontSize: 13, color: C.gray600, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <Spinner /> Calculating match scores against your profile...
        </div>
      )}

      {/* Results header */}
      {!loading && searched && jobs.length > 0 && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontSize: 13, color: C.gray600 }}>
            <span style={{ fontWeight: 600, color: C.gray800 }}>{jobs.length}</span> jobs shown
            {totalCount > jobs.length && <span style={{ color: C.gray400 }}> · {totalCount.toLocaleString()} total found in Germany</span>}
          </div>
          {profile?.name && <div style={{ fontSize: 11, color: C.gray400 }}>Sorted by profile match score</div>}
        </div>
      )}

      {/* Empty state */}
      {!loading && searched && jobs.length === 0 && !error && filteredOut > 0 && (
        <div style={{ background: C.amberLight || "#FFFBEB", border: "0.5px solid #FCD34D", borderRadius: 10, padding: "12px 16px", fontSize: 13, color: "#92400E", marginBottom: 12 }}>
          Found {filteredOut} job{filteredOut === 1 ? "" : "s"}, but the English-only filter hid {filteredOut === 1 ? "it" : "them all"}.{" "}
          <button onClick={() => { setEnglishOnly(false); search(false); }}
            style={{ background: "none", border: "none", color: "#92400E", fontWeight: 700, cursor: "pointer", textDecoration: "underline", fontFamily: FONT, fontSize: 13, padding: 0 }}>
            Show all results
          </button>
        </div>
      )}
      {!loading && searched && jobs.length === 0 && !error && filteredOut === 0 && (
        <div style={{ textAlign: "center", padding: "40px 20px", color: C.gray400, fontSize: 14, background: C.white, borderRadius: 12, border: `0.5px solid ${C.gray200}` }}>
          <div style={{ fontSize: 28, marginBottom: 10 }}>🔍</div>
          <div style={{ fontWeight: 600, color: C.gray600, marginBottom: 4 }}>No jobs found</div>
          <div style={{ fontSize: 13 }}>Try a different keyword, city, or work type</div>
        </div>
      )}

      {/* Job cards — sorted by match score descending if available */}
      <div className="ja-stagger" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {[...jobs]
          .sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0))
          .map(job => (
            <JobCard key={job.id} job={job} profile={profile} onQuickApply={onQuickApply} onSave={onSaveToTracker} />
          ))}
      </div>
    </div>
  );
}
