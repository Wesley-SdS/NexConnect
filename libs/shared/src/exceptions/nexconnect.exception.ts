import { HttpException, HttpStatus } from '@nestjs/common';

export class NexConnectException extends HttpException {
  constructor(
    message: string,
    statusCode: HttpStatus = HttpStatus.INTERNAL_SERVER_ERROR,
    public readonly errorCode?: string,
  ) {
    super(
      {
        statusCode,
        error: errorCode || 'NEXCONNECT_ERROR',
        message,
      },
      statusCode,
    );
  }
}

export class InstanceNotFoundException extends NexConnectException {
  constructor(instanceId: string) {
    super(
      `Instance ${instanceId} not found`,
      HttpStatus.NOT_FOUND,
      'INSTANCE_NOT_FOUND',
    );
  }
}

export class InstanceOfflineException extends NexConnectException {
  constructor(instanceId: string) {
    super(
      `Instance ${instanceId} is not connected`,
      HttpStatus.CONFLICT,
      'INSTANCE_OFFLINE',
    );
  }
}

export class RateLimitExceededException extends NexConnectException {
  constructor(message = 'Rate limit exceeded') {
    super(message, HttpStatus.TOO_MANY_REQUESTS, 'RATE_LIMIT_EXCEEDED');
  }
}

export class InvalidPhoneNumberException extends NexConnectException {
  constructor(phone: string) {
    super(
      `Invalid phone number: ${phone}`,
      HttpStatus.BAD_REQUEST,
      'INVALID_PHONE_NUMBER',
    );
  }
}

export class MediaProcessingException extends NexConnectException {
  constructor(reason: string) {
    super(
      `Media processing failed: ${reason}`,
      HttpStatus.UNPROCESSABLE_ENTITY,
      'MEDIA_PROCESSING_ERROR',
    );
  }
}

export class WebhookDeliveryException extends NexConnectException {
  constructor(webhookId: string, reason: string) {
    super(
      `Webhook delivery failed for ${webhookId}: ${reason}`,
      HttpStatus.BAD_GATEWAY,
      'WEBHOOK_DELIVERY_ERROR',
    );
  }
}
