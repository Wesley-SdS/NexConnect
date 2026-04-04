import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@nexconnect/database';
import { RedisService } from '@nexconnect/redis';
import { UlidUtil } from '@nexconnect/shared';

interface CreateSandboxInstanceDto {
  name: string;
  settings?: Record<string, any>;
}

interface SimulateInboundDto {
  sessionId: string;
  from: string;
  type: string;
  content: Record<string, any>;
}

interface SimulateWebhookDto {
  sessionId: string;
  event: string;
  data?: Record<string, any>;
}

const SANDBOX_MAX_MSGS_PER_DAY = 100;
const SANDBOX_TTL_HOURS = 24;

@Injectable()
export class SandboxService {
  private readonly logger = new Logger(SandboxService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async createInstance(tenantId: string, dto: CreateSandboxInstanceDto) {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + SANDBOX_TTL_HOURS);

    const session = await this.prisma.sandboxSession.create({
      data: {
        tenantId,
        name: dto.name,
        status: 'active',
        settings: dto.settings ?? {},
        expiresAt,
      },
    });

    await this.redis.set(
      `sandbox:${session.id}:msgs`,
      '0',
      SANDBOX_TTL_HOURS * 3600,
    );

    this.logger.log(
      { sessionId: session.id, tenantId },
      'Sandbox session created',
    );

    return {
      sessionId: session.id,
      name: session.name,
      status: session.status,
      expiresAt: session.expiresAt,
      quotaRemaining: SANDBOX_MAX_MSGS_PER_DAY,
    };
  }

  async simulateInbound(tenantId: string, dto: SimulateInboundDto) {
    const session = await this.getActiveSession(dto.sessionId, tenantId);

    await this.checkSandboxQuota(session.id);

    const messageId = UlidUtil.generate();
    const now = new Date();

    const payload = {
      messageId,
      sessionId: session.id,
      from: dto.from,
      to: `sandbox-${session.id}@s.whatsapp.net`,
      type: dto.type,
      content: dto.content,
      direction: 'inbound',
      timestamp: now.toISOString(),
      sandbox: true,
    };

    await this.redis.incr(`sandbox:${session.id}:msgs`);

    this.logger.log(
      { messageId, sessionId: session.id, from: dto.from },
      'Sandbox inbound message simulated',
    );

    return {
      messageId,
      timestamp: now.toISOString(),
      payload,
    };
  }

  async simulateWebhook(tenantId: string, dto: SimulateWebhookDto) {
    const session = await this.getActiveSession(dto.sessionId, tenantId);

    const eventId = UlidUtil.generate();
    const now = new Date();

    const payload = {
      event: dto.event,
      timestamp: now.toISOString(),
      data: {
        ...dto.data,
        sessionId: session.id,
        sandbox: true,
        eventId,
      },
    };

    this.logger.log(
      { eventId, sessionId: session.id, event: dto.event },
      'Sandbox webhook simulated',
    );

    return {
      eventId,
      event: dto.event,
      timestamp: now.toISOString(),
      payload,
      delivered: true,
    };
  }

  async listSessions(tenantId: string) {
    const sessions = await this.prisma.sandboxSession.findMany({
      where: {
        tenantId,
        status: 'active',
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    const sessionsWithQuota = await Promise.all(
      sessions.map(async (session) => {
        const usedRaw = await this.redis.get(`sandbox:${session.id}:msgs`);
        const used = parseInt(usedRaw ?? '0', 10);

        return {
          sessionId: session.id,
          name: session.name,
          status: session.status,
          createdAt: session.createdAt,
          expiresAt: session.expiresAt,
          quotaUsed: used,
          quotaRemaining: Math.max(0, SANDBOX_MAX_MSGS_PER_DAY - used),
        };
      }),
    );

    return { sessions: sessionsWithQuota };
  }

  async deleteSession(tenantId: string, sessionId: string) {
    const session = await this.getActiveSession(sessionId, tenantId);

    await this.prisma.sandboxSession.update({
      where: { id: session.id },
      data: { status: 'closed' },
    });

    await this.redis.del(`sandbox:${session.id}:msgs`);

    this.logger.log({ sessionId: session.id }, 'Sandbox session closed');

    return { message: 'Sandbox session closed' };
  }

  private async getActiveSession(sessionId: string, tenantId: string) {
    const session = await this.prisma.sandboxSession.findFirst({
      where: { id: sessionId, tenantId },
    });

    if (!session) {
      throw new NotFoundException(`Sandbox session ${sessionId} not found`);
    }

    if (session.status !== 'active') {
      throw new BadRequestException(
        `Sandbox session ${sessionId} is ${session.status}`,
      );
    }

    if (session.expiresAt < new Date()) {
      await this.prisma.sandboxSession.update({
        where: { id: session.id },
        data: { status: 'expired' },
      });
      throw new BadRequestException(
        `Sandbox session ${sessionId} has expired`,
      );
    }

    return session;
  }

  private async checkSandboxQuota(sessionId: string): Promise<void> {
    const usedRaw = await this.redis.get(`sandbox:${sessionId}:msgs`);
    const used = parseInt(usedRaw ?? '0', 10);

    if (used >= SANDBOX_MAX_MSGS_PER_DAY) {
      throw new BadRequestException(
        `Sandbox quota exceeded: ${used}/${SANDBOX_MAX_MSGS_PER_DAY} messages per day`,
      );
    }
  }
}
