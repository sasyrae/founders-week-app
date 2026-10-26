import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/auth";
import { getFeedbackSummary, getFeedbackRows } from "@/lib/db";

export const dynamic = "force-dynamic";

/* Admin: feedback summary, or a CSV export of raw rows with ?format=csv. */
export async function GET(req) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    if (new URL(req.url).searchParams.get("format") === "csv") {
      const rows = await getFeedbackRows();
      const header = ["ts", "respondent", "kind", "session_id", "rating", "overall", "nps", "used_meet", "valuable", "improve", "favorite", "meet_note", "comment"];
      const out = [header];
      for (const r of rows) {
        const d = r.data || {};
        out.push([
          r.ts, d.rid || "", r.kind, r.session_id || "", r.rating ?? "",
          d.overall ?? "", d.nps ?? "", d.usedMeet || "",
          d.valuable || "", d.improve || "", d.favorite || "", d.meetNote || "", d.comment || "",
        ]);
      }
      const csv = out.map((row) => row.map(csvCell).join(",")).join("\r\n");
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="founders-week-feedback.csv"',
          "Cache-Control": "no-store",
        },
      });
    }
    const summary = await getFeedbackSummary();
    return NextResponse.json(summary);
  } catch (e) {
    return NextResponse.json({ error: e.message || "Couldn't load feedback." }, { status: 500 });
  }
}

function csvCell(v) {
  const s = String(v == null ? "" : v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
