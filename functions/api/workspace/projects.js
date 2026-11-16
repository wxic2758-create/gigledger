import { readAuthenticatedUserId } from "../../lib/session.js";

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { "content-type": "application/json; charset=utf-8" },
});

const text = (value, max = 80) => {
  const result = String(value || "").trim().slice(0, max);
  return result || null;
};

const currentWorkspace = async (env, request) => {
  const userId = await readAuthenticatedUserId(env, request.headers.get("cookie"));
  if (!userId) return { response: json({ authenticated: false }, 401) };
  const workspace = await env.DB.prepare("SELECT id FROM workspaces WHERE owner_id = ?").bind(userId).first();
  if (!workspace) return { response: json({ authenticated: true, projects: [] }) };
  return { workspaceId: workspace.id };
};

const projects = async (db, workspaceId) => {
  const rows = await db.prepare(
    "SELECT id, name, archived, created_at, updated_at FROM projects WHERE workspace_id = ? ORDER BY created_at DESC",
  ).bind(workspaceId).all();
  return (rows.results || []).map((item) => ({
    id: item.id,
    name: item.name,
    archived: Boolean(item.archived),
    createdAt: item.created_at,
    updatedAt: item.updated_at,
  }));
};

export const onRequestGet = async ({ env, request }) => {
  const current = await currentWorkspace(env, request);
  if (current.response) return current.response;
  return json({ authenticated: true, projects: await projects(env.DB, current.workspaceId) });
};

export const onRequestPost = async ({ env, request }) => {
  const current = await currentWorkspace(env, request);
  if (current.response) return current.response;
  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  const name = text(payload?.name);
  if (!name) return json({ error: "invalid_name" }, 400);
  const timestamp = new Date().toISOString();
  const existing = await env.DB.prepare(
    "SELECT id, archived FROM projects WHERE workspace_id = ? AND lower(name) = lower(?)",
  ).bind(current.workspaceId, name).first();
  if (existing) {
    if (!existing.archived) return json({ error: "project_exists" }, 409);
    await env.DB.prepare(
      "UPDATE projects SET archived = 0, updated_at = ? WHERE id = ? AND workspace_id = ?",
    ).bind(timestamp, existing.id, current.workspaceId).run();
    return json({ authenticated: true, projects: await projects(env.DB, current.workspaceId) });
  }
  await env.DB.prepare(
    "INSERT INTO projects (id, workspace_id, name, archived, created_at, updated_at) VALUES (?, ?, ?, 0, ?, ?)",
  ).bind(crypto.randomUUID(), current.workspaceId, name, timestamp, timestamp).run();
  return json({ authenticated: true, projects: await projects(env.DB, current.workspaceId) });
};

export const onRequestPut = async ({ env, request }) => {
  const current = await currentWorkspace(env, request);
  if (current.response) return current.response;
  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  const id = text(payload?.id, 80);
  const name = text(payload?.name);
  if (!id || !name) return json({ error: "invalid_request" }, 400);
  const timestamp = new Date().toISOString();
  const result = await env.DB.prepare(
    "UPDATE projects SET name = ?, updated_at = ? WHERE id = ? AND workspace_id = ?",
  ).bind(name, timestamp, id, current.workspaceId).run();
  if (!result.meta.changes) return json({ error: "project_not_found" }, 404);
  return json({ authenticated: true, projects: await projects(env.DB, current.workspaceId) });
};

export const onRequestDelete = async ({ env, request }) => {
  const current = await currentWorkspace(env, request);
  if (current.response) return current.response;
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return json({ error: "invalid_request" }, 400);
  const timestamp = new Date().toISOString();
  const result = await env.DB.prepare(
    "UPDATE projects SET archived = 1, updated_at = ? WHERE id = ? AND workspace_id = ?",
  ).bind(timestamp, id, current.workspaceId).run();
  if (!result.meta.changes) return json({ error: "project_not_found" }, 404);
  return json({ authenticated: true, projects: await projects(env.DB, current.workspaceId) });
};
