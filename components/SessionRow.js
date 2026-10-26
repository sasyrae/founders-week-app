"use client";
import { useState, useEffect, useRef } from "react";
import { fmtTime } from "@/lib/utils";
import SpeakerAvatar from "./SpeakerAvatar";
import { api } from "./api";

/* One agenda row. onToggle(accessCode?) is async and returns the API
   result ({ ok, error, code }). Access codes and capacity are enforced
   server-side; this component just surfaces the outcomes. speakerMap
   resolves the session's attached (published) speakers. */
export default function SessionRow({
  s,
  mine,
  onToggle,
  readonly,
  speakerMap,
  onSpeakerClick,
  isFocus,
  onFocusHandled,
}) {
  const rootRef = useRef(null);
  const [askCode, setAskCode] = useState(false);

  // When this row is the navigation target (arrived from a speaker's session
  // link), scroll to it and flash it. Runs once this row is actually mounted,
  // so the element always exists.
  useEffect(() => {
    if (!isFocus) return;
    const el = rootRef.current;
    if (!el) return;
    el.scrollIntoView({ block: "center" });
    el.classList.add("fw-flash");
    setTimeout(() => el.classList.remove("fw-flash"), 1800);
    onFocusHandled && onFocusHandled();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFocus]);

  const [code, setCode] = useState("");
  const [codeErr, setCodeErr] = useState("");
  const [rowErr, setRowErr] = useState("");
  const [busy, setBusy] = useState(false);

  // Anonymous per-session rating.
  const [rateOpen, setRateOpen] = useState(false);
  const [stars, setStars] = useState(0);
  const [fbComment, setFbComment] = useState("");
  const [rated, setRated] = useState(false);
  const [rating, setRating] = useState(false);
  useEffect(() => {
    try {
      if (localStorage.getItem("fw_rated_" + s.id)) setRated(true);
    } catch {
      /* ignore */
    }
  }, [s.id]);
  const sendRating = async () => {
    if (!stars && !fbComment.trim()) return;
    setRating(true);
    const r = await api.submitFeedback({ kind: "session", sessionId: s.id, rating: stars || undefined, comment: fbComment });
    setRating(false);
    if (r.ok) {
      try {
        localStorage.setItem("fw_rated_" + s.id, String(stars || "c"));
      } catch {
        /* ignore */
      }
      setRated(true);
      setRateOpen(false);
    } else setRowErr(r.error || "Couldn't submit rating.");
  };

  const gated = s.gated ?? !!s.accessCode;
  const taken = s.taken ?? 0;
  const full = s.capacity > 0 && taken >= s.capacity && !mine;
  const linkedSpeakers = (s.speakerIds || [])
    .map((id) => speakerMap && speakerMap[id])
    .filter(Boolean);

  const doToggle = async (accessCode) => {
    setBusy(true);
    setRowErr("");
    const r = (await onToggle(accessCode)) || {};
    setBusy(false);
    return r;
  };

  const handleClick = async () => {
    if (mine || !gated) {
      const r = await doToggle();
      if (!r.ok && r.error) setRowErr(r.error);
      setAskCode(false);
      setCodeErr("");
      return;
    }
    setAskCode(!askCode);
  };

  const submitCode = async () => {
    const r = await doToggle(code);
    if (r.ok) {
      setAskCode(false);
      setCode("");
      setCodeErr("");
    } else {
      setCodeErr(r.error || "That code isn't right — check your invitation.");
    }
  };

  return (
    <div className={"fw-sess" + (mine ? " mine" : "")} id={"fw-session-" + s.id} ref={rootRef}>
      <div className="fw-time">
        <span>{fmtTime(s.start)}</span>
        <span className="fw-timeend">{fmtTime(s.end)}</span>
      </div>
      <div className="fw-dot" />
      <div className="fw-card">
        <div className="fw-cardtop">
          {String(s.track)
            .split("+")
            .map((t) => t.trim())
            .filter(Boolean)
            .map((t) => (
              <span key={t} className={"fw-track t-" + t.toLowerCase()}>
                {t}
              </span>
            ))}
          {gated && <span className="fw-lock">Invite only</span>}
          {s.capacity > 0 && !full && <span className="fw-cap">Limited · {s.capacity} seats</span>}
          {full && <span className="fw-full">Full</span>}
        </div>
        <div className="fw-sesstitle">{s.title}</div>
        {linkedSpeakers.length > 0 ? (
          <div className="fw-spkrow">
            {linkedSpeakers.map((sp) =>
              onSpeakerClick ? (
                <button
                  type="button"
                  className="fw-spkchip"
                  key={sp.id}
                  onClick={() => onSpeakerClick(sp)}
                >
                  <SpeakerAvatar speaker={sp} size={24} />
                  {sp.name}
                </button>
              ) : (
                <span className="fw-spkchip" key={sp.id}>
                  <SpeakerAvatar speaker={sp} size={24} />
                  {sp.name}
                </span>
              )
            )}
          </div>
        ) : (
          s.speaker && <div className="fw-speaker">{s.speaker}</div>
        )}
        {s.desc && <div className="fw-desc">{s.desc}</div>}
        <div className="fw-cardfoot">
          <span className="fw-loc">{s.location}</span>
          {!readonly && (
            <button
              className={"fw-add" + (mine ? " added" : "")}
              disabled={busy || full}
              onClick={handleClick}
            >
              {mine
                ? s.ctaDone || "✓ Registered"
                : full
                ? "Session full"
                : gated
                ? "Register with code"
                : s.cta || "+ Register for session"}
            </button>
          )}
        </div>
        {askCode && !mine && (
          <div className="fw-codebox">
            <input
              className="fw-input"
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                setCodeErr("");
              }}
              placeholder="Access code"
              onKeyDown={(e) => e.key === "Enter" && submitCode()}
            />
            <button className="fw-add" onClick={submitCode} disabled={busy}>
              Confirm
            </button>
            {codeErr && (
              <div className="fw-err" style={{ width: "100%" }}>
                {codeErr}
              </div>
            )}
          </div>
        )}
        {rowErr && <div className="fw-err">{rowErr}</div>}

        <div className="fw-rate">
          {rated ? (
            <span className="fw-muted">✓ Thanks for rating this session</span>
          ) : rateOpen ? (
            <div>
              <div style={{ display: "flex", gap: 4, marginBottom: 6 }}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    aria-label={`${n} star${n > 1 ? "s" : ""}`}
                    onClick={() => setStars(n === stars ? 0 : n)}
                    style={{ background: "none", border: "none", cursor: "pointer", fontSize: 24, lineHeight: 1, padding: 0, color: n <= stars ? "var(--amber)" : "var(--line)" }}
                  >
                    ★
                  </button>
                ))}
              </div>
              <textarea
                className="fw-input"
                rows={2}
                placeholder="Optional comment"
                value={fbComment}
                onChange={(e) => setFbComment(e.target.value)}
              />
              <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                <button className="fw-add added" disabled={rating} onClick={sendRating}>
                  {rating ? "Sending…" : "Submit rating"}
                </button>
                <button className="fw-linkbtn" onClick={() => setRateOpen(false)}>Cancel</button>
              </div>
            </div>
          ) : (
            <button className="fw-linkbtn" onClick={() => setRateOpen(true)}>Rate this session</button>
          )}
        </div>
      </div>
    </div>
  );
}
