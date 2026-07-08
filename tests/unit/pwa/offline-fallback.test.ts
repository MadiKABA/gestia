import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * public/offline.html est un fichier statique (pas une route Next.js) servi
 * par le Service Worker en fallback de navigation (voir src/app/sw.ts,
 * fallbacks.entries sur request.destination === "document") — testé ici par
 * lecture directe plutôt que via un rendu, la vérification d'affichage réel
 * relevant d'un test e2e avec build de production + coupure réseau simulée.
 */
const html = readFileSync(path.resolve(__dirname, "../../../public/offline.html"), "utf-8");

describe("Page offline (public/offline.html)", () => {
  it("reste dans le vocabulaire commerçant, sans jargon réseau/technique", () => {
    expect(html).toContain("Pas de connexion");
    expect(html).toContain("Vos données seront synchronisées dès que possible");

    for (const jargon of ["ERR_", "DNS", "network error", "Storage API", "IndexedDB"]) {
      expect(html.toLowerCase()).not.toContain(jargon.toLowerCase());
    }
  });

  it("propose une action de nouvelle tentative", () => {
    expect(html).toMatch(/<button[^>]*onclick="location\.reload\(\)"[^>]*>Réessayer<\/button>/);
  });

  it("respecte la charte de couleurs de la plateforme (#0F2A4A / #F7F8FA)", () => {
    expect(html.toLowerCase()).toContain("#0f2a4a");
    expect(html.toLowerCase()).toContain("#f7f8fa");
  });

  it("porte le wordmark Gestia et un titre de document identifiable", () => {
    expect(html).toContain(">Gestia<");
    expect(html).toMatch(/<title>Gestia.*<\/title>/);
  });
});
