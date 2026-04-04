import { MessageContext } from './message-context.interface';

export interface IPipelineStage {
  process(context: MessageContext): Promise<MessageContext>;
}
