"use client";

export default function Eats({ config }) {
  const eats = config.eats || [];
  return (
    <main className="fw-main fw-narrow2">
      <h2 className="fw-h2">Good Eats — Williamsburg</h2>
      <p className="fw-p">
        No formal dinner Wednesday night — the reception is heavy hors d'oeuvres, and after that the
        neighborhood takes over. Our picks, starting with the one downstairs:
      </p>
      {eats.map((e) => (
        <div className="fw-eat" key={e.name}>
          <div className="fw-eattop">
            <span className="fw-eatname">{e.name}</span>
            {e.tag && (
              <span className={"fw-eattag" + (e.tag.startsWith("On-site") ? " onsite" : "")}>
                {e.tag}
              </span>
            )}
          </div>
          {e.note && (
            <div className="fw-desc" style={{ marginTop: 4 }}>
              {e.note}
            </div>
          )}
        </div>
      ))}
      <p className="fw-p" style={{ fontSize: 13, marginTop: 18 }}>
        Weeknight in Williamsburg — most spots take walk-ins for small groups, but book ahead if
        you're rolling six deep.
      </p>
    </main>
  );
}
