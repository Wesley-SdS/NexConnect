import { Injectable, Logger } from '@nestjs/common';
import {
  OutboundMessage,
  ProviderContext,
  ProviderSendResult,
  ProviderType,
} from '@nexconnect/core';
import { PrismaService } from '@nexconnect/database';
import { $Enums, Prisma } from '@prisma/client';
import { ProviderCredentialService } from './provider-credential.service';
import { ProviderRegistry } from './provider-registry.service';

export interface DispatchRequest {
  tenantId: string;
  instanceId: string;
  credentialId?: string;
  provider?: ProviderType;
  message: OutboundMessage;
  messageId: string;
  correlationId?: string;
}

/**
 * Unified entry point for sending an OutboundMessage through whichever
 * provider owns the instance. Handles credential resolution, registry
 * lookup, persisted-status updates, and external-id mapping so the
 * calling code never touches provider specifics.
 */
@Injectable()
export class ProviderDispatcherService {
  private readonly logger = new Logger(ProviderDispatcherService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: ProviderRegistry,
    private readonly credentials: ProviderCredentialService,
  ) {}

  async dispatch(request: DispatchRequest): Promise<ProviderSendResult> {
    const credential = await this.resolveCredential(request);
    const provider = this.registry.resolve(credential.provider);

    const context: ProviderContext = {
      tenantId: request.tenantId,
      instanceId: request.instanceId,
      credentialId: credential.credentialId,
      correlationId: request.correlationId,
    };

    await this.markProcessing(request.messageId);

    const result = await provider.send(context, request.message);

    if (result.ok) {
      await this.persistSuccess(request, result);
      this.logger.log(
        {
          messageId: request.messageId,
          externalId: result.externalMessageId,
          provider: result.provider,
          tenantId: request.tenantId,
        },
        'provider.dispatch.ok',
      );
    } else {
      await this.persistFailure(request, result);
      this.logger.warn(
        {
          messageId: request.messageId,
          provider: result.provider,
          code: result.code,
          retryable: result.retryable,
          tenantId: request.tenantId,
        },
        'provider.dispatch.failed',
      );
    }

    return result;
  }

  private async resolveCredential(request: DispatchRequest): Promise<{
    credentialId: string;
    provider: ProviderType;
  }> {
    if (request.credentialId) {
      const cred = await this.prisma.providerCredential.findUnique({
        where: { id: request.credentialId },
        select: { id: true, provider: true, status: true },
      });
      if (!cred || cred.status !== 'ACTIVE') {
        throw new Error(`Credential ${request.credentialId} is not active`);
      }
      return { credentialId: cred.id, provider: cred.provider as ProviderType };
    }

    const byInstance = await this.prisma.providerCredential.findFirst({
      where: {
        tenantId: request.tenantId,
        instanceId: request.instanceId,
        status: 'ACTIVE',
        provider: request.provider,
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!byInstance) {
      throw new Error(
        `No active provider credential for instance ${request.instanceId}` +
          (request.provider ? ` with provider ${request.provider}` : ''),
      );
    }
    return { credentialId: byInstance.id, provider: byInstance.provider as ProviderType };
  }

  private async markProcessing(messageId: string): Promise<void> {
    await this.prisma.message
      .update({ where: { id: messageId }, data: { status: 'PROCESSING' } })
      .catch(() => {});
  }

  private async persistSuccess(
    request: DispatchRequest,
    result: Extract<ProviderSendResult, { ok: true }>,
  ): Promise<void> {
    const providerEnum = result.provider as unknown as $Enums.ProviderType;
    await this.prisma.$transaction([
      this.prisma.message.update({
        where: { id: request.messageId },
        data: {
          status: 'SENT',
          provider: providerEnum,
          externalId: result.externalMessageId,
          waMessageId: result.externalMessageId,
          sentAt: result.acceptedAt,
          metadata: {
            provider_recipient_id: result.recipientId,
          } as Prisma.InputJsonValue,
        },
      }),
      this.prisma.externalMessageMapping.upsert({
        where: {
          provider_externalMessageId: {
            provider: providerEnum,
            externalMessageId: result.externalMessageId,
          },
        },
        create: {
          tenantId: request.tenantId,
          instanceId: request.instanceId,
          provider: providerEnum,
          externalMessageId: result.externalMessageId,
          internalMessageId: request.messageId,
        },
        update: { internalMessageId: request.messageId },
      }),
    ]);
  }

  private async persistFailure(
    request: DispatchRequest,
    result: Extract<ProviderSendResult, { ok: false }>,
  ): Promise<void> {
    await this.prisma.message
      .update({
        where: { id: request.messageId },
        data: {
          status: 'FAILED',
          provider: result.provider as unknown as $Enums.ProviderType,
          errorCode: result.code,
          errorReason: result.message,
          failedAt: new Date(),
        },
      })
      .catch(() => {});
  }
}
