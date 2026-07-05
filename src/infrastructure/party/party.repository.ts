import type { PartyRepository, PartySearchQuery } from "@/application/party/party.repository";
import type { Party, PartyInput } from "@/domain/party/party.entity";
import { TenantScopedRepository } from "@/infrastructure/prisma/tenant-scoped-repository";

export class PrismaPartyRepository extends TenantScopedRepository implements PartyRepository {
  async findById(id: string): Promise<Party | null> {
    return this.prisma.party.findFirst({ where: this.scoped({ id }) });
  }

  async findMany(query: PartySearchQuery): Promise<Party[]> {
    return this.prisma.party.findMany({
      where: this.scoped(
        query.search
          ? {
              OR: [
                { name: { contains: query.search, mode: "insensitive" as const } },
                { phone: { contains: query.search } },
              ],
            }
          : {},
      ),
      orderBy: { createdAt: "desc" },
    });
  }

  async create(input: PartyInput): Promise<Party> {
    return this.prisma.party.create({
      data: {
        tenantId: this.tenantId,
        name: input.name,
        phone: input.phone ?? null,
        whatsappNumber: input.whatsappNumber ?? null,
        type: input.type,
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
        note: input.note ?? null,
      },
    });
  }
}
