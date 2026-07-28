"use client";
import { useState, useEffect, useRef } from "react";
import { api } from "./api";
import SpeakerAvatar from "./SpeakerAvatar";

/* Token-gated page where a speaker manages their own profile. Reached via
   the private link Flybridge emails them (/speaker/<token>). */
export default function SpeakerSelf({ token }) {
  const [state, setState] = useState("loading"); // loading | ready | invalid
  const [f, setF] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [published, setPublished] = useState(false);
  const [identity, setIdentity] = useState({ firstName: "", lastName: "", email: "" });
  const [registered, setRegistered] = useState(null); // null=checking, true/false
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const fileRef = useRef(null);

  useEffect(() => {
    (async () => {
      const r = await api.speakerSelfGet(token);
      if (r.ok) {
        setF({
          name: r.speaker.name,
          title: r.speaker.title || "",
          company: r.speaker.company || "",
          bio: r.speaker.bio || "",
          link: r.speaker.link || "",
          photoUrl: r.speaker.photoUrl || null,
        });
        setSessions(r.sessions || []);
        setPublished(!!r.speaker.published);
        setIdentity({
          firstName: r.speaker.firstName || "",
          lastName: r.speaker.lastName || "",
          email: r.speaker.email || "",
        });
        setState("ready");
        // Are they already registered for the event?
        if (r.speaker.email) {
          const reg = await api.findMe(r.speaker.email);
          setRegistered(!!reg.ok);
        } else {
          setRegistered(false);
        }
      } else {
        setState("invalid");
      }
    })();
  }, [token]);

  // Hand off pre-fill to the registration form (via sessionStorage, not the
  // URL — keeps their email out of browser history / logs).
  const goRegister = () => {
    try {
      sessionStorage.setItem("fw_register_prefill", JSON.stringify(identity));
    } catch {
      /* ignore */
    }
    window.location.href = "/";
  };

  const flash = (m) => {
    setMsg(m);
    setTimeout(() => setMsg(""), 3200);
  };

  const save = async () => {
    setErr("");
    setBusy(true);
    const r = await api.speakerSelfSave(token, {
      title: f.title,
      company: f.company,
      bio: f.bio,
      link: f.link,
    });
    setBusy(false);
    if (r.ok) flash("Saved — thank you!");
    else setErr(r.error || "Couldn't save — try again.");
  };

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setErr("");
    setUploading(true);
    const r = await api.speakerSelfUploadPhoto(token, file);
    setUploading(false);
    if (r.ok) setF((prev) => ({ ...prev, photoUrl: r.photoUrl }));
    else setErr(r.error || "Upload failed.");
  };

  return (
    <div className="fw-root">
      <header className="fw-head">
        <div className="fw-brand">
          <img className="fw-marklogo" src="/logo.png" alt="Flybridge" />
          <div>
            <div className="fw-title">Flybridge Founders Week & AGM</div>
            <div className="fw-sub">Speaker profile</div>
          </div>
        </div>
      </header>

      {msg && <div className="fw-banner">{msg}</div>}

      {state === "loading" && (
        <main className="fw-main fw-narrow">
          <p className="fw-p">Loading…</p>
        </main>
      )}

      {state === "invalid" && (
        <main className="fw-main fw-narrow">
          <h2 className="fw-h2">This link isn't valid</h2>
          <p className="fw-p">
            Double-check you used the full link from your email, or reach out to the Flybridge team
            and we'll send a fresh one.
          </p>
        </main>
      )}

      {state === "ready" && f && (
        <main className="fw-main fw-narrow">
          <h2 className="fw-h2">You're speaking, {f.name.split(" ")[0]}. 🎤</h2>
          <p className="fw-p">
            Add your headshot and details for the Founders Week app. The Flybridge team gives
            everything a final look before it goes live
            {published ? " — your profile is already published, and edits update it." : "."}
          </p>

          <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 14 }}>
            <SpeakerAvatar speaker={f} size={72} />
            <div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={onFile}
              />
              <button className="fw-add" disabled={uploading} onClick={() => fileRef.current?.click()}>
                {uploading ? "Uploading…" : f.photoUrl ? "Replace photo" : "Upload headshot"}
              </button>
              <p className="fw-muted" style={{ marginTop: 6 }}>
                Please upload the highest-resolution headshot you have (JPG/PNG, under 4MB) — we use
                it in the app and for event signage. A monogram shows until you add one.
              </p>
            </div>
          </div>

          <label className="fw-label">Name</label>
          <input className="fw-input" value={f.name} disabled />

          <div className="fw-grid2">
            <div>
              <label className="fw-label">Title</label>
              <input
                className="fw-input"
                value={f.title}
                onChange={(e) => setF({ ...f, title: e.target.value })}
                placeholder="Co-founder & CEO"
              />
            </div>
            <div>
              <label className="fw-label">Company</label>
              <input
                className="fw-input"
                value={f.company}
                onChange={(e) => setF({ ...f, company: e.target.value })}
              />
            </div>
          </div>

          <label className="fw-label">Short bio</label>
          <textarea
            className="fw-input"
            rows={4}
            value={f.bio}
            onChange={(e) => setF({ ...f, bio: e.target.value })}
            placeholder="A couple of sentences — what you do and why people should say hi."
          />

          <label className="fw-label">Link — LinkedIn / X / your site</label>
          <input
            className="fw-input"
            value={f.link}
            onChange={(e) => setF({ ...f, link: e.target.value })}
            placeholder="https://…"
          />

          {sessions.length > 0 && (
            <>
              <label className="fw-label">You're on the agenda for</label>
              <div className="fw-p" style={{ margin: 0 }}>
                {sessions.map((s) => (
                  <div key={s.id}>• {s.title}</div>
                ))}
              </div>
            </>
          )}

          {err && <div className="fw-err">{err}</div>}
          <button className="fw-primary" disabled={busy} onClick={save}>
            {busy ? "Saving…" : "Save my profile"}
          </button>

          <div className="fw-slackcard" style={{ marginTop: 28 }}>
            <div
              className="fw-slackglyph"
              style={{ background: registered ? "var(--green)" : "var(--cobalt)" }}
            >
              {registered ? "✓" : "2"}
            </div>
            <div style={{ flex: 1 }}>
              <div className="fw-sesstitle">
                {registered ? "You're registered for the event" : "One more step — register for the event"}
              </div>
              <p className="fw-p" style={{ margin: "4px 0 10px" }}>
                {registered
                  ? "You're on the attendee list — all set. Thank you!"
                  : "Your profile is only half of it. Register so we have your days, hotel, and dietary needs. We'll pre-fill your name and email so it's quick."}
              </p>
              {registered === false && (
                <button className="fw-primary fw-slackbtn" onClick={goRegister}>
                  Register for the event →
                </button>
              )}
              {registered === null && <span className="fw-muted">Checking your registration…</span>}
            </div>
          </div>
        </main>
      )}

      <footer className="fw-foot">
        <span>Flybridge Founders Week & AGM · The William Vale, Brooklyn</span>
      </footer>
    </div>
  );
}
