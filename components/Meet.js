"use client";
import { useState, useEffect } from "react";
import { api } from "./api";
import { MATCH_TAGS } from "../lib/tags";

/* "Meet people" — step 1: opt-in profiles. Identity comes from the personal
   link (handled in App), so this screen just loads the signed-in attendee's
   own profile + private draft and lets them edit and opt in. Nothing here is
   visible to anyone else until they approve. */
export default function Meet({ flash }) {
  const [state, setState] = useState("loading"); // loading | ready | anon | missing | error
  const [identity, setIdentity] = useState(null);
  const [hadProfile, setHadProfile] = useState(false);
  const [seededDraft, setSeededDraft] = useState(false);
  const [workingOn, setWorkingOn] = useState("");
  const [lookingFor, setLookingFor] = useState([]);
  const [canHelp, setCanHelp] = useState([]);
  const [optedIn, setOptedIn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [matches, setMatches] = useState(null); // null = not loaded yet

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
        setOptedIn(!!(p && p.optedIn));
        setHadProfile(!!p);
        setSeededDraft(
          !p && !!((d.workingOn && d.workingOn.trim()) || d.lookingFor.length || d.canHelpWith.length)
        );
        setState("ready");
        if (p && p.optedIn) loadMatches();
      } else if (r.status === 401) {
        setState("anon");
      } else if (r.status === 404) {
        setState("missing");
      } else {
        setErr(r.error || "Something went wrong.");
        setState("error");
      }
    })();
  }, []);

  const loadMatches = async () => {
    const r = await api.meetGetMatches();
    if (r.ok) setMatches(r.items || []);
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
      optedIn: nextOptedIn,
    });
    setBusy(false);
    if (r.ok) {
      setOptedIn(!!r.profile.optedIn);
      setHadProfile(true);
      setSeededDraft(false);
      flash && flash(nextOptedIn ? "You're in — thanks! You can edit anytime." : "Saved.");
      if (nextOptedIn) loadMatches();
      else setMatches(null);
    } else {
      setErr(r.error || "Couldn't save — try again.");
    }
  };

  if (state === "loading")
    return (
      <main className="fw-main fw-narrow">
        <p className="fw-p">Loading…</p>
      </main>
    );

  if (state === "anon")
    return (
      <main className="fw-main fw-narrow">
        <h2 className="fw-h2">Meet people</h2>
        <p className="fw-p">
          We'll help you find the handful of people here most worth meeting. To set up your
          profile, open the personal link we emailed you — it signs you in on this device.
        </p>
        <p className="fw-muted">Can't find it? Reply to that email and we'll resend your link.</p>
      </main>
    );

  if (state === "missing")
    return (
      <main className="fw-main fw-narrow">
        <h2 className="fw-h2">Meet people</h2>
        <p className="fw-p">
          We couldn't find your registration yet. Reply to our email and we'll get you set up.
        </p>
      </main>
    );

  if (state === "error")
    return (
      <main className="fw-main fw-narrow">
        <h2 className="fw-h2">Meet people</h2>
        <p className="fw-p">{err}</p>
      </main>
    );

  // state === "ready"
  const who = identity || {};
  const name = [who.firstName, who.lastName].filter(Boolean).join(" ");
  return (
    <main className="fw-main fw-narrow">
      <h2 className="fw-h2">Meet people</h2>
      <p className="fw-p">
        {name ? `${name} · ` : ""}
        {[who.company, who.attendeeType].filter(Boolean).join(" · ")}
      </p>

      {optedIn ? (
        <div className="fw-banner" style={{ position: "static", marginBottom: 16 }}>
          You're opted in — your profile is visible to other attendees for matching.
        </div>
      ) : seededDraft ? (
        <p className="fw-muted" style={{ marginBottom: 8 }}>
          We drafted this from what we already know — edit anything, then approve to join. Nothing
          below is visible to anyone until you opt in.
        </p>
      ) : (
        <p className="fw-muted" style={{ marginBottom: 8 }}>
          Fill this in, then approve to join. Nothing below is visible to anyone until you opt in.
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

      {optedIn && (
        <section style={{ marginTop: 34 }}>
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
                <div key={m.id} className="fw-matchcard">
                  <strong>{m.name}</strong>
                  <div className="fw-muted" style={{ fontSize: 13 }}>
                    {[m.type, m.company].filter(Boolean).join(" · ")}
                  </div>
                  {m.workingOn && <p className="fw-p" style={{ margin: "6px 0 0" }}>{m.workingOn}</p>}
                  {m.reason && (
                    <p className="fw-p" style={{ margin: "8px 0 0", color: "var(--cobalt)" }}>
                      {m.reason}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </main>
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
