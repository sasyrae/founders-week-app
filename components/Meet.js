"use client";
import { useState, useEffect } from "react";
import { api } from "./api";
import { MATCH_TAGS } from "../lib/tags";

/* "Meet people": opt-in profile, AI-suggested matches, and double-opt-in
   meeting requests. Once opted in, matches + requests lead and the profile
   editor collapses below. Identity comes from the personal link (handled in
   App). Nothing here is visible to anyone else until the person opts in, and
   contact details appear only after both sides accept a request. */
export default function Meet({ flash, onPendingChange }) {
  const [state, setState] = useState("loading"); // loading | ready | anon | missing | error
  const [identity, setIdentity] = useState(null);
  const [seededDraft, setSeededDraft] = useState(false);
  const [workingOn, setWorkingOn] = useState("");
  const [lookingFor, setLookingFor] = useState([]);
  const [canHelp, setCanHelp] = useState([]);
  const [linkedin, setLinkedin] = useState("");
  const [optedIn, setOptedIn] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [matches, setMatches] = useState(null); // null = not loaded
  const [requests, setRequests] = useState(null); // {incoming, outgoing, pendingIncoming}

  useEffect(() => {
    (async () => {
      const r = await api.meetGetProfile();
      if (r.ok) {
        setIdentity(r.identity);
        const p = r.profile;
        const d = r.draft || { workingOn: "", lookingFor: [], canHelpWith: [] };
        const base = p || d;
        setWorkingOn(base.workingOn || "");
        setLookingFor(base.lookingFor || []);
        setCanHelp(base.canHelpWith || []);
        setLinkedin((p && p.linkedin) || "");
        setOptedIn(!!(p && p.optedIn));
        setEditorOpen(!(p && p.optedIn)); // open when they still need to opt in
        setSeededDraft(
          !p && !!((d.workingOn && d.workingOn.trim()) || d.lookingFor.length || d.canHelpWith.length)
        );
        setState("ready");
        if (p && p.optedIn) {
          loadMatches();
          loadRequests();
        }
      } else if (r.status === 401) setState("anon");
      else if (r.status === 404) setState("missing");
      else {
        setErr(r.error || "Something went wrong.");
        setState("error");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadMatches = async () => {
    const r = await api.meetGetMatches();
    if (r.ok) setMatches(r.items || []);
  };
  const loadRequests = async () => {
    const r = await api.meetGetRequests();
    if (r.ok) {
      setRequests(r);
      onPendingChange && onPendingChange(r.pendingIncoming || 0);
    }
  };

  const toggle = (list, setList, tag) =>
    setList(list.includes(tag) ? list.filter((t) => t !== tag) : [...list, tag]);

  const save = async (nextOptedIn) => {
    setBusy(true);
    setErr("");
    const r = await api.meetSaveProfile({
      workingOn,
      lookingFor,
      canHelpWith: canHelp,
      linkedin,
      optedIn: nextOptedIn,
    });
    setBusy(false);
    if (r.ok) {
      setOptedIn(!!r.profile.optedIn);
      setSeededDraft(false);
      flash && flash(nextOptedIn ? "You're in — thanks! You can edit anytime." : "Saved.");
      if (nextOptedIn) {
        setEditorOpen(false);
        loadMatches();
        loadRequests();
      } else {
        setMatches(null);
        setRequests(null);
        onPendingChange && onPendingChange(0);
      }
    } else {
      setErr(r.error || "Couldn't save — try again.");
    }
  };

  const onRequested = () => {
    loadMatches();
    loadRequests();
  };
  const respond = async (id, action) => {
    const r = await api.meetRespond(id, action);
    if (r.ok) {
      loadRequests();
      loadMatches();
      flash && flash(action === "accept" ? "Accepted — contact details are now shared." : "Declined.");
    } else flash && flash(r.error || "Couldn't update the request.");
  };

  if (state === "loading")
    return (
      <main className="fw-main fw-narrow">
        <p className="fw-p">Loading…</p>
      </main>
    );

  if (state === "anon" || state === "missing")
    return (
      <main className="fw-main fw-narrow">
        <h2 className="fw-h2">Meet people</h2>
        <p className="fw-p">
          {state === "anon"
            ? "To set up your profile and see who to meet, open the personal link we emailed you — it signs you in on this device."
            : "We couldn't find your registration yet. Reply to our email and we'll get you set up."}
        </p>
        {state === "anon" && <p className="fw-muted">Can't find it? Reply to that email and we'll resend your link.</p>}
      </main>
    );

  if (state === "error")
    return (
      <main className="fw-main fw-narrow">
        <h2 className="fw-h2">Meet people</h2>
        <p className="fw-p">{err}</p>
      </main>
    );

  const who = identity || {};
  const name = [who.firstName, who.lastName].filter(Boolean).join(" ");
  const profileEditor = (
    <ProfileEditor
      seededDraft={seededDraft && !optedIn}
      optedIn={optedIn}
      workingOn={workingOn}
      setWorkingOn={setWorkingOn}
      lookingFor={lookingFor}
      canHelp={canHelp}
      linkedin={linkedin}
      setLinkedin={setLinkedin}
      toggle={toggle}
      setLookingFor={setLookingFor}
      setCanHelp={setCanHelp}
      err={err}
      busy={busy}
      save={save}
    />
  );

  return (
    <main className="fw-main fw-narrow">
      <h2 className="fw-h2">Meet people</h2>
      <p className="fw-p" style={{ marginTop: 0 }}>
        {name ? `${name} · ` : ""}
        {[who.company, who.attendeeType].filter(Boolean).join(" · ")}
      </p>

      {!optedIn ? (
        <>
          <p className="fw-muted" style={{ marginBottom: 8 }}>
            {seededDraft
              ? "We drafted this from what we already know — edit anything, then approve to join. Nothing is visible to anyone until you opt in."
              : "Fill this in, then approve to join. Nothing is visible to anyone until you opt in."}
          </p>
          {profileEditor}
        </>
      ) : (
        <>
          {requests && requests.incoming.some((r) => r.status === "pending") && (
            <section style={{ marginTop: 18 }}>
              <h3 className="fw-h2" style={{ fontSize: 20 }}>Requests to meet you</h3>
              <div style={{ display: "grid", gap: 10, marginTop: 8 }}>
                {requests.incoming
                  .filter((r) => r.status === "pending")
                  .map((r) => (
                    <div key={r.id} className="fw-matchcard">
                      <strong>{r.name}</strong>
                      <div className="fw-muted" style={{ fontSize: 13 }}>
                        {[r.type, r.company].filter(Boolean).join(" · ")}
                      </div>
                      {r.note && <p className="fw-p" style={{ margin: "6px 0 0" }}>“{r.note}”</p>}
                      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                        <button className="fw-add added" onClick={() => respond(r.id, "accept")}>Accept</button>
                        <button className="fw-linkbtn" onClick={() => respond(r.id, "decline")}>Decline</button>
                      </div>
                    </div>
                  ))}
              </div>
            </section>
          )}

          <section style={{ marginTop: 26 }}>
            <h3 className="fw-h2" style={{ fontSize: 22 }}>People worth meeting</h3>
            {matches === null ? (
              <p className="fw-muted">Finding your matches…</p>
            ) : matches.length === 0 ? (
              <p className="fw-muted">
                No suggestions yet — check back as more people opt in. Your matches refresh whenever
                you edit your profile.
              </p>
            ) : (
              <div style={{ display: "grid", gap: 12, marginTop: 8 }}>
                {matches.map((m) => (
                  <MatchCard key={m.id} m={m} onRequested={onRequested} flash={flash} />
                ))}
              </div>
            )}
          </section>

          <ConnectedList requests={requests} />

          <section style={{ marginTop: 30 }}>
            <button
              className="fw-linkbtn"
              onClick={() => setEditorOpen((v) => !v)}
              style={{ fontWeight: 600 }}
            >
              {editorOpen ? "Hide your profile ▴" : "Edit your profile ▾"}
            </button>
            {editorOpen && <div style={{ marginTop: 10 }}>{profileEditor}</div>}
          </section>
        </>
      )}
    </main>
  );
}

function MatchCard({ m, onRequested, flash }) {
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const send = async () => {
    setBusy(true);
    const r = await api.meetRequest(m.id, note);
    setBusy(false);
    setNoteOpen(false);
    if (r.ok) {
      flash && flash("Request sent.");
      onRequested && onRequested();
    } else flash && flash(r.error || "Couldn't send the request.");
  };

  return (
    <div className="fw-matchcard">
      <strong>{m.name}</strong>
      <div className="fw-muted" style={{ fontSize: 13 }}>
        {[m.type, m.company].filter(Boolean).join(" · ")}
      </div>
      {m.workingOn && <p className="fw-p" style={{ margin: "6px 0 0" }}>{m.workingOn}</p>}
      {m.reason && (
        <p className="fw-p" style={{ margin: "8px 0 0", color: "var(--cobalt)" }}>{m.reason}</p>
      )}
      <TagLine label="Looking for" tags={m.lookingFor} />
      <TagLine label="Can help with" tags={m.canHelpWith} />

      <div style={{ marginTop: 12 }}>
        {m.requestStatus === "accepted" && m.contact ? (
          <div className="fw-connectbox">
            <strong>You're connected.</strong>{" "}
            <a href={`mailto:${m.contact.email}`}>{m.contact.email}</a>
            {m.contact.linkedin && (
              <>
                {" · "}
                <a href={m.contact.linkedin} target="_blank" rel="noreferrer">LinkedIn</a>
              </>
            )}
          </div>
        ) : m.requestStatus === "pending" && m.requestDir === "received" ? (
          <p className="fw-muted">Asked to meet you — see “Requests to meet you” above.</p>
        ) : m.requestStatus === "pending" ? (
          <p className="fw-muted">Request sent — waiting for them to accept.</p>
        ) : m.requestStatus === "declined" ? (
          <p className="fw-muted">Not connected.</p>
        ) : noteOpen ? (
          <div>
            <textarea
              className="fw-input"
              rows={2}
              maxLength={400}
              placeholder="Add a short note (optional) — why you'd like to connect."
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button className="fw-add added" disabled={busy} onClick={send}>
                {busy ? "Sending…" : "Send request"}
              </button>
              <button className="fw-linkbtn" onClick={() => setNoteOpen(false)}>Cancel</button>
            </div>
          </div>
        ) : (
          <button className="fw-add" onClick={() => setNoteOpen(true)}>Request to meet</button>
        )}
      </div>
    </div>
  );
}

/* Accepted outgoing requests that aren't already shown as matches — so the
   person always has one place to find everyone they've connected with. */
function ConnectedList({ requests }) {
  if (!requests) return null;
  const accepted = [...(requests.incoming || []), ...(requests.outgoing || [])].filter(
    (r) => r.status === "accepted" && r.contact
  );
  if (accepted.length === 0) return null;
  // De-dupe by email.
  const seen = new Set();
  const rows = [];
  for (const r of accepted) {
    if (seen.has(r.contact.email)) continue;
    seen.add(r.contact.email);
    rows.push(r);
  }
  return (
    <section style={{ marginTop: 26 }}>
      <h3 className="fw-h2" style={{ fontSize: 20 }}>Your connections</h3>
      <div style={{ display: "grid", gap: 10, marginTop: 8 }}>
        {rows.map((r) => (
          <div key={r.contact.email} className="fw-matchcard">
            <strong>{r.name}</strong>
            <div className="fw-muted" style={{ fontSize: 13 }}>
              {[r.type, r.company].filter(Boolean).join(" · ")}
            </div>
            <div className="fw-connectbox" style={{ marginTop: 8 }}>
              <a href={`mailto:${r.contact.email}`}>{r.contact.email}</a>
              {r.contact.linkedin && (
                <>
                  {" · "}
                  <a href={r.contact.linkedin} target="_blank" rel="noreferrer">LinkedIn</a>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ProfileEditor({
  seededDraft, optedIn, workingOn, setWorkingOn, lookingFor, canHelp, linkedin, setLinkedin,
  toggle, setLookingFor, setCanHelp, err, busy, save,
}) {
  return (
    <div>
      {seededDraft && (
        <p className="fw-muted" style={{ marginBottom: 8 }}>
          Drafted from what we already know — edit anything.
        </p>
      )}
      <label className="fw-label">What I'm working on</label>
      <textarea
        className="fw-input"
        rows={3}
        maxLength={600}
        placeholder="A sentence or two on what you're building or focused on right now."
        value={workingOn}
        onChange={(e) => setWorkingOn(e.target.value)}
      />

      <label className="fw-label">What I'm looking for</label>
      <TagPicker all={MATCH_TAGS} selected={lookingFor} onToggle={(t) => toggle(lookingFor, setLookingFor, t)} />

      <label className="fw-label">What I can help with</label>
      <TagPicker all={MATCH_TAGS} selected={canHelp} onToggle={(t) => toggle(canHelp, setCanHelp, t)} />

      <label className="fw-label">LinkedIn (optional)</label>
      <input
        className="fw-input"
        placeholder="linkedin.com/in/your-handle"
        value={linkedin}
        onChange={(e) => setLinkedin(e.target.value)}
      />
      <p className="fw-muted" style={{ marginTop: 6 }}>
        Only shared with people you've both agreed to meet.
      </p>

      {err && <p className="fw-err" style={{ marginTop: 12 }}>{err}</p>}

      {optedIn ? (
        <>
          <button className="fw-primary" disabled={busy} onClick={() => save(true)}>
            {busy ? "Saving…" : "Save changes"}
          </button>
          <button
            className="fw-linkbtn"
            style={{ display: "block", margin: "14px auto 0" }}
            disabled={busy}
            onClick={() => save(false)}
          >
            Opt out of matching
          </button>
        </>
      ) : (
        <button className="fw-primary" disabled={busy} onClick={() => save(true)}>
          {busy ? "Saving…" : "Approve & opt in"}
        </button>
      )}
    </div>
  );
}

function TagLine({ label, tags }) {
  if (!tags || tags.length === 0) return null;
  return (
    <div style={{ marginTop: 8 }}>
      <span className="fw-label" style={{ display: "inline", margin: 0 }}>{label}:</span>{" "}
      <span className="fw-caterchips" style={{ display: "inline-flex", verticalAlign: "middle" }}>
        {tags.map((t) => (
          <span key={t} className="fw-caterchip">{t}</span>
        ))}
      </span>
    </div>
  );
}

function TagPicker({ all, selected, onToggle }) {
  return (
    <div className="fw-caterchips">
      {all.map((t) => (
        <button
          key={t}
          type="button"
          className={"fw-add" + (selected.includes(t) ? " added" : "")}
          onClick={() => onToggle(t)}
        >
          {t}
        </button>
      ))}
    </div>
  );
}
