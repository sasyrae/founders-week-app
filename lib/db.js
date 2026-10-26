import { randomUUID } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { DEFAULT_CONFIG, SEED_SESSIONS } from "./constants";
import { cleanTags } from "./tags";
import { publicHandle } from "./auth";
import { buildShortlist, explainPair } from "./score";

/* ─────────────────────────────────────────────────────────────
   Server-only data access. Uses the Supabase SERVICE ROLE key,
   which bypasses Row Level Security — so this module must NEVER be
   imported into a client component. Every table has RLS enabled
   with no policies, so the anon key can't touch data directly;
   all access flows through the API routes that use this module.
   ───────────────────────────────────────────────────────────── */

let _client = null;
function db() {
  if (_client) return _client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase env vars missing. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
  }
  _client = createClient(url, key, { auth: { persistSession: false } });
  return _client;
}

/* ── session row <-> JS object mapping ─────────────────────────
   DB uses snake_case / non-reserved column names; the app uses the
   prototype's object shape. accessCode is server-only. */
export function rowToSession(r) {
  const s = {
    id: r.id,
    day: r.day,
    start: r.start_time,
    end: r.end_time,
    title: r.title,
    speaker: r.speaker || "",
    location: r.location || "",
    track: r.track || "",
    capacity: r.capacity ?? 0,
    desc: r.description || "",
    speakerIds: Array.isArray(r.speaker_ids) ? r.speaker_ids : [],
  };
  if (r.access_code) s.accessCode = r.access_code;
  if (r.cta) s.cta = r.cta;
  if (r.cta_done) s.ctaDone = r.cta_done;
  return s;
}

function sessionToRow(s, sortOrder) {
  return {
    id: s.id,
    day: s.day,
    start_time: s.start,
    end_time: s.end,
    title: s.title,
    speaker: s.speaker || "",
    location: s.location || "",
    track: s.track || "",
    capacity: Number(s.capacity) || 0,
    access_code: s.accessCode ? String(s.accessCode) : null,
    cta: s.cta || null,
    cta_done: s.ctaDone || null,
    description: s.desc || "",
    sort_order: sortOrder ?? 0,
    speaker_ids: Array.isArray(s.speakerIds) ? s.speakerIds : [],
  };
}

/* Strip the access code before anything is sent to the browser. */
export function publicSession(s) {
  const { accessCode, ...rest } = s;
  return { ...rest, gated: !!accessCode };
}

/* ── seeding ───────────────────────────────────────────────────
   Idempotent first-run seed: if there's no config row yet, insert the
   default event config AND the default sessions from constants. Once
   seeded, never runs again, so admin edits/deletes are preserved. */
export async function ensureSeeded() {
  const { data, error } = await db().from("config").select("id").eq("id", 1).maybeSingle();
  if (error) throw error;
  if (data) return false; // already seeded
  await saveConfig({ ...DEFAULT_CONFIG });
  const rows = SEED_SESSIONS.map((s, i) => sessionToRow(s, i));
  const { error: sErr } = await db().from("sessions").upsert(rows);
  if (sErr) throw sErr;
  return true;
}

/* ── config ────────────────────────────────────────────────── */
export async function getConfig() {
  const { data, error } = await db().from("config").select("data").eq("id", 1).maybeSingle();
  if (error) throw error;
  return data?.data || { ...DEFAULT_CONFIG };
}

export async function saveConfig(cfg) {
  const { error } = await db().from("config").upsert({ id: 1, data: cfg });
  if (error) throw error;
  return true;
}

/* ── sessions ──────────────────────────────────────────────── */
export async function getSessions() {
  const { data, error } = await db()
    .from("sessions")
    .select("*")
    .order("day", { ascending: true })
    .order("start_time", { ascending: true });
  if (error) throw error;
  return (data || []).map(rowToSession);
}

export async function getSessionById(id) {
  const { data, error } = await db().from("sessions").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? rowToSession(data) : null;
}

/* Replace the entire sessions list (used by the admin editor). */
export async function replaceSessions(sessions) {
  const client = db();
  const rows = sessions.map((s, i) => sessionToRow(s, i));
  const keepIds = new Set(rows.map((r) => r.id));

  // Which existing rows should be removed?
  const { data: current, error: curErr } = await client.from("sessions").select("id");
  if (curErr) throw curErr;
  const toDelete = (current || []).map((r) => r.id).filter((id) => !keepIds.has(id));

  if (rows.length) {
    const { error: upErr } = await client.from("sessions").upsert(rows);
    if (upErr) throw upErr;
  }
  if (toDelete.length) {
    const { error: delErr } = await client.from("sessions").delete().in("id", toDelete);
    if (delErr) throw delErr;
  }
  return true;
}

/* Count how many attendees are registered for a session (hard cap). */
export async function countSessionRegistrations(sid) {
  const { data, error } = await db().from("attendees").select("data");
  if (error) throw error;
  return (data || []).filter((r) => (r.data?.sessions || []).includes(sid)).length;
}

/* Registration counts for every session, keyed by id — for showing the
   "N seats / full" state on the public agenda. */
export async function getSessionCounts() {
  const { data, error } = await db().from("attendees").select("data");
  if (error) throw error;
  const counts = {};
  for (const r of data || []) {
    for (const sid of r.data?.sessions || []) counts[sid] = (counts[sid] || 0) + 1;
  }
  return counts;
}

