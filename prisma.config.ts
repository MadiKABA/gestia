import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // `env()` (plutôt que process.env directement) fait échouer le chargement
    // de la config avec une erreur nommant explicitement DATABASE_URL si la
    // variable est absente, au lieu du message générique et peu actionnable
    // de la CLI ("datasource.url property is required...").
    url: env("DATABASE_URL"),
  },
});
