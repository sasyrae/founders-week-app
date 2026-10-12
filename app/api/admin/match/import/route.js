import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/auth";
import { importRoster } from "@/lib/db";

export const dynamic = "force-dynamic";

/* Admin-only: import the confirmed roster + private enrichment drafts into
   Supabase. The admin uploads the two JSON files; the client reads them and
   posts their parsed contents here. The files themselves never get committed
   or logged. */
export async function POST(req) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  const roster = Array.isArray(body?.roster) ? body.roster : null;
  if (!roster || roster.length === 0) {
    return NextResponse.json({ error: "No roster rows found in that file." }, { status: 400 });
  }
  const enrichment = body?.enrichment && typeof body.enrichment === "object" ? body.enrichment : {};
  try {
    const result = await importRoster(roster, enrichment);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json({ error: e.message || "Import failed." }, { status: 500 });
  }
}
