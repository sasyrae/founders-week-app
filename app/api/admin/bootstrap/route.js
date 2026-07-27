import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/auth";
import { getConfig, getSessions, listAttendees, getAnnouncements, getSpeakers } from "@/lib/db";

export const dynamic = "force-dynamic";

/* One call to hydrate all Host tools. Admin-only. Returns the FULL
   sessions (including access codes) because the admin edits them. */
export async function GET(req) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const [config, sessions, attendees, announcements, speakers] = await Promise.all([
      getConfig(),
      getSessions(),
      listAttendees(),
      getAnnouncements(),
      getSpeakers().catch(() => null), // null = speakers table not migrated yet
    ]);
    return NextResponse.json({ config, sessions, attendees, announcements, speakers });
  } catch (e) {
    return NextResponse.json({ error: e.message || "Failed to load." }, { status: 500 });
  }
}
