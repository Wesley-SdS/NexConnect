export interface TwilioMessageStatusWebhook {
  MessageSid: string;
  MessageStatus: string;
  SmsSid?: string;
  SmsStatus?: string;
  To: string;
  From: string;
  AccountSid: string;
  ApiVersion?: string;
  ErrorCode?: string;
  ErrorMessage?: string;
  ChannelToAddress?: string;
  ChannelPrefix?: string;
  MessagingServiceSid?: string;
  Price?: string;
  PriceUnit?: string;
  RawDlrDoneDate?: string;
}

export interface TwilioInboundMessageWebhook {
  MessageSid: string;
  SmsSid?: string;
  AccountSid: string;
  From: string;
  To: string;
  Body: string;
  NumMedia: string;
  MessagingServiceSid?: string;
  FromCity?: string;
  FromState?: string;
  FromZip?: string;
  FromCountry?: string;
  ToCity?: string;
  ToState?: string;
  ToZip?: string;
  ToCountry?: string;
  ProfileName?: string;
  WaId?: string;
  ChannelPrefix?: string;
  OriginalRepliedMessageSid?: string;
  ButtonText?: string;
  ButtonPayload?: string;
  [key: string]: string | undefined;
}

export interface TwilioVoiceStatusWebhook {
  CallSid: string;
  AccountSid: string;
  From: string;
  To: string;
  CallStatus: string;
  ApiVersion?: string;
  Direction?: string;
  ForwardedFrom?: string;
  CallerName?: string;
  Duration?: string;
  CallDuration?: string;
  SipResponseCode?: string;
  RecordingUrl?: string;
  RecordingSid?: string;
  RecordingDuration?: string;
  Timestamp?: string;
}

export type TwilioMessageStatus =
  | 'accepted'
  | 'queued'
  | 'sending'
  | 'sent'
  | 'delivered'
  | 'read'
  | 'undelivered'
  | 'failed'
  | 'received';
