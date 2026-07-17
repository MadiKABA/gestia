import type { TenantRepository } from "@/application/tenant/tenant.repository";
import {
  DEFAULT_BUSINESS_TYPE,
  isBusinessTypeCode,
  type BusinessTypeCode,
} from "@/domain/tenant/business-type";
import { TenantScopedRepository } from "@/infrastructure/prisma/tenant-scoped-repository";

export class PrismaTenantRepository extends TenantScopedRepository implements TenantRepository {
  async findBusinessType(): Promise<BusinessTypeCode> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: this.tenantId },
      select: { businessType: true },
    });
    return tenant && isBusinessTypeCode(tenant.businessType)
      ? tenant.businessType
      : DEFAULT_BUSINESS_TYPE;
  }

  async updateBusinessType(businessType: BusinessTypeCode): Promise<BusinessTypeCode> {
    const tenant = await this.prisma.tenant.update({
      where: { id: this.tenantId },
      data: { businessType },
      select: { businessType: true },
    });
    return isBusinessTypeCode(tenant.businessType) ? tenant.businessType : DEFAULT_BUSINESS_TYPE;
  }
}
