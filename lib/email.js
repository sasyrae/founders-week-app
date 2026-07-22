import { Resend } from "resend";
import { DEFAULT_SUBJECT, DEFAULT_TEMPLATE } from "./constants";

/* ─────────────────────────────────────────────────────────────
   Transactional email via Resend. Sends the confirmation instantly
   on registration. Server-only.
   ───────────────────────────────────────────────────────────── */

/* Fill the confirmation template — same placeholder logic as the
   prototype, including the hotel-note branch that switches once a
   hotelBookingUrl is set. */
export function fillConfirmation(config, a, template) {
  const days =
    (a.attending || [])
      .map((id) => {
        const d = (config.days || []).find((x) => x.id === id);
        return d ? `• ${d.label} (${d.date})` : "";
      })
      .filter(Boolean)
      .join("\n") || "• (no days selected)";

  const sessions =
    (a.sessions || [])
      .map((sid) => {
        const s = (config._sessions || []).find((x) => x.id === sid);
        return s ? `• ${s.title}` : "";
      })
      .filter(Boolean)
      .join("\n") || "• None yet — browse the agenda to add sessions";

  const hotelNote =
    a.hotel === "yes"
      ? config.hotelBookingUrl
        ? `Hotel: you're staying at The William Vale (${(a.hotelNights || []).join(
            ", "
          )}). Book your room in our block here: ${config.hotelBookingUrl}`
        : `Hotel: you told us you're staying at The William Vale (${(a.hotelNights || []).join(
            ", "
          )}). A booking link for our room block is coming in a separate email.`
      : "Staying elsewhere? No problem — everything happens at The William Vale, an easy trip from anywhere in Williamsburg.";

  return template
    .replaceAll("{firstName}", a.firstName || (a.name || "").split(" ")[0] || "there")
    .replaceAll("{days}", days)
    .replaceAll("{sessions}", sessions)
    .replaceAll("{hotelNote}", hotelNote)
    .replaceAll("{slack}", config.slackInviteUrl || "");
}

/* Send the confirmation email. `config._sessions` should be attached
   by the caller (the full sessions list) so {sessions} can resolve
   titles. Returns { sent: bool, skipped?: bool, error?: string }. */
export async function sendConfirmation(config, attendee) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.CONFIRM_FROM_EMAIL;
  if (!apiKey || !from) {
    // Not configured yet — don't block registration.
    return { sent: false, skipped: true, error: "Resend not configured" };
  }
  const subject = config.confirmSubject || DEFAULT_SUBJECT;
  const template = config.confirmTemplate || DEFAULT_TEMPLATE;
  const body = fillConfirmation(config, attendee, template);
  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from,
      to: attendee.email,
      subject,
      text: body,
    });
    if (error) return { sent: false, error: error.message || String(error) };
    return { sent: true };
  } catch (e) {
    return { sent: false, error: e.message || String(e) };
  }
}
