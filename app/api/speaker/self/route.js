import { NextResponse } from "next/server";
import { verifySpeakerToken } from "@/lib/auth";
import { getSpeakerById, updateSpeakerSelf, getSessionsForSpeaker } from "@/lib/db";

export const dynamic = "force-dynamic";

/* Load the speaker's own profile via their signed link token. */
export async function GET(req) {
  const token = new URL(req.url).searchParams.get("token") || "";
  const id = verifySpeakerToken(token);
  if (!id) return NextResponse.json({ error: "This link isn't valid." }, { status: 401 });
  try {
    const sp = await getSpeakerById(id);
    if (!sp) return NextResponse.json({ error: "Speaker not found." }, { status: 404 });
    const sessions = await getSessionsForSpeaker(id).catch(() => []);
    return NextResponse.json({
      speaker: {
        name: sp.name,
        firstName: sp.firstName,
        lastName: sp.lastName,
        email: sp.email,
        title: sp.title,
        company: sp.company,
        bio: sp.bio,
        link: sp.link,
        photoUrl: sp.photoUrl,
        published: sp.published,
      },
      sessions,
    });
  } catch (e) {
    return NextResponse.json({ error: e.message || "Something went wrong." }, { status: 500 });
  }
}

/* Save the speaker's own edits (title/company/bio/link only). */
export async function PUT(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  const id = verifySpeakerToken(body.token || "");
  if (!id) return NextResponse.json({ error: "This link isn't valid." }, { status: 401 });
  try {
    const sp = await updateSpeakerSelf(id, body);
    return NextResponse.json({
      speaker: {
        name: sp.name,
        title: sp.title,
        company: sp.company,
        bio: sp.bio,
        link: sp.link,
        photoUrl: sp.photoUrl,
        published: sp.published,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e.message || "Couldn't save." }, { status: 500 });
  }
}
