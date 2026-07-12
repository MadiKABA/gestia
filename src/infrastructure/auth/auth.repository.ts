import type { AuthRepository, AuthUser, OtpCode } from "@/application/auth/auth.repository";
import type { OtpChannel, OtpPurpose } from "@/domain/auth/otp";
import { prisma } from "@/infrastructure/prisma/client";

/**
 * Pas de TenantScopedRepository ici : l'authentification (login, inscription,
 * reset PIN) s'exécute avant qu'un tenantId courant n'existe — l'utilisateur
 * est retrouvé par téléphone ou email (uniques globalement), et l'inscription
 * crée le tenant lui-même.
 */
export class PrismaAuthRepository implements AuthRepository {
  async findUserByPhone(phone: string): Promise<AuthUser | null> {
    return prisma.user.findUnique({ where: { phone } });
  }

  async findUserByEmail(email: string): Promise<AuthUser | null> {
    return prisma.user.findUnique({ where: { email } });
  }

  async findUserById(id: string): Promise<AuthUser | null> {
    return prisma.user.findUnique({ where: { id } });
  }

  async createTenantWithPatron(input: {
    tenantName: string;
    patronName: string;
    phone: string;
    pinHash: string;
    email?: string;
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
            email: input.email,
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

  async incrementFailedAttempts(
    userId: string,
  ): Promise<{ failedAttempts: number; lockedUntil: Date | null }> {
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { failedAttempts: { increment: 1 } },
    });
    return { failedAttempts: updated.failedAttempts, lockedUntil: updated.lockedUntil };
  }

  async lockAccount(userId: string, lockedUntil: Date): Promise<void> {
    await prisma.user.update({ where: { id: userId }, data: { lockedUntil } });
  }

  async clearLockout(userId: string): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: { failedAttempts: 0, lockedUntil: null },
    });
  }

  async updateName(userId: string, name: string): Promise<void> {
    await prisma.user.update({ where: { id: userId }, data: { name } });
  }

  async setActive(userId: string, active: boolean): Promise<void> {
    await prisma.user.update({ where: { id: userId }, data: { active } });
  }

  async recordFirstLoginIfUnset(userId: string): Promise<void> {
    await prisma.user.updateMany({
      where: { id: userId, firstLoginAt: null },
      data: { firstLoginAt: new Date() },
    });
  }

  async listVendeursByTenant(tenantId: string): Promise<AuthUser[]> {
    return prisma.user.findMany({
      where: { tenantId, role: "VENDEUR" },
      orderBy: { createdAt: "desc" },
    });
  }

  async createOtp(input: {
    identifier: string;
    channel: OtpChannel;
    codeHash: string;
    purpose: OtpPurpose;
    expiresAt: Date;
  }): Promise<void> {
    await prisma.otpCode.create({ data: input });
  }

  async findActiveOtp(identifier: string, purpose: OtpPurpose): Promise<OtpCode | null> {
    return prisma.otpCode.findFirst({
      where: { identifier, purpose, consumedAt: null },
      orderBy: { createdAt: "desc" },
    });
  }

  async consumeOtp(id: string): Promise<void> {
    await prisma.otpCode.update({ where: { id }, data: { consumedAt: new Date() } });
  }

  async findRecentOtpRequestTimestamps(
    identifier: string,
    purpose: OtpPurpose,
    since: Date,
  ): Promise<Date[]> {
    const rows = await prisma.otpCode.findMany({
      where: { identifier, purpose, createdAt: { gte: since } },
      select: { createdAt: true },
    });
    return rows.map((row) => row.createdAt);
  }
}
