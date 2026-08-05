// GET /api/me -> the signed-in Suitsupply user (from the session cookie).
import { getSession } from '../_lib/session.js';

export async function onRequestGet(context) {
  const session = await getSession(context.request, context.env);
  const body = session
    ? { authenticated: true, name: session.name, email: session.email }
    : { authenticated: false };
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  });
}
