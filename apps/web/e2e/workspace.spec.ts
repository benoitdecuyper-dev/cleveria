import { test, expect } from "@playwright/test";

// Espace Projet — board redimensionnable + en-tête « bras droit » (CLV-41/42/45, docs/27).
// Réseau mocké (déterministe, pas d'appel IA réel) : on prouve le comportement DOM/CSS du
// lot, pas la génération elle-même (déjà couverte par e2e/chat.spec.ts).

async function mockMaquette(page: import("@playwright/test").Page) {
  await page.route("**/api/tts", (route) => route.abort());
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
    '<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>Maquette test</title></head>' +
    "<body><h1>Plomberie Test</h1></body></html>";
  await page.route("**/api/maquette", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ html: fakeHtml }) });
  });
}

async function startMaquetteConversation(page: import("@playwright/test").Page) {
  await mockMaquette(page);
  await page.goto("/voice");
  await page
    .getByRole("textbox", { name: "Décrivez votre activité" })
    .fill("Un site vitrine pour mon activité de plombier");
  await page.getByRole("button", { name: "Envoyer" }).click();
  await expect(page.locator("iframe.mockup-frame")).toBeVisible();
}

// Pose un marqueur JS directement sur le nœud DOM de l'iframe : un REMONTAGE React (rendu
// conditionnel `{mobileView === "board" && <MockupFrame/>}`) recréerait le nœud et perdrait ce
// marqueur, alors qu'un simple changement de visibilité/pointer-events le conserve — c'est la
// preuve la plus directe que MockupFrame n'est jamais démonté (docs/27 §12 pt.3).
async function markMockupFrame(page: import("@playwright/test").Page) {
  await page.evaluate(() => {
    (document.querySelector("iframe.mockup-frame") as unknown as Record<string, unknown>).__neverRemounted = true;
  });
}
async function readMockupFrameMarker(page: import("@playwright/test").Page) {
  return page.evaluate(
    () => (document.querySelector("iframe.mockup-frame") as unknown as Record<string, unknown> | null)?.__neverRemounted,
  );
}

test.describe("/voice — en-tête « bras droit » (CLV-42/45)", () => {
  test("le titre du fil courant et le badge de stage apparaissent dans la vbar, sans dégrader la hauteur du bandeau", async ({
    page,
  }) => {
    await page.route("**/api/tts", (route) => route.abort());
    await page.route("**/api/brief", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          reply: "Le statut auto-entrepreneur convient pour démarrer seul.",
          mode: "echange",
          isNote: false,
          questions: null,
          spoken: "Le statut auto-entrepreneur convient pour démarrer seul.",
          board: null,
        }),
      });
    });

    await page.goto("/voice?echange=1");
    await page
      .getByRole("textbox", { name: "Décrivez votre activité" })
      .fill("Quel statut juridique choisir ?");
    await page.getByRole("button", { name: "Envoyer" }).click();
    await expect(page.getByText("Le statut auto-entrepreneur convient pour démarrer seul.")).toBeVisible();

    // Badge de stage "Discussion" tant qu'on est au stage echange — même table STAGE_LABEL que
    // le tiroir d'historique (docs/27 §7 : jamais une 2e source de vérité du stage).
    await expect(page.locator(".vbar .hist-badge")).toHaveText("Discussion");

    // Le fil courant (titre auto-dérivé) apparaît juste après « Chef de projet », SUR LA MÊME
    // ligne que le nom (§7, §12 pt.1) — vérifié en mesurant que .vbar reste sur une hauteur
    // "compacte" (2 lignes : nom+titre+badge, puis statut), jamais 3.
    await expect(page.locator(".vbar .conv-title-inline")).toBeVisible();
    const vbarBox = await page.locator(".vbar").boundingBox();
    expect(vbarBox).not.toBeNull();
    // Seuil généreux (2 lignes de texte + paddings) : une régression qui ferait wrapper le
    // titre sur une 3e ligne ferait largement dépasser cette hauteur.
    expect(vbarBox!.height).toBeLessThan(90);

    // Le badge suit le stage SANS rechargement de page (CLV-45 critère §14 pt.5) : après
    // « Transformer en projet », il passe à « Projet ».
    await page.getByRole("button", { name: /Transformer en projet/ }).click();
    await expect(page.locator(".vbar .hist-badge")).toHaveText("Projet");
  });

  test("le bouton Historique porte un libellé visible, sur l'accueil et pendant la conversation", async ({ page }) => {
    await page.route("**/api/tts", (route) => route.abort());
    await page.goto("/voice");
    // Accueil : FAB avec libellé visible (CLV-45 — même traitement que pendant la conversation).
    await expect(page.locator(".voice-hist-fab .hist-btn-label")).toHaveText("Historique");

    await page.goto("/voice?demo=1");
    await page.getByRole("button", { name: "Envoyer" }).click();
    await expect(page.locator(".msg.me")).toBeVisible();
    await expect(page.locator(".vbar .hist-btn .hist-btn-label")).toHaveText("Historique");
  });

  test("la sticky du board (top: 98px) reste correctement calée sous le fil d'Ariane (pas de recouvrement)", async ({
    page,
  }) => {
    await startMaquetteConversation(page);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(150);
    const crumbsBox = await page.locator(".crumbs-bar").boundingBox();
    const boardBox = await page.locator(".board-pane").boundingBox();
    expect(crumbsBox).not.toBeNull();
    expect(boardBox).not.toBeNull();
    // Le board ne doit jamais commencer AU-DESSUS du bas du fil d'Ariane sticky (il serait
    // rogné/masqué en haut) — invariant explicitement à revérifier après CLV-42 (docs/27 §12 pt.1).
    expect(boardBox!.y).toBeGreaterThanOrEqual(crumbsBox!.y + crumbsBox!.height - 1);
  });
});

