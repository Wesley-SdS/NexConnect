import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@nexconnect/database';
import { UlidUtil } from '@nexconnect/shared';
import { CreateTenantDto, UpdateTenantDto } from '@nexconnect/core';

@Injectable()
export class TenantsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateTenantDto) {
    return this.prisma.tenant.create({
      data: {
        id: UlidUtil.generate(),
        ...dto,
      },
    });
  }

  async findAll() {
    return this.prisma.tenant.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });

    if (!tenant) {
      throw new NotFoundException(`Tenant ${id} not found`);
    }

    return tenant;
  }

  async update(id: string, dto: UpdateTenantDto) {
    await this.findOne(id);

    return this.prisma.tenant.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.tenant.delete({
      where: { id },
    });
  }

  async exportData(id: string) {
    const tenant = await this.findOne(id);

    const [instances, apiKeys, messages] = await Promise.all([
      this.prisma.instance.findMany({ where: { tenantId: id } }),
      this.prisma.apiKey.findMany({
        where: { tenantId: id },
        select: { id: true, name: true, prefix: true, createdAt: true },
      }),
      this.prisma.message.findMany({
        where: { instance: { tenantId: id } },
        take: 10000,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      tenant,
      instances,
      apiKeys,
      messages,
      exportedAt: new Date().toISOString(),
    };
  }

  async deletePersonalData(id: string) {
    await this.findOne(id);

    await this.prisma.$transaction([
      this.prisma.message.deleteMany({
        where: { instance: { tenantId: id } },
      }),
      this.prisma.webhook.deleteMany({
        where: { tenantId: id },
      }),
      this.prisma.instance.deleteMany({ where: { tenantId: id } }),
      this.prisma.apiKey.deleteMany({ where: { tenantId: id } }),
      this.prisma.tenant.delete({ where: { id } }),
    ]);

    return { message: 'All personal data has been permanently deleted' };
  }
}
