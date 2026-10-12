import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/auth";
import { seedTestProfiles, removeTestProfiles } from "@/lib/db";
import { recomputeAllMatches } from "@/lib/matchCompute";

export const dynamic = "force-dynamic";

/* Admin-only: add or remove the clearly-fake @example.com sample profiles
   used to exercise matching. Add/remove then recompute so matches reflect
   the change immediately. */
export async function POST(req) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  try {
    const action = body?.action;
    let result;
    if (action === "add") result = await seedTestProfiles();
    else if (action === "remove") result = await removeTestProfiles();
    else return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    const recompute = await recomputeAllMatches();
    return NextResponse.json({ ok: true, ...result, recompute });
  } catch (e) {
    return NextResponse.json({ error: e.message || "Failed." }, { status: 500 });
  }
}
