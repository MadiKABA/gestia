import { describe, expect, it } from "vitest";
import { generateClientId } from "@/infrastructure/offline/id-generator";

describe("generateClientId", () => {
  it("génère un identifiant non vide", () => {
    expect(generateClientId().length).toBeGreaterThan(0);
  });

  it("génère des identifiants uniques à chaque appel", () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateClientId()));
    expect(ids.size).toBe(100);
  });
});
