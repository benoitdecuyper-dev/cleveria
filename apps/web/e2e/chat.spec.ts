import { test, expect } from "@playwright/test";

// Parcours chat en mode démo (déterministe, sans appel IA).
// Couvre : rendu de l'accueil, état du composer, et un aller-retour complet
// (envoi → réponse scriptée du chef de projet).

test.describe("/voice — parcours chat", () => {
  // La voix est active par défaut → on coupe l'appel TTS (ElevenLabs) pour garder
  // le smoke hermétique et déterministe (la lecture audio n'est pas l'objet du test).
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/tts", (route) => route.abort());
  });

  test("affiche l'accueil et le composer", async ({ page }) => {
    await page.goto("/voice");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    // Le bouton Envoyer est désactivé tant que rien n'est saisi.
    const send = page.getByRole("button", { name: "Envoyer" });
    await expect(send).toBeDisabled();
    // En tapant, il s'active.
    await page.getByRole("textbox").fill("Bonjour");
    await expect(send).toBeEnabled();
  });

  test("un aller-retour complet en mode démo affiche la réponse du chef de projet", async ({ page }) => {
    await page.goto("/voice?demo=1");
    // Le champ est pré-rempli par le scénario démo.
    const field = page.getByRole("textbox");
    await expect(field).not.toHaveValue("");

    await page.getByRole("button", { name: "Envoyer" }).click();

    // La bulle utilisateur apparaît immédiatement (optimiste)…
    await expect(page.locator(".msg.me")).toBeVisible();
    // …puis la réponse scriptée du chef de projet (1ère salve = questions).
    await expect(page.getByText("Quel statut juridique", { exact: false })).toBeVisible();
    // Le champ a été vidé après l'envoi (pas de transcription résiduelle).
    await expect(field).toHaveValue("");
  });
});
