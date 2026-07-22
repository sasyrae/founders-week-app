import { HOTEL_NIGHTS } from "./constants";
import { normalizeEmail } from "./utils";

const TYPES = ["Founder", "LP", "Guest", "Team"];

/* Validate + normalize the registration form fields, server-side.
   Mirrors the prototype's client checks — never trust the client.
   Returns { ok, error } or { ok:true, fields }. */
export function validateRegistration(body, config) {
  const dayIds = new Set((config.days || []).map((d) => d.id));

  const firstName = (body.firstName || "").trim();
  const lastName = (body.lastName || "").trim();
  const email = normalizeEmail(body.email);
  const company = (body.company || "").trim();
  const type = TYPES.includes(body.type) ? body.type : "Founder";
  const attending = Array.isArray(body.attending)
    ? body.attending.filter((id) => dayIds.has(id))
    : [];
  const hotel = body.hotel === "yes" ? "yes" : body.hotel === "no" ? "no" : "";
  const hotelNights =
    hotel === "yes" && Array.isArray(body.hotelNights)
      ? body.hotelNights.filter((n) => HOTEL_NIGHTS.includes(n))
      : [];
  const dietary = Array.isArray(body.dietary) ? body.dietary.map(String) : [];
  const dietaryOther = (body.dietaryOther || "").trim();

  if (!email.includes("@")) return { ok: false, error: "Enter a valid email." };
  if (!firstName || !lastName) return { ok: false, error: "Enter your first and last name." };
  if (attending.length === 0) return { ok: false, error: "Pick at least one day." };
  if (hotel === "")
    return { ok: false, error: "Let us know if you'll be staying at The William Vale." };
  if (hotel === "yes" && hotelNights.length === 0)
    return { ok: false, error: "Pick which nights you'll stay." };

  return {
    ok: true,
    fields: {
      firstName,
      lastName,
      name: `${firstName} ${lastName}`,
      email,
      company,
      type,
      attending,
      hotel,
      hotelNights,
      dietary,
      dietaryOther,
    },
  };
}
