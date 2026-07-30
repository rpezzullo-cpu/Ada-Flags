'use strict';

const { getClientPrincipal } = require('../shared/principal');

// GET /api/me -> the signed-in Suitsupply user (from the SWA auth header).
module.exports = async function (context, req) {
  const p = getClientPrincipal(req);
  context.res = {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: p
      ? { authenticated: true, name: p.name, email: p.email, roles: p.roles }
      : { authenticated: false }
  };
};
