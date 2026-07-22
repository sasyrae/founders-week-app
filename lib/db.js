import { createClient } from "@supabase/supabase-js";
import { DEFAULT_CONFIG, SEED_SESSIONS } from "./constants";

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
