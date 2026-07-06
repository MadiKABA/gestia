import type {
  PartyRepository,
  PartySearchQuery,
  PartyWithBalance,
} from "@/application/party/party.repository";
import type { Party, PartyInput } from "@/domain/party/party.entity";
import { TenantScopedRepository } from "@/infrastructure/prisma/tenant-scoped-repository";

export class PrismaPartyRepository extends TenantScopedRepository implements PartyRepository {
  async findById(id: string): Promise<Party | null> {
    return this.prisma.party.findFirst({ where: this.scoped({ id, deletedAt: null }) });
  }

  async findMany(query: PartySearchQuery): Promise<PartyWithBalance[]> {
    const parties = await this.prisma.party.findMany({
      where: this.scoped({
        deletedAt: null,
        ...(query.type ? { type: query.type } : {}),
        ...(query.search
          ? {
              OR: [
                { name: { contains: query.search, mode: "insensitive" as const } },
                { phone: { contains: query.search } },
              ],
            }
          : {}),
      }),
      orderBy: { createdAt: "desc" },
    });

    // TODO: brancher le calcul réel une fois le module Transaction implémenté
    // (agrégation amount - paidAmount des Transaction liées à ce Party).
    return parties.map((party) => ({ ...party, balance: 0 }));
  }

  async create(input: PartyInput): Promise<Party> {
    return this.prisma.party.create({
      data: {
        tenantId: this.tenantId,
        name: input.name,
        phone: input.phone ?? null,
        whatsappNumber: input.whatsappNumber ?? null,
        type: input.type,
        isCompany: input.isCompany ?? false,
        companyName: input.companyName ?? null,
        contactName: input.contactName ?? null,
        note: input.note ?? null,
      },
    });
  }

  async update(id: string, input: PartyInput): Promise<Party> {
    return this.prisma.party.update({
      where: this.scoped({ id }),
      data: {
        name: input.name,
        phone: input.phone ?? null,
        whatsappNumber: input.whatsappNumber ?? null,
        type: input.type,
        isCompany: input.isCompany ?? false,
        companyName: input.companyName ?? null,
        contactName: input.contactName ?? null,
        note: input.note ?? null,
      },
    });
  }

  async delete(id: string): Promise<Party> {
    return this.prisma.party.update({
      where: this.scoped({ id }),
      data: { deletedAt: new Date() },
    });
  }
}
