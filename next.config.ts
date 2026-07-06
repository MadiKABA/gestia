import type { NextConfig } from "next";
import { withSerwist } from "@serwist/turbopack";

const nextConfig: NextConfig = {
  images: {
    // Logo boutique uploadé sur Cloudinary (TenantSettings.logoUrl, cahier
    // des charges §theming) — next/image refuse toute source externe non
    // listée ici.
    remotePatterns: [{ protocol: "https", hostname: "res.cloudinary.com" }],
  },
};

export default withSerwist(nextConfig);
