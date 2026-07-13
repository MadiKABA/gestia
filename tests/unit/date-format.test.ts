import { describe, expect, it } from "vitest";
import { formatLongDateFr } from "@/presentation/shared/date-format";

describe("formatLongDateFr", () => {
  it("formate une date en toutes lettres, en français", () => {
    expect(formatLongDateFr(new Date("2026-07-12T10:00:00Z"))).toBe("12 juillet 2026");
  });

  it("n'affiche jamais un format ISO brut", () => {
    const result = formatLongDateFr(new Date("2026-01-05T00:00:00Z"));
    expect(result).not.toMatch(/^\d{4}-\d{2}-\d{2}/);
  });
});
