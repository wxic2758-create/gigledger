const encoder = new TextEncoder();

const hmac = async (value, secret) => {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return [...new Uint8Array(signature)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

const safeEqual = (left, right) => {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
};

export const createSessionToken = async (userId, secret) => {
  const issuedAt = Date.now().toString();
  const payload = `${userId}.${issuedAt}`;
  const signature = await hmac(payload, secret);
  return `${payload}.${signature}`;
};

export const verifySessionToken = async (token, secret) => {
  const parts = String(token || "").split(".");
  if (parts.length !== 3) return null;
  const [userId, issuedAt, signature] = parts;
  if (!userId || !issuedAt || !signature) return null;
  const expected = await hmac(`${userId}.${issuedAt}`, secret);
  if (!safeEqual(signature, expected)) return null;
  const issued = Number(issuedAt);
  if (!Number.isFinite(issued) || Date.now() - issued > 30 * 24 * 60 * 60 * 1000) {
    return null;
  }
  return { userId, issuedAt: issued };
};

export const sessionSecret = (env) => env.SESSION_SECRET || env.GOOGLE_CLIENT_SECRET;

export const readSessionCookie = (cookieHeader) => {
  if (!cookieHeader) return null;
  const match = cookieHeader.split(";").map((item) => item.trim()).find((item) => {
    return item.startsWith("gigledger_session=");
  });
  return match ? decodeURIComponent(match.slice("gigledger_session=".length)) : null;
};

export const readAuthenticatedUserId = async (env, cookieHeader) => {
  const token = readSessionCookie(cookieHeader);
  if (!token) return null;
  const session = await verifySessionToken(token, sessionSecret(env));
  if (!session?.userId || !env?.DB) return null;

  // Tokens are stateless; reject sessions whose user no longer exists.
  const user = await env.DB.prepare("SELECT id FROM users WHERE id = ?").bind(session.userId).first();
  return user?.id || null;
};

export const sessionCookie = (value) => {
  const options = ["Max-Age=2592000", "HttpOnly", "Secure", "SameSite=Lax", "Path=/"].join("; ");
  return `gigledger_session=${encodeURIComponent(value)}; ${options}`;
};

export const clearedSessionCookie = () =>
  "gigledger_session=; Max-Age=0; HttpOnly; Secure; SameSite=Lax; Path=/";
