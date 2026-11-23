// Petit utilitaire pour appeler l'API Mureka depuis les fonctions Vercel.
// La clé API reste côté serveur (variable d'environnement MUREKA_API_KEY).

const BASE_URL = "https://api.mureka.ai";

export async function murekaFetch(path, { method = "GET", body, timeoutMs = 45000 } = {}) {
  const apiKey = process.env.MUREKA_API_KEY;

  if (!apiKey) {
    const error = new Error("MUREKA_API_KEY manquante");
    error.code = "NO_KEY";
    throw error;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(BASE_URL + path, {
      method,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal
    });

    let data = null;
    try {
      data = await response.json();
    } catch (e) {
      data = null;
    }

    return { ok: response.ok, status: response.status, data };
  } finally {
    clearTimeout(timer);
  }
}
