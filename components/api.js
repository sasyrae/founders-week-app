"use client";

/* Thin client-side API layer. Every call returns a plain object that
   always has an `ok` boolean plus whatever the route returned. */
async function jsonFetch(url, opts) {
  let res;
  try {
    res = await fetch(url, {
      headers: { "Content-Type": "application/json" },
      ...opts,
    });
  } catch {
    return { ok: false, error: "Network error — check your connection." };
  }
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* no body */
  }
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      ...(data || {}),
      error: (data && data.error) || `Request failed (${res.status}).`,
    };
  }
  return { ok: true, ...(data || {}) };
}

export const api = {
  // public
  loadEvent: () => jsonFetch("/api/config"),
  updates: () => jsonFetch("/api/updates"),
  register: (form) => jsonFetch("/api/register", { method: "POST", body: JSON.stringify(form) }),
  findMe: (email) => jsonFetch("/api/attendee?email=" + encodeURIComponent(email)),
  updateMe: (form) => jsonFetch("/api/attendee", { method: "PUT", body: JSON.stringify(form) }),
  toggleSession: (email, sessionId, accessCode) =>
    jsonFetch("/api/attendee/session", {
      method: "POST",
      body: JSON.stringify({ email, sessionId, accessCode }),
    }),

  // admin
  adminSession: () => jsonFetch("/api/admin/session"),
  adminLogin: (password) =>
    jsonFetch("/api/admin/login", { method: "POST", body: JSON.stringify({ password }) }),
  adminLogout: () => jsonFetch("/api/admin/logout", { method: "POST" }),
  adminBootstrap: () => jsonFetch("/api/admin/bootstrap"),
  adminSaveAttendee: (attendee) =>
    jsonFetch("/api/admin/attendee", { method: "POST", body: JSON.stringify({ attendee }) }),
  adminDeleteAttendee: (email) =>
    jsonFetch("/api/admin/attendee?email=" + encodeURIComponent(email), { method: "DELETE" }),
  adminSaveConfig: (config) =>
    jsonFetch("/api/admin/config", { method: "PUT", body: JSON.stringify({ config }) }),
  adminSaveSessions: (sessions) =>
    jsonFetch("/api/admin/sessions", { method: "PUT", body: JSON.stringify({ sessions }) }),
  adminPublish: (payload) =>
    jsonFetch("/api/admin/update", { method: "POST", body: JSON.stringify(payload) }),
  adminDeleteUpdate: (id) =>
    jsonFetch("/api/admin/update?id=" + encodeURIComponent(id), { method: "DELETE" }),
  adminResend: (email) =>
    jsonFetch("/api/admin/resend", { method: "POST", body: JSON.stringify(email ? { email } : {}) }),

  // speakers
  adminSaveSpeaker: (speaker) =>
    jsonFetch("/api/admin/speaker", { method: "POST", body: JSON.stringify({ speaker }) }),
  adminDeleteSpeaker: (id) =>
    jsonFetch("/api/admin/speaker?id=" + encodeURIComponent(id), { method: "DELETE" }),
  adminBulkSpeakers: (speakers) =>
    jsonFetch("/api/admin/speakers", { method: "POST", body: JSON.stringify({ speakers }) }),
  adminReorderSpeakers: (ids) =>
    jsonFetch("/api/admin/speakers", { method: "PUT", body: JSON.stringify({ ids }) }),
  adminUploadSpeakerPhoto: async (speakerId, file) => uploadForm("/api/admin/speaker/photo", { speakerId }, file),

  // feedback (anonymous; pseudonymous respondent id groups one person's
  // submissions without storing any identity)
  submitFeedback: (payload) =>
    jsonFetch("/api/feedback", { method: "POST", body: JSON.stringify({ ...payload, rid: feedbackRid() }) }),
  adminFeedback: () => jsonFetch("/api/admin/feedback"),

  // matchmaking ("Meet people")
  meetWhoAmI: () => jsonFetch("/api/meet/session"),
  meetStart: (token) =>
    jsonFetch("/api/meet/session", { method: "POST", body: JSON.stringify({ token }) }),
  meetSignOut: () => jsonFetch("/api/meet/session", { method: "DELETE" }),
  meetRequestLink: (email) =>
    jsonFetch("/api/meet/request-link", { method: "POST", body: JSON.stringify({ email }) }),
  meetGetProfile: () => jsonFetch("/api/meet/profile"),
  meetSaveProfile: (fields) =>
    jsonFetch("/api/meet/profile", { method: "PUT", body: JSON.stringify(fields) }),
  meetGetMatches: () => jsonFetch("/api/meet/matches"),
  meetGetRequests: () => jsonFetch("/api/meet/requests"),
  meetGetDirectory: () => jsonFetch("/api/meet/directory"),
  meetRequest: (toHandle, note) =>
    jsonFetch("/api/meet/request", { method: "POST", body: JSON.stringify({ toHandle, note }) }),
  meetRespond: (requestId, action) =>
    jsonFetch("/api/meet/request/respond", { method: "POST", body: JSON.stringify({ requestId, action }) }),
  adminMatchImport: (roster, enrichment) =>
    jsonFetch("/api/admin/match/import", {
      method: "POST",
      body: JSON.stringify({ roster, enrichment }),
    }),
  adminMatchRecompute: () => jsonFetch("/api/admin/match/recompute", { method: "POST" }),
  adminMatchSyncSpeakers: () => jsonFetch("/api/admin/match/sync-speakers", { method: "POST" }),
  adminMatchNudge: (payload) =>
    jsonFetch("/api/admin/match/nudge", { method: "POST", body: JSON.stringify(payload) }),
  adminMatchOverview: () => jsonFetch("/api/admin/match/overview"),
  adminMatchIntro: (aEmail, bEmail, reason) =>
    jsonFetch("/api/admin/match/intro", { method: "POST", body: JSON.stringify({ aEmail, bEmail, reason }) }),
  adminMatchIntroRemove: (id) =>
    jsonFetch("/api/admin/match/intro?id=" + encodeURIComponent(id), { method: "DELETE" }),
  adminMatchIntrosBulk: (items) =>
    jsonFetch("/api/admin/match/intros-bulk", { method: "POST", body: JSON.stringify({ items }) }),
  adminMatchTest: (action) =>
    jsonFetch("/api/admin/match/test", { method: "POST", body: JSON.stringify({ action }) }),

  // speaker self-service (token-gated)
  speakerSelfGet: (token) => jsonFetch("/api/speaker/self?token=" + encodeURIComponent(token)),
  speakerSelfSave: (token, fields) =>
    jsonFetch("/api/speaker/self", { method: "PUT", body: JSON.stringify({ token, ...fields }) }),
  speakerSelfUploadPhoto: (token, file) => uploadForm("/api/speaker/self/photo", { token }, file),
};

/* A stable, meaningless per-browser id so one person's anonymous feedback
   submissions can be grouped (never any name/email). */
function feedbackRid() {
  try {
    let r = localStorage.getItem("fw_fb_rid");
    if (!r) {
      r = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      localStorage.setItem("fw_fb_rid", r);
    }
    return r;
  } catch {
    return "";
  }
}

/* Shared multipart upload helper — the browser sets the multipart
   boundary, so we must NOT send a Content-Type header. */
async function uploadForm(url, fields, file) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  fd.append("file", file);
  let res;
  try {
    res = await fetch(url, { method: "POST", body: fd });
  } catch {
    return { ok: false, error: "Upload failed — check your connection." };
  }
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* no body */
  }
  if (!res.ok) return { ok: false, ...(data || {}), error: (data && data.error) || "Upload failed." };
  return { ok: true, ...(data || {}) };
}
