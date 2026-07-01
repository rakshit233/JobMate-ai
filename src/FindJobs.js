import { useState } from "react";
import { scoreJobBatch } from "./matching";

const C = {
  navy: "#0F1F3D", accent: "#2563EB", accentLight: "#EFF6FF", accentBorder: "#BFDBFE",
  green: "#16A34A", greenLight: "#F0FDF4", greenBorder: "#BBF7D0",
  amber: "#D97706", amberLight: "#FFFBEB", amberBorder: "#FDE68A",
  red: "#DC2626", redLight: "#FEF2F2",
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

  return (
    <div style={{ background: C.white, borderRadius: 12, border: `0.5px solid ${C.gray200}`, padding: "16px 20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 14 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.navy, marginBottom: 3 }}>{job.title}</div>
          <div style={{ fontSize: 12.5, color: C.gray600, marginBottom: 8 }}>{job.company} · {job.location}</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {salaryText && <span style={{ fontSize: 11, padding: "2px 9px", borderRadius: 99, background: C.greenLight, color: C.green, border: `0.5px solid ${C.greenBorder}`, fontWeight: 600 }}>{salaryText}</span>}
            {job.contractType && <span style={{ fontSize: 11, padding: "2px 9px", borderRadius: 99, background: C.gray100, color: C.gray600 }}>{job.contractType}</span>}
          </div>
        </div>
        {job.matchScore !== undefined && (
          <div style={{ flexShrink: 0, textAlign: "center" }}>
            <div style={{ width: 44, height: 44, borderRadius: "50%", background: scoreBg(job.matchScore), border: `1.5px solid ${scoreColor(job.matchScore)}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: scoreColor(job.matchScore) }}>
              {job.matchScore === null ? "—" : job.matchScore}
            </div>
            <div style={{ fontSize: 9, color: C.gray400, marginTop: 2 }}>match</div>
          </div>
        )}
      </div>

      {!profile?.name && (
        <div style={{ marginTop: 10, fontSize: 11, color: C.amber, background: C.amberLight, border: `0.5px solid ${C.amberBorder}`, borderRadius: 6, padding: "5px 9px" }}>
          ⚠️ Save your profile for personalised match scores
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

export default function FindJobs({ profile, onQuickApply, onSaveToTracker }) {
  const [keyword, setKeyword] = useState("");
  const [location, setLocation] = useState("Berlin");
  const [remote, setRemote] = useState("any");
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [scoring, setScoring] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);

  const search = async () => {
    setLoading(true); setError(""); setJobs([]); setSearched(true);
    try {
      const params = new URLSearchParams({ keyword, location, remote });
      const res = await fetch(`/api/adzuna?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Search failed");

      setLoading(false);

      if (data.jobs.length === 0) { setJobs([]); return; }

      if (profile?.name) {
        setScoring(true);
        try {
          const scored = await scoreJobBatch(profile, data.jobs);
          setJobs(scored);
        } catch {
          setJobs(data.jobs.map(j => ({ ...j, matchScore: null })));
        }
        setScoring(false);
      } else {
        setJobs(data.jobs.map(j => ({ ...j, matchScore: null })));
      }
    } catch (e) {
      setError(e.message || "Something went wrong searching for jobs.");
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <div style={{ background: C.white, borderRadius: 12, border: `0.5px solid ${C.gray200}`, padding: "18px 22px", marginBottom: 20 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 140px", gap: 10, marginBottom: 12 }}>
          <input value={keyword} onChange={e => setKeyword(e.target.value)} placeholder="Job title or keyword (e.g. Product Manager)"
            style={{ padding: "9px 12px", borderRadius: 8, border: `0.5px solid ${C.gray200}`, fontSize: 13, color: C.gray800, outline: "none", fontFamily: FONT }}
            onKeyDown={e => e.key === "Enter" && search()} />
          <input value={location} onChange={e => setLocation(e.target.value)} placeholder="Location (e.g. Berlin)"
            style={{ padding: "9px 12px", borderRadius: 8, border: `0.5px solid ${C.gray200}`, fontSize: 13, color: C.gray800, outline: "none", fontFamily: FONT }}
            onKeyDown={e => e.key === "Enter" && search()} />
          <select value={remote} onChange={e => setRemote(e.target.value)}
            style={{ padding: "9px 10px", borderRadius: 8, border: `0.5px solid ${C.gray200}`, fontSize: 13, color: C.gray800, background: C.white, fontFamily: FONT }}>
            <option value="any">Any</option>
            <option value="remote">Remote</option>
            <option value="hybrid">Hybrid</option>
            <option value="onsite">Onsite</option>
          </select>
        </div>
        <button onClick={search} disabled={loading}
          style={{ width: "100%", padding: 12, borderRadius: 10, background: C.accent, color: C.white, fontSize: 14, fontWeight: 600, border: "none", cursor: "pointer", fontFamily: DISPLAY, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: loading ? 0.7 : 1 }}>
          {loading ? <><Spinner /> Searching...</> : "🔍 Search jobs"}
        </button>
        {error && <div style={{ marginTop: 10, fontSize: 13, color: C.red }}>{error}</div>}
      </div>

      {scoring && (
        <div style={{ textAlign: "center", padding: "16px 0", fontSize: 13, color: C.gray600, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <Spinner /> Calculating match scores against your profile...
        </div>
      )}

      {!loading && searched && jobs.length === 0 && !error && (
        <div style={{ textAlign: "center", padding: "40px 20px", color: C.gray400, fontSize: 14 }}>
          No jobs found. Try a different keyword or location.
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {jobs.map(job => (
          <JobCard key={job.id} job={job} profile={profile} onQuickApply={onQuickApply} onSave={onSaveToTracker} />
        ))}
      </div>
    </div>
  );
}
