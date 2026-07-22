/* ─────────────────────────────────────────────────────────────
   Slack cross-post via an Incoming Webhook URL stored in the
   SLACK_WEBHOOK_URL env var. Server-only. Returns { posted, error }.
   A webhook is bound to one channel when created, so the channel is
   determined by the webhook, not by the text.
   ───────────────────────────────────────────────────────────── */
export async function postToSlack(text) {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) return { posted: false, skipped: true, error: "Slack webhook not configured" };
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return { posted: false, error: `Slack responded ${res.status} ${detail}`.trim() };
    }
    return { posted: true };
  } catch (e) {
    return { posted: false, error: e.message || String(e) };
  }
}
