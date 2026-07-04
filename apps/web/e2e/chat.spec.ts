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

  test("affiche l'accueil Shazam (micro + repli texte)", async ({ page }) => {
    await page.goto("/voice");
    // Hero "Shazam du besoin" repositionné site (docs/25) : titre + champ description
    // (primaire) avec micro compact accolé + repli écrit.
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Voyons à quoi ressemble votre site.");
    await expect(page.getByRole("button", { name: "Parler" })).toBeVisible();
    // Le bouton Envoyer (du repli texte) est désactivé tant que rien n'est saisi.
    const send = page.getByRole("button", { name: "Envoyer" });
    await expect(send).toBeDisabled();
    // En tapant son besoin, il s'active. Nommé explicitement : un 2e champ (URL du site
    // existant, optionnel — service site) partage aussi le rôle "textbox" dans le hero.
    await page.getByRole("textbox", { name: "Décrivez votre activité" }).fill("Bonjour");
    await expect(send).toBeEnabled();
  });

  test("un aller-retour complet en mode démo affiche la réponse du chef de projet", async ({ page }) => {
    await page.goto("/voice?demo=1");
    // Le champ est pré-rempli par le scénario démo (nommé explicitement : le hero a aussi un
    // 2e champ "textbox", l'URL optionnelle du site existant — service site).
    await expect(page.getByRole("textbox", { name: "Décrivez votre activité" })).not.toHaveValue("");

    await page.getByRole("button", { name: "Envoyer" }).click();

    // La bulle utilisateur apparaît immédiatement (optimiste)…
    await expect(page.locator(".msg.me")).toBeVisible();
    // …puis la réponse scriptée du chef de projet (1ère salve = questions).
    await expect(page.getByText("Quel statut juridique", { exact: false })).toBeVisible();
    // Le hero (et son champ URL) a disparu après l'envoi : le composer est alors le SEUL champ
    // texte visible. Vérifie qu'il est vide (pas de transcription résiduelle).
    await expect(page.getByRole("textbox")).toHaveValue("");
  });
});

