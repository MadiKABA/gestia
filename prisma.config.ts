import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // `process.env` plutôt que le helper `env()` : ce fichier est chargé pour
    // TOUTE commande Prisma, y compris `generate` (appelé par `postinstall`
    // à chaque `pnpm install`), qui n'a besoin d'aucune connexion réelle à la
    // base. `env()` throw dès le chargement de la config si la variable est
    // absente — ce qui casse `generate` inutilement. Seules les commandes qui
    // se connectent réellement (`migrate deploy`, `db push`...) échoueront
    // si la variable manque encore à ce moment-là, ce qui est correct.
    url: process.env["DATABASE_URL"],
  },
});
