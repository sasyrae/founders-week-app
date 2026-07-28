"use client";
import { useState } from "react";
import { api } from "./api";
import { DIET_OPTIONS, HOTEL_NIGHTS } from "@/lib/constants";

export default function Register({ config, onDone, existing, prefill }) {
  const isEdit = !!existing;
  const [mode, setMode] = useState("new");
  const [f, setF] = useState(
    isEdit
      ? {
          firstName: existing.firstName || (existing.name || "").split(" ")[0] || "",
          lastName:
            existing.lastName || (existing.name || "").split(" ").slice(1).join(" ") || "",
          email: existing.email,
          company: existing.company || "",
          type: existing.type || "Founder",
          attending: existing.attending || [],
          hotel: existing.hotel || "",
          hotelNights: existing.hotelNights || [],
          dietary: existing.dietary || [],
          dietaryOther: existing.dietaryOther || "",
        }
      : {
          firstName: prefill?.firstName || "",
          lastName: prefill?.lastName || "",
          email: prefill?.email || "",
          company: "",
          type: "Founder",
          attending: [],
          hotel: "",
          hotelNights: [],
          dietary: [],
          dietaryOther: "",
        }
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const toggleDay = (id) =>
    setF({
      ...f,
      attending: f.attending.includes(id)
        ? f.attending.filter((x) => x !== id)
        : [...f.attending, id],
    });
  const toggleNight = (n) =>
    setF({
      ...f,
      hotelNights: f.hotelNights.includes(n)
        ? f.hotelNights.filter((x) => x !== n)
        : [...f.hotelNights, n],
    });
  const toggleDiet = (d) =>
    setF({
      ...f,
      dietary: f.dietary.includes(d) ? f.dietary.filter((x) => x !== d) : [...f.dietary, d],
    });

  const validateShared = () => {
    if (!f.firstName.trim() || !f.lastName.trim()) return "Enter your first and last name.";
    if (f.attending.length === 0) return "Pick at least one day.";
    if (f.hotel === "") return "Let us know if you'll be staying at The William Vale.";
    if (f.hotel === "yes" && f.hotelNights.length === 0) return "Pick which nights you'll stay.";
    return "";
  };

  const submit = async () => {
    setErr("");

    if (isEdit) {
      const msg = validateShared();
      if (msg) return setErr(msg);
      setBusy(true);
      const r = await api.updateMe({ ...f, email: existing.email });
      setBusy(false);
      if (r.ok) onDone(r.attendee);
      else setErr(r.error || "Couldn't save — try again.");
      return;
    }

    if (!f.email.includes("@")) return setErr("Enter a valid email.");

    if (mode === "returning") {
      setBusy(true);
      const r = await api.findMe(f.email);
      setBusy(false);
      if (r.ok) onDone(r.attendee);
      else setErr("No registration found for that email. Register as new below.");
      return;
    }

    const msg = validateShared();
    if (msg) return setErr(msg);
    setBusy(true);
    const r = await api.register(f);
    setBusy(false);
    if (r.ok) onDone(r.attendee);
    else setErr(r.error || "Couldn't save — try again.");
  };

  return (
    <main className="fw-main fw-narrow">
      <h2 className="fw-h2">
        {isEdit ? "Update registration" : mode === "new" ? "Register" : "Find my registration"}
      </h2>
      <p className="fw-p">
        {isEdit
          ? "Change your days, hotel nights, or dietary needs — your session picks stay put."
          : mode === "new"
          ? "Register once for the event, then add individual sessions from the agenda."
          : "Enter the email you registered with."}
      </p>
      {(mode === "new" || isEdit) && (
        <>
          <div className="fw-grid2">
            <div>
              <label className="fw-label">First name</label>
              <input
                className="fw-input"
                value={f.firstName}
                onChange={(e) => setF({ ...f, firstName: e.target.value })}
                placeholder="Cheraé"
              />
            </div>
            <div>
              <label className="fw-label">Last name</label>
              <input
                className="fw-input"
                value={f.lastName}
                onChange={(e) => setF({ ...f, lastName: e.target.value })}
                placeholder="Robinson"
              />
            </div>
          </div>
          <label className="fw-label">Company</label>
          <input
            className="fw-input"
            value={f.company}
            onChange={(e) => setF({ ...f, company: e.target.value })}
            placeholder="Flybridge"
          />
          <label className="fw-label">I'm attending as</label>
          <div className="fw-seg">
            {["Founder", "LP", "Guest", "Team"].map((t) => (
              <button key={t} className={f.type === t ? "on" : ""} onClick={() => setF({ ...f, type: t })}>
                {t}
              </button>
            ))}
          </div>

          <label className="fw-label">Which days will you attend (select all that apply)</label>
          <div className="fw-dayselect">
            {config.days.map((d) => (
              <button
                key={d.id}
                className={"fw-dayopt" + (f.attending.includes(d.id) ? " on" : "")}
                onClick={() => toggleDay(d.id)}
              >
                <span className="fw-dayoptlabel">{d.label}</span>
                <span className="fw-dayoptdate">{d.date}</span>
              </button>
            ))}
          </div>

          <label className="fw-label">Will you be staying at The William Vale (on-site hotel)?</label>
          <div className="fw-seg">
            <button className={f.hotel === "yes" ? "on" : ""} onClick={() => setF({ ...f, hotel: "yes" })}>
              Yes
            </button>
            <button
              className={f.hotel === "no" ? "on" : ""}
              onClick={() => setF({ ...f, hotel: "no", hotelNights: [] })}
            >
              No
            </button>
          </div>
          {f.hotel === "yes" && (
            <>
              <label className="fw-label">Which nights</label>
              <div className="fw-seg">
                {HOTEL_NIGHTS.map((n) => (
                  <button
                    key={n}
                    className={f.hotelNights.includes(n) ? "on" : ""}
                    onClick={() => toggleNight(n)}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <p className="fw-p" style={{ fontSize: 13, marginTop: 8 }}>
                We have a room block at The William Vale for the nights of Oct 14 & 15 — we'll email
                you a booking link with our group rate.
              </p>
            </>
          )}

          <label className="fw-label">Dietary needs (for meals & dinners)</label>
          <div className="fw-seg">
            {DIET_OPTIONS.map((d) => (
              <button
                key={d}
                className={f.dietary.includes(d) ? "on" : ""}
                onClick={() => toggleDiet(d)}
              >
                {d}
              </button>
            ))}
          </div>
          <input
            className="fw-input"
            style={{ marginTop: 8 }}
            value={f.dietaryOther}
            onChange={(e) => setF({ ...f, dietaryOther: e.target.value })}
            placeholder="Anything else we should know (allergies, etc.)"
          />
        </>
      )}
      <label className="fw-label">Email{isEdit ? " (can't be changed — it's how we find you)" : ""}</label>
      <input
        className="fw-input"
        value={f.email}
        disabled={isEdit}
        onChange={(e) => setF({ ...f, email: e.target.value })}
        placeholder="you@company.com"
      />
      {err && <div className="fw-err">{err}</div>}
      <button className="fw-primary" disabled={busy} onClick={submit}>
        {busy ? "One sec…" : isEdit ? "Save changes" : mode === "new" ? "Register" : "Find me"}
      </button>
      {!isEdit && (
        <button
          className="fw-linkbtn"
          onClick={() => {
            setMode(mode === "new" ? "returning" : "new");
            setErr("");
          }}
        >
          {mode === "new" ? "Already registered? Find my schedule" : "New here? Register instead"}
        </button>
      )}
    </main>
  );
}
