import { clearedSessionCookie } from "../../lib/session.js";

export const onRequestGet = async () => new Response(null, {
  status: 302,
  headers: {
    location: "/",
    "set-cookie": clearedSessionCookie(),
  },
});