// Parcours maquette (docs/18) : réseau mocké (pas d'appel IA réel, déterministe) — on simule
// juste ce que /api/brief et /api/maquette renvoient, pour prouver le CŒUR technique : montage
// automatique de la maquette (sans bouton), sandbox effectif, et persistance au refresh.
test.describe("/voice — parcours maquette", () => {
  test("MODE: maquette → génération auto dans le board, sandbox vide, survit au refresh", async ({ page }) => {
    await page.route("**/api/tts", (route) => route.abort());

    // /api/brief : simule le bras droit détectant un projet visuel (MODE: maquette) dès le
    // 1er message — pas de flux SSE ici, juste le JSON final (le client gère les deux formats).
    await page.route("**/api/brief", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          reply: "",
          mode: "maquette",
          isNote: false,
          questions: null,
          spoken: "Je vous prépare une première maquette tout de suite.",
          board: null,
          maquetteSeed: "site vitrine plombier, sections offre/contact, ton pro",
          userEcho: "Un site vitrine pour mon activité de plombier",
        }),
      });
    });

    const fakeHtml =
      '<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>Maquette test</title>' +
      "<style>body{font-family:sans-serif}</style></head><body><h1>Plomberie Test</h1>" +
      "<p>Maquette e2e — vérif sandbox</p></body></html>";

    // /api/maquette : simule factory-maquettiste (JSON direct, comme le mode démo réel).
    await page.route("**/api/maquette", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ html: fakeHtml }) });
    });

    await page.goto("/voice");
    await page
      .getByRole("textbox", { name: "Décrivez votre activité" })
      .fill("Un site vitrine pour mon activité de plombier");
    await page.getByRole("button", { name: "Envoyer" }).click();

    // Génération AUTOMATIQUE, sans bouton : le board bascule en maquette et l'iframe apparaît.
    const frame = page.locator("iframe.mockup-frame");
    await expect(frame).toBeVisible();
    // Décision de sécu non négociable (docs/18 §1) : sandbox VIDE, aucun flag.
    await expect(frame).toHaveAttribute("sandbox", "");
    // Le contenu généré est bien rendu À L'INTÉRIEUR du sandbox.
    await expect(page.frameLocator("iframe.mockup-frame").getByText("Plomberie Test")).toBeVisible();
    // La trace dans le chat est discrète (pas de redite du HTML dans le fil).
    await expect(page.getByText("🎨 Maquette mise à jour")).toBeVisible();

    // Persistance (P0-A) : /voice ne restaure pas la dernière conversation au chargement — il
    // faut rouvrir via l'historique. La maquette (kind + HTML) doit être identique après reload.
    await page.reload();
    await expect(page.locator("iframe.mockup-frame")).toHaveCount(0); // page vierge après refresh
    await page.getByRole("button", { name: "Historique des conversations" }).click();
    await page.locator(".hist-open").first().click();

    const reopenedFrame = page.locator("iframe.mockup-frame");
    await expect(reopenedFrame).toBeVisible();
    await expect(reopenedFrame).toHaveAttribute("sandbox", "");
    await expect(page.frameLocator("iframe.mockup-frame").getByText("Plomberie Test")).toBeVisible();
  });

  test("itération : un retour visuel régénère la maquette ENTIÈRE (pas un patch), sans repasser par le bras droit", async ({
    page,
  }) => {
    await page.route("**/api/tts", (route) => route.abort());

    // /api/brief : uniquement l'ENTRÉE en phase maquette (1er tour). Le fast-path retouche
    // (docs/18 §4/§7) doit court-circuiter le bras droit pour tous les tours suivants — le test
    // compte les appels pour le prouver.
    let briefCalls = 0;
    await page.route("**/api/brief", async (route) => {
      briefCalls += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          reply: "",
          mode: "maquette",
          isNote: false,
          questions: null,
          spoken: "Je vous prépare une première maquette.",
          board: null,
          maquetteSeed: "site vitrine plombier",
          userEcho: "Un site vitrine pour mon activité de plombier",
        }),
      });
    });

    // /api/maquette : renvoie un document DIFFÉRENT selon présence de `feedback` — preuve que
    // c'est bien une régénération intégrale (nouveau document), pas un patch du premier. Le
    // feedback doit être le texte BRUT tapé par l'utilisateur (pas une reformulation du bras
    // droit, puisqu'il n'est plus appelé pour ce tour).
    let lastFeedback: string | undefined;
    await page.route("**/api/maquette", async (route) => {
      const body = route.request().postDataJSON() as { feedback?: string };
      lastFeedback = body.feedback;
      const html = body.feedback
        ? '<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>v2</title></head><body><h1 style="color:green">Plomberie Test v2</h1></body></html>'
        : '<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>v1</title></head><body><h1>Plomberie Test v1</h1></body></html>';
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ html }) });
    });

    await page.goto("/voice");
    await page
      .getByRole("textbox", { name: "Décrivez votre activité" })
      .fill("Un site vitrine pour mon activité de plombier");
    await page.getByRole("button", { name: "Envoyer" }).click();

    await expect(page.frameLocator("iframe.mockup-frame").getByText("Plomberie Test v1")).toBeVisible();
    expect(briefCalls).toBe(1);

    // Tour suivant, en phase maquette : un retour visuel → régénération intégrale, DIRECT vers
    // le maquettiste (le composer ne doit plus jamais rappeler /api/brief une fois en maquette).
    await page.getByPlaceholder("Votre réponse…").fill("Mets le titre en vert");
    await page.getByRole("button", { name: "Envoyer" }).click();

    await expect(page.frameLocator("iframe.mockup-frame").getByText("Plomberie Test v2")).toBeVisible();
    // L'ancien contenu a bien disparu (régénération complète, pas un ajout à côté).
    await expect(page.frameLocator("iframe.mockup-frame").getByText("Plomberie Test v1")).toHaveCount(0);
    // Le bras droit n'a PAS été rappelé pour la retouche — c'est tout l'objet du fast-path.
    expect(briefCalls).toBe(1);
    expect(lastFeedback).toBe("Mets le titre en vert");
    // Trace chat discrète pour la retouche aussi (2 occurrences : entrée + retouche).
    await expect(page.getByText("🎨 Maquette mise à jour")).toHaveCount(2);
  });
});
