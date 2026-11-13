const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { "content-type": "application/json; charset=utf-8" },
});

const readSession = (cookieHeader) => {
  if (!cookieHeader) return null;
  const raw = cookieHeader.split(";").map((item) => item.trim()).reduce((found, item) => {
    const [key, ...rest] = item.split("=");
    if (key !== "gigledger_session") return found;
    return rest.join("=");
  }, null);
  if (!raw) return null;
  try {
    return JSON.parse(atob(raw));
  } catch {
    return null;
  }
};

export const onRequestGet = async ({ env, request }) => {
  const session = readSession(request.headers.get("cookie"));
  if (!session?.userId) return json({ authenticated: false }, 401);
  const user = await env.DB.prepare(
    "SELECT users.id, users.email, users.name, users.avatar_url, users.timezone, workspaces.id AS workspace_id, workspaces.base_currency, workspaces.tax_reserve_rate, workspaces.cash_on_hand FROM users LEFT JOIN workspaces ON workspaces.owner_id = users.id WHERE users.id = ?",
  ).bind(session.userId).first();
  if (!user) return json({ authenticated: false }, 401);
  return json({ authenticated: true, user });
};