test.describe("/voice — board redimensionnable (CLV-41)", () => {
  test("desktop : glisser la poignée redimensionne le chat entre 320 et 560px, sans jamais démonter la maquette", async ({
    page,
  }) => {
    await startMaquetteConversation(page);
    await markMockupFrame(page);

    const before = await page.locator(".chat-pane").boundingBox();
    const handleBox = await page.locator(".split-handle").boundingBox();
    expect(handleBox).not.toBeNull();

    // Glisse vers la droite (élargit le chat), largement au-delà de la borne haute (560px) —
    // le clamp JS (clampChatW) doit arrêter à 560, jamais plus.
    await page.mouse.move(handleBox!.x + handleBox!.width / 2, handleBox!.y + handleBox!.height / 2);
    await page.mouse.down();
    await page.mouse.move(handleBox!.x + 400, handleBox!.y + handleBox!.height / 2, { steps: 6 });
    await page.mouse.up();

    const afterWide = await page.locator(".chat-pane").boundingBox();
    expect(afterWide!.width).toBeGreaterThan(before!.width);
    expect(afterWide!.width).toBeLessThanOrEqual(561); // borne haute 560px (+1px de marge d'arrondi)

    // Glisse vers la gauche, largement en dessous de la borne basse (320px).
    const handleBox2 = await page.locator(".split-handle").boundingBox();
    await page.mouse.move(handleBox2!.x + handleBox2!.width / 2, handleBox2!.y + handleBox2!.height / 2);
    await page.mouse.down();
    await page.mouse.move(handleBox2!.x - 400, handleBox2!.y + handleBox2!.height / 2, { steps: 6 });
    await page.mouse.up();
    const afterNarrow = await page.locator(".chat-pane").boundingBox();
    expect(afterNarrow!.width).toBeGreaterThanOrEqual(319); // borne basse 320px (-1px de marge d'arrondi)

    // La maquette n'a JAMAIS été démontée pendant tout le drag (aucun re-render conditionnel).
    expect(await readMockupFrameMarker(page)).toBe(true);
    await expect(page.frameLocator("iframe.mockup-frame").getByText("Plomberie Test")).toBeVisible();
  });

  test("desktop : « Agrandir » masque le chat sans jamais démonter la maquette, la pastille de retour la restaure", async ({
    page,
  }) => {
    await startMaquetteConversation(page);
    await markMockupFrame(page);

    await page.getByRole("button", { name: "Agrandir l'aperçu" }).click();
    await expect(page.locator(".chat-pane")).toBeHidden();
    await expect(page.locator(".split-handle")).toBeHidden();
    const boardBox = await page.locator(".board-pane").boundingBox();
    const workspaceBox = await page.locator(".workspace.split").boundingBox();
    // Le board occupe (quasi) toute la largeur du workspace une fois agrandi.
    expect(boardBox!.width).toBeGreaterThan(workspaceBox!.width * 0.9);
    await expect(page.frameLocator("iframe.mockup-frame").getByText("Plomberie Test")).toBeVisible();

    await page.getByRole("button", { name: /Revenir à la discussion/ }).click();
    await expect(page.locator(".chat-pane")).toBeVisible();
    await expect(page.locator(".split-handle")).toBeVisible();
    expect(await readMockupFrameMarker(page)).toBe(true); // jamais démontée, même en boucle agrandir/revenir
  });

  test("stage « echange » (pas de board) : ni poignée, ni bouton agrandir, ni onglets mobile — layout inchangé", async ({
    page,
  }) => {
    await page.route("**/api/tts", (route) => route.abort());
    await page.goto("/voice?echange=1");
    await page
      .getByRole("textbox", { name: "Décrivez votre activité" })
      .fill("Bonjour");
    await page.route("**/api/brief", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ reply: "Bonjour !", mode: "echange", isNote: false, questions: null, spoken: null, board: null }),
      });
    });
    await page.getByRole("button", { name: "Envoyer" }).click();
    await expect(page.locator(".msg.me")).toBeVisible();

    await expect(page.locator(".workspace.split")).toHaveCount(0);
    await expect(page.locator(".split-handle")).toHaveCount(0);
    await expect(page.locator(".mtabs")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Agrandir l'aperçu" })).toHaveCount(0);
  });
});

