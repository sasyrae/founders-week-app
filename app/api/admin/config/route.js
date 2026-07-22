import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/auth";
import { getConfig, saveConfig } from "@/lib/db";

export const dynamic = "force-dynamic";

/* Save event config: Settings fields, Slack/hotel settings, and the
   confirmation email template. Admin-only. Merges over the current
   config so partial saves are safe. Sessions live in their own table
   and are saved via /api/admin/sessions. */
export async function PUT(req) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  try {
    const patch = body.config || body;
    const current = await getConfig();
    const next = { ...current, ...patch };
    await saveConfig(next);
    return NextResponse.json({ config: next });
  } catch (e) {
    return NextResponse.json({ error: e.message || "Couldn't save settings." }, { status: 500 });
  }
}
