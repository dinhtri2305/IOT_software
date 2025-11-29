const crypto = require("crypto");

// Simple cookie parser for clientId (no dependency required)
function parseCookies(header) {
  const list = {};
  if (!header) return list;
  header.split(";").forEach((cookie) => {
    const parts = cookie.split("=");
    const key = parts.shift().trim();
    const value = decodeURIComponent(parts.join("="));
    list[key] = value;
  });
  return list;
}

// Middleware: ensure each client has a stable HttpOnly cookie `clientId`.
// Attaches `req.clientId`.
module.exports = function ensureClientId(req, res, next) {
  try {
    const cookies = parseCookies(req.headers && req.headers.cookie);
    let clientId = cookies.clientId;
    if (!clientId) {
      clientId = crypto.randomUUID();
      // Set HttpOnly cookie, sameSite Lax, path /
      res.cookie("clientId", clientId, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        // short-lived for dev; in production consider longer expiration
        maxAge: 1000 * 60 * 60 * 24 * 30,
      });
    }
    req.clientId = clientId;
  } catch (e) {
    // On any error, fallback to a generated id attached to req only
    try {
      req.clientId = crypto.randomUUID();
    } catch (err) {
      req.clientId = Date.now().toString();
    }
  }
  next();
};
