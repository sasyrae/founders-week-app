import { NextResponse } from "next/server";
import { meetEmailFromRequest } from "@/lib/auth";
import { matchTargetEmail, emailForHandle, createMeetRequest } from "@/lib/db";

export const dynamic = "force-dynamic";

/* Send a "request to meet" to a match or anyone in the directory. The client
   passes an opaque handle (or legacy match id), never an email, so contact
   details never reach the browser before a double opt-in. */
export async function POST(req) {
  const email = meetEmailFromRequest(req);
  if (!email) return NextResponse.json({ error: "Open your personal link first." }, { status: 401 });
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  try {
    const toEmail = body?.toHandle
      ? await emailForHandle(body.toHandle)
      : await matchTargetEmail(email, body?.toId);
    if (!toEmail) return NextResponse.json({ error: "That person is no longer available." }, { status: 404 });
    const { request } = await createMeetRequest(email, toEmail, body?.note);
    return NextResponse.json({ ok: true, status: request.status });
  } catch (e) {
    return NextResponse.json({ error: e.message || "Couldn't send the request." }, { status: 400 });
  }
}
