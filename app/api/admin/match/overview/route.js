import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/auth";
import { getMatchAdminOverview } from "@/lib/db";

export const dynamic = "force-dynamic";

/* Admin dashboard data for matchmaking. */
export async function GET(req) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const overview = await getMatchAdminOverview();
    return NextResponse.json(overview);
  } catch (e) {
    return NextResponse.json({ error: e.message || "Couldn't load the overview." }, { status: 500 });
  }
}
