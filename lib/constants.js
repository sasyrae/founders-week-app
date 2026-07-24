/* ─────────────────────────────────────────────────────────────
   Seed data + constants — ported verbatim from the approved
   prototype (AGENDA_VERSION 13). This is the source of truth used
   to seed the database. Once seeded, live data lives in Supabase
   and the admin Host tools edit it.
   ───────────────────────────────────────────────────────────── */

export const AGENDA_VERSION = 13;

export const DIET_OPTIONS = [
  "Vegetarian", "Vegan", "Pescatarian", "Gluten-free",
  "Dairy-free", "Halal", "Kosher", "Nut allergy",
];

export const HOTEL_NIGHTS = ["Tue, Oct 13", "Wed, Oct 14", "Thu, Oct 15", "Fri, Oct 16"];

/* Event-level config (everything except the sessions list, which is
   its own table). Seeds the single `config` row. */
export const DEFAULT_CONFIG = {
  agendaVersion: AGENDA_VERSION,
  title: "Flybridge Founders Week & AGM",
  subtitle: "October 14–16, 2026 at The William Vale, Williamsburg, Brooklyn.",
  city: "The William Vale, Brooklyn",
  slackInviteUrl:
    "https://join.slack.com/share/enQtMTE2Nzk1Njc2NzI4NDgtOTQ2Y2M1MWJlZmNhNTk4MGQyZjk2ZTkwYzYyZjk3ZGU4ZmJkMTlkNTJhODViMjE2OWRjMzI5ZDZjMDA3M2UzOQ",
  slackChannel: "#founders-week-2026",
  hotelBlockTarget: 25,
  hotelTeamRooms: 9,
  hotelBookingUrl: "",
  // Negotiated William Vale room rates, per night, by attendee type.
  hotelRateFounder: 349,
  hotelRateStandard: 549,
  blockNights: ["Wed, Oct 14", "Thu, Oct 15"],
  eats: [
    { name: "Leuca", note: "Southern Italian inside The William Vale — you don't even have to put a coat on.", tag: "On-site", url: "https://www.leuca.com/" },
    { name: "Cafe Mogador", note: "Williamsburg institution — Moroccan-Middle Eastern, always humming.", tag: "", url: "https://www.cafemogador.com/" },
    { name: "The Commodore", note: "Legendary dive energy, great fried chicken.", tag: "Late night · kitchen til 1 AM", url: "https://thecommodorebars.com/thecommodore" },
    { name: "Wei", note: "Sichuan dining with killer cocktails and an even better playlist.", tag: "Late night · kitchen til 1 AM", url: "https://www.instagram.com/weis_nyc/?hl=en" },
    { name: "Laser Wolf", note: "Israeli grill with a rooftop and a point of view.", tag: "", url: "https://www.laserwolfbrooklyn.com/" },
    { name: "Le Crocodile", note: "French brasserie at the Wythe — for a proper sit-down.", tag: "", url: "https://www.lecrocodile.com/" },
    { name: "Santa Fe BK", note: "New Mexican — green chile everything.", tag: "", url: "https://santafebk.com/" },
    { name: "Ace's Pizza", note: "Detroit-style squares, zero pretense.", tag: "", url: "https://acespizzaspot.com/" },
    { name: "Rule of Thirds", note: "Japanese, beautiful room, great for groups.", tag: "", url: "https://www.thirdsbk.com/" },
  ],
  days: [
    { id: "d1", label: "Day 1 — AGM + FFW Opening Night", date: "Wednesday, October 14" },
    { id: "d2", label: "Day 2 — FFW Full Session", date: "Thursday, October 15" },
    { id: "d3", label: "Day 3 — FFW Capital Summit (Half Day)", date: "Friday, October 16" },
  ],
  // confirmSubject / confirmTemplate default to the constants below until edited.
  confirmSubject: null,
  confirmTemplate: null,
};

