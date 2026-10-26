import { NextResponse } from "next/server";
import { addFeedback } from "@/lib/db";

export const dynamic = "force-dynamic";

const str = (v, n = 2000) => String(v == null ? "" : v).trim().slice(0, n);
const intIn = (v, lo, hi) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= lo && n <= hi ? n : null;
};

/* Public, anonymous feedback submit. kind "event" (the overall form) or
   "session" (a per-panel star rating). No identity is stored. */
export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  try {
    const rid = str(body?.rid, 64);
    if (body?.kind === "session") {
      const rating = intIn(body.rating, 1, 5);
      const comment = str(body.comment, 1000);
      if (!body.sessionId || (rating == null && !comment)) {
        return NextResponse.json({ error: "Add a rating or a comment." }, { status: 400 });
      }
      const data = { ...(comment ? { comment } : {}), ...(rid ? { rid } : {}) };
      await addFeedback({ kind: "session", sessionId: String(body.sessionId), rating, data });
      return NextResponse.json({ ok: true });
    }

    // event feedback
    const data = {
      overall: intIn(body.overall, 1, 5),
      nps: intIn(body.nps, 0, 10),
      valuable: str(body.valuable),
      improve: str(body.improve),
      favorite: str(body.favorite),
      usedMeet: ["yes", "no"].includes(body.usedMeet) ? body.usedMeet : "",
      meetNote: str(body.meetNote),
      ...(rid ? { rid } : {}),
    };
    const hasAny =
      data.overall != null || data.nps != null || data.valuable || data.improve || data.favorite || data.usedMeet || data.meetNote;
    if (!hasAny) return NextResponse.json({ error: "Nothing to submit." }, { status: 400 });
    await addFeedback({ kind: "event", data });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message || "Couldn't save your feedback." }, { status: 500 });
  }
}
