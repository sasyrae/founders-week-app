import { NextResponse } from "next/server";
import {
  verifyAttendeeToken,
  createMeetSession,
  meetEmailFromRequest,
  MEET_COOKIE,
  cookieOptions,
} from "@/lib/auth";
import { getMatchMe } from "@/lib/db";

export const dynamic = "force-dynamic";

/* Exchange a personal link token for a signed identity cookie. The token
   comes from the link Flybridge emails each attendee; we verify it, then
   set an httpOnly cookie so the token needn't stay in the URL. */
export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  const email = verifyAttendeeToken(body?.token);
  if (!email) {
    return NextResponse.json({ error: "That link isn't valid. Ask us for a fresh one." }, { status: 401 });
  }
  let me = null;
  try {
    me = await getMatchMe(email);
  } catch {
    /* identity still valid even if the record lookup hiccups */
  }
  const res = NextResponse.json({ email, identity: me?.identity || null, hasProfile: !!me?.profile });
  res.cookies.set(MEET_COOKIE, createMeetSession(email), cookieOptions);
  return res;
}

/* Who am I? (from the cookie) */
export async function GET(req) {
  const email = meetEmailFromRequest(req);
  if (!email) return NextResponse.json({ identity: null });
  try {
    const me = await getMatchMe(email);
    return NextResponse.json({ email, identity: me?.identity || null, hasProfile: !!me?.profile });
  } catch (e) {
    return NextResponse.json({ error: e.message || "Lookup failed." }, { status: 500 });
  }
}

/* Sign out of matchmaking on this device. */
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(MEET_COOKIE, "", { ...cookieOptions, maxAge: 0 });
  return res;
}
