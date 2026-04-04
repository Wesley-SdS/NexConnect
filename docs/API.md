# NexConnect API Reference

**Base URL:** `http://localhost:3100/v1`
**Auth:** `Authorization: Bearer nc_xxxxxxxxxxxxx`

---

## Tenants

### Criar Tenant

```http
POST /v1/tenants
Content-Type: application/json

{
  "name": "Minha Empresa",
  "plan": "PRO"
}
```

**Response 201:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Minha Empresa",
    "plan": "PRO",
    "apiKey": "nc_xxxxxxxxxxxxxxxxxxxx",
    "createdAt": "2026-03-30T12:00:00.000Z"
  }
}
```

---

## Instâncias

### Criar Instância

```http
POST /v1/instances
Content-Type: application/json

{
  "name": "Suporte Principal",
  "connectionType": "QR_CODE",
  "settings": {
    "bufferEnabled": true,
    "bufferWindowMs": 3000,
    "sttEnabled": true,
    "sttProvider": "whisper",
    "sttLanguage": "pt-BR",
    "callRejection": "all",
    "presenceBehavior": "only_composing",
    "readConfirmation": "always",
    "rateLimitPerMinute": 100,
    "rateLimitPerDay": 5000
  }
}
```

### Obter QR Code

```http
GET /v1/instances/:id/qrcode
```

**Response:**
```json
{
  "success": true,
  "data": {
    "qrcode": "base64...",
    "svg": "<svg>...</svg>",
    "expiresAt": "2026-03-30T12:02:00.000Z"
  }
}
```

### Código de Pareamento

```http
POST /v1/instances/:id/pairing-code
Content-Type: application/json

{
  "phoneNumber": "+5511999998888"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "code": "12345678",
    "expiresAt": "2026-03-30T12:05:00.000Z"
  }
}
```

---

## Mensagens

### Enviar Mensagem de Texto

```http
POST /v1/instances/:id/messages
Content-Type: application/json

{
  "to": "+5511999998888",
  "type": "text",
  "content": {
    "text": "Olá! Como posso ajudar?"
  }
}
```

### Enviar Imagem

```http
POST /v1/instances/:id/messages

{
  "to": "+5511999998888",
  "type": "image",
  "content": {
    "url": "https://example.com/image.jpg",
    "caption": "Veja esta imagem"
  }
}
```

### Enviar Áudio

```http
POST /v1/instances/:id/messages

{
  "to": "+5511999998888",
  "type": "audio",
  "content": {
    "url": "https://r2.example.com/audio.ogg",
    "ptt": true
  }
}
```

### Enviar Documento

```http
POST /v1/instances/:id/messages

{
  "to": "+5511999998888",
  "type": "document",
  "content": {
    "url": "https://example.com/doc.pdf",
    "filename": "contrato.pdf"
  }
}
```

### Enviar Localização

```http
POST /v1/instances/:id/messages

{
  "to": "+5511999998888",
  "type": "location",
  "content": {
    "latitude": -23.5505,
    "longitude": -46.6333,
    "name": "São Paulo",
    "address": "Av Paulista, 1000"
  }
}
```

### Agendar Mensagem

```http
POST /v1/instances/:id/messages

{
  "to": "+5511999998888",
  "type": "text",
  "content": { "text": "Bom dia!" },
  "sendAt": "2026-04-01T09:00:00-03:00"
}
```

### Reagir a Mensagem

```http
POST /v1/instances/:id/messages/:msgId/reactions

{
  "emoji": "👍"
}
```

---

## Webhooks

### Criar Webhook

```http
POST /v1/instances/:id/webhooks
Content-Type: application/json

{
  "name": "NexBot Inbound",
  "url": "https://nexbot.app/api/channels/whatsapp/inbound",
  "events": ["message.received", "message.sent", "instance.connected"],
  "headers": {
    "Authorization": "Bearer my-nexbot-secret"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "NexBot Inbound",
    "url": "https://nexbot.app/api/channels/whatsapp/inbound",
    "events": ["message.received", "message.sent", "instance.connected"],
    "secret": "whsec_xxxxxxxxxxxxxxxx",
    "enabled": true
  }
}
```

### Replay de Eventos

```http
POST /v1/events/replay
Content-Type: application/json

{
  "from": "2026-03-30T10:00:00Z",
  "to": "2026-03-30T11:00:00Z",
  "eventTypes": ["message.received"],
  "instanceId": "ins_...",
  "targetUrl": "https://debug.myapp.com/webhook"
}
```

---

## Payload de Webhook (Inbound)

```json
{
  "id": "evt_01HZ...",
  "type": "message.received",
  "instance_id": "ins_...",
  "tenant_id": "ten_...",
  "created_at": "2026-03-30T12:00:00.000Z",
  "data": {
    "message_id": "3AAB4DA4297176B74E38",
    "type": "text",
    "from": "+5511999998888",
    "from_name": "João Silva",
    "is_group": false,
    "content": {
      "text": "mensagem já bufferizada",
      "transcription": "...",
      "media_url": "https://r2.nexconnect.io/...",
      "thumbnail_url": "...",
      "filename": "...",
      "latitude": -23.5,
      "longitude": -46.6
    },
    "buffered_messages": 3,
    "sent_at": "2026-03-30T12:00:00.000Z"
  },
  "meta": {
    "delivery_attempt": 1,
    "replay": false
  }
}
```

---

## Grupos

### Listar Grupos

```http
GET /v1/instances/:id/groups
```

### Criar Grupo

```http
POST /v1/instances/:id/groups

{
  "name": "Equipe Suporte",
  "participants": ["+5511999998888", "+5511999997777"]
}
```

### Adicionar Participantes

```http
POST /v1/instances/:id/groups/:gid/participants

{
  "participants": ["+5511999996666"]
}
```

---

## Presence

```http
PATCH /v1/instances/:id/presence

{
  "recipient": "+5511999998888",
  "status": "typing",
  "durationStrategy": "until_next_message",
  "maxDuration": 600
}
```

---

## Broadcasts

```http
POST /v1/broadcasts

{
  "instancePool": ["ins_001", "ins_002", "ins_003"],
  "strategy": "round_robin",
  "messages": [
    {
      "to": "+5511999990001",
      "type": "text",
      "content": { "text": "Olá!" }
    }
  ],
  "sendWindow": {
    "start": 9,
    "end": 18,
    "timezone": "America/Sao_Paulo"
  }
}
```

---

## Rate Limits

| Nível | Limite Padrão |
|---|---|
| Por API Key | 1.000 req/min |
| Por instância | 100 msgs/min |
| Por destinatário | 10 msgs/min |
| Webhook delivery | 500 eventos/min |
| Media upload | 50 MB/min |

---

## Códigos de Erro

| Código | Significado |
|---|---|
| 400 | Bad Request — validação falhou |
| 401 | Unauthorized — API key inválida |
| 403 | Forbidden — scope insuficiente |
| 404 | Not Found — recurso não existe |
| 409 | Conflict — recurso já existe |
| 422 | Unprocessable — instância offline |
| 429 | Too Many Requests — rate limit |
| 500 | Internal Server Error |

**Formato de erro:**
```json
{
  "success": false,
  "error": {
    "code": "INSTANCE_NOT_FOUND",
    "message": "Instance ins_xxx not found",
    "statusCode": 404,
    "timestamp": "2026-03-30T12:00:00.000Z"
  }
}
```
