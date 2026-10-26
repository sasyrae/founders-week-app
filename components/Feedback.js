"use client";
import { useState, useEffect } from "react";
import { api } from "./api";

/* Anonymous overall-event feedback. Per-session ratings live on each session
   row in the agenda; this is the big-picture form. */
export default function Feedback({ config }) {
  const [overall, setOverall] = useState(0);
  const [nps, setNps] = useState("");
  const [valuable, setValuable] = useState("");
  const [improve, setImprove] = useState("");
  const [favorite, setFavorite] = useState("");
  const [usedMeet, setUsedMeet] = useState("");
  const [meetNote, setMeetNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    setBusy(true);
    setErr("");
    const r = await api.submitFeedback({
      kind: "event",
      overall: overall || undefined,
      nps: nps === "" ? undefined : Number(nps),
      valuable,
      improve,
      favorite,
      usedMeet,
      meetNote,
    });
    setBusy(false);
    if (r.ok) setDone(true);
    else setErr(r.error || "Couldn't submit — try again.");
  };

  return (
    <main className="fw-main fw-narrow">
      <h2 className="fw-h2">How was Founders Week?</h2>
      <p className="fw-p" style={{ marginTop: 0 }}>
        Anonymous and quick. Skip anything you like.
      </p>

      <label className="fw-label">Overall, how was it?</label>
      <Stars value={overall} onChange={setOverall} />

      <label className="fw-label">How likely are you to recommend attending next year? (0–10)</label>
      <div className="fw-caterchips">
        {Array.from({ length: 11 }, (_, i) => (
          <button
            key={i}
            type="button"
            className={"fw-add" + (String(nps) === String(i) ? " added" : "")}
            onClick={() => setNps(String(i))}
          >
            {i}
          </button>
        ))}
      </div>

      <label className="fw-label">What was most valuable to you?</label>
      <textarea className="fw-input" rows={3} value={valuable} onChange={(e) => setValuable(e.target.value)} />

      <label className="fw-label">What should we improve?</label>
      <textarea className="fw-input" rows={3} value={improve} onChange={(e) => setImprove(e.target.value)} />

      <label className="fw-label">A favorite session or speaker?</label>
      <input className="fw-input" value={favorite} onChange={(e) => setFavorite(e.target.value)} />

      <label className="fw-label">Did you use "Meet People"?</label>
      <div className="fw-caterchips">
        {[["yes", "Yes"], ["no", "No"]].map(([v, l]) => (
          <button
            key={v}
            type="button"
            className={"fw-add" + (usedMeet === v ? " added" : "")}
            onClick={() => setUsedMeet(usedMeet === v ? "" : v)}
          >
            {l}
          </button>
        ))}
      </div>
      {usedMeet === "yes" && (
        <>
          <label className="fw-label">How was it? Did you make any connections?</label>
          <textarea className="fw-input" rows={2} value={meetNote} onChange={(e) => setMeetNote(e.target.value)} />
        </>
      )}

      {err && <p className="fw-err" style={{ marginTop: 12 }}>{err}</p>}
      {done ? (
        <p className="fw-banner" style={{ position: "static", marginTop: 16 }}>
          Thanks — your feedback is in.
        </p>
      ) : (
        <button className="fw-primary" disabled={busy} onClick={submit}>
          {busy ? "Sending…" : "Send feedback"}
        </button>
      )}

      <SessionRatings config={config} />
    </main>
  );
}

function SessionRatings({ config }) {
  const days = config?.days || [];
  const sessions = config?.sessions || [];
  if (sessions.length === 0) return null;
  return (
    <section style={{ marginTop: 34 }}>
      <h3 className="fw-h2" style={{ fontSize: 20 }}>Rate the sessions</h3>
      <p className="fw-muted">Tap stars on any session you attended — saved as you go.</p>
      {days.map((d) => {
        const list = sessions
          .filter((s) => s.day === d.id)
          .sort((a, b) => String(a.start).localeCompare(String(b.start)));
        if (!list.length) return null;
        return (
          <div key={d.id} style={{ marginTop: 14 }}>
            <div className="fw-label">{d.label}</div>
            {list.map((s) => (
              <SessionRateRow key={s.id} s={s} />
            ))}
          </div>
        );
      })}
    </section>
  );
}

function SessionRateRow({ s }) {
  const [stars, setStars] = useState(0);
  useEffect(() => {
    try {
      const v = localStorage.getItem("fw_rated_" + s.id);
      if (v && v !== "c") setStars(Number(v) || 0);
    } catch {
      /* ignore */
    }
  }, [s.id]);
  const rate = async (n) => {
    setStars(n);
    const r = await api.submitFeedback({ kind: "session", sessionId: s.id, rating: n });
    if (r.ok) {
      try {
        localStorage.setItem("fw_rated_" + s.id, String(n));
      } catch {
        /* ignore */
      }
    }
  };
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
      <span style={{ fontSize: 14 }}>{s.title}</span>
      <span style={{ display: "flex", gap: 2, flexShrink: 0 }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
            onClick={() => rate(n)}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, lineHeight: 1, padding: 0, color: n <= stars ? "var(--amber)" : "var(--line)" }}
          >
            ★
          </button>
        ))}
      </span>
    </div>
  );
}

function Stars({ value, onChange, size = 30 }) {
  return (
    <div style={{ display: "flex", gap: 4 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
          onClick={() => onChange(n === value ? 0 : n)}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            fontSize: size,
            lineHeight: 1,
            padding: 0,
            color: n <= value ? "var(--amber)" : "var(--line)",
          }}
        >
          ★
        </button>
      ))}
    </div>
  );
}

export { Stars };
