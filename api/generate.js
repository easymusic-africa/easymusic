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
      recipient,
      occasion,
      story,
      style,
      gender
    } = req.body || {};

    if (!recipient || !occasion || !story || !style) {
      return res.status(400).json({
        error: "Veuillez remplir tous les champs obligatoires."
      });
    }

    const lyricPrompt = `
Écris des paroles originales pour une chanson personnalisée.

Destinataire : ${recipient}
Occasion : ${occasion}
Histoire et détails personnels : ${story}
Style musical : ${style}

Instructions :
- Écris une chanson émotionnelle et originale.
- Utilise des paroles naturelles et faciles à chanter.
- Structure la chanson avec couplets, refrain et pont si nécessaire.
- Adapte les paroles à l'occasion.
- Ne mentionne pas ces instructions.
- Écris uniquement les paroles de la chanson.
`;

    // 1. Génération des paroles
    const lyricsResponse = await fetch(
      "https://api.mureka.ai/v1/lyrics/generate",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          prompt: lyricPrompt
        })
      }
    );

    const lyricsData = await lyricsResponse.json();

    if (!lyricsResponse.ok) {
      return res.status(lyricsResponse.status).json({
        error: "Impossible de générer les paroles.",
        details: lyricsData
      });
    }

    const lyrics =
      lyricsData.lyrics ||
      lyricsData.data?.lyrics ||
      lyricsData.result?.lyrics;

    if (!lyrics) {
      return res.status(500).json({
        error: "Les paroles n'ont pas été retournées par Mureka.",
        details: lyricsData
      });
    }

    // 2. Génération de la musique
    const musicResponse = await fetch(
      "https://api.mureka.ai/v1/song/generate",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          lyrics,
          model: "mureka-9.5",
          prompt: `${style}, African music, professional production, high quality`,
          n: 1,
          ...(gender ? { gender } : {})
        })
      }
    );

    const musicData = await musicResponse.json();

    if (!musicResponse.ok) {
      return res.status(musicResponse.status).json({
        error: "La génération musicale a échoué.",
        details: musicData
      });
    }

    return res.status(200).json({
      success: true,
      message: "Génération musicale lancée.",
      task: musicData,
      lyrics
    });

  } catch (error) {
    return res.status(500).json({
      error: "Erreur du serveur.",
      details: error.message
    });
  }
};
