import { AppStoreReportError, confirmAppStorePayout, loadAppStoreFinance } from "../../../lib/app-store-reports.js";
import { loadWorkspace } from "../../../lib/ledger.js";
import { readAuthenticatedUserId } from "../../../lib/session.js";

export const onRequestPost = async ({ env, request }) => {
  const userId = await readAuthenticatedUserId(env, request.headers.get("cookie"));
  if (!userId) return Response.json({ authenticated: false }, { status: 401 });
  const workspace = await env.DB.prepare(
    "SELECT w.id, u.timezone FROM workspaces w JOIN users u ON u.id = w.owner_id WHERE u.id = ?",
  ).bind(userId).first();
  if (!workspace) return Response.json({ error: "workspace_not_found" }, { status: 404 });

  try {
    const payload = await request.json().catch(() => null);
    await confirmAppStorePayout(env.DB, workspace, payload);
    const [ledger, financeReports] = await Promise.all([
      loadWorkspace(env.DB, workspace.id), loadAppStoreFinance(env.DB, workspace.id),
    ]);
    return Response.json({ ledger, financeReports });
  } catch (error) {
    const expected = error instanceof AppStoreReportError;
    return Response.json({
      error: expected ? error.message : "app_store_payout_failed",
    }, { status: expected ? error.status : 500 });
  }
};
