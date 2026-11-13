import { createSessionToken, sessionCookie, sessionSecret } from "../../../lib/session.js";
import { saveWorkspaceDraft } from "../../../lib/ledger.js";

const SITE_URL = "https://gigledger.xyz";

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { "content-type": "application/json; charset=utf-8" },
});

const cookieValue = (cookieHeader, name) => {
  if (!cookieHeader) return null;
  const match = cookieHeader.split(";").map((item) => item.trim()).find((item) => {
    return item.startsWith(`${name}=`);
  });
  return match ? decodeURIComponent(match.slice(`${name}=`.length)) : null;
};

const tokenRequest = (code, env) => new URLSearchParams({
  code,
  client_id: env.GOOGLE_CLIENT_ID,
  client_secret: env.GOOGLE_CLIENT_SECRET,
  redirect_uri: `${SITE_URL}/api/auth/google/callback`,
  grant_type: "authorization_code",
});

export const onRequestGet = async ({ env, request }) => {
  const clientId = env.GOOGLE_CLIENT_ID;
  const clientSecret = env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return json({ error: "Google OAuth is not configured" }, 500);

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = cookieValue(request.headers.get("cookie"), "gigledger_oauth_state");
  if (!code || !state || state !== cookieState) {
    return json({ error: "invalid_oauth_state" }, 400);
  }

  const authState = await env.DB.prepare(
    "SELECT intent, locale, draft_json FROM auth_states WHERE state = ?",
  ).bind(state).first();
  if (!authState) return json({ error: "expired_oauth_state" }, 400);
  await env.DB.prepare("DELETE FROM auth_states WHERE state = ?").bind(state).run();

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: tokenRequest(code, env),
  });
  const token = await tokenResponse.json();
  if (!token.access_token) return json({ error: "oauth_token_failed" }, 401);

  const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { authorization: `Bearer ${token.access_token}` },
  });
  const profile = await profileResponse.json();
  if (!profile.sub || !profile.email) return json({ error: "oauth_profile_failed" }, 401);

  const timestamp = new Date().toISOString();
  const existing = await env.DB.prepare("SELECT id FROM users WHERE google_sub = ?").bind(profile.sub).first();
  let userId;
  if (existing) {
    userId = existing.id;
    await env.DB.prepare(
      `UPDATE users SET email = ?, name = ?, avatar_url = ?, updated_at = ? WHERE id = ?`,
    ).bind(profile.email, profile.name, profile.picture || null, timestamp, userId).run();
  } else {
    userId = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO users (id, google_sub, email, name, avatar_url, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).bind(userId, profile.sub, profile.email, profile.name, profile.picture || null, timestamp, timestamp).run();
  }

  const existingWorkspace = await env.DB.prepare(
    "SELECT id FROM workspaces WHERE owner_id = ?",
  ).bind(userId).first();
  let workspaceId;
  if (existingWorkspace) {
    workspaceId = existingWorkspace.id;
  } else {
    workspaceId = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO workspaces (id, owner_id, name, base_currency, created_at, updated_at)
       VALUES (?, ?, ?, 'USD', ?, ?)`,
    ).bind(workspaceId, userId, "My company", timestamp, timestamp).run();
  }

  if (authState.intent === "save" && authState.draft_json) {
    try {
      const draft = JSON.parse(authState.draft_json);
      await saveWorkspaceDraft(env.DB, workspaceId, draft);
    } catch {
      return json({ error: "invalid_saved_draft" }, 400);
    }
  }

  const tokenValue = await createSessionToken(userId, sessionSecret(env));
  const destination = `${SITE_URL}/${authState.locale === "zh-TW" ? "zh-TW" : "en"}/dashboard`;
  return new Response(null, {
    status: 302,
    headers: { location: destination, "set-cookie": sessionCookie(tokenValue) },
  });
};
