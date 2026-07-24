"use client";
import { GUIDE_DO, GUIDE_SHOP } from "@/lib/constants";

/* ─────────────────────────────────────────────────────────────
   Neighborhood Guide — Restaurants, Things to Do, Shopping.

   Restaurants come from the database (config.eats) so the original
   copy is preserved; Things to Do and Shopping are curated in code
   for now. Every entry links out.
   ───────────────────────────────────────────────────────────── */

/* Verified official sites for the restaurant picks. Kept here rather
   than in the database so they apply without a data migration — an
   entry's own `url` still wins if one is ever set. */
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

function linkFor(item) {
  if (item.url) return item.url;
  if (EAT_LINKS[item.name]) return EAT_LINKS[item.name];
  return (
    "https://www.google.com/maps/search/?api=1&query=" +
    encodeURIComponent(`${item.name} Williamsburg Brooklyn`)
  );
}

function Entry({ item }) {
  const extra = EAT_NOTES[item.name];
  return (
    <div className="fw-eat">
      <div className="fw-eattop">
        <a className="fw-eatname" href={linkFor(item)} target="_blank" rel="noreferrer">
          {item.name}
        </a>
        {item.tag && (
          <span className={"fw-eattag" + (item.tag.startsWith("On-site") ? " onsite" : "")}>
            {item.tag}
          </span>
        )}
      </div>
      {(item.note || extra) && (
        <div className="fw-desc" style={{ marginTop: 4 }}>
          {item.note}
          {extra && (item.note ? " " : "") + extra}
        </div>
      )}
    </div>
  );
}

export default function Guide({ config }) {
  const eats = config.eats || [];

  return (
    <main className="fw-main fw-narrow2">
      <h2 className="fw-h2">Neighborhood Guide</h2>
      <p className="fw-p">
        Williamsburg is yours between sessions. Where we'd send a friend — everything below is a
        short walk from The William Vale.
      </p>

      <div className="fw-dayhead">
        <span>Restaurants</span>
      </div>
      <p className="fw-p">
        No formal dinner Wednesday night — the reception is heavy hors d'oeuvres, and after that the
        neighborhood takes over. Our picks, starting with the one downstairs:
      </p>
      {eats.map((e) => (
        <Entry key={e.name} item={e} />
      ))}
      <p className="fw-p" style={{ fontSize: 13, marginTop: 18 }}>
        Weeknight in Williamsburg — most spots take walk-ins for small groups, but book ahead if
        you're rolling six deep.
      </p>

      <div className="fw-dayhead">
        <span>Things to Do</span>
      </div>
      <p className="fw-p">
        Early mornings, long lunch breaks, and the gap before dinner — a few ways to fill them.
      </p>
      {GUIDE_DO.map((e) => (
        <Entry key={e.name} item={e} />
      ))}

      <div className="fw-dayhead">
        <span>Shopping</span>
      </div>
      <p className="fw-p">
        From "I forgot a blazer" to "I should bring something home."
      </p>
      {GUIDE_SHOP.map((e) => (
        <Entry key={e.name} item={e} />
      ))}
    </main>
  );
}
