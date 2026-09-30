import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/auth";
import { uploadSpeakerPhoto, getSpeakerById } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BYTES = 4 * 1024 * 1024; // 4MB

/* Upload a speaker headshot (multipart form: file + speakerId). Admin-only. */
export async function POST(req) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const form = await req.formData();
    const speakerId = form.get("speakerId");
    const file = form.get("file");
    if (!speakerId || typeof speakerId !== "string") {
      return NextResponse.json({ error: "Missing speakerId." }, { status: 400 });
    }
    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "No image uploaded." }, { status: 400 });
    }
    if (!String(file.type || "").startsWith("image/")) {
      return NextResponse.json({ error: "That file isn't an image." }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "Image is too large — keep it under 4MB." }, { status: 400 });
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    const photoUrl = await uploadSpeakerPhoto(speakerId, bytes, file.type);
    return NextResponse.json({ photoUrl });
  } catch (e) {
    return NextResponse.json({ error: e.message || "Upload failed." }, { status: 500 });
  }
}

/* Stream a speaker's ORIGINAL uploaded photo back through our own origin
   with a Content-Disposition attachment, so the admin can save the full
   high-res headshot with a sensible filename (e.g. Jane-Doe.jpg) for use
   in other materials. Admin-only. Fetched via a same-origin <a>, so the
   admin cookie rides along automatically. */
export async function GET(req) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });

  let speaker;
  try {
    speaker = await getSpeakerById(id);
  } catch (e) {
    return NextResponse.json({ error: e.message || "Lookup failed." }, { status: 500 });
  }
  if (!speaker || !speaker.photoUrl) {
    return NextResponse.json({ error: "No photo on file." }, { status: 404 });
  }

  let upstream;
  try {
    upstream = await fetch(speaker.photoUrl);
  } catch {
    return NextResponse.json({ error: "Couldn't reach the photo." }, { status: 502 });
  }
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: "Couldn't fetch the photo." }, { status: 502 });
  }

  const contentType = upstream.headers.get("content-type") || "application/octet-stream";
  const ext = extFor(contentType, speaker.photoUrl);
  const base =
    [speaker.firstName, speaker.lastName].filter(Boolean).join("-") ||
    (speaker.name || "speaker").trim().replace(/\s+/g, "-");
  const filename = `${base.replace(/[^A-Za-z0-9._-]/g, "")}.${ext}`;

  return new NextResponse(upstream.body, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

function extFor(contentType, url) {
  const map = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };
  if (map[contentType]) return map[contentType];
  const m = /\.([a-z0-9]{3,4})(?:\?|$)/i.exec(url || "");
  return m ? m[1].toLowerCase() : "jpg";
}
