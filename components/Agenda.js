"use client";
import { useState, useEffect } from "react";
import SessionRow from "./SessionRow";

export default function Agenda({
  config,
  me,
  onToggle,
  speakerMap,
  onSpeakerClick,
  focusSessionId,
  onFocusHandled,
}) {
  const [dayId, setDayId] = useState(config.days[0]?.id);
  const day = config.days.find((d) => d.id === dayId) || config.days[0];

  // Arriving from a speaker's "Speaking at" link: switch to that session's
  // day, then scroll to it and flash it so it's easy to find.
  useEffect(() => {
    if (!focusSessionId) return;
    const target = config.sessions.find((s) => s.id === focusSessionId);
    if (target) setDayId(target.day);
    const t = setTimeout(() => {
      const el = document.getElementById("fw-session-" + focusSessionId);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("fw-flash");
        setTimeout(() => el.classList.remove("fw-flash"), 1800);
      }
      onFocusHandled && onFocusHandled();
    }, 80);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusSessionId]);
  const sessions = config.sessions
    .filter((s) => s.day === day.id)
    .sort((a, b) => a.start.localeCompare(b.start));

  return (
    <main className="fw-main">
      <div className="fw-daytabs">
        {config.days.map((d) => (
          <button key={d.id} className={d.id === dayId ? "on" : ""} onClick={() => setDayId(d.id)}>
            <span className="fw-daylabel">{d.label}</span>
            <span className="fw-daydate">{d.date}</span>
          </button>
        ))}
      </div>
      <div className="fw-spine">
        {sessions.length === 0 && <p className="fw-empty">No sessions on this day yet.</p>}
        {sessions.map((s) => (
          <SessionRow
            key={s.id}
            s={s}
            mine={me?.sessions.includes(s.id)}
            onToggle={(code) => onToggle(s.id, code)}
            speakerMap={speakerMap}
            onSpeakerClick={onSpeakerClick}
          />
        ))}
      </div>
    </main>
  );
}
