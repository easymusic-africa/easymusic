// Contrôle d'accès TEMPORAIRE, le temps de tester.
// Il sera remplacé par la vérification du paiement quand CinetPay sera branché.
// Sans la variable TEST_ACCESS_CODE sur Vercel, tout est refusé (sécurité par défaut).

const crypto = require("crypto");

function sha256(text) {
  return crypto.createHash("sha256").update(String(text)).digest();
}

// Retourne "ok", "disabled" (aucun code configuré) ou "denied" (mauvais code).
function checkAccess(req) {
  const expected = process.env.TEST_ACCESS_CODE;

  if (!expected) {
    return "disabled";
  }

  const provided = req.headers["x-access-code"];

  if (typeof provided !== "string" || provided.length === 0) {
    return "denied";
  }

  return crypto.timingSafeEqual(sha256(provided), sha256(expected)) ? "ok" : "denied";
}

module.exports = { checkAccess };
