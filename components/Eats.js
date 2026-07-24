"use client";

/* Verified official sites for the Good Eats picks. Kept here (rather than
   in the database) so they apply immediately without a data migration —
   an entry's own `url` still wins if one is ever set. */
const EAT_LINKS = {
  Leuca: "https://www.leuca.com/",
  "Cafe Mogador": "https://www.cafemogador.com/",
  "The Commodore": "https://thecommodorebars.com/thecommodore",
  Wei: "https://www.instagram.com/weis_nyc/?hl=en",
  "Laser Wolf": "https://www.laserwolfbrooklyn.com/",
  "Le Crocodile": "https://www.lecrocodile.com/",
  "Santa Fe BK": "https://santafebk.com/",
  "Ace's Pizza": "https://acespizzaspot.com/",
  "Rule of Thirds": "https://www.thirdsbk.com/",
};

/* Extra practical notes appended to a spot's description. */
const EAT_NOTES = {
  Wei: "Walk-ins only — they don't take reservations.",
};

/* An entry's own url wins; then our verified list; then a Google Maps
   search as a safe fallback for anything added later. */
function eatLink(e) {
  if (e.url) return e.url;
  if (EAT_LINKS[e.name]) return EAT_LINKS[e.name];
  return (
    "https://www.google.com/maps/search/?api=1&query=" +
    encodeURIComponent(`${e.name} Williamsburg Brooklyn`)
  );
}

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
            <a className="fw-eatname" href={eatLink(e)} target="_blank" rel="noreferrer">
              {e.name}
            </a>
            {e.tag && (
              <span className={"fw-eattag" + (e.tag.startsWith("On-site") ? " onsite" : "")}>
                {e.tag}
              </span>
            )}
          </div>
          {(e.note || EAT_NOTES[e.name]) && (
            <div className="fw-desc" style={{ marginTop: 4 }}>
              {e.note}
              {EAT_NOTES[e.name] && (e.note ? " " : "") + EAT_NOTES[e.name]}
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
