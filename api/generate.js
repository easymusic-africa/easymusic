module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Méthode non autorisée"
    });
  }

  try {
    const apiKey = process.env.MUREKA_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "Clé API Mureka non configurée"
      });
    }

    const {
      lyrics,
      style,
      model = "mureka-9.5",
      gender
    } = req.body || {};

    if (!lyrics || typeof lyrics !== "string") {
      return res.status(400).json({
        error: "Les paroles de la chanson sont obligatoires."
      });
    }

    if (lyrics.length > 5000) {
      return res.status(400).json({
        error: "Les paroles sont trop longues."
      });
    }

    const allowedModels = [
      "mureka-9",
      "mureka-9.5"
    ];

    if (!allowedModels.includes(model)) {
      return res.status(400).json({
        error: "Modèle musical non autorisé."
      });
    }

    const response = await fetch(
      "https://api.mureka.ai/v1/song/generate",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          lyrics,
          model,
          prompt: style || "Afropop, African music, professional production",
          n: 1,
          ...(gender ? { gender } : {})
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data.error?.message || "Erreur Mureka",
        details: data
      });
    }

    return res.status(200).json({
      success: true,
      message: "Génération musicale lancée.",
      task: data
    });

  } catch (error) {
    return res.status(500).json({
      error: "Erreur du serveur.",
      details: error.message
    });
  }
};
