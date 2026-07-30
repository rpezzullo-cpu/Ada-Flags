// GET /api/auth/logout -> clear the session cookie and return to the app
// (which will bounce to sign-in again).
import { clearCookie } from '../../_lib/session.js';

export async function onRequestGet() {
  return new Response(null, {
    status: 302,
    headers: { Location: '/', 'Set-Cookie': clearCookie() }
  });
}
