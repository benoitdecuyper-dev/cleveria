// TTS serveur via ElevenLabs (voix humaine). Le front appelle cet endpoint et joue l'audio.
// Clé : ELEVENLABS_API_KEY ; voix : ELEVENLABS_VOICE_ID (sinon une voix multilingue par défaut).
// Pas de clé → 503, et le front reste silencieux (jamais de voix robotique de repli).
export const runtime = "nodejs";

// Voix "premade" (utilisable en compte gratuit ; les voix de bibliothèque exigent un plan payant).
const DEFAULT_VOICE_ID = "EXAVITQu4vr4xnSDxMaL"; // Sarah — claire/assurée (override via env)

export async function POST(req: Request) {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) return new Response("TTS désactivé (ELEVENLABS_API_KEY absente).", { status: 503 });

  let text = "";
  try {
    text = (((await req.json()) as { text?: string }).text ?? "").trim();
  } catch {
    return new Response("Corps invalide.", { status: 400 });
  }
  if (!text) return new Response("Texte vide.", { status: 400 });

  const voiceId = process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE_ID;
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: { "xi-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({
        text: text.slice(0, 2500),
        model_id: "eleven_multilingual_v2",
        voice_settings: { stability: 0.5, similarity_boost: 0.8 },
      }),
    },
  );

  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => "");
    return new Response(`Erreur TTS ElevenLabs (${res.status}). ${detail.slice(0, 200)}`, { status: 502 });
  }

  return new Response(res.body, {
    headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
  });
}
