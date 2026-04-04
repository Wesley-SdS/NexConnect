export interface MessageDelaySettings {
  enabled: boolean;
  minMs: number;
  maxMs: number;
}

export interface SendWindowSettings {
  enabled: boolean;
  startHour: number;
  endHour: number;
  timezone: string;
}

export interface AutoPresenceSettings {
  enabled: boolean;
  status: 'typing' | 'recording';
  strategy: 'maximum_duration' | 'until_next_message';
}

export interface InstanceSettings {
  callRejection: 'all' | 'none' | 'unknown';

  messageDelay: MessageDelaySettings;
  delayPerWord: boolean;

  presenceBehavior: 'only_composing' | 'always_online' | 'never';

  readConfirmation: 'always' | 'never' | 'contacts_only';

  rateLimitPerMinute: number;
  rateLimitPerDay: number;
  allowedSendWindow: SendWindowSettings;

  bufferEnabled: boolean;
  bufferWindowMs: number;
  bufferMaxMessages: number;
  bufferAdaptive: boolean;

  sttEnabled: boolean;
  sttProvider: 'whisper' | 'assemblyai' | 'azure';
  sttLanguage: string;

  autoPresence: AutoPresenceSettings;
}
