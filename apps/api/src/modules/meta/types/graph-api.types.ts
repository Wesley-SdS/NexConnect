/**
 * Strongly typed representations of the subset of the Meta Graph API
 * that NexConnect integrates with. Types intentionally mirror the
 * payload shapes documented in Meta's developer reference so we can
 * map one-to-one without losing fidelity.
 */

export interface GraphErrorResponse {
  error: {
    message: string;
    type: string;
    code: number;
    error_subcode?: number;
    error_data?: {
      messaging_product?: string;
      details?: string;
    };
    fbtrace_id?: string;
  };
}

export interface GraphSendMessageResponse {
  messaging_product: 'whatsapp';
  contacts: Array<{ input: string; wa_id: string }>;
  messages: Array<{ id: string; message_status?: string }>;
}

export interface GraphMediaUploadResponse {
  id: string;
}

export interface GraphMediaMetadataResponse {
  messaging_product: 'whatsapp';
  url: string;
  mime_type: string;
  sha256: string;
  file_size: number;
  id: string;
}

export type GraphMessageStatus = 'read' | 'delivered' | 'sent' | 'failed' | 'deleted';

export interface GraphMessageStatusEntry {
  id: string;
  status: GraphMessageStatus;
  timestamp: string;
  recipient_id: string;
  errors?: Array<{
    code: number;
    title: string;
    message?: string;
    error_data?: { details?: string };
  }>;
  pricing?: {
    billable: boolean;
    pricing_model: string;
    category: string;
  };
  conversation?: {
    id: string;
    origin: { type: string };
  };
}

export interface GraphIncomingMessage {
  from: string;
  id: string;
  timestamp: string;
  type: string;
  context?: { from?: string; id?: string };
  text?: { body: string };
  image?: GraphIncomingMedia;
  video?: GraphIncomingMedia;
  audio?: GraphIncomingMedia;
  document?: GraphIncomingMedia;
  sticker?: GraphIncomingMedia;
  location?: { latitude: number; longitude: number; name?: string; address?: string };
  contacts?: Array<Record<string, unknown>>;
  interactive?: {
    type: 'button_reply' | 'list_reply';
    button_reply?: { id: string; title: string };
    list_reply?: { id: string; title: string; description?: string };
  };
  button?: { payload: string; text: string };
  reaction?: { message_id: string; emoji: string };
  errors?: Array<{ code: number; title: string; message?: string }>;
}

export interface GraphIncomingMedia {
  id: string;
  mime_type: string;
  sha256?: string;
  caption?: string;
  filename?: string;
  voice?: boolean;
}

export interface GraphWebhookContact {
  profile: { name?: string };
  wa_id: string;
}

export interface GraphWhatsAppChangeValue {
  messaging_product: 'whatsapp';
  metadata: {
    display_phone_number: string;
    phone_number_id: string;
  };
  contacts?: GraphWebhookContact[];
  messages?: GraphIncomingMessage[];
  statuses?: GraphMessageStatusEntry[];
  errors?: Array<{ code: number; title: string; message?: string }>;
}

export interface GraphInstagramMessagingEntry {
  id: string;
  time: number;
  messaging: Array<{
    sender: { id: string };
    recipient: { id: string };
    timestamp: number;
    message?: {
      mid: string;
      text?: string;
      attachments?: Array<{ type: string; payload: { url?: string } }>;
      reply_to?: { story?: { id: string; url?: string }; mid?: string };
      is_echo?: boolean;
    };
    reaction?: { mid: string; action: 'react' | 'unreact'; emoji?: string; reaction?: string };
    postback?: { mid: string; title: string; payload: string };
    read?: { mid?: string };
  }>;
}

export interface GraphWebhookEntry {
  id: string;
  time?: number;
  changes?: Array<{
    field: string;
    value: GraphWhatsAppChangeValue;
  }>;
  messaging?: GraphInstagramMessagingEntry['messaging'];
}

export interface GraphWebhookPayload {
  object: 'whatsapp_business_account' | 'instagram' | 'page';
  entry: GraphWebhookEntry[];
}

export interface GraphTemplate {
  id?: string;
  name: string;
  language: string;
  category: 'AUTHENTICATION' | 'MARKETING' | 'UTILITY';
  status?: 'APPROVED' | 'IN_APPEAL' | 'PENDING' | 'REJECTED' | 'PAUSED' | 'DISABLED';
  rejected_reason?: string;
  components: Array<{
    type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS';
    format?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'LOCATION';
    text?: string;
    example?: Record<string, unknown>;
    buttons?: Array<{
      type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER' | 'COPY_CODE';
      text?: string;
      url?: string;
      phone_number?: string;
      example?: string[];
    }>;
  }>;
}

export interface GraphTemplateListResponse {
  data: GraphTemplate[];
  paging?: { cursors?: { before?: string; after?: string }; next?: string };
}
