import argon2 from "argon2";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const pinHash = await argon2.hash("1234");

  const tenant = await prisma.tenant.upsert({
    where: { id: "demo-tenant" },
    update: {},
    create: {
      id: "demo-tenant",
      name: "Boutique Démo",
      phone: "+221770000000",
      settings: {
        create: {
          currency: "FCFA",
          reminderDays: 7,
          displayName: "Boutique Démo",
        },
      },
      users: {
        create: {
          name: "Patron Démo",
          phone: "+221770000001",
          pinHash,
          role: "PATRON",
        },
      },
    },
  });

  console.log(`Tenant de démo créé : ${tenant.name} (PIN patron démo : 1234)`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
