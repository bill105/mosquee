/**
 * Intégration PayTech (paytech.sn) — passerelle de paiement sénégalaise
 * (Orange Money, Wave, MTN MoMo, Moov Money, cartes bancaires).
 *
 * Ce module est STRICTEMENT côté serveur : il lit les clés API depuis
 * process.env et ne doit jamais être importé depuis un composant client.
 */

export const PURPOSE_LABELS: Record<string, string> = {
  don_libre: "Don à la mosquée",
  sadaqa: "Sadaqa — Mosquée Hadja Yah Diakite",
  zakat: "Zakat — Mosquée Hadja Yah Diakite",
  construction: "Don construction — Mosquée Hadja Yah Diakite",
};

/** Message générique renvoyé au client quand PayTech est indisponible. */
const PAYTECH_UNAVAILABLE =
  "Le service de paiement est momentanément indisponible. Veuillez réessayer.";

/**
 * Détermine l'URL publique de base utilisée pour les retours PayTech
 * (success / cancel / IPN).
 *
 * Priorité :
 *  1. process.env.PUBLIC_BASE_URL (sans slash final)
 *  2. en-tête `Origin`
 *  3. en-tête `x-forwarded-proto` (http par défaut pour les hôtes locaux,
 *     https sinon) + en-tête `Host`
 */
export function resolveBaseUrl(req: Request): string {
  const envUrl = process.env.PUBLIC_BASE_URL?.trim();
  if (envUrl) return envUrl.replace(/\/+$/, "");

  const origin = req.headers.get("origin");
  if (origin) {
    try {
      const parsed = new URL(origin);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        return `${parsed.protocol}//${parsed.host}`.replace(/\/+$/, "");
      }
    } catch {
      // Origin invalide (ex: "null") → on continue avec les autres stratégies.
    }
  }

  const host = req.headers.get("host") ?? "localhost:3000";
  const forwardedProto = req.headers.get("x-forwarded-proto");
  const proto =
    forwardedProto?.split(",")[0]?.trim() ||
    (host.startsWith("localhost") || host.startsWith("127.0.0.1")
      ? "http"
      : "https");
  return `${proto}://${host}`;
}

/** Génère une référence de commande unique, ex: `DON-1717000000000-7GK2QX`. */
export function generateRefCommand(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  let suffix = "";
  for (const b of bytes) suffix += chars[b % chars.length];
  return `DON-${Date.now()}-${suffix}`;
}

/** Lit PAYTECH_ENV ; "test" par défaut. */
export function getPaytechEnv(): "test" | "prod" {
  return process.env.PAYTECH_ENV === "prod" ? "prod" : "test";
}

export interface PaytechTokenResult {
  ok: boolean;
  token?: string;
  redirectUrl?: string;
  /** Message d'erreur en français, sans jamais exposer les clés. */
  error?: string;
}

interface PaytechTokenResponse {
  success?: unknown;
  token?: unknown;
  redirect_url?: unknown;
  redirectUrl?: unknown;
  message?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Demande un token de paiement à PayTech (paiement avec redirection).
 * Doc officielle : https://docs.intech.sn/doc_paytech.php
 * Endpoint : POST https://paytech.sn/api/payment/request-payment
 *
 * Remarques (conformes à la doc officielle) :
 *  - `command_name` est OBLIGATOIRE (on réutilise itemName).
 *  - Les données additionnelles passent dans `custom_field` (JSON stringifié).
 *  - L'ancien endpoint `/api/payment/request-token` n'existe plus (404).
 */
export async function requestPaytechToken(params: {
  itemName: string;
  /** Montant en XOF (entier). */
  amount: number;
  refCommand: string;
  baseUrl: string;
  /** JSON stringifié des informations donateur. */
  customData?: string;
}): Promise<PaytechTokenResult> {
  const apiKey = process.env.PAYTECH_API_KEY;
  const apiSecret = process.env.PAYTECH_API_SECRET;

  if (!apiKey || !apiSecret) {
    console.error(
      "[PayTech] request-token failed: PAYTECH_API_KEY / PAYTECH_API_SECRET manquants"
    );
    return {
      ok: false,
      error: "Le service de paiement n'est pas encore configuré.",
    };
  }

  const payload = {
    item_name: params.itemName,
    item_price: params.amount,
    currency: "XOF",
    ref_command: params.refCommand,
    command_name: params.itemName,
    env: getPaytechEnv(),
    ipn_url: `${params.baseUrl}/api/paytech/ipn`,
    success_url: `${params.baseUrl}/?payment=success`,
    cancel_url: `${params.baseUrl}/?payment=cancel`,
    custom_field: params.customData ?? "",
  };

  try {
    const res = await fetch("https://paytech.sn/api/payment/request-payment", {
      method: "POST",
      headers: {
        API_KEY: apiKey,
        API_SECRET: apiSecret,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });

    const raw = await res.text();

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw) as unknown;
    } catch {
      console.error(
        "[PayTech] request-token failed",
        res.status,
        "réponse non JSON:",
        raw.slice(0, 500)
      );
      return { ok: false, error: PAYTECH_UNAVAILABLE };
    }

    if (!res.ok) {
      console.error("[PayTech] request-token failed", res.status, parsed);
      return { ok: false, error: PAYTECH_UNAVAILABLE };
    }

    if (!isRecord(parsed)) {
      console.error("[PayTech] request-token failed", res.status, parsed);
      return { ok: false, error: PAYTECH_UNAVAILABLE };
    }

    const body = parsed as PaytechTokenResponse;
    const success = body.success === 1;
    // La doc renvoie `redirect_url` (et l'alias camelCase `redirectUrl`).
    const redirectUrl =
      typeof body.redirect_url === "string" && body.redirect_url.length > 0
        ? body.redirect_url
        : typeof body.redirectUrl === "string" && body.redirectUrl.length > 0
          ? body.redirectUrl
          : undefined;
    const token =
      typeof body.token === "string" && body.token.length > 0
        ? body.token
        : undefined;

    if (!success || !redirectUrl) {
      console.error("[PayTech] request-token failed", res.status, body);
      return { ok: false, error: PAYTECH_UNAVAILABLE };
    }

    return { ok: true, token, redirectUrl };
  } catch (err) {
    console.error(
      "[PayTech] request-token failed: erreur réseau/timeout",
      err instanceof Error ? err.message : err
    );
    return { ok: false, error: PAYTECH_UNAVAILABLE };
  }
}
