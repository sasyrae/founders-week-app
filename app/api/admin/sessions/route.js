import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/auth";
import { replaceSessions, getSessions } from "@/lib/db";

export const dynamic = "force-dynamic";

/* Replace the full sessions list from the Sessions editor. Admin-only. */
export async function PUT(req) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  try {
    const sessions = Array.isArray(body.sessions) ? body.sessions : [];
    await replaceSessions(sessions);
    const fresh = await getSessions();
    return NextResponse.json({ sessions: fresh });
  } catch (e) {
    return NextResponse.json({ error: e.message || "Couldn't save sessions." }, { status: 500 });
  }
}
