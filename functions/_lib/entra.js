// Microsoft Entra ID (Azure AD) OAuth2 helpers — single-tenant, so only
// Suitsupply accounts can sign in. Sign-in uses only user-consentable scopes
// (openid profile email); the one-time owner setup adds Files.Read offline_access.

function authorizeUrl(env, { redirectUri, scope, state, prompt }) {
  const params = new URLSearchParams({
    client_id: env.ENTRA_CLIENT_ID,
    response_type: 'code',
    redirect_uri: redirectUri,
    response_mode: 'query',
    scope,
    state
  });
  if (prompt) params.set('prompt', prompt);
  return `https://login.microsoftonline.com/${env.TENANT_ID}/oauth2/v2.0/authorize?${params.toString()}`;
}

async function exchangeCode(env, { code, redirectUri, scope }) {
  const body = new URLSearchParams({
    client_id: env.ENTRA_CLIENT_ID,
    client_secret: env.ENTRA_CLIENT_SECRET,
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    scope
  });
  const res = await fetch(`https://login.microsoftonline.com/${env.TENANT_ID}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  if (!res.ok) throw new Error('Token exchange failed: ' + res.status + ' ' + (await res.text()));
  return res.json();
}

// Decode a JWT payload WITHOUT signature verification. Safe here because the
// id_token is received directly from Entra over TLS in the code exchange —
// it never passes through an untrusted party.
function decodeIdToken(idToken) {
  const parts = (idToken || '').split('.');
  if (parts.length < 2) return {};
  const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '==='.slice((b64.length + 3) % 4);
  try {
    return JSON.parse(decodeURIComponent(escape(atob(padded))));
  } catch (e) {
    return {};
  }
}

function claimsToUser(claims) {
  const email = (claims.preferred_username || claims.email || claims.upn || '').toLowerCase();
  const name = claims.name || email;
  return { name, email, oid: claims.oid || '', tid: claims.tid || '' };
}

export { authorizeUrl, exchangeCode, decodeIdToken, claimsToUser };
