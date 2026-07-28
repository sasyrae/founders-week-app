"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "./api";
import { fmtTime, fmtWhen } from "@/lib/utils";
import { DEFAULT_SUBJECT, DEFAULT_TEMPLATE, HOTEL_NIGHTS } from "@/lib/constants";
import SpeakerAvatar from "./SpeakerAvatar";

/* ── host tools root ─────────────────────────────────────────── */
export default function Admin({ flash, refreshEvent }) {
  const [authed, setAuthed] = useState(null); // null = still checking
  const [code, setCode] = useState("");
  const [tab, setTab] = useState("checkin");
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [attendees, setAttendees] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [speakers, setSpeakers] = useState(null); // null = table not migrated yet

  useEffect(() => {
    (async () => {
      const r = await api.adminSession();
      setAuthed(!!r.authed);
    })();
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const r = await api.adminBootstrap();
    setLoading(false);
    if (r.ok) {
      setConfig(r.config);
      setSessions(r.sessions || []);
      setAttendees(r.attendees || []);
      setAnnouncements(r.announcements || []);
      setSpeakers(r.speakers === undefined ? null : r.speakers); // null if not migrated
    } else if (r.status === 401) {
      setAuthed(false);
    }
  }, []);

  useEffect(() => {
    if (authed) loadAll();
  }, [authed, loadAll]);

  const unlock = async () => {
    const r = await api.adminLogin(code);
    if (r.ok) {
      setAuthed(true);
      setCode("");
    } else flash(r.error || "Wrong passcode.");
  };

  const logout = async () => {
    await api.adminLogout();
    setAuthed(false);
    setAttendees(null);
    setConfig(null);
  };

  const saveConfig = async (next) => {
    setConfig(next);
    const r = await api.adminSaveConfig(next);
    if (!r.ok) flash(r.error || "Couldn't save.");
    else {
      setConfig(r.config);
      refreshEvent && refreshEvent();
    }
  };

  const saveSessions = async (next) => {
    const r = await api.adminSaveSessions(next);
    if (r.ok) {
      setSessions(r.sessions || []);
      refreshEvent && refreshEvent();
    } else flash(r.error || "Couldn't save sessions.");
    return r;
  };

  const saveAttendee = async (a) => {
    const r = await api.adminSaveAttendee(a);
    if (r.ok) setAttendees((prev) => (prev || []).map((x) => (x.email === a.email ? r.attendee : x)));
    else flash(r.error || "Couldn't save.");
  };

  const deleteAttendee = async (a) => {
    const r = await api.adminDeleteAttendee(a.email);
    if (r.ok) setAttendees((prev) => (prev || []).filter((x) => x.email !== a.email));
    else flash(r.error || "Couldn't remove.");
  };

  // ── speakers ──
  const saveSpeaker = async (sp) => {
    const r = await api.adminSaveSpeaker(sp);
    if (r.ok) {
      setSpeakers((prev) => {
        const list = prev || [];
        return list.some((x) => x.id === r.speaker.id)
          ? list.map((x) => (x.id === r.speaker.id ? r.speaker : x))
          : [...list, r.speaker];
      });
      refreshEvent && refreshEvent();
    } else flash(r.error || "Couldn't save speaker.");
    return r;
  };

  const removeSpeaker = async (id) => {
    const r = await api.adminDeleteSpeaker(id);
    if (r.ok) {
      setSpeakers((prev) => (prev || []).filter((x) => x.id !== id));
      refreshEvent && refreshEvent();
    } else flash(r.error || "Couldn't delete.");
  };

  const bulkAddSpeakers = async (list) => {
    const r = await api.adminBulkSpeakers(list);
    if (r.ok) {
      setSpeakers(r.speakers);
      refreshEvent && refreshEvent();
    } else flash(r.error || "Couldn't add speakers.");
    return r;
  };

  const uploadSpeakerPhoto = async (id, file) => {
    const r = await api.adminUploadSpeakerPhoto(id, file);
    if (r.ok) {
      setSpeakers((prev) => (prev || []).map((x) => (x.id === id ? { ...x, photoUrl: r.photoUrl } : x)));
      refreshEvent && refreshEvent();
    } else flash(r.error || "Upload failed.");
    return r;
  };

  if (authed === null)
    return (
      <main className="fw-main fw-narrow">
        <p className="fw-p">Checking…</p>
      </main>
    );

  if (!authed)
    return (
      <main className="fw-main fw-narrow">
        <h2 className="fw-h2">Host tools</h2>
        <p className="fw-p">Enter the Host tools password to manage the event.</p>
        <input
          className="fw-input"
          type="password"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && unlock()}
          placeholder="Password"
        />
        <button className="fw-primary" onClick={unlock}>
          Unlock
        </button>
      </main>
    );

  return (
    <main className="fw-main">
      <div className="fw-admintabs">
        {[
          ["checkin", "Check-in"],
          ["registrants", "Registrants"],
          ["confirm", "Confirmations"],
          ["updates", "Send update"],
          ["speakers", "Speakers"],
          ["sessions", "Sessions"],
          ["settings", "Settings"],
        ].map(([id, label]) => (
          <button key={id} className={tab === id ? "on" : ""} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
        <button className="fw-refresh" onClick={loadAll}>
          {loading ? "Refreshing…" : "↻ Refresh"}
        </button>
        <button className="fw-linkbtn" style={{ padding: "8px 10px" }} onClick={logout}>
          Log out
        </button>
      </div>

      {config && tab === "checkin" && (
        <CheckIn config={config} sessions={sessions} attendees={attendees} onSave={saveAttendee} />
      )}
      {config && tab === "registrants" && (
        <Registrants
          config={config}
          sessions={sessions}
          attendees={attendees}
          flash={flash}
          onDelete={deleteAttendee}
        />
      )}
      {config && tab === "confirm" && (
        <Confirmations
          config={config}
          attendees={attendees}
          saveConfig={saveConfig}
          reload={loadAll}
          flash={flash}
        />
      )}
      {config && tab === "updates" && (
        <SendUpdate
          config={config}
          announcements={announcements}
          setAnnouncements={setAnnouncements}
          flash={flash}
        />
      )}
      {config && tab === "speakers" && (
        <SpeakersAdmin
          speakers={speakers}
          saveSpeaker={saveSpeaker}
          removeSpeaker={removeSpeaker}
          bulkAddSpeakers={bulkAddSpeakers}
          uploadSpeakerPhoto={uploadSpeakerPhoto}
          flash={flash}
        />
      )}
      {config && tab === "sessions" && (
        <SessionEditor
          days={config.days}
          sessions={sessions}
          speakers={speakers}
          saveSessions={saveSessions}
          flash={flash}
        />
      )}
      {config && tab === "settings" && <Settings config={config} saveConfig={saveConfig} flash={flash} />}
    </main>
  );
}

const Stat = ({ n, label }) => (
  <div className="fw-stat">
    <div className="fw-statn">{n}</div>
    <div className="fw-statl">{label}</div>
  </div>
);

/* ── check-in ────────────────────────────────────────────────── */
function CheckIn({ config, sessions, attendees, onSave }) {
  const [sid, setSid] = useState(sessions[0]?.id || "");
  const [q, setQ] = useState("");
  const s = sessions.find((x) => x.id === sid);
  if (!attendees) return <p className="fw-p">Loading registrants…</p>;

  const signedUp = attendees.filter((a) => (a.sessions || []).includes(sid));
  const walkIns = q
    ? attendees.filter(
        (a) =>
          !(a.sessions || []).includes(sid) &&
          (a.name + a.email + (a.company || "")).toLowerCase().includes(q.toLowerCase())
      )
    : [];
  const checked = signedUp.filter((a) => a.checkins?.[sid]).length;

  const toggle = (a) => onSave({ ...a, checkins: { ...(a.checkins || {}), [sid]: !a.checkins?.[sid] } });

  return (
    <div>
      <label className="fw-label">Session</label>
      <select className="fw-input" value={sid} onChange={(e) => setSid(e.target.value)}>
        {config.days.map((d) => (
          <optgroup key={d.id} label={d.label}>
            {sessions
              .filter((x) => x.day === d.id)
              .sort((a, b) => a.start.localeCompare(b.start))
              .map((x) => (
                <option key={x.id} value={x.id}>
                  {fmtTime(x.start)} — {x.title}
                </option>
              ))}
          </optgroup>
        ))}
      </select>
      {s && (
        <div className="fw-statrow">
          <Stat n={signedUp.length} label="signed up" />
          <Stat n={checked} label="checked in" />
          <Stat
            n={signedUp.length ? Math.round((checked / signedUp.length) * 100) + "%" : "—"}
            label="show rate"
          />
        </div>
      )}
      <div className="fw-roster">
        {signedUp.length === 0 && <p className="fw-p">Nobody has registered for this session yet.</p>}
        {signedUp.map((a) => (
          <button
            key={a.email}
            className={"fw-person" + (a.checkins?.[sid] ? " in" : "")}
            onClick={() => toggle(a)}
          >
            <span>
              <strong>{a.name}</strong> <span className="fw-muted">{a.company}</span>
            </span>
            <span className="fw-checkpill">{a.checkins?.[sid] ? "✓ Checked in" : "Tap to check in"}</span>
          </button>
        ))}
      </div>
      <label className="fw-label" style={{ marginTop: 20 }}>
        Walk-in? Search all registrants
      </label>
      <input
        className="fw-input"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search name, company, email…"
      />
      {walkIns.slice(0, 6).map((a) => (
        <button
          key={a.email}
          className="fw-person"
          onClick={() =>
            onSave({
              ...a,
              sessions: [...(a.sessions || []), sid],
              checkins: { ...(a.checkins || {}), [sid]: true },
            })
          }
        >
          <span>
            <strong>{a.name}</strong> <span className="fw-muted">{a.company}</span>
          </span>
          <span className="fw-checkpill">+ Add & check in</span>
        </button>
      ))}
    </div>
  );
}

/* ── registrants + catering + room block ─────────────────────── */
function Registrants({ config, sessions, attendees, flash, onDelete }) {
  if (!attendees) return <p className="fw-p">Loading registrants…</p>;

  const dietCounts = {};
  attendees.forEach((a) => (a.dietary || []).forEach((d) => (dietCounts[d] = (dietCounts[d] || 0) + 1)));
  const others = attendees.filter((a) => a.dietaryOther?.trim());

  const exportCsv = () => {
    const head = [
      "First name", "Last name", "Email", "Company", "Type", "Days", "Hotel",
      "Hotel nights", "Dietary", "Dietary notes", "Registered", "Sessions", "Check-ins",
    ];
    const rows = attendees.map((a) => [
      a.firstName || (a.name || "").split(" ")[0],
      a.lastName || (a.name || "").split(" ").slice(1).join(" "),
      a.email, a.company || "", a.type || "",
      (a.attending || []).map((id) => config.days.findIndex((d) => d.id === id) + 1).sort().join(" "),
      a.hotel === "yes" ? "Yes" : a.hotel === "no" ? "No" : "",
      (a.hotelNights || []).join("; "),
      (a.dietary || []).join("; "), a.dietaryOther || "",
      a.createdAt?.slice(0, 10) || "",
      (a.sessions || []).map((sid) => sessions.find((s) => s.id === sid)?.title || sid).join("; "),
      Object.keys(a.checkins || {})
        .filter((k) => a.checkins[k])
        .map((sid) => sessions.find((s) => s.id === sid)?.title || sid)
        .join("; "),
    ]);
    const csv = [head, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "registrants.csv";
    link.click();
    URL.revokeObjectURL(url);
    flash("CSV downloaded.");
  };

  const hotelYes = attendees.filter((a) => a.hotel === "yes");
  const nightCounts = {};
  hotelYes.forEach((a) => (a.hotelNights || []).forEach((n) => (nightCounts[n] = (nightCounts[n] || 0) + 1)));

  return (
    <div>
      <div className="fw-statrow">
        <Stat n={attendees.length} label="registered" />
        <Stat n={attendees.filter((a) => a.type === "LP").length} label="LPs" />
        <Stat n={attendees.filter((a) => a.type === "Founder").length} label="founders" />
        <Stat n={hotelYes.length} label="hotel stays" />
        <button
          className="fw-primary"
          style={{ marginLeft: "auto", width: "auto", marginTop: 0 }}
          onClick={exportCsv}
        >
          Export CSV
        </button>
      </div>

      <div className="fw-cater">
        <div className="fw-label" style={{ margin: "0 0 8px" }}>
          Room block — {config.hotelBlockTarget || 25} rooms/night required on{" "}
          {(config.blockNights || []).join(" & ")}
        </div>
        {HOTEL_NIGHTS.map((n) => {
          const guest = nightCounts[n] || 0;
          const isBlock = (config.blockNights || []).includes(n);
          const team = isBlock ? config.hotelTeamRooms || 0 : 0;
          const total = guest + team;
          const target = config.hotelBlockTarget || 25;
          const gap = target - total;
          return (
            <div key={n} className="fw-blockrow">
              <span className="fw-mono">{n}</span>
              <div className="fw-blockbar">
                <div
                  className={"fw-blockfill" + (isBlock && gap > 0 ? " short" : " ok")}
                  style={{
                    width: isBlock
                      ? Math.min(100, (total / target) * 100) + "%"
                      : guest > 0
                      ? Math.min(100, (guest / target) * 100) + "%"
                      : "0%",
                  }}
                />
              </div>
              <span className="fw-blocknum">
                {isBlock
                  ? `${total} / ${target}` +
                    (team ? ` (${guest} guests + ${team} team)` : "") +
                    (gap > 0 ? ` · ${gap} to fill` : " · filled ✓")
                  : `${guest} guest${guest === 1 ? "" : "s"}`}
              </span>
            </div>
          );
        })}
      </div>

      {(Object.keys(dietCounts).length > 0 || others.length > 0) && (
        <div className="fw-cater">
          <div className="fw-label" style={{ margin: "0 0 8px" }}>
            Catering summary
          </div>
          <div className="fw-caterchips">
            {Object.entries(dietCounts).map(([d, n]) => (
              <span key={d} className="fw-caterchip">
                {d} × {n}
              </span>
            ))}
          </div>
          {others.map((a) => (
            <div key={a.email} className="fw-muted" style={{ marginTop: 6 }}>
              {a.name}: “{a.dietaryOther}”
            </div>
          ))}
        </div>
      )}

      <div className="fw-dayhead">
        <span>Session totals</span>
        <span className="fw-daydate2">registered · checked in</span>
      </div>
      {config.days.map((d) => (
        <div key={d.id}>
          {sessions
            .filter((s) => s.day === d.id)
            .sort((a, b) => a.start.localeCompare(b.start))
            .map((s) => {
              const reg = attendees.filter((a) => (a.sessions || []).includes(s.id)).length;
              const chk = attendees.filter((a) => a.checkins?.[s.id]).length;
              return (
                <div className="fw-editrow" key={s.id}>
                  <span className="fw-mono">{fmtTime(s.start)}</span>
                  <span>
                    <strong>{s.title}</strong>{" "}
                    <span className="fw-muted">
                      {d.date.split(",")[0]}
                      {s.capacity > 0 ? ` · cap ${s.capacity}` : ""}
                    </span>
                  </span>
                  <span className="fw-mono">
                    {reg} · {chk}
                  </span>
                </div>
              );
            })}
        </div>
      ))}
      <div style={{ height: 24 }} />
      <div className="fw-table">
        <div className="fw-tr fw-th">
          <span>Name</span>
          <span>Company</span>
          <span>Type</span>
          <span>Days</span>
          <span>Sessions</span>
          <span></span>
        </div>
        {attendees.map((a) => (
          <div className="fw-tr" key={a.email}>
            <span>
              <strong>{a.name}</strong>
              <br />
              <span className="fw-muted">{a.email}</span>
              {(a.dietary || []).length > 0 && (
                <>
                  <br />
                  <span className="fw-dietnote">{a.dietary.join(" · ")}</span>
                </>
              )}
            </span>
            <span>{a.company}</span>
            <span>{a.type}</span>
            <span>
              {(a.attending || []).length === config.days.length
                ? "All"
                : (a.attending || [])
                    .map((id) => config.days.findIndex((d) => d.id === id) + 1)
                    .sort()
                    .join(", ")}
            </span>
            <span>{(a.sessions || []).length}</span>
            <span>
              <button
                className="fw-del"
                onClick={() => {
                  if (window.confirm(`Remove ${a.name}?`)) onDelete(a);
                }}
              >
                Remove
              </button>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── confirmations (template editor + resend failures) ───────── */
function Confirmations({ config, attendees, saveConfig, reload, flash }) {
  const [subject, setSubject] = useState(config.confirmSubject || DEFAULT_SUBJECT);
  const [template, setTemplate] = useState(config.confirmTemplate || DEFAULT_TEMPLATE);
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState("");

  if (!attendees) return <p className="fw-p">Loading registrants…</p>;
  const pending = attendees.filter((a) => !a.confirmedAt);
  const sent = attendees.length - pending.length;
  const dirty =
    subject !== (config.confirmSubject || DEFAULT_SUBJECT) ||
    template !== (config.confirmTemplate || DEFAULT_TEMPLATE);

  const resend = async () => {
    setSending(true);
    setProgress("Sending…");
    const r = await api.adminResend();
    setSending(false);
    if (!r.ok) {
      setProgress(r.error || "Couldn't send.");
      return;
    }
    setProgress(
      r.failures?.length
        ? `Sent ${r.sent} of ${r.attempted} — ${r.failures.length} failed (check the Resend setup).`
        : `Sent ${r.sent} confirmation${r.sent === 1 ? "" : "s"} ✓`
    );
    reload && reload();
  };

  return (
    <div className="fw-narrow2">
      <div className="fw-statrow">
        <Stat n={sent} label="confirmed" />
        <Stat n={pending.length} label="not yet emailed" />
      </div>
      <p className="fw-p">
        Confirmation emails now send <strong>automatically the moment someone registers</strong>, via
        Resend. Edit the template below — new registrations use it right away. The button re-sends to
        anyone whose automatic email didn't go through.
      </p>
      <label className="fw-label">Subject</label>
      <input className="fw-input" value={subject} onChange={(e) => setSubject(e.target.value)} />
      <label className="fw-label">
        Email template — placeholders:{" "}
        {"{firstName} {days} {sessions} {hotelNote} {slackChannel} {slackUrl} {appUrl}"}
      </label>
      <p className="fw-p" style={{ fontSize: 13, margin: "0 0 6px" }}>
        To add a link, write it as <span className="fw-mono">[label](url)</span> — for example{" "}
        <span className="fw-mono">[open the event app]({"{appUrl}"})</span>. It becomes a real
        hyperlink in the email.
      </p>
      <textarea
        className="fw-input"
        rows={14}
        value={template}
        onChange={(e) => setTemplate(e.target.value)}
        style={{ fontSize: 13, lineHeight: 1.5 }}
      />
      {dirty && (
        <button
          className="fw-linkbtn"
          onClick={() => saveConfig({ ...config, confirmSubject: subject, confirmTemplate: template })}
        >
          Save template
        </button>
      )}
      <button
        className="fw-primary"
        disabled={sending || pending.length === 0}
        onClick={resend}
      >
        {sending
          ? "Sending…"
          : pending.length === 0
          ? "Everyone's been emailed ✓"
          : `Re-send ${pending.length} missed confirmation${pending.length === 1 ? "" : "s"}`}
      </button>
      {progress && (
        <p className="fw-p" style={{ marginTop: 12 }}>
          {progress}
        </p>
      )}
    </div>
  );
}

/* ── compose + broadcast updates ─────────────────────────────── */
function SendUpdate({ config, announcements, setAnnouncements, flash }) {
  const [text, setText] = useState("");
  const [author, setAuthor] = useState("Flybridge team");
  const [toSlack, setToSlack] = useState(false);
  const [busy, setBusy] = useState(false);

  const send = async () => {
    if (!text.trim()) {
      flash("Write the update first.");
      return;
    }
    setBusy(true);
    const r = await api.adminPublish({ text: text.trim(), author, toSlack });
    setBusy(false);
    if (!r.ok) {
      flash(r.error || "Couldn't save the update — try again.");
      return;
    }
    setAnnouncements([...(announcements || []), r.item]);
    setText("");
    let slackNote = "";
    if (toSlack) {
      slackNote = r.slack?.posted
        ? " and posted to Slack"
        : " — but the Slack post failed (check your Slack setup)";
    }
    flash("Update published" + slackNote + ".");
  };

  const remove = async (id) => {
    const r = await api.adminDeleteUpdate(id);
    if (r.ok) setAnnouncements((announcements || []).filter((a) => a.id !== id));
    else flash(r.error || "Couldn't delete.");
  };

  const items = announcements || [];

  return (
    <div className="fw-narrow2">
      <label className="fw-label">From</label>
      <input className="fw-input" value={author} onChange={(e) => setAuthor(e.target.value)} />
      <label className="fw-label">Update</label>
      <textarea
        className="fw-input"
        rows={4}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Doors open at 8:30 — coffee's on the terrace. GTM Clinic moved to Workshop B."
      />
      <label className="fw-checkrow">
        <input type="checkbox" checked={toSlack} onChange={(e) => setToSlack(e.target.checked)} />
        <span>
          Also post to {config.slackChannel || "Slack"}{" "}
          <span className="fw-muted">(uses your Slack webhook)</span>
        </span>
      </label>
      <button className="fw-primary" disabled={busy} onClick={send}>
        {busy ? "Publishing…" : "Publish update"}
      </button>

      {items.length > 0 && (
        <div style={{ marginTop: 28 }}>
          <div className="fw-dayhead">
            <span>Published</span>
          </div>
          {[...items]
            .sort((a, b) => (b.ts || "").localeCompare(a.ts || ""))
            .map((a) => (
              <div className="fw-announce" key={a.id}>
                <div className="fw-announcemeta">
                  {a.author} · {fmtWhen(a.ts)}{" "}
                  <button className="fw-del" onClick={() => remove(a.id)}>
                    Delete
                  </button>
                </div>
                <div className="fw-announcetext">{a.text}</div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

/* ── session editor ──────────────────────────────────────────── */
function SessionEditor({ days, sessions, speakers, saveSessions, flash }) {
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);

  /* The editor renders above the session list, so opening it from a row
     far down the page would scroll it out of sight and look like nothing
     happened. Bring it into view whenever a different session is opened
     (keyed on id, so it doesn't re-scroll on every keystroke). */
  const editorRef = useRef(null);
  const editingId = editing ? editing.id || "new" : null;
  useEffect(() => {
    if (editingId && editorRef.current) {
      editorRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [editingId]);
  const blank = {
    id: "",
    day: days[0]?.id,
    start: "09:00",
    end: "10:00",
    title: "",
    speaker: "",
    location: "",
    track: "Founders",
    capacity: 0,
    desc: "",
    speakerIds: [],
  };
  const save = async () => {
    if (!editing.title.trim()) {
      flash("Give the session a title.");
      return;
    }
    setBusy(true);
    let next;
    if (editing.id) next = sessions.map((s) => (s.id === editing.id ? editing : s));
    else next = [...sessions, { ...editing, id: "x" + Math.random().toString(36).slice(2, 9) }];
    const r = await saveSessions(next);
    setBusy(false);
    if (r.ok) {
      setEditing(null);
      flash("Session saved.");
    }
  };
  const remove = async (id) => {
    if (!window.confirm("Delete this session?")) return;
    await saveSessions(sessions.filter((s) => s.id !== id));
  };
  return (
    <div>
      {!editing && (
        <button
          className="fw-primary"
          style={{ width: "auto", marginBottom: 16 }}
          onClick={() => setEditing({ ...blank })}
        >
          + New session
        </button>
      )}
      {editing && (
        <div className="fw-editor" ref={editorRef}>
          <div className="fw-dayhead" style={{ padding: "0 0 8px", marginBottom: 14 }}>
            <span>{editing.id ? "Editing session" : "New session"}</span>
            <button className="fw-linkbtn" onClick={() => setEditing(null)}>
              Close
            </button>
          </div>
          <label className="fw-label">Title</label>
          <input
            className="fw-input"
            value={editing.title}
            onChange={(e) => setEditing({ ...editing, title: e.target.value })}
          />
          <div className="fw-grid2">
            <div>
              <label className="fw-label">Day</label>
              <select
                className="fw-input"
                value={editing.day}
                onChange={(e) => setEditing({ ...editing, day: e.target.value })}
              >
                {days.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="fw-label">Track(s) — join with + for multiple</label>
              <input
                className="fw-input"
                value={editing.track}
                onChange={(e) => setEditing({ ...editing, track: e.target.value })}
                placeholder="AGM, Founders, Capital, or Social — e.g. AGM+Social"
              />
            </div>
            <div>
              <label className="fw-label">Starts</label>
              <input
                className="fw-input"
                type="time"
                value={editing.start}
                onChange={(e) => setEditing({ ...editing, start: e.target.value })}
              />
            </div>
            <div>
              <label className="fw-label">Ends</label>
              <input
                className="fw-input"
                type="time"
                value={editing.end}
                onChange={(e) => setEditing({ ...editing, end: e.target.value })}
              />
            </div>
            <div>
              <label className="fw-label">Location</label>
              <input
                className="fw-input"
                value={editing.location}
                onChange={(e) => setEditing({ ...editing, location: e.target.value })}
              />
            </div>
            <div>
              <label className="fw-label">Capacity (0 = open)</label>
              <input
                className="fw-input"
                type="number"
                value={editing.capacity}
                onChange={(e) => setEditing({ ...editing, capacity: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="fw-label">Access code (optional)</label>
              <input
                className="fw-input"
                value={editing.accessCode || ""}
                onChange={(e) => setEditing({ ...editing, accessCode: e.target.value })}
                placeholder="Leave blank for open registration"
              />
            </div>
            <div>
              <label className="fw-label">Button label (optional)</label>
              <input
                className="fw-input"
                value={editing.cta || ""}
                onChange={(e) => setEditing({ ...editing, cta: e.target.value })}
                placeholder='Default: "+ Register for session"'
              />
            </div>
          </div>
          <label className="fw-label">Speaker / host</label>
          <input
            className="fw-input"
            value={editing.speaker}
            onChange={(e) => setEditing({ ...editing, speaker: e.target.value })}
          />
          <label className="fw-label">Description</label>
          <textarea
            className="fw-input"
            rows={2}
            value={editing.desc}
            onChange={(e) => setEditing({ ...editing, desc: e.target.value })}
          />
          {speakers && speakers.length > 0 && (
            <>
              <label className="fw-label">Speakers (tap to attach — multiple for panels)</label>
              <div className="fw-seg" style={{ maxHeight: 200, overflow: "auto" }}>
                {speakers.map((sp) => {
                  const on = (editing.speakerIds || []).includes(sp.id);
                  return (
                    <button
                      key={sp.id}
                      className={on ? "on" : ""}
                      onClick={() => {
                        const cur = editing.speakerIds || [];
                        setEditing({
                          ...editing,
                          speakerIds: on ? cur.filter((x) => x !== sp.id) : [...cur, sp.id],
                        });
                      }}
                    >
                      {sp.name}
                      {sp.published ? "" : " (draft)"}
                    </button>
                  );
                })}
              </div>
              <p className="fw-p" style={{ fontSize: 13, marginTop: 6 }}>
                Attached speakers show on the session once they're published. Add speakers in the
                Speakers tab.
              </p>
            </>
          )}
          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <button className="fw-primary" style={{ width: "auto" }} disabled={busy} onClick={save}>
              {busy ? "Saving…" : "Save session"}
            </button>
            <button className="fw-linkbtn" onClick={() => setEditing(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}
      {days.map((d) => (
        <div key={d.id}>
          <div className="fw-dayhead">
            <span>{d.label}</span>
          </div>
          {sessions
            .filter((s) => s.day === d.id)
            .sort((a, b) => a.start.localeCompare(b.start))
            .map((s) => (
              <div className="fw-editrow" key={s.id}>
                <span className="fw-mono">{fmtTime(s.start)}</span>
                <span>
                  <strong>{s.title}</strong> <span className="fw-muted">{s.location}</span>
                </span>
                <span>
                  <button className="fw-linkbtn" onClick={() => setEditing({ ...s })}>
                    Edit
                  </button>
                  <button className="fw-del" onClick={() => remove(s.id)}>
                    Delete
                  </button>
                </span>
              </div>
            ))}
        </div>
      ))}
    </div>
  );
}

/* ── settings ────────────────────────────────────────────────── */
function Settings({ config, saveConfig, flash }) {
  const [f, setF] = useState({
    title: config.title,
    city: config.city,
    slackInviteUrl: config.slackInviteUrl || "",
    slackChannel: config.slackChannel || "",
    hotelBookingUrl: config.hotelBookingUrl || "",
    hotelBlockTarget: config.hotelBlockTarget ?? 25,
    hotelTeamRooms: config.hotelTeamRooms ?? 9,
    hotelRateFounder: config.hotelRateFounder ?? 399,
    hotelRateStandard: config.hotelRateStandard ?? 549,
    days: config.days,
  });
  return (
    <div className="fw-narrow2">
      <label className="fw-label">Event name</label>
      <input className="fw-input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
      <label className="fw-label">City</label>
      <input className="fw-input" value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} />
      <label className="fw-label">Host tools password</label>
      <p className="fw-p" style={{ marginTop: 0 }}>
        The password is set with the <span className="fw-mono">ADMIN_PASSWORD</span> environment
        variable (in Vercel → Settings → Environment Variables), so it never ships to the browser.
        Change it there and redeploy.
      </p>
      <label className="fw-label">Slack invite link (shown to attendees)</label>
      <input
        className="fw-input"
        value={f.slackInviteUrl}
        onChange={(e) => setF({ ...f, slackInviteUrl: e.target.value })}
        placeholder="https://join.slack.com/t/…"
      />
      <label className="fw-label">Slack channel for updates</label>
      <input
        className="fw-input"
        value={f.slackChannel}
        onChange={(e) => setF({ ...f, slackChannel: e.target.value })}
        placeholder="#founders-week"
      />
      <label className="fw-label">Hotel booking link (room block — appears in confirmation emails)</label>
      <input
        className="fw-input"
        value={f.hotelBookingUrl}
        onChange={(e) => setF({ ...f, hotelBookingUrl: e.target.value })}
        placeholder="Paste the William Vale room-block link when you have it"
      />
      <div className="fw-grid2">
        <div>
          <label className="fw-label">Room block (rooms/night)</label>
          <input
            className="fw-input"
            type="number"
            value={f.hotelBlockTarget}
            onChange={(e) => setF({ ...f, hotelBlockTarget: Number(e.target.value) })}
          />
        </div>
        <div>
          <label className="fw-label">Team rooms/night</label>
          <input
            className="fw-input"
            type="number"
            value={f.hotelTeamRooms}
            onChange={(e) => setF({ ...f, hotelTeamRooms: Number(e.target.value) })}
          />
        </div>
      </div>
      <div className="fw-grid2">
        <div>
          <label className="fw-label">Founder room rate ($/night)</label>
          <input
            className="fw-input"
            type="number"
            value={f.hotelRateFounder}
            onChange={(e) => setF({ ...f, hotelRateFounder: Number(e.target.value) })}
          />
        </div>
        <div>
          <label className="fw-label">LP / Guest / Team rate ($/night)</label>
          <input
            className="fw-input"
            type="number"
            value={f.hotelRateStandard}
            onChange={(e) => setF({ ...f, hotelRateStandard: Number(e.target.value) })}
          />
        </div>
      </div>
      <p className="fw-p" style={{ fontSize: 13, marginTop: 8 }}>
        These rates appear in the confirmation email — Founders see the founder rate, everyone else
        sees the standard rate. The booking link above is the same for everyone; the email notes that
        no price shows on the booking page.
      </p>
      {f.days.map((d, i) => (
        <div className="fw-grid2" key={d.id}>
          <div>
            <label className="fw-label">Day {i + 1} label</label>
            <input
              className="fw-input"
              value={d.label}
              onChange={(e) => {
                const days = [...f.days];
                days[i] = { ...d, label: e.target.value };
                setF({ ...f, days });
              }}
            />
          </div>
          <div>
            <label className="fw-label">Date</label>
            <input
              className="fw-input"
              value={d.date}
              onChange={(e) => {
                const days = [...f.days];
                days[i] = { ...d, date: e.target.value };
                setF({ ...f, days });
              }}
            />
          </div>
        </div>
      ))}
      <button
        className="fw-primary"
        onClick={async () => {
          await saveConfig({ ...config, ...f });
          flash("Settings saved.");
        }}
      >
        Save settings
      </button>
    </div>
  );
}

/* ── speakers admin ──────────────────────────────────────────── */
function SpeakersAdmin({ speakers, saveSpeaker, removeSpeaker, bulkAddSpeakers, uploadSpeakerPhoto, flash }) {
  const [editing, setEditing] = useState(null);
  const [bulk, setBulk] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);

  if (speakers === null) {
    return (
      <div className="fw-narrow2">
        <h3 className="fw-h2" style={{ fontSize: 20 }}>One-time setup needed</h3>
        <p className="fw-p">
          The Speakers feature needs a quick database table added. Run{" "}
          <span className="fw-mono">db/speakers.sql</span> in your Supabase SQL Editor (same place you
          ran the first setup), then tap <strong>↻ Refresh</strong> above.
        </p>
      </div>
    );
  }

  const speakerLink = (s) =>
    s.token && typeof window !== "undefined"
      ? `${window.location.origin}/speaker/${s.token}`
      : "";

  const copyLink = async (s) => {
    const link = speakerLink(s);
    if (!link) {
      flash("Link isn't ready — tap ↻ Refresh, then try again.");
      return;
    }
    try {
      await navigator.clipboard.writeText(link);
      flash(`Copied ${s.name}'s private link.`);
    } catch {
      flash("Couldn't copy automatically — use Export links CSV instead.");
    }
  };

  const exportCsv = () => {
    const head = [
      "First name",
      "Last name",
      "Email",
      "Title",
      "Company",
      "Published",
      "Speaker link",
      "Photo (print)",
    ];
    const rows = speakers.map((s) => [
      s.firstName || "",
      s.lastName || "",
      s.email || "",
      s.title || "",
      s.company || "",
      s.published ? "Yes" : "No",
      speakerLink(s),
      s.photoUrl || "",
    ]);
    const csv = [head, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "speaker-links.csv";
    a.click();
    URL.revokeObjectURL(url);
    flash("Speaker links CSV downloaded.");
  };

  const doBulk = async () => {
    const list = bulk
      .split("\n")
      .map((line) => {
        const parts = line.split(/\t|,/).map((p) => p.trim());
        if (!parts[0]) return null;
        return {
          firstName: parts[0],
          lastName: parts[1] || "",
          title: parts[2] || "",
          company: parts[3] || "",
          email: parts[4] || "",
        };
      })
      .filter(Boolean);
    if (!list.length) {
      flash("Paste at least one speaker (Name, Title, Company).");
      return;
    }
    setBulkBusy(true);
    const r = await bulkAddSpeakers(list);
    setBulkBusy(false);
    if (r.ok) {
      setBulk("");
      flash(`Added ${r.added} speaker${r.added === 1 ? "" : "s"} (as drafts).`);
    }
  };

  if (editing) {
    return (
      <SpeakerEditor
        speaker={editing}
        onClose={() => setEditing(null)}
        saveSpeaker={saveSpeaker}
        uploadSpeakerPhoto={uploadSpeakerPhoto}
        flash={flash}
      />
    );
  }

  return (
    <div>
      <button
        className="fw-primary"
        style={{ width: "auto", marginBottom: 16 }}
        onClick={() =>
          setEditing({
            firstName: "",
            lastName: "",
            title: "",
            company: "",
            bio: "",
            link: "",
            email: "",
            published: false,
          })
        }
      >
        + New speaker
      </button>

      <div className="fw-cater">
        <div className="fw-label" style={{ margin: "0 0 8px" }}>
          Bulk add — one per line: First, Last, Title, Company, Email (last/title/company/email
          optional)
        </div>
        <textarea
          className="fw-input"
          rows={5}
          value={bulk}
          onChange={(e) => setBulk(e.target.value)}
          placeholder={"Jane, Doe, CEO, Acme, jane@acme.com\nJohn, Smith, General Partner, Flybridge, john@flybridge.com"}
          style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13 }}
        />
        <button className="fw-primary" style={{ width: "auto" }} disabled={bulkBusy} onClick={doBulk}>
          {bulkBusy ? "Adding…" : "Add speakers"}
        </button>
        <p className="fw-p" style={{ fontSize: 13, marginTop: 8 }}>
          Added as unpublished drafts — open each to add a bio and photo, then publish when confirmed.
        </p>
      </div>

      <div className="fw-statrow">
        <Stat n={speakers.length} label="speakers" />
        <Stat n={speakers.filter((s) => s.published).length} label="published" />
        <Stat n={speakers.filter((s) => s.photoUrl).length} label="with photo" />
        {speakers.length > 0 && (
          <button
            className="fw-primary"
            style={{ marginLeft: "auto", width: "auto", marginTop: 0 }}
            onClick={exportCsv}
          >
            Export links CSV
          </button>
        )}
      </div>
      {speakers.length > 0 && (
        <p className="fw-p" style={{ fontSize: 13, marginTop: -6 }}>
          Each speaker has a private link to upload their own photo and bio. Use{" "}
          <strong>Export links CSV</strong> to mail-merge them, or <strong>Copy link</strong> on a
          single speaker.
        </p>
      )}

      <div className="fw-roster">
        {speakers.length === 0 && <p className="fw-p">No speakers yet — add some above.</p>}
        {speakers.map((s) => (
          <div className="fw-person" key={s.id} style={{ cursor: "default" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <SpeakerAvatar speaker={s} size={36} />
              <span>
                <strong>{s.name}</strong>{" "}
                <span className="fw-muted">{[s.title, s.company].filter(Boolean).join(" · ")}</span>
              </span>
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <label className="fw-checkrow" style={{ marginTop: 0 }}>
                <input
                  type="checkbox"
                  checked={s.published}
                  onChange={(e) => saveSpeaker({ ...s, published: e.target.checked })}
                />
                <span className="fw-muted">Published</span>
              </label>
              <button className="fw-linkbtn" onClick={() => copyLink(s)}>
                Copy link
              </button>
              <button className="fw-linkbtn" onClick={() => setEditing(s)}>
                Edit
              </button>
              <button
                className="fw-del"
                onClick={() => {
                  if (window.confirm(`Remove ${s.name}?`)) removeSpeaker(s.id);
                }}
              >
                Remove
              </button>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SpeakerEditor({ speaker, onClose, saveSpeaker, uploadSpeakerPhoto, flash }) {
  const [f, setF] = useState({ ...speaker });
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const save = async () => {
    if (!f.name.trim()) {
      flash("Name is required.");
      return;
    }
    setBusy(true);
    const r = await saveSpeaker(f);
    setBusy(false);
    if (r.ok) onClose();
  };

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    // Uploading needs a saved speaker (an id). Save first if this is new.
    let id = f.id;
    if (!id) {
      if (!f.name.trim()) {
        flash("Add a name before uploading a photo.");
        return;
      }
      const r = await saveSpeaker(f);
      if (!r.ok) return;
      id = r.speaker.id;
      setF(r.speaker);
    }
    setUploading(true);
    const r = await uploadSpeakerPhoto(id, file);
    setUploading(false);
    if (r.ok) setF((prev) => ({ ...prev, id, photoUrl: r.photoUrl }));
  };

  return (
    <div className="fw-editor">
      <div className="fw-dayhead" style={{ padding: "0 0 8px", marginBottom: 14 }}>
        <span>{f.id ? "Edit speaker" : "New speaker"}</span>
        <button className="fw-linkbtn" onClick={onClose}>
          Close
        </button>
      </div>

      <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 14 }}>
        <SpeakerAvatar speaker={f} size={64} />
        <div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={onFile}
          />
          <button className="fw-add" disabled={uploading} onClick={() => fileRef.current?.click()}>
            {uploading ? "Uploading…" : f.photoUrl ? "Replace photo" : "Upload photo"}
          </button>
          <p className="fw-muted" style={{ marginTop: 6 }}>
            High-res headshot, JPG/PNG, under 4MB — used for the app and event signage. A monogram
            shows until you add one.
          </p>
        </div>
      </div>

      <div className="fw-grid2">
        <div>
          <label className="fw-label">First name</label>
          <input
            className="fw-input"
            value={f.firstName || ""}
            onChange={(e) => setF({ ...f, firstName: e.target.value })}
          />
        </div>
        <div>
          <label className="fw-label">Last name</label>
          <input
            className="fw-input"
            value={f.lastName || ""}
            onChange={(e) => setF({ ...f, lastName: e.target.value })}
          />
        </div>
      </div>
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
      <label className="fw-label">Email (for their private edit link — not shown publicly)</label>
      <input
        className="fw-input"
        value={f.email || ""}
        onChange={(e) => setF({ ...f, email: e.target.value })}
        placeholder="speaker@company.com"
      />
      <label className="fw-label">Bio (optional)</label>
      <textarea
        className="fw-input"
        rows={3}
        value={f.bio}
        onChange={(e) => setF({ ...f, bio: e.target.value })}
      />
      <label className="fw-label">Link — LinkedIn / X / site (optional)</label>
      <input
        className="fw-input"
        value={f.link}
        onChange={(e) => setF({ ...f, link: e.target.value })}
        placeholder="https://…"
      />
      <label className="fw-checkrow">
        <input
          type="checkbox"
          checked={f.published}
          onChange={(e) => setF({ ...f, published: e.target.checked })}
        />
        <span>
          <strong>Published</strong> — visible to attendees on the Speakers page and their sessions
        </span>
      </label>
      <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
        <button className="fw-primary" style={{ width: "auto" }} disabled={busy} onClick={save}>
          {busy ? "Saving…" : "Save speaker"}
        </button>
        <button className="fw-linkbtn" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
}
