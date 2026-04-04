import { MessageContext } from './message-context.interface';

export interface IPipelineStage {
  execute(context: MessageContext): Promise<MessageContext | null>;
}
