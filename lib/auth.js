import crypto from "crypto";

/* ─────────────────────────────────────────────────────────────
   Admin auth for Host tools. A single shared password (ADMIN_PASSWORD
   env var) is checked SERVER-SIDE — it never ships to the browser.
   On success we set a signed, httpOnly session cookie so the password
   isn't stored or resent by the client.
   ───────────────────────────────────────────────────────────── */

export const ADMIN_COOKIE = "fw_admin";
const MAX_AGE = 60 * 60 * 12; // 12 hours

function secret() {
  return process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD || "fw-dev-secret";
}

function b64url(buf) {
  return Buffer.from(buf).toString("base64url");
}

/* Constant-time password check against the env var. */
export function checkPassword(input) {
  const expected = process.env.ADMIN_PASSWORD || "";
  if (!expected) return false;
  const a = Buffer.from(String(input || ""));
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/* Create a signed session token: <payload>.<hmac>. */
export function createSessionToken() {
  const exp = Date.now() + MAX_AGE * 1000;
  const payload = b64url(JSON.stringify({ exp }));
  const sig = crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifySessionToken(token) {
  if (!token || typeof token !== "string" || !token.includes(".")) return false;
  const [payload, sig] = token.split(".");
  const expected = crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
  const a = Buffer.from(sig || "");
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  if (!crypto.timingSafeEqual(a, b)) return false;
  try {
    const { exp } = JSON.parse(Buffer.from(payload, "base64url").toString());
    return typeof exp === "number" && exp > Date.now();
  } catch {
    return false;
  }
}

/* Read the admin cookie off a NextRequest and validate it. */
export function isAdminRequest(request) {
  const token = request.cookies?.get?.(ADMIN_COOKIE)?.value;
  return verifySessionToken(token);
}

/* ─────────────────────────────────────────────────────────────
   Speaker self-service links. A stable, unguessable token per speaker
   (HMAC of the id) lets a speaker edit ONLY their own profile without a
   login. It's a capability to edit that one record's photo/bio/details
   — never publishing, never other speakers. Stable so the emailed link
   keeps working.
   ───────────────────────────────────────────────────────────── */
export function speakerToken(id) {
  const payload = b64url(String(id));
  const sig = crypto.createHmac("sha256", secret()).update("speaker:" + id).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifySpeakerToken(token) {
  if (!token || typeof token !== "string" || !token.includes(".")) return null;
  const [payload, sig] = token.split(".");
  let id;
  try {
    id = Buffer.from(payload, "base64url").toString();
  } catch {
    return null;
  }
  const expected = crypto.createHmac("sha256", secret()).update("speaker:" + id).digest("base64url");
  const a = Buffer.from(sig || "");
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  if (!crypto.timingSafeEqual(a, b)) return null;
  return id;
}

export const cookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: MAX_AGE,
};

/* ─────────────────────────────────────────────────────────────
   Attendee identity for matchmaking ("Meet people"). Same HMAC idea
   as speaker links, keyed by the attendee's email. The emailed link
   carries this token; the app exchanges it (once) for a signed,
   httpOnly session cookie so the token doesn't linger in the URL and
   the server can trust "who am I" on every matchmaking request.
   Identity = control of that inbox. Never grants admin.
   ───────────────────────────────────────────────────────────── */
function normEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export function attendeeToken(email) {
  const e = normEmail(email);
  const payload = b64url(e);
  const sig = crypto.createHmac("sha256", secret()).update("attendee:" + e).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyAttendeeToken(token) {
  if (!token || typeof token !== "string" || !token.includes(".")) return null;
  const [payload, sig] = token.split(".");
  let email;
  try {
    email = Buffer.from(payload, "base64url").toString();
  } catch {
    return null;
  }
  const expected = crypto.createHmac("sha256", secret()).update("attendee:" + email).digest("base64url");
  const a = Buffer.from(sig || "");
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  if (!crypto.timingSafeEqual(a, b)) return null;
  return email;
}

export const MEET_COOKIE = "fw_meet";
const MEET_MAX_AGE = 60 * 60 * 24 * 30; // 30 days — lasts the whole event

/* Cookie options for the attendee (Meet) session — longer-lived than admin. */
export const meetCookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: MEET_MAX_AGE,
};

/* A signed session cookie binding the browser to one attendee email. */
export function createMeetSession(email) {
  const e = normEmail(email);
  const exp = Date.now() + MEET_MAX_AGE * 1000;
  const payload = b64url(JSON.stringify({ e, exp }));
  const sig = crypto.createHmac("sha256", secret()).update("meet:" + payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyMeetSession(token) {
  if (!token || typeof token !== "string" || !token.includes(".")) return null;
  const [payload, sig] = token.split(".");
  const expected = crypto.createHmac("sha256", secret()).update("meet:" + payload).digest("base64url");
  const a = Buffer.from(sig || "");
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  if (!crypto.timingSafeEqual(a, b)) return null;
  try {
    const { e, exp } = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (typeof exp !== "number" || exp <= Date.now()) return null;
    return e || null;
  } catch {
    return null;
  }
}

/* Email of the signed-in attendee for this request, or null. */
export function meetEmailFromRequest(request) {
  const token = request.cookies?.get?.(MEET_COOKIE)?.value;
  return verifyMeetSession(token);
}

/* A stable, NON-reversible handle for an attendee, used to reference people
   in the directory / match cards without ever sending an email to the
   browser. The server maps a handle back to an email by scanning opted-in
   profiles (emails never leave the server). */
export function publicHandle(email) {
  const e = normEmail(email);
  return crypto.createHmac("sha256", secret()).update("dir:" + e).digest("base64url").slice(0, 22);
}
