export interface WebhookPayloadMeta {
  delivery_attempt: number;
  replay: boolean;
}

export interface WebhookPayload<T = Record<string, unknown>> {
  id: string;
  type: string;
  instance_id: string;
  tenant_id: string;
  created_at: string;
  data: T;
  meta: WebhookPayloadMeta;
}