/* ── attendees ─────────────────────────────────────────────── */
export async function getAttendee(email) {
  const key = (email || "").trim().toLowerCase();
  const { data, error } = await db().from("attendees").select("data").eq("email", key).maybeSingle();
  if (error) throw error;
  return data?.data || null;
}

export async function upsertAttendee(att) {
  const email = (att.email || "").trim().toLowerCase();
  const record = { ...att, email };
  const { error } = await db().from("attendees").upsert({ email, data: record });
  if (error) throw error;
  return record;
}

export async function deleteAttendee(email) {
  const key = (email || "").trim().toLowerCase();
  const { error } = await db().from("attendees").delete().eq("email", key);
  if (error) throw error;
  return true;
}

export async function listAttendees() {
  const { data, error } = await db().from("attendees").select("data");
  if (error) throw error;
  const out = (data || []).map((r) => r.data).filter(Boolean);
  out.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  return out;
}

/* ── feedback (anonymous: overall event + per-session) ───────── */
export async function addFeedback({ kind, sessionId, rating, data }) {
  const row = {
    id: randomUUID(),
    kind: kind === "session" ? "session" : "event",
    session_id: sessionId ? String(sessionId) : null,
    rating: Number.isFinite(rating) ? rating : null,
    data: data && typeof data === "object" ? data : {},
    ts: new Date().toISOString(),
  };
  const { error } = await db().from("feedback").insert(row);
  if (error) throw error;
  return { id: row.id };
}

