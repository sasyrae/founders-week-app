import { NextResponse } from "next/server";
import {
  getAttendee,
  getSessionById,
  upsertAttendee,
  countSessionRegistrations,
} from "@/lib/db";
import { normalizeEmail } from "@/lib/utils";

export const dynamic = "force-dynamic";

/* Toggle a session on/off for an attendee.
   - Access codes are validated SERVER-SIDE (never shipped to client).
   - Capacity is HARD-enforced with a friendly "full" state.
   Body: { email, sessionId, accessCode? } */
export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  try {
    const email = normalizeEmail(body.email);
    const sessionId = String(body.sessionId || "");
    const attendee = await getAttendee(email);
    if (!attendee) {
      return NextResponse.json(
        { error: "Register first — it takes 20 seconds.", code: "NO_ATTENDEE" },
        { status: 403 }
      );
    }
    const session = await getSessionById(sessionId);
    if (!session) return NextResponse.json({ error: "Unknown session." }, { status: 404 });

    const has = (attendee.sessions || []).includes(sessionId);

    // Removing is always allowed, no checks.
    if (has) {
      const next = {
        ...attendee,
        sessions: attendee.sessions.filter((x) => x !== sessionId),
      };
      const saved = await upsertAttendee(next);
      return NextResponse.json({ attendee: saved });
    }

    // Adding — validate access code (server-side) if the session is gated.
    if (session.accessCode) {
      const given = String(body.accessCode || "").trim().toLowerCase();
      if (!given) {
        return NextResponse.json(
          { error: "This session needs an access code.", code: "CODE_REQUIRED" },
          { status: 403 }
        );
      }
      if (given !== String(session.accessCode).trim().toLowerCase()) {
        return NextResponse.json(
          { error: "That code isn't right — check your invitation.", code: "BAD_CODE" },
          { status: 403 }
        );
      }
    }

    // Adding — hard capacity enforcement.
    if (session.capacity > 0) {
      const count = await countSessionRegistrations(sessionId);
      if (count >= session.capacity) {
        return NextResponse.json(
          { error: "This session is full.", code: "FULL" },
          { status: 409 }
        );
      }
    }

    const next = { ...attendee, sessions: [...(attendee.sessions || []), sessionId] };
    const saved = await upsertAttendee(next);
    return NextResponse.json({ attendee: saved });
  } catch (e) {
    return NextResponse.json({ error: e.message || "Couldn't save — try again." }, { status: 500 });
  }
}
