import { createSessionToken, sessionCookie, sessionSecret, verifySessionToken } from "../../lib/session.js";
import { normalizeDraft } from "../../lib/ledger.js";

const SITE_URL = "https://gigledger.xyz";
const AUTH_STATE_COOKIE = "gigledger_oauth_state";

const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", ...headers },
});

const cookieValue = (cookieHeader, name) => {
  if (!cookieHeader) return null;
  const match = cookieHeader.split(";").map((item) => item.trim()).find((item) => {
    return item.startsWith(`${name}=`);
  });
  return match ? decodeURIComponent(match.slice(`${name}=`.length)) : null;
};

const authCookie = (value) =>
  `${AUTH_STATE_COOKIE}=${encodeURIComponent(value)}; Max-Age=600; HttpOnly; Secure; SameSite=Lax; Path=/`;

const locale = (request) => {
  const value = new URL(request.url).searchParams.get("locale");
  return value === "zh-TW" ? "zh-TW" : "en";
};

const now = () => new Date().toISOString();
const newId = () => crypto.randomUUID();

const ensureWorkspace = async (db, ownerId) => {
  const existing = await db.prepare("SELECT id FROM workspaces WHERE owner_id = ?").bind(ownerId).first();
  if (existing) return existing.id;
  const workspaceId = newId();
  const timestamp = now();
  await db.prepare(
    `INSERT INTO workspaces (id, owner_id, name, base_currency, created_at, updated_at)
     VALUES (?, ?, ?, 'USD', ?, ?)`,
  ).bind(workspaceId, ownerId, "My company", timestamp, timestamp).run();
  return workspaceId;
};

const saveGoogleUser = async (db, profile) => {
  const timestamp = now();
  const existing = await db.prepare("SELECT id FROM users WHERE google_sub = ?").bind(profile.sub).first();
  if (existing) {
    await db.prepare(
      `UPDATE users SET email = ?, name = ?, avatar_url = ?, updated_at = ? WHERE id = ?`,
    ).bind(profile.email, profile.name, profile.picture || null, timestamp, existing.id).run();
    return { userId: existing.id, workspaceId: await ensureWorkspace(db, existing.id) };
  }
  const userId = newId();
  await db.prepare(
    `INSERT INTO users (id, google_sub, email, name, avatar_url, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).bind(userId, profile.sub, profile.email, profile.name, profile.picture || null, timestamp, timestamp).run();
  return { userId, workspaceId: await ensureWorkspace(db, userId) };
};

const readAuthenticatedUserId = async (env, cookieHeader) => {
  const token = cookieValue(cookieHeader, "gigledger_session");
  if (!token) return null;
  const session = await verifySessionToken(token, sessionSecret(env));
  return session?.userId || null;
};

const authUrl = (env, state) => {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", env.GOOGLE_CLIENT_ID);
  url.searchParams.set("redirect_uri", `${SITE_URL}/api/auth/google/callback`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  url.searchParams.set("prompt", "select_account");
  return url.toString();
};

export const onRequestGet = async ({ env, request }) => {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    return json({ error: "Google OAuth is not configured" }, 500);
  }
  const authLocale = locale(request);
  if (await readAuthenticatedUserId(env, request.headers.get("cookie"))) {
    return Response.redirect(`${SITE_URL}/${authLocale}/dashboard`, 302);
  }
  const state = newId() + newId();
  await env.DB.prepare(
    "INSERT INTO auth_states (state, intent, locale, draft_json, created_at) VALUES (?, 'signin', ?, NULL, ?)",
  ).bind(state, authLocale, now()).run();
  return new Response(null, {
    status: 302,
    headers: { location: authUrl(env, state), "set-cookie": authCookie(state) },
  });
};

export const onRequestPost = async ({ env, request }) => {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    return json({ error: "Google OAuth is not configured" }, 500);
  }
  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  const draft = await normalizeDraft(payload);
  const authenticatedUserId = await readAuthenticatedUserId(env, request.headers.get("cookie"));
  if (authenticatedUserId) {
    const workspace = await env.DB.prepare(
      "SELECT id FROM workspaces WHERE owner_id = ?",
    ).bind(authenticatedUserId).first();
    if (workspace) await saveWorkspaceDraft(env.DB, workspace.id, draft);
    return json({
      saved: true,
      redirectUrl: `${SITE_URL}/${locale(request)}/dashboard`,
    });
  }
  const state = newId() + newId();
  await env.DB.prepare(
    "INSERT INTO auth_states (state, intent, locale, draft_json, created_at) VALUES (?, 'save', ?, ?, ?)",
  ).bind(state, locale(request), JSON.stringify(draft), now()).run();
  return json({ authUrl: authUrl(env, state) }, 200, { "set-cookie": authCookie(state) });
};
