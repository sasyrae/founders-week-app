"use client";
import SessionRow from "./SessionRow";

export default function MySchedule({ config, me, onToggle, goRegister, goAgenda }) {
  if (!me)
    return (
      <main className="fw-main fw-narrow">
        <h2 className="fw-h2">My Schedule</h2>
        <p className="fw-p">Register (or find your registration) to start building your schedule.</p>
        <button className="fw-primary" onClick={goRegister}>
          Register / find me
        </button>
      </main>
    );

  const byDay = config.days.map((d) => ({
    day: d,
    sessions: config.sessions
      .filter((s) => s.day === d.id && me.sessions.includes(s.id))
      .sort((a, b) => a.start.localeCompare(b.start)),
  }));
  const total = me.sessions.length;
  const dayNums = (me.attending || [])
    .map((id) => config.days.findIndex((d) => d.id === id) + 1)
    .sort();

  return (
    <main className="fw-main">
      <h2 className="fw-h2">My Schedule</h2>
      <p className="fw-p">
        Registered for{" "}
        {(me.attending || []).length === config.days.length
          ? "the full event"
          : `Day${dayNums.length > 1 ? "s" : ""} ${dayNums.join(", ")}`}
        {me.dietary?.length ? ` · Dietary: ${me.dietary.join(", ")}` : ""}
      </p>
      {total === 0 && (
        <>
          <p className="fw-p">No sessions yet. Browse the agenda and register for the ones you want.</p>
          <button className="fw-primary" onClick={goAgenda}>
            Browse the agenda
          </button>
        </>
      )}
      {byDay.map(
        ({ day, sessions }) =>
          sessions.length > 0 && (
            <div key={day.id}>
              <div className="fw-dayhead">
                <span>{day.label}</span>
                <span className="fw-daydate2">{day.date}</span>
              </div>
              <div className="fw-spine">
                {sessions.map((s) => (
                  <SessionRow key={s.id} s={s} mine onToggle={(code) => onToggle(s.id, code)} />
                ))}
              </div>
            </div>
          )
      )}
    </main>
  );
}
