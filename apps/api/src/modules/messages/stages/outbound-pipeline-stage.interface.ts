export interface OutboundMessage {
  messageId: string;
  instanceId: string;
  tenantId: string;
  to: string;
  type: string;
  content: Record<string, any>;
}

export interface IOutboundPipelineStage {
  execute(message: OutboundMessage): Promise<void>;
}
