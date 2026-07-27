import { NextResponse } from "next/server";
import {
  ensureSeeded,
  getConfig,
  getSessions,
  getSessionCounts,
  getSpeakers,
  publicSession,
} from "@/lib/db";

export const dynamic = "force-dynamic";

/* Config is public, but the confirmation-email fields are admin-only
   noise for the attendee app — strip them. (No secrets live in config;
   access codes live on sessions and are stripped by publicSession.) */
function publicConfig(c) {
  const { confirmSubject, confirmTemplate, ...rest } = c || {};
  return rest;
}

export async function GET() {
  try {
    await ensureSeeded();
    const [config, sessions, counts, speakers] = await Promise.all([
      getConfig(),
      getSessions(),
      getSessionCounts(),
      getSpeakers({ publishedOnly: true }).catch(() => []), // tolerate pre-migration
    ]);
    return NextResponse.json({
      config: publicConfig(config),
      sessions: sessions.map((s) => ({
        ...publicSession(s),
        taken: s.capacity > 0 ? counts[s.id] || 0 : 0,
      })),
      speakers,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e.message || "Failed to load the event." },
      { status: 500 }
    );
  }
}
