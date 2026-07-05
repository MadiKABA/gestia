import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { env } from "@/lib/env";

/**
 * Client Prisma singleton (adapter driver `pg`, requis par Prisma 7).
 * SEUL fichier autorisé à instancier PrismaClient — voir tenant-scoped-repository.ts
 * pour la base que tous les repositories doivent étendre.
 */
declare global {
  var __prisma: PrismaClient | undefined;
}

function createPrismaClient() {
  const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

export const prisma = globalThis.__prisma ?? createPrismaClient();

if (env.NODE_ENV !== "production") {
  globalThis.__prisma = prisma;
}
