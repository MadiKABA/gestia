import type { NextConfig } from "next";
import { withSerwist } from "@serwist/turbopack";

const nextConfig: NextConfig = {
  // Image Docker de prod minimale : ne copie que ce dont le serveur a besoin
  // (voir docker/Dockerfile).
  output: "standalone",
};

export default withSerwist(nextConfig);
