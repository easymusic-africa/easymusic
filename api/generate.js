module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Méthode non autorisée"
    });
  }

  try {
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

    const API_KEY = process.env.MUREKA_API_KEY;

    if (!API_KEY) {
      return res.status(500).json({
        error: "Clé API Mureka manquante sur Vercel."
      });
    }

    const prompt = `
Écris des paroles de chanson originales et émotionnelles en français.

Personne concernée : ${recipient}
Occasion : ${occasion}
Histoire : ${story}
Style musical : ${style}
Voix souhaitée : ${gender || "au choix"}

Structure la chanson avec :
[Intro]
[Verse 1]
[Pre-Chorus]
[Chorus]
[Verse 2]
[Bridge]
[Final Chorus]
[Outro]

La chanson doit être personnalisée, cohérente, touchante,
musicalement exploitable et adaptée à l'occasion.
`;

    // 1. Génération des paroles
    const lyricsResponse = await fetch(
      "https://api.mureka.ai/v1/lyrics/generate",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          prompt
        })
      }
    );

    const lyricsData = await lyricsResponse.json();

    if (!lyricsResponse.ok) {
      return res.status(502).json({
        error: "Erreur lors de la génération des paroles.",
        details: lyricsData
      });
    }

    const lyrics = lyricsData.lyrics;

    if (!lyrics) {
      return res.status(502).json({
        error: "Mureka n'a pas retourné de paroles."
      });
    }

    // 2. Génération de la chanson
    const musicPrompt = `${style}, French lyrics, emotional,
personalized song, professional production`;

    const songResponse = await fetch(
      "https://api.mureka.ai/v1/song/generate",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          lyrics,
          model: "mureka-9.5",
          n: 1,
          prompt: musicPrompt,
          gender: gender || undefined
        })
      }
    );

    const songData = await songResponse.json();

    if (!songResponse.ok) {
      return res.status(502).json({
        error: "Erreur lors du lancement de la génération musicale.",
        details: songData
      });
    }

    // 3. Retour des informations
    return res.status(200).json({
      success: true,
      message: "Votre chanson a été envoyée en génération.",
      title: lyricsData.title || "Votre chanson personnalisée",
      lyrics,
      task: songData
    });

  } catch (error) {
    return res.status(500).json({
      error: "Une erreur interne est survenue.",
      details: error.message
    });
  }
};
