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
