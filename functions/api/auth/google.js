const SITE_URL = "https://gigledger.xyz";
const AUTH_STATE_COOKIE = "gigledger_oauth_state";
const SESSION_COOKIE = "gigledger_session";

const json = (data, init = {}) => new Response(JSON.stringify(data), {
  headers: { "content-type": "application/json; charset=utf-8", ...init.headers },
  ...init,
});

const randomToken = () => crypto.randomUUID() + crypto.randomUUID();

const cookieValue = (cookieHeader, name) => {
  if (!cookieHeader) return null;
  return cookieHeader.split(";").map((part) => part.trim()).reduce((found, item) => {
    const [key, ...rest] = item.split("=");
    if (key !== name) return found;
    try {
      return decodeURIComponent(rest.join("="));
    } catch {
      return rest.join("=");
    }
  }, null);
};

const cookieOptions = () => ({
  httpOnly: true,
  secure: true,
  sameSite: "Lax",
  path: "/",
});

const now = () => new Date().toISOString();
const userId = () => crypto.randomUUID();

const ensureWorkspace = async (db, ownerId) => {
  const existing = await db.prepare("SELECT id FROM workspaces WHERE owner_id = ?").bind(ownerId).first();
  if (existing) return existing.id;
  const workspaceId = userId();
  const timestamp = now();
  await db.prepare(
    `INSERT INTO workspaces (id, owner_id, name, base_currency, created_at, updated_at)
     VALUES (?, ?, ?, 'USD', ?, ?)`,
  ).bind(workspaceId, ownerId, "My company", timestamp, timestamp).run();
  return workspaceId;
};

const saveGoogleUser = async (db, profile) => {
  const timestamp = now();
  const existing = await db.prepare(
    "SELECT id FROM users WHERE google_sub = ?",
  ).bind(profile.sub).first();
  if (existing) {
    await db.prepare(
      `UPDATE users SET email = ?, name = ?, avatar_url = ?, updated_at = ?
       WHERE id = ?`,
    ).bind(profile.email, profile.name, profile.picture || null, timestamp, existing.id).run();
    await ensureWorkspace(db, existing.id);
    return existing.id;
  }
  const newId = userId();
  await db.prepare(
    `INSERT INTO users (id, google_sub, email, name, avatar_url, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).bind(newId, profile.sub, profile.email, profile.name, profile.picture || null, timestamp, timestamp).run();
  await ensureWorkspace(db, newId);
  return newId;
};

const sessionToken = (userId) => btoa(JSON.stringify({ userId, issuedAt: now() })).replaceAll("=", "");

const readSession = (cookieHeader) => {
  const raw = cookieValue(cookieHeader, SESSION_COOKIE);
  if (!raw) return null;
  try {
    return JSON.parse(atob(raw));
  } catch {
    return null;
  }
};

export const onRequestGet = async ({ env, request }) => {
  const clientId = env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return json({ error: "GOOGLE_CLIENT_ID is not configured" }, { status: 500 });
  }
  const state = randomToken();
  const redirectUri = `${SITE_URL}/api/auth/google/callback`;
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  url.searchParams.set("prompt", "select_account");
  const headers = new Headers({ location: url.toString() });
  headers.append("set-cookie", `${AUTH_STATE_COOKIE}=${encodeURIComponent(state)}; ${Object.entries(cookieOptions()).map(([k, v]) => `${k}=${v}`).join("; ")}`);
  return new Response(null, { status: 302, headers });
};

export const onRequestPost = async ({ env, request }) => {
  const clientId = env.GOOGLE_CLIENT_ID;
  const clientSecret = env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return json({ error: "Google OAuth is not configured" }, { status: 500 });
  }
  const form = await request.formData();
  const code = form.get("code");
  const state = form.get("state");
  if (!code || state !== cookieValue(request.headers.get("cookie"), AUTH_STATE_COOKIE)) {
    return json({ error: "invalid_oauth_state" }, { status: 400 });
  }
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: `${SITE_URL}/api/auth/google/callback`,
      grant_type: "authorization_code",
    }),
  });
  const token = await tokenResponse.json();
  if (!token.access_token) {
    return json({ error: "oauth_token_failed" }, { status: 401 });
  }
  const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { authorization: `Bearer ${token.access_token}` },
  });
  const profile = await profileResponse.json();
  if (!profile.sub || !profile.email) {
    return json({ error: "oauth_profile_failed" }, { status: 401 });
  }
  const appUserId = await saveGoogleUser(env.DB, profile);
  const session = sessionToken(appUserId);
  const headers = new Headers({ location: "/" });
  headers.append("set-cookie", `${SESSION_COOKIE}=${encodeURIComponent(session)}; ${Object.entries(cookieOptions()).map(([k, v]) => `${k}=${v}`).join("; ")}`);
  return new Response(null, { status: 302, headers });
};