export async function getFeedbackRows() {
  const { data, error } = await db().from("feedback").select("*").order("ts", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getFeedbackSummary() {
  const rows = await getFeedbackRows();
  const avg = (a) => (a.length ? Math.round((a.reduce((s, x) => s + x, 0) / a.length) * 10) / 10 : null);
  const event = rows.filter((r) => r.kind === "event").map((r) => ({ ...r.data, ts: r.ts }));
  const overalls = event.map((e) => Number(e.overall)).filter((n) => n >= 1 && n <= 5);
  const nps = event.map((e) => Number(e.nps)).filter((n) => n >= 0 && n <= 10);
  const npsScore = nps.length
    ? Math.round(((nps.filter((n) => n >= 9).length - nps.filter((n) => n <= 6).length) / nps.length) * 100)
    : null;
  const usedYes = event.filter((e) => e.usedMeet === "yes").length;
  const usedTotal = event.filter((e) => e.usedMeet === "yes" || e.usedMeet === "no").length;

  const sess = {};
  for (const r of rows.filter((r) => r.kind === "session" && r.session_id)) {
    const v = (sess[r.session_id] = sess[r.session_id] || { ratings: [], comments: [] });
    if (Number.isFinite(r.rating)) v.ratings.push(r.rating);
    if (r.data && r.data.comment) v.comments.push(r.data.comment);
  }
  const perSession = Object.entries(sess)
    .map(([sessionId, v]) => ({ sessionId, count: v.ratings.length, avg: avg(v.ratings), comments: v.comments }))
    .sort((a, b) => (b.avg || 0) - (a.avg || 0));

  return {
    eventCount: event.length,
    overallAvg: avg(overalls),
    nps: npsScore,
    npsCount: nps.length,
    usedMeetYes: usedYes,
    usedMeetTotal: usedTotal,
    event,
    perSession,
  };
}

/* ── announcements ─────────────────────────────────────────── */
export async function getAnnouncements() {
  const { data, error } = await db()
    .from("announcements")
    .select("*")
    .order("ts", { ascending: false });
  if (error) throw error;
  return (data || []).map((r) => ({ id: r.id, text: r.text, author: r.author, ts: r.ts }));
}

export async function addAnnouncement(item) {
  const { error } = await db().from("announcements").insert({
    id: item.id,
    text: item.text,
    author: item.author,
    ts: item.ts,
  });
  if (error) throw error;
  return true;
}

export async function deleteAnnouncement(id) {
  const { error } = await db().from("announcements").delete().eq("id", id);
  if (error) throw error;
  return true;
}

/* ── speakers ──────────────────────────────────────────────── */
function rowToSpeaker(r) {
  const name = r.name || "";
  let firstName = r.first_name || "";
  let lastName = r.last_name || "";
  // Legacy rows (or bulk name-only) — split the full name.
  if (!firstName && !lastName && name) {
    const parts = name.split(/\s+/).filter(Boolean);
    firstName = parts[0] || "";
    lastName = parts.slice(1).join(" ");
  }
  return {
    id: r.id,
    name: name || `${firstName} ${lastName}`.trim(),
    firstName,
    lastName,
    title: r.title || "",
    company: r.company || "",
    bio: r.bio || "",
    photoUrl: r.photo_url || null,
    link: r.link || "",
    email: r.email || "",
    published: !!r.published,
    sortOrder: r.sort_order ?? 0,
  };
}

function speakerToRow(s) {
  const firstName = (s.firstName ?? "").trim();
  const lastName = (s.lastName ?? "").trim();
  // Full name is derived from first/last when given; else use provided name.
  const name = firstName || lastName ? `${firstName} ${lastName}`.trim() : (s.name || "").trim();
  const row = {
    id: s.id,
    name,
    first_name: firstName,
    last_name: lastName,
    title: s.title || "",
    company: s.company || "",
    bio: s.bio || "",
    link: s.link || "",
    email: s.email || "",
    published: !!s.published,
  };
  // photo_url is intentionally NOT written here — it is managed solely by
  // the photo-upload endpoints. That way a text edit or a Publish toggle
  // (which sends back a possibly-stale photoUrl) can never wipe the photo.
  if (s.sortOrder !== undefined) row.sort_order = s.sortOrder;
  return row;
}

/* Speaker fields are all public info for a lineup — nothing to strip. */
export function publicSpeaker(s) {
  return s;
}

export async function getSpeakers({ publishedOnly = false } = {}) {
  let q = db()
    .from("speakers")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (publishedOnly) q = q.eq("published", true);
  const { data, error } = await q;
  if (error) throw error;
  return (data || []).map(rowToSpeaker);
}

export async function getSpeakerById(id) {
  const { data, error } = await db().from("speakers").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? rowToSpeaker(data) : null;
}

export async function upsertSpeaker(sp) {
  const { error } = await db().from("speakers").upsert(speakerToRow(sp));
  if (error) throw error;
  return getSpeakerById(sp.id);
}

export async function bulkCreateSpeakers(list) {
  const rows = list.map((s, i) => speakerToRow({ ...s, sortOrder: s.sortOrder ?? i }));
  const { error } = await db().from("speakers").upsert(rows);
  if (error) throw error;
  return true;
}

export async function deleteSpeaker(id) {
  const { error } = await db().from("speakers").delete().eq("id", id);
  if (error) throw error;
  return true;
}

export async function reorderSpeakers(ids) {
  const client = db();
  for (let i = 0; i < ids.length; i++) {
    const { error } = await client.from("speakers").update({ sort_order: i }).eq("id", ids[i]);
    if (error) throw error;
  }
  return true;
}

/* Update only the fields a speaker may edit about themselves. Never
   touches name, published, email, or sort order. */
export async function updateSpeakerSelf(id, fields) {
  const patch = {
    title: (fields.title || "").trim(),
    company: (fields.company || "").trim(),
    bio: (fields.bio || "").trim(),
    link: (fields.link || "").trim(),
  };
  const { error } = await db().from("speakers").update(patch).eq("id", id);
  if (error) throw error;
  return getSpeakerById(id);
}

/* Sessions a speaker is attached to — for the read-only "you're speaking
   at" list on their self-service page. */
export async function getSessionsForSpeaker(id) {
  const sessions = await getSessions();
  return sessions
    .filter((s) => (s.speakerIds || []).includes(id))
    .map((s) => ({ id: s.id, title: s.title, day: s.day, start: s.start }));
}

/* ── speaker photos (Supabase Storage) ─────────────────────────
   Uploaded through the app (capped at 4MB, under the serverless limit).
   Stored as-is — that original doubles as the print asset — while the
   app displays an auto-optimized thumbnail (next/image), so the Speakers
   grid stays fast even with near-4MB source photos. */
const SPEAKER_BUCKET = "speaker-photos";
const SPEAKER_BUCKET_OPTS = {
  public: true,
  fileSizeLimit: "5MB", // a hair above the 4MB app cap, for headroom
  allowedMimeTypes: ["image/png", "image/jpeg", "image/webp", "image/gif", "image/heic"],
};

async function ensureSpeakerBucket() {
  const client = db();
  const { data } = await client.storage.getBucket(SPEAKER_BUCKET);
  if (data) {
    await client.storage.updateBucket(SPEAKER_BUCKET, SPEAKER_BUCKET_OPTS).catch(() => {});
    return;
  }
  await client.storage.createBucket(SPEAKER_BUCKET, SPEAKER_BUCKET_OPTS);
}

/* ── matchmaking ("Meet people") ──────────────────────────────
   Profiles live on the existing email-keyed attendee record, so no
   schema change: `data.roster` (authoritative identity from the
   imported roster), `data.matchDraft` (PRIVATE enrichment pre-fill —
   only ever returned to its owner or an admin), and `data.matchProfile`
   (the attendee's approved, opt-in profile). Registration fields on the
   same record are never touched. */
function normEmail(email) {
  return String(email || "").trim().toLowerCase();
}

/* Admin import: upsert roster people + seed private drafts from the
   enrichment map. Merges into any existing record (keeps registration,
   never clobbers an already-approved profile's draft). */
export async function importRoster(roster, enrichment) {
  const client = db();
  const enr = enrichment && typeof enrichment === "object" ? enrichment : {};
  const { data: existingRows, error } = await client.from("attendees").select("email,data");
  if (error) throw error;
  const map = new Map((existingRows || []).map((r) => [r.email, r.data || {}]));

  const rows = [];
  let drafted = 0;
  for (const p of Array.isArray(roster) ? roster : []) {
    const email = normEmail(p.email);
    if (!email.includes("@")) continue;
    const prev = map.get(email) || { email };
    const data = {
      ...prev,
      email,
      roster: {
        firstName: String(p.first_name || "").trim(),
        lastName: String(p.last_name || "").trim(),
        company: String(p.company || "").trim(),
        attendeeType: String(p.attendee_type || "").trim(),
        fund: String(p.fund || "").trim(),
        days: String(p.days || "").trim(),
      },
    };
    // Seed the private draft only when they haven't approved a profile yet.
    const e = enr[email] || enr[p.email] || {};
    if (e.linkedin) data.linkedin = cleanLinkedin(e.linkedin); // pre-filled contact, shared only on accept
    const hasDraft =
      (e.working_on && e.working_on.trim()) ||
      (Array.isArray(e.suggested_looking_for) && e.suggested_looking_for.length) ||
      (Array.isArray(e.suggested_can_help_with) && e.suggested_can_help_with.length);
    if (!prev.matchProfile && hasDraft) {
      data.matchDraft = {
        workingOn: String(e.working_on || "").trim().slice(0, 600),
        lookingFor: cleanTags(e.suggested_looking_for),
        canHelpWith: cleanTags(e.suggested_can_help_with),
      };
      drafted++;
    }
    rows.push({ email, data });
  }

  for (let i = 0; i < rows.length; i += 200) {
    const { error: upErr } = await client.from("attendees").upsert(rows.slice(i, i + 200));
    if (upErr) throw upErr;
  }
  return { imported: rows.length, drafted };
}

/* The signed-in attendee's own identity + profile + private draft. */
export async function getMatchMe(email) {
  const rec = await getAttendee(email);
  if (!rec) return null;
  const roster = rec.roster || {};
  const nameParts = String(rec.name || "").trim().split(/\s+/);
  const identity = {
    email: normEmail(email),
    firstName: roster.firstName || rec.firstName || nameParts[0] || "",
    lastName: roster.lastName || rec.lastName || nameParts.slice(1).join(" ") || "",
    company: roster.company || rec.company || "",
    attendeeType: roster.attendeeType || rec.type || "",
    fund: roster.fund || "",
    days: roster.days || "",
  };
  return {
    identity,
    profile: rec.matchProfile || null,
    draft: rec.matchDraft || { workingOn: "", lookingFor: [], canHelpWith: [] },
    linkedin: (rec.matchProfile && rec.matchProfile.linkedin) || rec.linkedin || "",
  };
}

/* Save (and opt in / out) the attendee's own profile. */
export async function saveMatchProfile(email, fields) {
  const rec = await getAttendee(email);
  if (!rec) throw new Error("We couldn't find your registration for that email.");
  const now = new Date().toISOString();
  const prev = rec.matchProfile || {};
  const optedIn = !!fields.optedIn;
  const profile = {
    workingOn: String(fields.workingOn || "").trim().slice(0, 600),
    lookingFor: cleanTags(fields.lookingFor),
    canHelpWith: cleanTags(fields.canHelpWith),
    linkedin: cleanLinkedin(fields.linkedin),
    optedIn,
    approvedAt: optedIn ? prev.approvedAt || now : null,
    updatedAt: now,
  };
  await upsertAttendee({ ...rec, matchProfile: profile });
  return profile;
}

/* Accept a LinkedIn URL or handle; normalize to a full URL, or "" if blank. */
function cleanLinkedin(v) {
  let s = String(v || "").trim();
  if (!s) return "";
  s = s.replace(/^@/, "");
  if (/^https?:\/\//i.test(s)) return s.slice(0, 200);
  if (/^(www\.)?linkedin\.com\//i.test(s)) return "https://" + s.slice(0, 200);
  return "https://www.linkedin.com/in/" + s.replace(/^\/+/, "").slice(0, 150);
}

/* Everyone who has approved + opted in — the pool for scoring and the
   directory. Returns approved fields only (never drafts). */
export async function getOptedInProfiles() {
  const { data, error } = await db().from("attendees").select("data");
  if (error) throw error;
  const out = [];
  for (const row of data || []) {
    const rec = row.data;
    const mp = rec?.matchProfile;
    if (!mp || !mp.optedIn) continue;
    const roster = rec.roster || {};
    const nameParts = String(rec.name || "").trim().split(/\s+/);
    out.push({
      email: rec.email,
      firstName: roster.firstName || rec.firstName || nameParts[0] || "",
      lastName: roster.lastName || rec.lastName || nameParts.slice(1).join(" ") || "",
      company: roster.company || rec.company || "",
      attendeeType: roster.attendeeType || rec.type || "",
      workingOn: mp.workingOn || "",
      lookingFor: mp.lookingFor || [],
      canHelpWith: mp.canHelpWith || [],
      linkedin: mp.linkedin || rec.linkedin || "",
      isTest: !!rec.test,
    });
  }
  return out;
}

/* Persist a person's precomputed matches (never computed on page view). */
export async function saveMatches(email, items) {
  const rec = await getAttendee(email);
  if (!rec) return;
  await upsertAttendee({ ...rec, matches: { computedAt: new Date().toISOString(), items } });
}

/* My cached matches, resolved to display cards against the CURRENT opted-in
   pool — so anyone who has since opted out silently drops off. Includes the
   match's own tags and my request status with them; contact details are
   included ONLY once a request between us has been accepted (double opt-in). */
export async function getMatchesResolved(email) {
  const rec = await getAttendee(email);
  if (!rec) return { computedAt: null, items: [] };
  const stored = rec.matches;
  const storedItems = Array.isArray(stored?.items) ? stored.items : [];
  const profiles = await getOptedInProfiles();
  const byEmail = new Map(profiles.map((p) => [p.email, p]));
  // My request state keyed by the other person's email (either direction).
  const reqByEmail = requestStateByCounterpart(rec, email);
  const curatedEmails = new Set((rec?.curatedIntros || []).map((c) => c.withEmail));

  const cardFor = (p, extra) => {
    const state = reqByEmail.get(p.email);
    return {
      handle: publicHandle(p.email),
      name: [p.firstName, p.lastName].filter(Boolean).join(" "),
      company: p.company,
      type: p.attendeeType,
      workingOn: p.workingOn,
      lookingFor: p.lookingFor || [],
      canHelpWith: p.canHelpWith || [],
      requestStatus: state ? state.status : null, // null | pending | accepted | declined
      requestDir: state ? state.dir : null, // "sent" | "received"
      contact: state && state.status === "accepted" ? { email: p.email, linkedin: p.linkedin || "" } : null,
      ...extra,
    };
  };

  // Admin-curated intros lead, flagged, and de-duped against normal matches.
  const curated = [];
  for (const c of rec?.curatedIntros || []) {
    const p = byEmail.get(c.withEmail);
    if (!p || p.email === email) continue;
    curated.push(cardFor(p, { id: c.id, reason: c.reason || "", curated: true }));
  }

  // Live tag shortlist against whoever is CURRENTLY opted in, so matches are
  // fresh the moment new people opt in (no admin recompute needed). We reuse
  // any AI-written reason from the last recompute; otherwise a deterministic
  // tag-based reason. This computes a cheap shortlist but never calls the API.
  const items = [];
  const myProfile = byEmail.get(normEmail(email));
  if (myProfile) {
    const cachedReason = new Map(storedItems.map((it) => [it.email, it.reason]));
    const others = profiles.filter((p) => p.email !== myProfile.email);
    for (const s of buildShortlist(myProfile, others, 6)) {
      if (curatedEmails.has(s.email)) continue;
      const p = byEmail.get(s.email);
      const reason = cachedReason.get(s.email) || explainPair(myProfile, p);
      items.push(cardFor(p, { id: publicHandle(p.email), reason, curated: false }));
    }
  }
  return { computedAt: stored?.computedAt || null, items: [...curated, ...items] };
}

/* Build a map: other-person email → {status, dir} from my stored requests. */
function requestStateByCounterpart(rec, email) {
  const m = new Map();
  for (const r of rec?.sentRequests || []) m.set(r.to, { status: r.status, dir: "sent" });
  for (const r of rec?.receivedRequests || []) {
    // A received (incoming) request takes precedence for display context.
    m.set(r.from, { status: r.status, dir: "received" });
  }
  return m;
}

/* The full opted-in directory (everyone but me), each card carrying my
   request state with them. No contact details unless we've both accepted.
   Clients filter/search this list locally. */
export async function getDirectory(email) {
  const me = normEmail(email);
  const rec = await getAttendee(me);
  const reqByEmail = requestStateByCounterpart(rec, me);
  const profiles = await getOptedInProfiles();
  const people = [];
  for (const p of profiles) {
    if (p.email === me) continue;
    const state = reqByEmail.get(p.email);
    people.push({
      handle: publicHandle(p.email),
      name: [p.firstName, p.lastName].filter(Boolean).join(" "),
      company: p.company,
      type: p.attendeeType,
      workingOn: p.workingOn,
      lookingFor: p.lookingFor || [],
      canHelpWith: p.canHelpWith || [],
      requestStatus: state ? state.status : null,
      requestDir: state ? state.dir : null,
      contact: state && state.status === "accepted" ? { email: p.email, linkedin: p.linkedin || "" } : null,
    });
  }
  people.sort((a, b) => a.name.localeCompare(b.name));
  return { people };
}

/* Resolve a public handle back to an email (opted-in people only). */
export async function emailForHandle(handle) {
  if (!handle) return null;
  const profiles = await getOptedInProfiles();
  for (const p of profiles) if (publicHandle(p.email) === handle) return p.email;
  return null;
}

function displayName(rec) {
  const ro = rec.roster || {};
  const np = String(rec.name || "").trim().split(/\s+/);
  return [ro.firstName || rec.firstName || np[0] || "", ro.lastName || rec.lastName || np.slice(1).join(" ") || ""]
    .filter(Boolean)
    .join(" ");
}

/* Admin dashboard: opt-in rate, who has no matches, all meeting requests,
   the opted-in people (for the intro picker), and existing curated intros. */
export async function getMatchAdminOverview() {
  const { data, error } = await db().from("attendees").select("data");
  if (error) throw error;
  const recs = (data || []).map((r) => r.data).filter(Boolean);
  let rosterCount = 0;
  let optedInCount = 0;
  const optedInPeople = [];
  const noMatch = [];
  const requestsMap = new Map();
  const curatedMap = new Map();
  for (const rec of recs) {
    if (rec.roster) rosterCount++;
    const nm = displayName(rec);
    const mp = rec.matchProfile;
    if (mp && mp.optedIn) {
      optedInCount++;
      optedInPeople.push({ email: rec.email, name: nm, type: (rec.roster && rec.roster.attendeeType) || rec.type || "" });
      const cnt = ((rec.matches && rec.matches.items) || []).length + ((rec.curatedIntros) || []).length;
      if (cnt === 0) noMatch.push(nm || rec.email);
    }
    for (const r of rec.sentRequests || []) {
      requestsMap.set(r.id, { from: r.fromName, to: r.toName, status: r.status, createdAt: r.createdAt });
    }
    for (const c of rec.curatedIntros || []) {
      if (!curatedMap.has(c.id)) curatedMap.set(c.id, { id: c.id, reason: c.reason, createdAt: c.createdAt, a: nm, b: c.withName });
    }
  }
  optedInPeople.sort((a, b) => a.name.localeCompare(b.name));
  noMatch.sort((a, b) => a.localeCompare(b));
  const requests = [...requestsMap.values()].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  const curatedIntros = [...curatedMap.values()].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  return {
    rosterCount,
    optedInCount,
    optInRate: rosterCount ? Math.round((optedInCount / rosterCount) * 100) : 0,
    noMatch,
    optedInPeople,
    requests,
    curatedIntros,
  };
}

/* Recipients for a reminder send. segment "pending" = not opted in (nudge to
   join); "opted" = already opted in (new-matches re-engagement). Excludes
   test profiles and records without a usable email. */
export async function getNudgeTargets(segment) {
  const { data, error } = await db().from("attendees").select("data");
  if (error) throw error;
  const out = [];
  for (const row of data || []) {
    const rec = row.data;
    if (!rec || rec.test || !rec.email || !rec.email.includes("@")) continue;
    const opted = !!(rec.matchProfile && rec.matchProfile.optedIn);
    if (segment === "opted" ? !opted : opted) continue;
    out.push({ email: rec.email, name: displayName(rec), nudgedAt: rec.matchNudgedAt || null });
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

export async function markNudged(email) {
  const rec = await getAttendee(email);
  if (!rec) return;
  await upsertAttendee({ ...rec, matchNudgedAt: new Date().toISOString() });
}

/* Create (or replace) an admin-curated intro between two attendees. Stored on
   both records so each sees it as a "Flybridge thinks you two should meet". */
export async function createCuratedIntro(aEmail, bEmail, reason) {
  const a = normEmail(aEmail);
  const b = normEmail(bEmail);
  if (!a.includes("@") || !b.includes("@") || a === b) throw new Error("Pick two different people.");
  const rsn = String(reason || "").trim().slice(0, 400);
  if (!rsn) throw new Error("Add a reason for the intro.");
  const [ra, rb] = await Promise.all([getAttendee(a), getAttendee(b)]);
  if (!ra || !rb) throw new Error("Both people need a profile first.");
  const entry = (rec, otherEmail) => ({
    withEmail: otherEmail,
    withName: displayName(rec),
    withType: (rec.roster && rec.roster.attendeeType) || rec.type || "",
    withCompany: (rec.roster && rec.roster.company) || rec.company || "",
  });
  const id = randomUUID();
  const now = new Date().toISOString();
  const aList = (ra.curatedIntros || []).filter((c) => c.withEmail !== b);
  const bList = (rb.curatedIntros || []).filter((c) => c.withEmail !== a);
  aList.push({ id, reason: rsn, createdAt: now, ...entry(rb, b) });
  bList.push({ id, reason: rsn, createdAt: now, ...entry(ra, a) });
  await upsertAttendee({ ...ra, curatedIntros: aList });
  await upsertAttendee({ ...rb, curatedIntros: bList });
  return { id };
}

export async function removeCuratedIntro(id) {
  const { data, error } = await db().from("attendees").select("data");
  if (error) throw error;
  for (const row of data || []) {
    const rec = row.data;
    if (rec?.curatedIntros?.some((c) => c.id === id)) {
      await upsertAttendee({ ...rec, curatedIntros: rec.curatedIntros.filter((c) => c.id !== id) });
    }
  }
  return { removed: true };
}

/* Bulk-create curated intros from [{ a, b, reason }] where a/b are attendee
   NAMES. Resolves each name to a record; skips (and reports) names that don't
   match exactly one person. Both people just need a record — they don't have
   to be opted in yet (the intro surfaces once they are). */
export async function createCuratedIntrosBulk(items) {
  const { data, error } = await db().from("attendees").select("email,data");
  if (error) throw error;
  const nameMap = new Map(); // lowercased name -> Set(emails)
  const addName = (nm, email) => {
    const k = String(nm || "").trim().toLowerCase();
    if (!k) return;
    if (!nameMap.has(k)) nameMap.set(k, new Set());
    nameMap.get(k).add(email);
  };
  for (const row of data || []) {
    const rec = row.data;
    if (!rec) continue;
    const ro = rec.roster || {};
    const full = `${ro.firstName || rec.firstName || ""} ${ro.lastName || rec.lastName || ""}`.trim();
    if (full) addName(full, row.email);
    if (rec.name) addName(rec.name, row.email);
  }
  const resolve = (nm) => {
    const s = nameMap.get(String(nm || "").trim().toLowerCase());
    if (!s || s.size === 0) return { err: "not found" };
    if (s.size > 1) return { err: "ambiguous" };
    return { email: [...s][0] };
  };

  let created = 0;
  const skipped = [];
  for (const it of Array.isArray(items) ? items : []) {
    const ra = resolve(it.a);
    const rb = resolve(it.b);
    if (ra.err || rb.err) {
      skipped.push({ a: it.a, b: it.b, why: ra.err ? `${it.a}: ${ra.err}` : `${it.b}: ${rb.err}` });
      continue;
    }
    if (ra.email === rb.email) {
      skipped.push({ a: it.a, b: it.b, why: "same person" });
      continue;
    }
    if (!String(it.reason || "").trim()) {
      skipped.push({ a: it.a, b: it.b, why: "no reason" });
      continue;
    }
    try {
      await createCuratedIntro(ra.email, rb.email, it.reason);
      created++;
    } catch (e) {
      skipped.push({ a: it.a, b: it.b, why: e.message || "failed" });
    }
  }
  return { created, skipped };
}

/* ── meeting requests (double opt-in) ─────────────────────────
   A request lives as a copy on both people's records: the sender's
   `sentRequests` and the recipient's `receivedRequests`. State changes
   update both copies. Contact details are only ever surfaced once a
   request is accepted. */

function profileCardFor(p) {
  return {
    name: [p.firstName, p.lastName].filter(Boolean).join(" "),
    type: p.attendeeType || "",
    company: p.company || "",
  };
}

/* Map a match card id back to the target email, using my cached matches. */
export async function matchTargetEmail(myEmail, matchId) {
  const rec = await getAttendee(myEmail);
  const items = rec?.matches?.items || [];
  const hit = items.find((it) => it.id === matchId);
  return hit ? hit.email : null;
}

export async function createMeetRequest(fromEmail, toEmail, note) {
  const from = normEmail(fromEmail);
  const to = normEmail(toEmail);
  if (!to || from === to) throw new Error("Invalid request.");
  const [fromRec, toRec] = await Promise.all([getAttendee(from), getAttendee(to)]);
  if (!fromRec?.matchProfile?.optedIn) throw new Error("Opt in before requesting to meet.");
  if (!toRec?.matchProfile?.optedIn) throw new Error("That person isn't available to meet right now.");

  const already = (fromRec.sentRequests || []).find(
    (r) => r.to === to && (r.status === "pending" || r.status === "accepted")
  );
  if (already) return { request: already, existed: true };
  const incomingFromThem = (fromRec.receivedRequests || []).find(
    (r) => r.from === to && r.status === "pending"
  );
  if (incomingFromThem) throw new Error("They already asked to meet you — check your requests to accept.");

  const fromP = profileCardFor({
    firstName: fromRec.roster?.firstName || fromRec.firstName,
    lastName: fromRec.roster?.lastName || fromRec.lastName,
    attendeeType: fromRec.roster?.attendeeType || fromRec.type,
    company: fromRec.roster?.company || fromRec.company,
  });
  const toP = profileCardFor({
    firstName: toRec.roster?.firstName || toRec.firstName,
    lastName: toRec.roster?.lastName || toRec.lastName,
    attendeeType: toRec.roster?.attendeeType || toRec.type,
    company: toRec.roster?.company || toRec.company,
  });

  const request = {
    id: randomUUID(),
    from,
    to,
    fromName: fromP.name,
    fromType: fromP.type,
    fromCompany: fromP.company,
    toName: toP.name,
    toType: toP.type,
    toCompany: toP.company,
    note: String(note || "").trim().slice(0, 400),
    status: "pending",
    createdAt: new Date().toISOString(),
    decidedAt: null,
  };

  await upsertAttendee({ ...fromRec, sentRequests: [...(fromRec.sentRequests || []), request] });
  await upsertAttendee({ ...toRec, receivedRequests: [...(toRec.receivedRequests || []), request] });
  return { request, existed: false };
}

export async function respondMeetRequest(meEmail, requestId, action) {
  const me = normEmail(meEmail);
  const status = action === "accept" ? "accepted" : action === "decline" ? "declined" : null;
  if (!status) throw new Error("Unknown action.");
  const meRec = await getAttendee(me);
  const incoming = (meRec?.receivedRequests || []).slice();
  const idx = incoming.findIndex((r) => r.id === requestId);
  if (idx === -1) throw new Error("Request not found.");
  if (incoming[idx].status !== "pending") return { status: incoming[idx].status };

  const decidedAt = new Date().toISOString();
  incoming[idx] = { ...incoming[idx], status, decidedAt };
  await upsertAttendee({ ...meRec, receivedRequests: incoming });

  const otherEmail = incoming[idx].from;
  const otherRec = await getAttendee(otherEmail);
  if (otherRec) {
    const sent = (otherRec.sentRequests || []).map((r) =>
      r.id === requestId ? { ...r, status, decidedAt } : r
    );
    await upsertAttendee({ ...otherRec, sentRequests: sent });
  }
  return { status };
}

/* My incoming + outgoing requests, resolved for display. Contact (email +
   LinkedIn) is attached ONLY on accepted requests. */
export async function getRequestsResolved(meEmail) {
  const me = normEmail(meEmail);
  const rec = await getAttendee(me);
  if (!rec) return { incoming: [], outgoing: [], pendingIncoming: 0 };
  const profiles = await getOptedInProfiles();
  const byEmail = new Map(profiles.map((p) => [p.email, p]));

  const contactFor = (otherEmail) => {
    const p = byEmail.get(otherEmail);
    return { email: otherEmail, linkedin: p?.linkedin || "" };
  };

  // Drop requests whose counterpart is no longer an opted-in profile (opted
  // out or removed, e.g. a deleted sample) so stale connections don't linger.
  const incoming = (rec.receivedRequests || [])
    .filter((r) => byEmail.has(r.from))
    .map((r) => ({
      id: r.id,
      name: r.fromName,
      type: r.fromType,
      company: r.fromCompany,
      note: r.note || "",
      status: r.status,
      createdAt: r.createdAt,
      contact: r.status === "accepted" ? contactFor(r.from) : null,
    }));
  const outgoing = (rec.sentRequests || [])
    .filter((r) => byEmail.has(r.to))
    .map((r) => ({
      id: r.id,
      name: r.toName,
      type: r.toType,
      company: r.toCompany,
      status: r.status,
      createdAt: r.createdAt,
      contact: r.status === "accepted" ? contactFor(r.to) : null,
    }));
  const pendingIncoming = incoming.filter((r) => r.status === "pending").length;
  // Newest first.
  incoming.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  outgoing.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  return { incoming, outgoing, pendingIncoming };
}

/* ── dev/test sample profiles (clearly fake @example.com, admin-purgeable) */
const TEST_PROFILES = [
  { first: "Tessa", last: "Nguyen", company: "Ridgeline AI", type: "Founder",
    working: "Building an agent platform for ops teams.",
    looking: ["Fundraising intros", "Enterprise sales", "GTM hiring"],
    help: ["AI infrastructure and models", "Agents and agentic workflows"] },
  { first: "Marcus", last: "Bell", company: "Harbor Ventures", type: "LP",
    working: "LP investing in early-stage AI funds.",
    looking: ["Co-investment", "LP perspective"],
    help: ["Fundraising intros", "Board and governance", "Co-investment"] },
  { first: "Priya", last: "Shah", company: "Loom Health", type: "Founder",
    working: "Clinical documentation copilots for hospitals.",
    looking: ["Engineering hiring", "Enterprise sales", "Pricing"],
    help: ["Product and design", "Partnerships"] },
  { first: "Diego", last: "Ramos", company: "Northstar Growth", type: "Guest",
    working: "GTM operator, ex-Series B head of sales.",
    looking: ["Partnerships"],
    help: ["Sales and GTM strategy", "Enterprise sales", "GTM hiring", "Pricing"] },
  { first: "Ana", last: "Kowalski", company: "Field Labs", type: "Founder",
    working: "Developer tools for agentic workflows.",
    looking: ["Brand and storytelling", "Press and media", "Customer intros and design partners"],
    help: ["AI infrastructure and models", "Agents and agentic workflows"] },
  { first: "Sam", last: "Okafor", company: "Two Rivers Capital", type: "Sponsor",
    working: "Sponsor; connects founders with enterprise buyers.",
    looking: ["Co-investment"],
    help: ["Customer intros and design partners", "Enterprise sales", "International expansion"] },
];

export async function seedTestProfiles() {
  const now = new Date().toISOString();
  const rows = TEST_PROFILES.map((p) => {
    const email = `${p.first}.${p.last}@example.com`.toLowerCase();
    return {
      email,
      data: {
        email,
        test: true,
        roster: { firstName: p.first, lastName: p.last, company: p.company, attendeeType: p.type, fund: "", days: "All" },
        matchProfile: {
          workingOn: p.working,
          lookingFor: cleanTags(p.looking),
          canHelpWith: cleanTags(p.help),
          optedIn: true,
          approvedAt: now,
          updatedAt: now,
        },
      },
    };
  });
  const { error } = await db().from("attendees").upsert(rows);
  if (error) throw error;
  return { added: rows.length };
}

/* Bring speakers into the matchmaking pool: give each speaker (matched by
   email) an attendee record so they get a personal link and can opt in / be
   matched. Seeds a private draft from their speaker bio/title/company and
   their LinkedIn (if their speaker link is a LinkedIn URL). Never overwrites
   an existing roster entry or an approved profile. */
export async function syncSpeakersToMatch() {
  const client = db();
  const speakers = await getSpeakers();
  const { data: existingRows, error } = await client.from("attendees").select("email,data");
  if (error) throw error;
  const map = new Map((existingRows || []).map((r) => [r.email, r.data || {}]));

  const rows = [];
  let created = 0;
  let updated = 0;
  for (const sp of speakers) {
    const email = normEmail(sp.email);
    if (!email.includes("@")) continue;
    const prev = map.get(email);
    const workingOn = (sp.bio || [sp.title, sp.company].filter(Boolean).join(" · ") || "").trim().slice(0, 600);
    const isLinkedin = /linkedin\.com/i.test(sp.link || "");
    const roster = {
      firstName: sp.firstName || "",
      lastName: sp.lastName || "",
      company: sp.company || "",
      attendeeType: "Guest",
      fund: "",
      days: "",
    };

    if (prev) {
      const data = { ...prev, email, speaker: true };
      if (!prev.roster) data.roster = roster;
      if (!prev.matchProfile && !prev.matchDraft && workingOn) {
        data.matchDraft = { workingOn, lookingFor: [], canHelpWith: [] };
      }
      if (!prev.linkedin && isLinkedin) data.linkedin = cleanLinkedin(sp.link);
      rows.push({ email, data });
      updated++;
    } else {
      const data = { email, speaker: true, roster };
      if (workingOn) data.matchDraft = { workingOn, lookingFor: [], canHelpWith: [] };
      if (isLinkedin) data.linkedin = cleanLinkedin(sp.link);
      rows.push({ email, data });
      created++;
    }
  }
  for (let i = 0; i < rows.length; i += 200) {
    const { error: upErr } = await client.from("attendees").upsert(rows.slice(i, i + 200));
    if (upErr) throw upErr;
  }
  return { speakers: speakers.length, created, updated };
}

export async function removeTestProfiles() {
  const { data, error } = await db().from("attendees").select("email,data");
  if (error) throw error;
  const emails = (data || []).filter((r) => r.data?.test).map((r) => r.email);
  if (emails.length) {
    const { error: delErr } = await db().from("attendees").delete().in("email", emails);
    if (delErr) throw delErr;
  }
  return { removed: emails.length };
}

export async function uploadSpeakerPhoto(speakerId, bytes, contentType) {
  await ensureSpeakerBucket();
  const client = db();
  const ext = ((contentType || "image/jpeg").split("/")[1] || "jpg").replace("jpeg", "jpg");
  // Unique path per upload so a re-upload never serves a stale cached image.
  const path = `${speakerId}-${Date.now()}.${ext}`;
  const { error } = await client.storage
    .from(SPEAKER_BUCKET)
    .upload(path, bytes, { contentType, cacheControl: "3600" });
  if (error) throw error;
  const { data } = client.storage.from(SPEAKER_BUCKET).getPublicUrl(path);
  const url = data.publicUrl;
  const { error: uErr } = await client.from("speakers").update({ photo_url: url }).eq("id", speakerId);
  if (uErr) throw uErr;
  return url;
}
