// GET /api/song-status?id=XXXX
// Demande à Mureka où en est la chanson et renvoie : pending, ready ou failed.

const { murekaFetch } = require("../lib/mureka");
const { checkAccess } = require("../lib/access");

const DONE = ["succeeded", "success", "completed"];
const FAILED = ["failed", "timeouted", "timeout", "cancelled", "canceled"];

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Méthode non autorisée" });
  }

  const access = checkAccess(req);
  if (access === "disabled") {
    return res.status(503).json({ error: "Service non activé." });
  }
  if (access === "denied") {
    return res.status(401).json({ error: "Code d'accès invalide." });
  }

  const id = req.query && req.query.id;

  if (typeof id !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(id)) {
    return res.status(400).json({ error: "Identifiant invalide." });
  }

  try {
    const result = await murekaFetch(`/v1/song/query/${encodeURIComponent(id)}`);

    if (!result.ok || !result.data) {
      console.error("Mureka query error", result.status, JSON.stringify(result.data));
      return res.status(502).json({ error: "Impossible de vérifier l'état de la chanson." });
    }

    const rawStatus = String(result.data.status || "").toLowerCase();

    if (FAILED.includes(rawStatus)) {
      return res.status(200).json({ status: "failed" });
    }

    if (DONE.includes(rawStatus)) {
      const choices = Array.isArray(result.data.choices) ? result.data.choices : [];
      const first = choices[0] || {};
      const audioUrl = first.url || first.mp3_url || null;

      if (!audioUrl) {
        console.error("Mureka: statut terminé sans lien audio", JSON.stringify(result.data));
        return res.status(502).json({ error: "La chanson est terminée mais le lien audio est absent." });
      }

      return res.status(200).json({
        status: "ready",
        audioUrl,
        duration: first.duration || null
      });
    }

    return res.status(200).json({ status: "pending" });
  } catch (error) {
    console.error("song-status error", error && error.message);
    return res.status(500).json({ error: "Une erreur interne est survenue." });
  }
};
