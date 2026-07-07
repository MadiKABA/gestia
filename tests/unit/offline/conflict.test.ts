import { describe, expect, it } from "vitest";
import { detectConflict } from "@/domain/offline/conflict";

describe("detectConflict", () => {
  it("aucun conflit si le serveur n'a pas changé depuis le dernier état connu du client", () => {
    expect(detectConflict("2026-01-01T00:00:00.000Z", "2026-01-01T00:00:00.000Z")).toBe(false);
  });

  it("aucun conflit si le serveur est plus ancien (ne devrait pas arriver, mais pas un conflit)", () => {
    expect(detectConflict("2026-01-02T00:00:00.000Z", "2026-01-01T00:00:00.000Z")).toBe(false);
  });

  it("conflit si le serveur a été modifié après le dernier état connu du client", () => {
    expect(detectConflict("2026-01-01T00:00:00.000Z", "2026-01-02T00:00:00.000Z")).toBe(true);
  });
});
