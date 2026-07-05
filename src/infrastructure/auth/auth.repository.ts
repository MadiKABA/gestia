import type { AuthRepository, AuthUser, OtpCode } from "@/application/auth/auth.repository";
import type { OtpPurpose } from "@/domain/auth/otp";
import { prisma } from "@/infrastructure/prisma/client";

/**
 * Pas de TenantScopedRepository ici : l'authentification (login, inscription,
 * reset PIN) s'exécute avant qu'un tenantId courant n'existe — l'utilisateur
 * est retrouvé par téléphone (unique globalement), et l'inscription crée le
 * tenant lui-même.
 */
export class PrismaAuthRepository implements AuthRepository {
  async findUserByPhone(phone: string): Promise<AuthUser | null> {
    return prisma.user.findUnique({ where: { phone } });
  }

  async createTenantWithPatron(input: {
    tenantName: string;
    patronName: string;
    phone: string;
    pinHash: string;
  }): Promise<AuthUser> {
    const tenant = await prisma.tenant.create({
      data: {
        name: input.tenantName,
        settings: { create: {} },
        users: {
          create: {
            name: input.patronName,
            phone: input.phone,
            pinHash: input.pinHash,
            role: "PATRON",
          },
        },
      },
      include: { users: true },
    });

    return tenant.users[0];
  }

  async createVendeur(input: {
    tenantId: string;
    name: string;
    phone: string;
    placeholderPinHash: string;
  }): Promise<AuthUser> {
    return prisma.user.create({
      data: {
        tenantId: input.tenantId,
        name: input.name,
        phone: input.phone,
        pinHash: input.placeholderPinHash,
        role: "VENDEUR",
      },
    });
  }

  async updatePinHash(userId: string, pinHash: string): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: { pinHash, failedAttempts: 0, lockedUntil: null },
    });
  }

  async createOtp(input: {
    phone: string;
    codeHash: string;
    purpose: OtpPurpose;
    expiresAt: Date;
  }): Promise<void> {
    await prisma.otpCode.create({ data: input });
  }

  async findActiveOtp(phone: string, purpose: OtpPurpose): Promise<OtpCode | null> {
    return prisma.otpCode.findFirst({
      where: { phone, purpose, consumedAt: null },
      orderBy: { createdAt: "desc" },
    });
  }

  async consumeOtp(id: string): Promise<void> {
    await prisma.otpCode.update({ where: { id }, data: { consumedAt: new Date() } });
  }
}
