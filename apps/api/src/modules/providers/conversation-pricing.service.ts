import { Injectable, Logger } from '@nestjs/common';
import { ProviderType } from '@nexconnect/core';
import { PrismaService } from '@nexconnect/database';
import { $Enums, Prisma } from '@prisma/client';

export interface PricingRecord {
  tenantId: string;
  instanceId: string;
  provider: ProviderType;
  conversationId?: string;
  externalMessageId?: string;
  category?: string;
  pricingModel?: string;
  billable?: boolean;
  amount?: number;
  currency?: string;
  occurredAt: Date;
}

export interface UsageQuery {
  tenantId: string;
  from?: Date;
  to?: Date;
  provider?: ProviderType;
}

export interface UsageBreakdownEntry {
  provider: ProviderType;
  category: string | null;
  totalConversations: number;
  totalAmount: number;
  currency: string | null;
}

@Injectable()
export class ConversationPricingService {
  private readonly logger = new Logger(ConversationPricingService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(entry: PricingRecord): Promise<void> {
    try {
      await this.prisma.conversationPricing.create({
        data: {
          tenantId: entry.tenantId,
          instanceId: entry.instanceId,
          provider: entry.provider as unknown as $Enums.ProviderType,
          conversationId: entry.conversationId,
          externalMessageId: entry.externalMessageId,
          category: entry.category,
          pricingModel: entry.pricingModel,
          billable: entry.billable ?? true,
          amount: entry.amount !== undefined ? new Prisma.Decimal(entry.amount) : undefined,
          currency: entry.currency,
          occurredAt: entry.occurredAt,
        },
      });
    } catch (err) {
      this.logger.error(
        { err: (err as Error).message, conversationId: entry.conversationId },
        'pricing.record.failed',
      );
    }
  }

  async breakdown(query: UsageQuery): Promise<UsageBreakdownEntry[]> {
    const rows = await this.prisma.$queryRaw<
      Array<{ provider: string; category: string | null; total_conversations: bigint; total_amount: Prisma.Decimal | null; currency: string | null }>
    >`
      SELECT
        provider,
        category,
        COUNT(DISTINCT conversation_id) AS total_conversations,
        SUM(amount) AS total_amount,
        MIN(currency) AS currency
      FROM conversation_pricing
      WHERE tenant_id = ${query.tenantId}::uuid
        ${query.from ? Prisma.sql`AND occurred_at >= ${query.from}` : Prisma.empty}
        ${query.to ? Prisma.sql`AND occurred_at <= ${query.to}` : Prisma.empty}
        ${query.provider ? Prisma.sql`AND provider = ${query.provider as unknown as string}::"ProviderType"` : Prisma.empty}
      GROUP BY provider, category
      ORDER BY total_amount DESC NULLS LAST
    `;

    return rows.map((row) => ({
      provider: row.provider as ProviderType,
      category: row.category,
      totalConversations: Number(row.total_conversations),
      totalAmount: row.total_amount ? Number(row.total_amount) : 0,
      currency: row.currency,
    }));
  }
}
