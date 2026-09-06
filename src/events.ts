/* Outils partagés pour la gestion des événements de la mosquée :
   - vérification du mot de passe administrateur (en-tête x-admin-password)
   - validation du formulaire d'événement (messages d'erreur en français) */

export type EventValues = {
  title: string;
  date: Date;
  time: string;
  place: string;
  imageUrl: string;
};

/** Mot de passe admin défini dans .env (ADMIN_PASSWORD). */
export function isAdminRequest(req: Request): boolean {
  const expected = process.env.ADMIN_PASSWORD ?? "";
  if (expected.length === 0) return false;
  const provided = req.headers.get("x-admin-password") ?? "";
  if (provided.length !== expected.length) return false;
  /* Comparaison à temps constant (évite les fuites de timing) */
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

/** Analyse et valide le corps JSON d'une création/modification d'événement. */
export function parseEventBody(
  data: unknown
): { ok: true; values: EventValues } | { ok: false; error: string } {
  if (typeof data !== "object" || data === null) {
    return { ok: false, error: "Requête invalide." };
  }
  const o = data as Record<string, unknown>;

  /* Titre : obligatoire, 1 à 150 caractères */
  const title = typeof o.title === "string" ? o.title.trim() : "";
  if (title.length === 0) {
    return { ok: false, error: "Veuillez saisir le titre de l'événement." };
  }
  if (title.length > 150) {
    return {
      ok: false,
      error: "Le titre est trop long (150 caractères maximum).",
    };
  }

  /* Date : obligatoire, format YYYY-MM-DD */
  const dateStr = typeof o.date === "string" ? o.date.trim() : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return { ok: false, error: "Veuillez choisir une date valide." };
  }
  const date = new Date(`${dateStr}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== dateStr) {
    return { ok: false, error: "Veuillez choisir une date valide." };
  }

  /* Heure : optionnelle, format HH:MM (00:00 – 23:59) */
  const time = typeof o.time === "string" ? o.time.trim() : "";
  if (time.length > 0 && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
    return { ok: false, error: "Veuillez saisir une heure valide (ex. 18:30)." };
  }

  /* Lieu : optionnel, 200 caractères maximum */
  const place = typeof o.place === "string" ? o.place.trim() : "";
  if (place.length > 200) {
    return {
      ok: false,
      error: "Le lieu est trop long (200 caractères maximum).",
    };
  }

  /* Image : optionnelle — soit une URL http(s), soit un chemin local
     `/uploads/…` (image hébergée par le site depuis le panneau d'admin) */
  const imageUrl = typeof o.imageUrl === "string" ? o.imageUrl.trim() : "";
  const isHttpUrl = /^https?:\/\/\S+$/.test(imageUrl);
  const isLocalUpload = /^\/uploads\/[\w.-]+$/.test(imageUrl);
  if (imageUrl.length > 0 && !isHttpUrl && !isLocalUpload) {
    return {
      ok: false,
      error:
        "L'image doit être une URL http(s) ou une image hébergée par le site.",
    };
  }
  if (imageUrl.length > 600) {
    return { ok: false, error: "L'URL de l'image est trop longue." };
  }

  return { ok: true, values: { title, date, time, place, imageUrl } };
}
