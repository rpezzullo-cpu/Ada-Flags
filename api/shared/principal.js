'use strict';

/**
 * Decode the Azure Static Web Apps client principal from the request.
 * SWA injects a base64-encoded JSON header (`x-ms-client-principal`) on every
 * authenticated request. Returns { name, email, roles } or null if signed out.
 */
function getClientPrincipal(req) {
  const header =
    (req.headers && (req.headers['x-ms-client-principal'] || req.headers['X-MS-CLIENT-PRINCIPAL'])) || null;
  if (!header) return null;
  try {
    const decoded = Buffer.from(header, 'base64').toString('utf8');
    const p = JSON.parse(decoded);
    const claims = p.claims || [];
    const claim = (types) => {
      for (const t of types) {
        const c = claims.find((x) => x.typ === t || (x.typ || '').endsWith('/' + t));
        if (c && c.val) return c.val;
      }
      return '';
    };
    const email = (
      p.userDetails ||
      claim(['email', 'emails', 'preferred_username', 'upn', 'unique_name'])
    ).toLowerCase();
    const name =
      claim(['name']) ||
      [claim(['given_name']), claim(['family_name'])].filter(Boolean).join(' ') ||
      email;
    return {
      name: name || email,
      email,
      roles: p.userRoles || [],
      identityProvider: p.identityProvider || ''
    };
  } catch (e) {
    return null;
  }
}

module.exports = { getClientPrincipal };
