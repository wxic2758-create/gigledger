import { loadWorkspace } from "../lib/ledger.js";
import { readAuthenticatedUserId } from "../lib/session.js";

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { "content-type": "application/json; charset=utf-8" },
});

export const onRequestGet = async ({ env, request }) => {
  const userId = await readAuthenticatedUserId(env, request.headers.get("cookie"));
  if (!userId) return json({ authenticated: false }, 401);
  const user = await env.DB.prepare(
    "SELECT id, email, name, avatar_url, timezone FROM users WHERE id = ?",
  ).bind(userId).first();
  if (!user) return json({ authenticated: false }, 401);
  const workspace = await env.DB.prepare(
    "SELECT id FROM workspaces WHERE owner_id = ?",
  ).bind(userId).first();
  if (!workspace) return json({ authenticated: true, user, ledger: null });
  const ledger = await loadWorkspace(env.DB, workspace.id);
  return json({
    authenticated: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatar_url,
      timezone: user.timezone,
    },
    ledger,
  });
};
