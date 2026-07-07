import type { NextConfig } from "next";
import { withSerwist } from "@serwist/turbopack";

const nextConfig: NextConfig = {
  images: {
    // Logo boutique uploadé sur Cloudinary (TenantSettings.logoUrl, cahier
    // des charges §theming) — next/image refuse toute source externe non
    // listée ici.
    remotePatterns: [{ protocol: "https", hostname: "res.cloudinary.com" }],
  },
  // Headers de réponse uniquement — ne touche pas au routage/aux redirections
  // (ça reste le rôle de src/proxy.ts, dont le matcher n'est pas concerné ici).
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains",
          },
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
