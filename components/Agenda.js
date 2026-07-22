"use client";
import { useState } from "react";
import SessionRow from "./SessionRow";

export default function Agenda({ config, me, onToggle }) {
  const [dayId, setDayId] = useState(config.days[0]?.id);
  const day = config.days.find((d) => d.id === dayId) || config.days[0];
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
          />
        ))}
      </div>
    </main>
  );
}
