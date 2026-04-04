# @nexconnect/core

Shared enums, interfaces, and DTOs used across the NexConnect monorepo. This package contains zero runtime dependencies — it is pure type definitions and validation schemas.

## Installation

This package is workspace-internal. Import directly:
```ts
import { MessageType, InstanceStatus, SendMessageDto } from '@nexconnect/core';
```

## Exports

### Enums

| Enum | Values |
|---|---|
| `InstanceStatus` | `CREATED`, `CONNECTING`, `CONNECTED`, `DISCONNECTED`, `BANNED` |
| `ConnectionType` | `QR_CODE`, `PAIRING_CODE`, `WABA` |
| `MessageDirection` | `INBOUND`, `OUTBOUND` |
| `MessageType` | `TEXT`, `AUDIO`, `IMAGE`, `VIDEO`, `DOCUMENT`, `STICKER`, `LOCATION`, `VCARD`, `BUTTON_REPLY`, `LIST_REPLY`, `REACTION`, `POLL`, `STATUS_REPLY`, `CALL_MISSED`, `UNKNOWN` |
| `MessageStatus` | `PENDING`, `PROCESSING`, `SENT`, `DELIVERED`, `READ`, `FAILED` |
| `WebhookDeliveryStatus` | `PENDING`, `SUCCESS`, `FAILED`, `DEAD_LETTER` |
| `MediaType` | `IMAGE`, `AUDIO`, `VIDEO`, `DOCUMENT`, `STICKER` |
| `ScheduledMessageStatus` | `SCHEDULED`, `SENDING`, `SENT`, `FAILED`, `CANCELED` |
| `TenantPlan` | `FREE`, `STARTER`, `PRO`, `ENTERPRISE` |
| `WebhookEvent` | `instance.connected`, `instance.disconnected`, `instance.qrcode`, `message.received`, `message.sent`, `message.delivered`, `message.read`, `message.deleted`, `message.reaction`, `group.created`, `group.updated`, etc. |

### Interfaces

| Interface | Description |
|---|---|
| `WebhookPayload` | Payload structure dispatched to webhook endpoints |
| `InstanceSettings` | Per-instance configuration (delays, presence, send window) |
| `IPipelineStage` | Interface for inbound/outbound message pipeline stages |
| `MessageContext` | Runtime context passed through the message pipeline |
| `MediaAssetRef` | Reference to a media file stored in R2 |

### DTOs

| DTO | Description |
|---|---|
| `CreateInstanceDto` | Validation for instance creation requests |
| `UpdateInstanceDto` | Validation for instance update requests |
| `SendMessageDto` | Validation for outbound message requests |
| `CreateWebhookDto` | Validation for webhook creation requests |
| `PaginationDto` | Query params for paginated list endpoints |
| `PaginatedResponseDto` | Standardized paginated response wrapper |
