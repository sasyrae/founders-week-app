"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { api } from "./api";
import Agenda from "./Agenda";
import Register from "./Register";
import MySchedule from "./MySchedule";
import Welcome from "./Welcome";
import Updates from "./Updates";
import Guide from "./Guide";
import Speakers from "./Speakers";
import SpeakerModal from "./SpeakerModal";
import Admin from "./Admin";

const ME_KEY = "fw26_me_email";

export default function App({ initialConfig = null, initialSessions = null }) {
  // When the server pre-loaded the event, start with it already in state so
  // there's no "Loading the event…" flash. Otherwise fall back to a client
  // fetch on mount (see the effect below).
  const [config, setConfig] = useState(
    initialConfig ? { ...initialConfig, sessions: initialSessions || [] } : null
  );
  const [me, setMeState] = useState(null);
  const [view, setView] = useState("agenda");
  const [banner, setBanner] = useState(null);
  const [loadErr, setLoadErr] = useState(false);
  const [registerPrefill, setRegisterPrefill] = useState(null);
  const [modalSpeaker, setModalSpeaker] = useState(null);
  const [focusSessionId, setFocusSessionId] = useState(null);

  // Jump to a session on the agenda (from a speaker card/popover), and let
  // the Agenda scroll to + briefly highlight it.
  const openSession = (sid) => {
    setModalSpeaker(null);
    setFocusSessionId(sid);
    setView("agenda");
  };

  const flash = (msg) => {
    setBanner(msg);
    setTimeout(() => setBanner(null), 3200);
  };

  // id → speaker, for resolving the speakers attached to each session.
  const speakerMap = useMemo(() => {
    const m = {};
    for (const sp of config?.speakers || []) m[sp.id] = sp;
    return m;
  }, [config?.speakers]);
  const hasSpeakers = (config?.speakers || []).length > 0;

  // Keep the signed-in attendee remembered across reloads.
  const setMe = useCallback((next) => {
    setMeState(next);
    try {
      if (next?.email) localStorage.setItem(ME_KEY, next.email);
      else localStorage.removeItem(ME_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const loadEvent = useCallback(async () => {
    const r = await api.loadEvent();
    if (r.ok) setConfig({ ...r.config, sessions: r.sessions || [], speakers: r.speakers || [] });
    else setLoadErr(true);
    return r;
  }, []);

  useEffect(() => {
    (async () => {
      // Only fetch on mount if the server didn't already give us the event.
      if (!initialConfig) await loadEvent();

      // Hand-off from a speaker's profile page: open registration pre-filled.
      try {
        const raw = sessionStorage.getItem("fw_register_prefill");
        if (raw) {
          sessionStorage.removeItem("fw_register_prefill");
          setRegisterPrefill(JSON.parse(raw));
          setView("register");
        }
      } catch {
        /* ignore */
      }

      // Re-hydrate "who am I" if we remembered them.
      let saved = null;
      try {
        saved = localStorage.getItem(ME_KEY);
      } catch {
        /* ignore */
      }
      if (saved) {
        const r = await api.findMe(saved);
        if (r.ok) setMeState(r.attendee);
        else
          try {
            localStorage.removeItem(ME_KEY);
          } catch {
            /* ignore */
          }
      }
    })();
  }, [loadEvent, initialConfig]);

  // Whenever the view changes (tab switch, or "Register for session" when
  // not yet registered), jump back to the top — otherwise the new screen
  // opens scrolled to wherever the last one was, which reads as broken.
  useEffect(() => {
    // Don't jump to top when we're navigating to a specific session — the
    // Agenda will scroll to that session itself.
    if (focusSessionId) return;
    try {
      window.scrollTo(0, 0);
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  // Toggle a session for the current attendee. Returns the API result so
  // SessionRow can surface access-code / full errors inline.
  const toggleSession = async (sid, accessCode) => {
    if (!me) {
      setView("register");
      flash("Register for the event first to add sessions.");
      return { ok: false };
    }
    const had = (me.sessions || []).includes(sid);
    const r = await api.toggleSession(me.email, sid, accessCode);
    if (r.ok) {
      setMe(r.attendee);
      // Keep local "taken" counts fresh so the "full" state is accurate.
      setConfig((c) => {
        if (!c) return c;
        const delta = had ? -1 : 1;
        return {
          ...c,
          sessions: c.sessions.map((s) =>
            s.id === sid && s.capacity > 0
              ? { ...s, taken: Math.max(0, (s.taken ?? 0) + delta) }
              : s
          ),
        };
      });
    }
    return r;
  };

  if (!config)
    return (
      <div style={{ fontFamily: "Archivo, sans-serif", padding: 48, color: "#5b6472" }}>
        Loading the event…
      </div>
    );

  return (
    <div className="fw-root">
      <header className="fw-head">
        <div className="fw-brand">
          <img className="fw-marklogo" src="/logo.png" alt="Flybridge" />
          <div>
            <div className="fw-title">{config.title}</div>
            <div className="fw-sub">Oct 14–16, 2026 · {config.city}</div>
          </div>
        </div>
        <nav className="fw-nav">
          <button className={view === "agenda" ? "on" : ""} onClick={() => setView("agenda")}>
            Agenda
          </button>
          {hasSpeakers && (
            <button className={view === "speakers" ? "on" : ""} onClick={() => setView("speakers")}>
              Speakers
            </button>
          )}
          <button className={view === "me" ? "on" : ""} onClick={() => setView("me")}>
            My Schedule{me && me.sessions.length ? ` (${me.sessions.length})` : ""}
          </button>
          <button className={view === "updates" ? "on" : ""} onClick={() => setView("updates")}>
            Updates
          </button>
          <button className={view === "eats" ? "on" : ""} onClick={() => setView("eats")}>
            Neighborhood Guide
          </button>
          {!me && (
            <button className={view === "register" ? "on" : ""} onClick={() => setView("register")}>
              Register
            </button>
          )}
          {me && (
            <button className={view === "editreg" ? "on" : ""} onClick={() => setView("editreg")}>
              Hi, {me.name.split(" ")[0]} ✎
            </button>
          )}
        </nav>
      </header>

      {banner && <div className="fw-banner">{banner}</div>}
      {loadErr && (
        <div className="fw-banner warn">
          Couldn't reach the event data right now — try refreshing in a moment.
        </div>
      )}

      {view === "agenda" && (
        <Agenda
          config={config}
          me={me}
          onToggle={toggleSession}
          speakerMap={speakerMap}
          onSpeakerClick={setModalSpeaker}
          focusSessionId={focusSessionId}
          onFocusHandled={() => setFocusSessionId(null)}
        />
      )}
      {view === "speakers" && (
        <Speakers config={config} onSpeakerClick={setModalSpeaker} onSessionClick={openSession} />
      )}
      {view === "register" && (
        <Register
          config={config}
          prefill={registerPrefill}
          onDone={(a) => {
            setMe(a);
            setView("welcome");
            setRegisterPrefill(null);
          }}
        />
      )}
      {view === "editreg" && me && (
        <Register
          config={config}
          existing={me}
          onDone={(a) => {
            setMe(a);
            setView("me");
            flash("Registration updated.");
          }}
        />
      )}
      {view === "me" && (
        <MySchedule
          config={config}
          me={me}
          onToggle={toggleSession}
          goRegister={() => setView("register")}
          goAgenda={() => setView("agenda")}
          speakerMap={speakerMap}
          onSpeakerClick={setModalSpeaker}
        />
      )}
      {view === "welcome" && <Welcome config={config} me={me} goAgenda={() => setView("agenda")} />}
      {view === "updates" && <Updates config={config} />}
      {view === "eats" && <Guide config={config} />}
      {view === "admin" && <Admin flash={flash} refreshEvent={loadEvent} />}

      {modalSpeaker && (
        <SpeakerModal
          speaker={modalSpeaker}
          sessions={config.sessions}
          days={config.days}
          onClose={() => setModalSpeaker(null)}
          onSessionClick={openSession}
        />
      )}

      <footer className="fw-foot">
        <span>
          {config.title} · {config.city}
        </span>
        <button
          className="fw-hosttools"
          onClick={() => setView(view === "admin" ? "agenda" : "admin")}
        >
          {view === "admin" ? "← Back to event" : "Host tools"}
        </button>
      </footer>
    </div>
  );
}
