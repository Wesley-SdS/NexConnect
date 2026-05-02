export enum InstanceStatus {
  CREATED = 'CREATED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  DISCONNECTED = 'DISCONNECTED',
  BANNED = 'BANNED',
}

export enum ConnectionType {
  QR_CODE = 'QR_CODE',
  PAIRING_CODE = 'PAIRING_CODE',
  WABA = 'WABA',
}

export enum MessageDirection {
  INBOUND = 'INBOUND',
  OUTBOUND = 'OUTBOUND',
}

export enum MessageType {
  TEXT = 'TEXT',
  AUDIO = 'AUDIO',
  IMAGE = 'IMAGE',
  VIDEO = 'VIDEO',
  DOCUMENT = 'DOCUMENT',
  STICKER = 'STICKER',
  LOCATION = 'LOCATION',
  VCARD = 'VCARD',
  BUTTON_REPLY = 'BUTTON_REPLY',
  LIST_REPLY = 'LIST_REPLY',
  REACTION = 'REACTION',
  POLL = 'POLL',
  STATUS_REPLY = 'STATUS_REPLY',
  CALL_MISSED = 'CALL_MISSED',
  TEMPLATE = 'TEMPLATE',
  UNKNOWN = 'UNKNOWN',
}

export enum MessageStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  SENT = 'SENT',
  DELIVERED = 'DELIVERED',
  READ = 'READ',
  FAILED = 'FAILED',
}

export enum WebhookDeliveryStatus {
  PENDING = 'PENDING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  DEAD_LETTER = 'DEAD_LETTER',
}

export enum MediaType {
  IMAGE = 'IMAGE',
  AUDIO = 'AUDIO',
  VIDEO = 'VIDEO',
  DOCUMENT = 'DOCUMENT',
  STICKER = 'STICKER',
}

export enum ScheduledMessageStatus {
  SCHEDULED = 'SCHEDULED',
  SENDING = 'SENDING',
  SENT = 'SENT',
  FAILED = 'FAILED',
  CANCELED = 'CANCELED',
}

export enum TenantPlan {
  FREE = 'FREE',
  STARTER = 'STARTER',
  PRO = 'PRO',
  ENTERPRISE = 'ENTERPRISE',
}

export enum WebhookEvent {
  // Instance events
  INSTANCE_CONNECTED = 'instance.connected',
  INSTANCE_DISCONNECTED = 'instance.disconnected',
  INSTANCE_QRCODE = 'instance.qrcode',
  INSTANCE_MENTIONED = 'instance.mentioned',

  // Message events
  MESSAGE_RECEIVED = 'message.received',
  MESSAGE_SENT = 'message.sent',
  MESSAGE_DELIVERED = 'message.delivered',
  MESSAGE_READ = 'message.read',
  MESSAGE_DELETED = 'message.deleted',
  MESSAGE_REACTION = 'message.reaction',
  MESSAGE_PINNED = 'message.pinned',
  MESSAGE_UNPINNED = 'message.unpinned',

  // Group events
  GROUP_CREATED = 'group.created',
  GROUP_UPDATED = 'group.updated',
  GROUP_PARTICIPANTS_ADDED = 'group.participants_added',
  GROUP_PARTICIPANTS_REMOVED = 'group.participants_removed',
  GROUP_PARTICIPANTS_PROMOTED = 'group.participants_promoted',
  GROUP_PARTICIPANTS_DEMOTED = 'group.participants_demoted',

  // Health events
  INSTANCE_HEALTH_WARNING = 'instance.health_warning',
}
