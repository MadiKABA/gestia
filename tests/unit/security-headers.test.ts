import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";

/**
 * Régression : les headers de sécurité (audit sécurité, cf. next.config.ts)
 * ne doivent jamais redevenir plus restrictifs que les fonctionnalités qui
 * en dépendent — caméra pour le scan de code-barres (barcode-scanner-modal.tsx).
 */
async function getDocumentHeaders() {
  if (!nextConfig.headers) throw new Error("next.config.ts n'expose plus headers()");
  const [documentHeaders] = await nextConfig.headers();
  return documentHeaders;
}

describe("security headers", () => {
  it("autorise la caméra pour l'origine elle-même (scan de code-barres)", async () => {
    const documentHeaders = await getDocumentHeaders();
    const permissionsPolicy = documentHeaders.headers.find(
      (header) => header.key === "Permissions-Policy",
    );

    expect(permissionsPolicy?.value).toContain("camera=(self)");
  });
});
