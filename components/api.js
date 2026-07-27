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
  adminUploadSpeakerPhoto: async (speakerId, file) => {
    const fd = new FormData();
    fd.append("speakerId", speakerId);
    fd.append("file", file);
    let res;
    try {
      // No Content-Type header — the browser sets the multipart boundary.
      res = await fetch("/api/admin/speaker/photo", { method: "POST", body: fd });
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
  },
};
