import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@nexconnect/database';
import { UlidUtil } from '../utils/ulid.util';

export interface AuditLogParams {
  tenantId: string;
  actorId?: string;
  action: string;
  resourceType: string;
  resourceId: string;
  ip?: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(params: AuditLogParams): Promise<void> {
    const id = UlidUtil.generate();

    await this.prisma.auditLog.create({
      data: {
        id,
        tenantId: params.tenantId,
        actorId: params.actorId ?? null,
        action: params.action,
        resourceType: params.resourceType,
        resourceId: params.resourceId,
        ip: params.ip ?? null,
        metadata: params.metadata ?? undefined,
      },
    });

    this.logger.log({
      msg: 'Audit log created',
      auditLogId: id,
      action: params.action,
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      tenantId: params.tenantId,
    });
  }

  async findByTenant(
    tenantId: string,
    filters: {
      action?: string;
      resourceType?: string;
      startDate?: Date;
      endDate?: Date;
      page?: number;
      pageSize?: number;
    },
  ) {
    const page = filters.page ?? 1;
    const pageSize = Math.min(filters.pageSize ?? 20, 100);
    const skip = (page - 1) * pageSize;

    const where: any = { tenantId };

    if (filters.action) {
      where.action = filters.action;
    }

    if (filters.resourceType) {
      where.resourceType = filters.resourceType;
    }

    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) {
        where.createdAt.gte = filters.startDate;
      }
      if (filters.endDate) {
        where.createdAt.lte = filters.endDate;
      }
    }

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      data,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }
}
