import { describe, it, expect } from "vitest";
import { buildUserMessage, stripHtmlFence } from "./maquette";

describe("buildUserMessage", () => {
  it("1er jet : pas de previousHtml/feedback → message basé sur le seed seul", () => {
    const msg = buildUserMessage("site vitrine plombier");
    expect(msg).toContain("## Brief");
    expect(msg).toContain("site vitrine plombier");
    expect(msg).not.toContain("Maquette précédente");
  });

  it("itération : previousHtml + feedback → régénération intégrale demandée", () => {
    const msg = buildUserMessage("site vitrine plombier", "<html>ancien</html>", "le bouton en vert");
    expect(msg).toContain("Maquette précédente");
    expect(msg).toContain("<html>ancien</html>");
    expect(msg).toContain("le bouton en vert");
    expect(msg).toMatch(/ENTIER/);
  });

  it("previousHtml sans feedback (ou l'inverse) → repart en 1er jet (garde-fou)", () => {
    const msg = buildUserMessage("seed", "<html>x</html>", undefined);
    expect(msg).not.toContain("Maquette précédente");
  });
});

describe("stripHtmlFence", () => {
  it("laisse passer un document déjà propre", () => {
    const html = "<!DOCTYPE html>\n<html><head></head><body>ok</body></html>";
    expect(stripHtmlFence(html)).toBe(html);
  });

  it("retire un fence ```html autour du document", () => {
    const html = "<!DOCTYPE html>\n<html><body>x</body></html>";
    const raw = "```html\n" + html + "\n```";
    expect(stripHtmlFence(raw)).toBe(html);
  });

  it("retire un préambule/postambule autour du document", () => {
    const html = "<!DOCTYPE html>\n<html><body>x</body></html>";
    const raw = `Voici la maquette :\n\n${html}\n\nDites-moi ce que vous en pensez.`;
    expect(stripHtmlFence(raw)).toBe(html);
  });

  it("sans DOCTYPE ni </html> détectable → renvoie le texte tel quel (défensif)", () => {
    const raw = "pas du html";
    expect(stripHtmlFence(raw)).toBe("pas du html");
  });
});
