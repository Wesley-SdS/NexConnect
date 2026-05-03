import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import type { $Enums, Prisma } from '@prisma/client';
import { PrismaService } from '@nexconnect/database';
import { UlidUtil } from '@nexconnect/shared';
import {
  OutboundMessage,
  ProviderType,
  SendMessageDto,
} from '@nexconnect/core';
import { InstancesService } from '../instances/instances.service';
import { ProviderCredentialService } from '../providers/provider-credential.service';
import { ProviderDispatcherService } from '../providers/provider-dispatcher.service';
import { ProviderRegistry } from '../providers/provider-registry.service';

interface FindAllOptions {
  page: number;
  limit: number;
  direction?: string;
  status?: string;
}

type ResolvedProvider =
  | { kind: 'baileys'; provider: ProviderType }
  | { kind: 'external'; provider: ProviderType; credentialId: string };

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly instancesService: InstancesService,
    private readonly credentials: ProviderCredentialService,
    private readonly dispatcher: ProviderDispatcherService,
    private readonly registry: ProviderRegistry,
    @InjectQueue('outbound-messages')
    private readonly outboundQueue: Queue,
  ) {}

  async send(tenantId: string, instanceId: string, dto: SendMessageDto) {
    const instance = await this.instancesService.findOne(tenantId, instanceId);

    const resolved = await this.resolveProvider(
      tenantId,
      instanceId,
      dto,
      instance.connectionType as $Enums.ConnectionType,
    );

    const messageId = UlidUtil.generate();

    const message = await this.prisma.message.create({
      data: {
        id: messageId,
        instanceId,
        tenantId,
        type: dto.type as unknown as $Enums.MessageType,
        content: dto.content as Prisma.InputJsonValue,
        toAddress: dto.to,
        provider: resolved.provider as unknown as $Enums.ProviderType,
        direction: 'OUTBOUND',
        status: 'PENDING',
      },
    });

    if (resolved.kind === 'baileys') {
      await this.outboundQueue.add(
        'send',
        {
          messageId,
          instanceId,
          tenantId,
          to: dto.to,
          type: dto.type,
          content: dto.content,
        },
        { jobId: messageId },
      );
      this.logger.log(
        { messageId, instanceId, tenantId, type: dto.type },
        'messages.baileys.queued',
      );
      return { messageId: message.id, status: 'queued' };
    }

    // External provider (Meta, Twilio): dispatch synchronously.
    // Provider SDKs are stateless HTTP clients — Fastify handles the async
    // I/O; no need to pay the extra hop through a worker queue.
    const outbound = this.toOutboundMessage(dto);
    const result = await this.dispatcher.dispatch({
      tenantId,
      instanceId,
      credentialId: resolved.credentialId,
      provider: resolved.provider,
      message: outbound,
      messageId,
    });

    if (!result.ok) {
      this.logger.warn(
        {
          messageId,
          provider: result.provider,
          code: result.code,
          retryable: result.retryable,
        },
        'messages.provider.failed',
      );
      if (!result.retryable) {
        throw new BadRequestException({
          code: result.code,
          message: result.message,
          provider: result.provider,
        });
      }
    }

    return {
      messageId: message.id,
      status: result.ok ? 'sent' : 'failed',
      externalId: result.ok ? result.externalMessageId : undefined,
      provider: result.provider,
    };
  }

  async findAll(
    tenantId: string,
    instanceId: string,
    options: FindAllOptions,
  ) {
    await this.instancesService.findOne(tenantId, instanceId);

    const where: Prisma.MessageWhereInput = { instanceId };

    if (options.direction) {
      where.direction = options.direction as $Enums.MessageDirection;
    }

    if (options.status) {
      where.status = options.status as $Enums.MessageStatus;
    }

    const take = Math.min(options.limit, 100);
    const skip = (options.page - 1) * take;

    const [messages, total] = await Promise.all([
      this.prisma.message.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      this.prisma.message.count({ where }),
    ]);

    return {
      messages,
      pagination: {
        page: options.page,
        limit: take,
        total,
        totalPages: Math.ceil(total / take),
      },
    };
  }

  async findOne(tenantId: string, instanceId: string, msgId: string) {
    await this.instancesService.findOne(tenantId, instanceId);

    const message = await this.prisma.message.findFirst({
      where: { id: msgId, instanceId },
    });

    if (!message) {
      throw new NotFoundException(`Message ${msgId} not found`);
    }

    return message;
  }

  async markAsRead(
    tenantId: string,
    instanceId: string,
    msgId: string,
  ): Promise<{ ok: true; provider: ProviderType }> {
    const { provider, credentialId, externalId } = await this.resolveExistingMessage(
      tenantId,
      instanceId,
      msgId,
    );
    const impl = this.registry.resolve(provider);
    if (!impl.markAsRead) {
      throw new UnprocessableEntityException(
        `Provider ${provider} does not support MARK_READ`,
      );
    }
    await impl.markAsRead({ tenantId, instanceId, credentialId }, externalId);
    return { ok: true, provider };
  }

  async addReaction(
    tenantId: string,
    instanceId: string,
    msgId: string,
    emoji: string,
  ): Promise<{ ok: true; provider: ProviderType }> {
    if (!emoji) {
      throw new BadRequestException('emoji is required');
    }
    const { provider, credentialId, externalId } = await this.resolveExistingMessage(
      tenantId,
      instanceId,
      msgId,
    );
    const impl = this.registry.resolve(provider);
    if (!impl.addReaction) {
      throw new UnprocessableEntityException(
        `Provider ${provider} does not support reactions`,
      );
    }
    await impl.addReaction({ tenantId, instanceId, credentialId }, externalId, emoji);
    return { ok: true, provider };
  }

  /**
   * Looks up the persisted message + its provider mapping. Used by
   * read receipt and reaction endpoints so they can target the
   * correct external provider message id.
   */
  private async resolveExistingMessage(
    tenantId: string,
    instanceId: string,
    msgId: string,
  ): Promise<{ provider: ProviderType; credentialId: string; externalId: string }> {
    const message = await this.findOne(tenantId, instanceId, msgId);
    const externalId = message.externalId ?? message.waMessageId;
    if (!externalId) {
      throw new BadRequestException(
        `Message ${msgId} has no externalId — cannot reach the provider for reactions/read.`,
      );
    }

    const credential = await this.prisma.providerCredential.findFirst({
      where: {
        tenantId,
        instanceId,
        provider: message.provider,
        status: 'ACTIVE',
      },
    });
    if (!credential) {
      throw new UnprocessableEntityException(
        `No active ${message.provider} credential bound to instance ${instanceId}`,
      );
    }
    return {
      provider: message.provider as unknown as ProviderType,
      credentialId: credential.id,
      externalId,
    };
  }

  private async resolveProvider(
    tenantId: string,
    instanceId: string,
    dto: SendMessageDto,
    connectionType: $Enums.ConnectionType,
  ): Promise<ResolvedProvider> {
    // Explicit credential takes priority.
    if (dto.credentialId) {
      const credential = await this.credentials.findById(tenantId, dto.credentialId);
      if (credential.status !== 'ACTIVE') {
        throw new UnprocessableEntityException(
          `Credential ${dto.credentialId} is not active (status=${credential.status})`,
        );
      }
      return {
        kind: 'external',
        provider: credential.provider as ProviderType,
        credentialId: credential.id,
      };
    }

    // Baileys-backed instance types stay on the worker queue.
    if (connectionType === 'QR_CODE' || connectionType === 'PAIRING_CODE') {
      return { kind: 'baileys', provider: ProviderType.BAILEYS };
    }

    // External provider: look up the instance's active credential. If a
    // provider hint is supplied, narrow the search.
    const list = await this.credentials.list(tenantId, {
      instanceId,
      provider: dto.provider,
    });
    const active = list.find((c) => c.status === 'ACTIVE');
    if (!active) {
      throw new UnprocessableEntityException(
        `Instance ${instanceId} has no active provider credential. Register one via POST /v1/providers/credentials first.`,
      );
    }
    return {
      kind: 'external',
      provider: active.provider as ProviderType,
      credentialId: active.id,
    };
  }

  private toOutboundMessage(dto: SendMessageDto): OutboundMessage {
    const base: Record<string, unknown> = {
      type: dto.type,
      to: dto.to,
      metadata: dto.metadata,
    };
    if (dto.quotedId) base.context = { messageId: dto.quotedId };
    // Merge the DTO content (text, media, interactive, etc.) into the
    // normalized shape consumed by IMessagingProvider implementations.
    return { ...base, ...dto.content } as unknown as OutboundMessage;
  }
}
