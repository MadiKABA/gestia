import type { NextConfig } from "next";
import { withSerwist } from "@serwist/turbopack";

const nextConfig: NextConfig = {
  images: {
    // Logo boutique uploadé sur Cloudinary (TenantSettings.logoUrl, cahier
    // des charges §theming) — next/image refuse toute source externe non
    // listée ici.
    remotePatterns: [{ protocol: "https", hostname: "res.cloudinary.com" }],
  },
  experimental: {
    // Défaut Next.js (1 Mo) trop bas pour un upload de logo (validation
    // domain plafonnée à 2 Mo, voir logo-file.ts) — sans ce relèvement,
    // l'upload échoue avant même d'atteindre notre code de validation.
    serverActions: { bodySizeLimit: "3mb" },
  },
  // Headers de réponse uniquement — ne touche pas au routage/aux redirections
  // (ça reste le rôle de src/proxy.ts, dont le matcher n'est pas concerné ici).
  async headers() {
    // `img-src` autorise Cloudinary (logo boutique et photo produit, voir
    // remotePatterns ci-dessus) et `blob:` (aperçu local immédiat via
    // `URL.createObjectURL` avant upload — product-photo-input.tsx,
    // logo-input côté paramètres — jamais un appel réseau, uniquement une
    // référence en mémoire au fichier sélectionné) ; `connect-src` reste à
    // 'self' (aucun fetch externe dans l'app, vérifié). `script-src`/
    // `style-src` gardent 'unsafe-inline' : vérifié à la main (Playwright +
    // build de prod) que Next.js émet des scripts inline non noncés
    // (payload d'hydratation RSC) sur `/register` — les bloquer casse le
    // rendu. Un passage à des nonces par requête (proxy.ts + layout)
    // supprimerait ce besoin mais reste un chantier séparé, plus large que
    // l'ajout de ces headers. `wasm-unsafe-eval` : Chrome (Android inclus)
    // bloque toute compilation WebAssembly sans cette directive, y compris
    // via `instantiateStreaming` — nécessaire au décodeur ZXing-WASM du
    // scan de code-barres (barcode-scanner-modal.tsx), sans quoi chaque
    // `detect()` échoue silencieusement (promesse rejetée, avalée par le
    // `.catch` de retry frame-par-frame) et rien n'est jamais détecté.
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://res.cloudinary.com",
      "font-src 'self' data:",
      "connect-src 'self'",
      "worker-src 'self'",
      "manifest-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; ");

    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            // `camera=(self)` : scan de code-barres caméra (barcode-scanner-modal.tsx,
            // cahier des charges §Scope V1) — un `camera=()` bloque totalement
            // `getUserMedia`, y compris pour l'origine elle-même, indépendamment
            // de la permission navigateur accordée par l'utilisateur.
            value: "camera=(self), microphone=(), geolocation=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains",
          },
          { key: "Content-Security-Policy", value: csp },
        ],
      },
      {
        // Type MIME correct pour un web app manifest (défaut Next.js sur les
        // fichiers .json servis depuis public/ : application/json).
        source: "/manifest.json",
        headers: [{ key: "Content-Type", value: "application/manifest+json" }],
      },
    ];
  },
};

export default withSerwist(nextConfig);
