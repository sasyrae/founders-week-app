import { NextResponse } from "next/server";
import { isAdminRequest, attendeeToken } from "@/lib/auth";
import { listAttendees } from "@/lib/db";

export const dynamic = "force-dynamic";

/* Admin-only: a CSV of each roster attendee's personal matchmaking link,
   for mail-merging the invite (and for grabbing one link to test with).
   The link carries a signed token; opening it signs that person in. */
export async function GET(req) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
    const people = (await listAttendees()).filter((a) => a.roster || a.email);
    const rows = [["first_name", "last_name", "email", "company", "personal_link"]];
    for (const a of people) {
      const r = a.roster || {};
      const link = `${origin}/?m=${encodeURIComponent(attendeeToken(a.email))}`;
      rows.push([
        r.firstName || a.firstName || "",
        r.lastName || a.lastName || "",
        a.email || "",
        r.company || a.company || "",
        link,
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
