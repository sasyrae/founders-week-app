import { NextResponse } from "next/server";
import { meetEmailFromRequest } from "@/lib/auth";
import { getMatchMe, saveMatchProfile } from "@/lib/db";

export const dynamic = "force-dynamic";

/* My profile editor data: identity (read-only), my approved profile (if
   any), and my private draft pre-fill. Cookie-gated — only ever returns
   the signed-in attendee's own private content. */
export async function GET(req) {
  const email = meetEmailFromRequest(req);
  if (!email) return NextResponse.json({ error: "Open your personal link first." }, { status: 401 });
  try {
    const me = await getMatchMe(email);
    if (!me) {
      return NextResponse.json(
        { error: "We couldn't find your registration — reply to our email and we'll sort it." },
        { status: 404 }
      );
    }
    return NextResponse.json(me);
  } catch (e) {
    return NextResponse.json({ error: e.message || "Couldn't load your profile." }, { status: 500 });
  }
}

/* Save my profile (and opt in / out). */
export async function PUT(req) {
  const email = meetEmailFromRequest(req);
  if (!email) return NextResponse.json({ error: "Open your personal link first." }, { status: 401 });
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  try {
    const profile = await saveMatchProfile(email, {
      workingOn: body.workingOn,
      lookingFor: body.lookingFor,
      canHelpWith: body.canHelpWith,
      optedIn: body.optedIn,
    });
    return NextResponse.json({ profile });
  } catch (e) {
    return NextResponse.json({ error: e.message || "Couldn't save your profile." }, { status: 500 });
  }
}
