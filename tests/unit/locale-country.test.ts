import { describe, expect, it } from "vitest";
import {
  DEFAULT_LOCALE_COUNTRY,
  resolveCountryFromAcceptLanguage,
} from "@/domain/shared/locale-country";

describe("resolveCountryFromAcceptLanguage", () => {
  it("détecte le Sénégal depuis un sous-tag région fr-SN", () => {
    expect(resolveCountryFromAcceptLanguage("fr-SN,fr;q=0.9")).toBe("SN");
  });

  it("détecte la Guinée depuis un sous-tag région fr-GN", () => {
    expect(resolveCountryFromAcceptLanguage("fr-GN,fr;q=0.9,en;q=0.8")).toBe("GN");
  });

  it("est insensible à la casse du sous-tag région", () => {
    expect(resolveCountryFromAcceptLanguage("fr-gn")).toBe("GN");
  });

  it("retombe sur le défaut (SN) quand aucun sous-tag région n'est présent", () => {
    expect(resolveCountryFromAcceptLanguage("fr")).toBe(DEFAULT_LOCALE_COUNTRY);
    expect(resolveCountryFromAcceptLanguage("fr;q=0.9,en;q=0.8")).toBe(DEFAULT_LOCALE_COUNTRY);
  });

  it("retombe sur le défaut (SN) quand la région n'est ni SN ni GN", () => {
    expect(resolveCountryFromAcceptLanguage("en-US,en;q=0.9")).toBe(DEFAULT_LOCALE_COUNTRY);
    expect(resolveCountryFromAcceptLanguage("fr-FR")).toBe(DEFAULT_LOCALE_COUNTRY);
  });

  it("retombe sur le défaut (SN) pour un header absent ou vide", () => {
    expect(resolveCountryFromAcceptLanguage(null)).toBe(DEFAULT_LOCALE_COUNTRY);
    expect(resolveCountryFromAcceptLanguage(undefined)).toBe(DEFAULT_LOCALE_COUNTRY);
    expect(resolveCountryFromAcceptLanguage("")).toBe(DEFAULT_LOCALE_COUNTRY);
  });

  it("choisit la première région supportée (SN/GN) parmi plusieurs langues", () => {
    expect(resolveCountryFromAcceptLanguage("en-US,fr-GN;q=0.8,fr;q=0.7")).toBe("GN");
  });
});