test.describe("/voice — bascule mobile Discussion/Aperçu (CLV-41 §4/§6)", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("bascule par onglets sans jamais recharger la maquette, composer actionnable sur les 2 onglets", async ({
    page,
  }) => {
    await startMaquetteConversation(page);
    // 1re apparition d'un board sur mobile → bascule AUTO vers "Aperçu" (§4.1), sans action.
    await expect(page.getByRole("tab", { name: "Discussion" })).toHaveAttribute("aria-selected", "false");
    await expect(page.getByRole("tab", { name: /Aperçu du site/ })).toHaveAttribute("aria-selected", "true");
    await markMockupFrame(page);

    // Bascule vers "Discussion" : le composer reste actionnable (le piège du display:none sur
    // un ancêtre, docs/27 §6).
    await page.getByRole("tab", { name: "Discussion" }).click();
    await expect(page.locator(".thread")).toBeVisible();
    const composer = page.getByPlaceholder("Votre réponse…");
    await expect(composer).toBeVisible();
    await expect(composer).toBeEditable();
    await composer.fill("Mettez le titre en bleu");
    await expect(composer).toHaveValue("Mettez le titre en bleu");

    // Retour sur "Aperçu" : la maquette n'a JAMAIS été démontée (même marqueur DOM qu'avant la
    // bascule) — la preuve que MockupFrame n'est jamais remonté (docs/27 §12 pt.3).
    await page.getByRole("tab", { name: /Aperçu du site/ }).click();
    expect(await readMockupFrameMarker(page)).toBe(true);
    await expect(page.frameLocator("iframe.mockup-frame").getByText("Plomberie Test")).toBeVisible();
  });

  test("le composer envoie bien une retouche depuis l'onglet Aperçu, sans revenir sur Discussion", async ({ page }) => {
    await startMaquetteConversation(page);
    await expect(page.getByRole("tab", { name: /Aperçu du site/ })).toHaveAttribute("aria-selected", "true");

    let lastFeedback: string | undefined;
    await page.route("**/api/maquette", async (route) => {
      const body = route.request().postDataJSON() as { feedback?: string };
      lastFeedback = body.feedback;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          html:
            '<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>v2</title></head>' +
            '<body><h1 style="color:blue">Plomberie Test v2</h1></body></html>',
        }),
      });
    });

    // On reste sur l'onglet "Aperçu" (jamais basculé sur "Discussion") et on écrit la retouche.
    const composer = page.getByPlaceholder("Votre réponse…");
    await expect(composer).toBeVisible();
    await composer.fill("Mets le titre en bleu");
    await page.getByRole("button", { name: "Envoyer" }).click();

    await expect(page.frameLocator("iframe.mockup-frame").getByText("Plomberie Test v2")).toBeVisible();
    expect(lastFeedback).toBe("Mets le titre en bleu");
  });
});
