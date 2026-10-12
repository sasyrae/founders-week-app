import { createClient } from "@supabase/supabase-js";
import { DEFAULT_CONFIG, SEED_SESSIONS } from "./constants";
import { cleanTags } from "./tags";

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
    optedIn,
    approvedAt: optedIn ? prev.approvedAt || now : null,
    updatedAt: now,
  };
  await upsertAttendee({ ...rec, matchProfile: profile });
  return profile;
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
   pool — so anyone who has since opted out silently drops off, and no
   contact details (email) are ever included. */
export async function getMatchesResolved(email) {
  const rec = await getAttendee(email);
  const stored = rec?.matches;
  if (!stored || !Array.isArray(stored.items)) return { computedAt: stored?.computedAt || null, items: [] };
  const profiles = await getOptedInProfiles();
  const byEmail = new Map(profiles.map((p) => [p.email, p]));
  const items = [];
  for (const it of stored.items) {
    const p = byEmail.get(it.email);
    if (!p || p.email === email) continue;
    items.push({
      id: it.id,
      name: [p.firstName, p.lastName].filter(Boolean).join(" "),
      company: p.company,
      type: p.attendeeType,
      workingOn: p.workingOn,
      reason: it.reason || "",
    });
  }
  return { computedAt: stored.computedAt, items };
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
