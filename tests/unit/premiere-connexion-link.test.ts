import { describe, expect, it } from "vitest";
import { buildPremiereConnexionLink } from "@/domain/auth/premiere-connexion-link";

describe("buildPremiereConnexionLink", () => {
  it("construit l'URL vers /premiere-connexion avec le téléphone en query", () => {
    expect(buildPremiereConnexionLink("http://localhost:3000", "+221771234567")).toBe(
      "http://localhost:3000/premiere-connexion?phone=%2B221771234567",
    );
  });

  it("encode le '+' du téléphone pour rester une query string valide", () => {
    const link = buildPremiereConnexionLink("https://app.gestia.sn", "+33612345678");
    expect(link).toBe("https://app.gestia.sn/premiere-connexion?phone=%2B33612345678");
    expect(link).not.toContain("+3361");
  });
});
