// Gate the static app behind Suitsupply sign-in. API routes self-protect (they
// return 401), so we only redirect *page* navigations here. Auth/setup/health
// endpoints are always reachable so the login flow can run.

import { getSession } from './_lib/session.js';

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  // API endpoints handle their own auth; never redirect an API call.
  if (path.startsWith('/api/')) return next();

  // Static assets / favicon can load freely (the HTML holds no data until the
  // authenticated /api calls succeed).
  if (path === '/favicon.ico' || path === '/robots.txt') return next();

  const session = await getSession(request, env);
  if (!session) {
    const login = new URL('/api/auth/login', url.origin);
    login.searchParams.set('redirect', path + url.search);
    return Response.redirect(login.toString(), 302);
  }
  return next();
}
