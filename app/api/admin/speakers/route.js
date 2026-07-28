import { NextResponse } from "next/server";
import { isAdminRequest, speakerToken } from "@/lib/auth";
import { bulkCreateSpeakers, reorderSpeakers, getSpeakers } from "@/lib/db";
import { uid } from "@/lib/utils";

const withTokens = (list) => list.map((s) => ({ ...s, token: speakerToken(s.id) }));

export const dynamic = "force-dynamic";

/* Bulk-create speakers from a parsed list (from the paste-import box).
   Each item: { name, title?, company?, bio?, link?, published? }. Admin-only. */
export async function POST(req) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  try {
    const incoming = (Array.isArray(body.speakers) ? body.speakers : [])
      .filter((s) => s && ((s.firstName && s.firstName.trim()) || (s.name && s.name.trim())))
      .map((s) => ({
        id: uid(),
        firstName: (s.firstName || "").trim(),
        lastName: (s.lastName || "").trim(),
        name: (s.name || "").trim(),
        title: (s.title || "").trim(),
        company: (s.company || "").trim(),
        bio: (s.bio || "").trim(),
        link: (s.link || "").trim(),
        email: (s.email || "").trim(),
        published: !!s.published,
      }));
    if (incoming.length === 0) {
      return NextResponse.json({ error: "No valid speakers to add." }, { status: 400 });
    }
    const existing = await getSpeakers();
    const base = existing.length;
    incoming.forEach((s, i) => (s.sortOrder = base + i));
    await bulkCreateSpeakers(incoming);
    const all = await getSpeakers();
    return NextResponse.json({ added: incoming.length, speakers: withTokens(all) });
  } catch (e) {
    return NextResponse.json({ error: e.message || "Couldn't add speakers." }, { status: 500 });
  }
}

/* Reorder speakers by id list. Admin-only. */
export async function PUT(req) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  try {
    const ids = Array.isArray(body.ids) ? body.ids : [];
    await reorderSpeakers(ids);
    const all = await getSpeakers();
    return NextResponse.json({ speakers: withTokens(all) });
  } catch (e) {
    return NextResponse.json({ error: e.message || "Couldn't reorder." }, { status: 500 });
  }
}
