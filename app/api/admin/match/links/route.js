import { NextResponse } from "next/server";
import { isAdminRequest, attendeeToken } from "@/lib/auth";
import { listAttendees, getSessions } from "@/lib/db";

export const dynamic = "force-dynamic";

/* Admin-only: a CSV of each roster attendee's personal matchmaking link plus
   engagement flags (registered for the event? planned any sessions? picked an
   evening experience?) so reminders can be mail-merged to the right people.
   The link carries a signed token; opening it signs that person in. */
export async function GET(req) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
    const proto = req.headers.get("x-forwarded-proto") || "https";
    const origin = host ? `${proto}://${host}` : process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;

    // Evening "experiences" = the Day 2, 6pm capped offerings (Founders Night
    // Out: Brooklyn Bowl, Eavesdrop, Padel Haus, Bathhouse).
    const sessions = await getSessions().catch(() => []);
    const experienceIds = new Set(
      sessions.filter((s) => s.day === "d2" && String(s.start) === "18:00").map((s) => s.id)
    );

    const people = (await listAttendees()).filter((a) => a.roster || a.email);
    const rows = [[
      "first_name", "last_name", "email", "personal_link", "attendee_type", "company",
      "registered", "sessions_planned", "experiences_planned", "needs_sessions", "needs_experiences",
    ]];
    for (const a of people) {
      const r = a.roster || {};
      const link = `${origin}/?m=${encodeURIComponent(attendeeToken(a.email))}`;
      const picks = Array.isArray(a.sessions) ? a.sessions : [];
      const registered = !!a.createdAt;
      const expCount = picks.filter((id) => experienceIds.has(id)).length;
      const sesCount = picks.filter((id) => !experienceIds.has(id)).length;
      rows.push([
        r.firstName || a.firstName || "",
        r.lastName || a.lastName || "",
        a.email || "",
        link,
        r.attendeeType || a.type || "",
        r.company || a.company || "",
        registered ? "Yes" : "No",
        String(sesCount),
        String(expCount),
        registered ? (sesCount === 0 ? "Yes" : "No") : "",
        registered ? (expCount === 0 ? "Yes" : "No") : "",
      ]);
    }
    const csv = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="matchmaking-links.csv"',
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e.message || "Couldn't build the links." }, { status: 500 });
  }
}

function csvCell(v) {
  const s = String(v == null ? "" : v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