/* Sessions list — seeds the `sessions` table. */
export const SEED_SESSIONS = [
  // ── Wednesday, October 14 ──
  { id: "w1", day: "d1", start: "14:00", end: "15:00", title: "Doors Open & Check-in", speaker: "", location: "The William Vale — Lobby", track: "Social", capacity: 0, desc: "Badge pickup and a soft landing in Williamsburg." },
  { id: "w2", day: "d1", start: "15:00", end: "17:00", title: "AGM Private Session", speaker: "", location: "Franklin Room", track: "AGM", capacity: 40, accessCode: "AGM2026", desc: "Closed session for limited partners and the investment team. Registration requires an access code from your invitation." },
  { id: "w3", day: "d1", start: "17:00", end: "18:00", title: "AGM Public Session", speaker: "", location: "Vale Ballroom", track: "AGM", capacity: 75, desc: "The AGM opens up to the full community for a headline conversation. Programming to be announced." },
  { id: "w4", day: "d1", start: "18:00", end: "20:00", title: "Founders Week + AGM Opening Reception", speaker: "", location: "Westlight Semi-Private Terrace", track: "Social", capacity: 0, desc: "Heavy hors d'oeuvres, drinks, and the whole community on one terrace at golden hour. Dinner afterward is on your own — see the Good Eats guide for our neighborhood picks." },
  { id: "w5", day: "d1", start: "20:00", end: "21:30", title: "Pitch Roast Live", speaker: "Hosted by a special guest comedian", location: "Vale Ballroom", track: "Social", capacity: 75, desc: "Founders pitch, the room reacts, a comedian keeps score. Comedy-club bar food at the show — burgers, wings, that kind of thing." },
  { id: "w6", day: "d1", start: "20:00", end: "21:30", title: "Dinner On Your Own", speaker: "", location: "Williamsburg — see the Good Eats guide", track: "Social", capacity: 0, cta: "Let us know", ctaDone: "✓ Noted — enjoy!", desc: "Let us know if you're headed out into the world — tap below so we have a count, then drop your plans in Slack and find your dinner crew. Leuca is downstairs and our full list of picks is in the Good Eats tab." },
  // ── Thursday, October 15 ──
  { id: "t1", day: "d2", start: "07:00", end: "08:00", title: "Sunrise Yoga", speaker: "", location: "Westlight Semi-Private Terrace", track: "Social", capacity: 20, desc: "Start the day on the terrace. Space is limited — register early." },
  { id: "t2", day: "d2", start: "07:00", end: "09:00", title: "Breakfast", speaker: "", location: "The Foyer", track: "Social", capacity: 0, desc: "Open seating, rolling arrival." },
  { id: "t3", day: "d2", start: "09:00", end: "09:45", title: "Opening Fireside", speaker: "Speaker to be announced", location: "Vale Ballroom", track: "Founders", capacity: 0, desc: "Kicking off the full FFW day on the main stage." },
  { id: "t4", day: "d2", start: "09:45", end: "10:20", title: "Brand in the Age of AI: Founder Voice & Competitive Edge for B2B", speaker: "", location: "Vale Ballroom", track: "Founders", capacity: 0, desc: "When AI commoditizes features overnight, brand, founder voice, and a sharp point of view become the durable edge." },
  { id: "t5", day: "d2", start: "10:20", end: "11:00", title: "Enterprise GTM: Building a Repeatable Revenue Engine", speaker: "", location: "Vale Ballroom", track: "Founders", capacity: 0, desc: "Founders and enterprise leaders on moving past founder-led selling to repeatable revenue." },
  { id: "t6", day: "d2", start: "11:00", end: "12:00", title: "Breakout — Physical & Frontier AI: Robotics, Hard Tech & the Real World", speaker: "", location: "Franklin East", track: "Founders", capacity: 40, desc: "Deep-dive room for applied AI in the physical world and at the scientific frontier." },
  { id: "t7", day: "d2", start: "11:00", end: "12:00", title: "Breakout — Building in Verticals: Health, Fintech, Legal & More", speaker: "", location: "Franklin West", track: "Founders", capacity: 40, desc: "For founders going deep in one industry." },
  { id: "t8", day: "d2", start: "12:00", end: "13:30", title: "Lunch Talk: AI, Humanity & Society", speaker: "Big-ideas voice to be announced", location: "The Foyer & The Salon", track: "Founders", capacity: 0, desc: "Lunch is served while a big-ideas voice zooms out on where this is all going." },
  { id: "t9", day: "d2", start: "13:30", end: "14:10", title: "The Talent Game: Positioning, Comp & Hiring Brilliant People", speaker: "", location: "Vale Ballroom", track: "Founders", capacity: 0, desc: "How an early-stage startup wins smart people in any role — positioning the mission, structuring comp, and competing with big-lab offers." },
  { id: "t10", day: "d2", start: "14:10", end: "14:50", title: "Agent-to-Agent: The Future of Agentic Interactions", speaker: "", location: "Vale Ballroom", track: "Founders", capacity: 0, desc: "A forward-looking panel on agents transacting and coordinating with other agents — protocols, authorization, and the emerging agentic economy." },
  { id: "t11", day: "d2", start: "15:00", end: "16:00", title: "Breakout — Open Source & Open Weight: Distribution as a Moat", speaker: "", location: "Franklin East", track: "Founders", capacity: 40, desc: "Open-source and open-weight strategy: distribution, community, and commercialization." },
  { id: "t12", day: "d2", start: "15:00", end: "16:00", title: "Breakout — Your Company's AI Brain: Context as the Edge", speaker: "", location: "Franklin West", track: "Founders", capacity: 40, desc: "How a company ingests and organizes its own context — docs, data, knowledge, code — so AI can actually inform decisions." },
  { id: "t13", day: "d2", start: "15:00", end: "16:00", title: "Velocity & the Scale of Ambition", speaker: "", location: "Vale Ballroom", track: "Founders", capacity: 0, desc: "Building big, fast, and thinking differently about growth when AI compresses timelines. (Swing session — placement may shift.)" },
  { id: "t14", day: "d2", start: "16:00", end: "16:40", title: "Build the Harness or Bet on the Labs? Owning the Agent Stack", speaker: "", location: "Vale Ballroom", track: "Founders", capacity: 0, desc: "Build your own agent harness, stand on a framework, or assume the labs will give it away? Opposing camps, seated across from each other." },
  { id: "t15", day: "d2", start: "16:40", end: "17:15", title: "Closing Fireside: Leadership & Culture", speaker: "Speaker to be announced", location: "Vale Ballroom", track: "Founders", capacity: 0, desc: "Closing the main-stage day on leadership and culture." },
  { id: "t16", day: "d2", start: "17:15", end: "19:00", title: "Open Space Founder Connections", speaker: "", location: "Lobby, Foyer & Lounge Areas", track: "Founders", capacity: 0, desc: "Unstructured time to find your people." },
  { id: "t17", day: "d2", start: "19:00", end: "22:00", title: "Founder Connections (Offsite)", speaker: "", location: "Brooklyn Bowl · Brooklyn Brewery · Bar Crawl · Vital Climbing", track: "Social", capacity: 0, desc: "Pick your crew and your adventure around Williamsburg." },
  // ── Friday, October 16 — Capital Summit ──
  { id: "f1", day: "d3", start: "07:00", end: "08:00", title: "McCarren Park Run", speaker: "", location: "McCarren Park (offsite)", track: "Social", capacity: 0, desc: "Easy pace, all levels. Meet in the lobby at 6:50." },
  { id: "f2", day: "d3", start: "07:00", end: "10:00", title: "Breakfast", speaker: "", location: "The Foyer", track: "Social", capacity: 0, desc: "Open seating, rolling arrival." },
  { id: "f4", day: "d3", start: "10:00", end: "10:55", title: "The Fundraising Landscape: State of Venture in the AI Age", speaker: "", location: "Vale Ballroom", track: "Capital", capacity: 0, desc: "Marquee Series A investors on what's getting funded now." },
  { id: "f5", day: "d3", start: "11:00", end: "11:55", title: "Fundraising Workshop: Seed to Series A", speaker: "Led by Flybridge", location: "Vale Ballroom", track: "Capital", capacity: 0, desc: "Founder-practical: metrics, narrative, and running the raise, with founders who just did it." },
  { id: "f3", day: "d3", start: "12:00", end: "13:00", title: "M&A: Exits in the AI Era", speaker: "", location: "Vale Ballroom", track: "Capital", capacity: 0, desc: "Acquisitions, secondaries, and liquidity when the market is moving fast — founders who've just done deals, plus the banker and lawyer view. Program wraps at 1:00 PM." },
];

export const DEFAULT_SUBJECT =
  "You're registered — Flybridge Founders Week & AGM (Oct 14–16)";

/* Links use a simple [label](url) syntax — the mailer turns them into
   real hyperlinks in the HTML email and "label (url)" in plain text. */
export const DEFAULT_TEMPLATE = `Hi {firstName},

You're confirmed for Flybridge Founders Week & AGM, October 14–16 at The William Vale in Williamsburg, Brooklyn.

You're registered for:
{days}

Your sessions so far:
{sessions}

{hotelNote}

Join the community: [{slackChannel}]({slackUrl}) is where attendees are connecting before the event, coordinating dinner crews, and getting real-time updates.

You can update your schedule anytime — just [open the event app]({appUrl}) and tap "Find my registration."

See you in Brooklyn,
The Flybridge Team`;
