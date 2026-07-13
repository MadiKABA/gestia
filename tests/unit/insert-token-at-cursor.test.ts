import { describe, expect, it } from "vitest";
import { insertTokenAtCursor } from "@/presentation/tenant/insert-token-at-cursor";

describe("insertTokenAtCursor", () => {
  it("insère le token à la position du curseur", () => {
    const { value, cursor } = insertTokenAtCursor("Salam client !", "boutique", 6, 6);
    expect(value).toBe("Salam {boutique}client !");
    expect(cursor).toBe(16);
  });

  it("remplace la sélection courante si une plage est sélectionnée", () => {
    const { value } = insertTokenAtCursor("Salam client !", "boutique", 6, 12);
    expect(value).toBe("Salam {boutique} !");
  });

  it("insère à la fin si le curseur est en bout de texte", () => {
    const { value } = insertTokenAtCursor("Salam", "boutique", 5, 5);
    expect(value).toBe("Salam{boutique}");
  });
});
