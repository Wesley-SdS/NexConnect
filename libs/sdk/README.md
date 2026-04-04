# @nexconnect/sdk

Official TypeScript SDK for the NexConnect WhatsApp Engine API.

## Installation

```bash
npm install @nexconnect/sdk
```

Requires Node.js >= 18 (uses `undici` for HTTP).

## Quick Start

```ts
import { NexConnect } from '@nexconnect/sdk';

const nex = new NexConnect({ apiKey: 'nc_live_...' });

// Create an instance
const instance = await nex.instances.create({ name: 'My Bot' });

// Get QR code for connection
const qr = await nex.instances.getQrCode(instance.id);

// Send a message
await nex.messages.send(instance.id, {
  to: '+5511999999999',
  type: 'text',
  content: { text: 'Hello from NexConnect!' },
});
```

## Configuration

```ts
const nex = new NexConnect({
  apiKey: 'nc_live_...',       // Required
  baseUrl: 'https://...',      // Default: https://api.nexconnect.io/v1
  timeout: 30000,              // Default: 30s
  maxRetries: 3,               // Default: 3
});
```

## Resources

### `nex.instances`

| Method | Description |
|---|---|
| `create(data)` | Create a new WhatsApp instance |
| `list(params?)` | List instances with pagination and status filter |
| `get(id)` | Get instance by ID |
| `update(id, data)` | Update instance name/settings |
| `delete(id)` | Delete instance |
| `connect(id)` | Initiate WhatsApp connection |
| `disconnect(id)` | Disconnect instance |
| `getQrCode(id)` | Get QR code for pairing |
| `getPairingCode(id)` | Get pairing code |

### `nex.messages`

| Method | Description |
|---|---|
| `send(instanceId, data)` | Send a message (text, image, audio, video, document, sticker, location, contact, reaction) |
| `list(instanceId, params?)` | List messages with pagination and filters |
| `get(instanceId, messageId)` | Get message by ID |

### `nex.webhooks`

| Method | Description |
|---|---|
| `create(instanceId, data)` | Register a webhook endpoint |
| `list(instanceId)` | List webhooks for an instance |
| `get(instanceId, webhookId)` | Get webhook by ID |
| `update(instanceId, webhookId, data)` | Update webhook configuration |
| `delete(instanceId, webhookId)` | Remove a webhook |

### `nex.groups`

| Method | Description |
|---|---|
| `create(instanceId, data)` | Create a WhatsApp group |
| `list(instanceId)` | List groups |
| `get(instanceId, groupId)` | Get group details |
| `update(instanceId, groupId, data)` | Update group name/description |
| `addParticipants(instanceId, groupId, participants)` | Add participants |
| `removeParticipants(instanceId, groupId, participants)` | Remove participants |

### `nex.broadcasts`

| Method | Description |
|---|---|
| `create(data)` | Create a broadcast campaign |
| `list(params?)` | List broadcasts with status filter |
| `get(broadcastId)` | Get broadcast status and progress |
| `cancel(broadcastId)` | Cancel a running broadcast |

### `nex.scheduling`

| Method | Description |
|---|---|
| `schedule(data)` | Schedule a one-time message |
| `createCronJob(data)` | Create a recurring message job |
| `listCronJobs(instanceId)` | List cron jobs for an instance |
| `deleteCronJob(cronJobId)` | Delete a cron job |

### `nex.sandbox`

| Method | Description |
|---|---|
| `createSession(data)` | Create a sandbox testing session |
| `simulateInbound(data)` | Simulate an inbound message |
| `simulateWebhook(data)` | Simulate a webhook event |
| `replayEvents(data)` | Replay historical events to a webhook |

## Error Handling

```ts
import { NexConnect, NexConnectError } from '@nexconnect/sdk';

try {
  await nex.instances.get('nonexistent');
} catch (err) {
  if (err instanceof NexConnectError) {
    console.log(err.status);  // 404
    console.log(err.code);    // 'INSTANCE_NOT_FOUND'
    console.log(err.message); // 'Instance does not exist'
  }
}
```
