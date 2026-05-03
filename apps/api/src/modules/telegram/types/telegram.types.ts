/**
 * Strongly-typed subset of the Telegram Bot API used by NexConnect.
 * Mirrors https://core.telegram.org/bots/api as of v8.0+ (2026).
 */

export interface TelegramApiResponse<T> {
  ok: boolean;
  result?: T;
  description?: string;
  error_code?: number;
  parameters?: { migrate_to_chat_id?: number; retry_after?: number };
}

export interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

export interface TelegramChat {
  id: number;
  type: 'private' | 'group' | 'supergroup' | 'channel';
  title?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
}

export interface TelegramPhotoSize {
  file_id: string;
  file_unique_id: string;
  width: number;
  height: number;
  file_size?: number;
}

export interface TelegramFile {
  file_id: string;
  file_unique_id: string;
  file_size?: number;
  file_path?: string;
}

export interface TelegramMessage {
  message_id: number;
  message_thread_id?: number;
  from?: TelegramUser;
  date: number;
  chat: TelegramChat;
  reply_to_message?: TelegramMessage;
  text?: string;
  caption?: string;
  entities?: Array<{ type: string; offset: number; length: number; url?: string }>;
  photo?: TelegramPhotoSize[];
  audio?: { file_id: string; file_unique_id: string; duration: number; mime_type?: string };
  voice?: { file_id: string; file_unique_id: string; duration: number; mime_type?: string };
  video?: { file_id: string; file_unique_id: string; width: number; height: number; duration: number; mime_type?: string };
  document?: { file_id: string; file_unique_id: string; file_name?: string; mime_type?: string };
  sticker?: { file_id: string; file_unique_id: string; type?: string; emoji?: string };
  location?: { latitude: number; longitude: number };
  contact?: { phone_number: string; first_name: string; last_name?: string; user_id?: number; vcard?: string };
  poll?: TelegramPoll;
  dice?: { emoji: string; value: number };
  new_chat_members?: TelegramUser[];
  left_chat_member?: TelegramUser;
}

export interface TelegramPoll {
  id: string;
  question: string;
  options: Array<{ text: string; voter_count: number }>;
  total_voter_count: number;
  is_closed: boolean;
  is_anonymous: boolean;
  type: 'regular' | 'quiz';
  allows_multiple_answers: boolean;
}

export interface TelegramCallbackQuery {
  id: string;
  from: TelegramUser;
  message?: TelegramMessage;
  chat_instance: string;
  data?: string;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
  channel_post?: TelegramMessage;
  edited_channel_post?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
  poll?: TelegramPoll;
  poll_answer?: { poll_id: string; user: TelegramUser; option_ids: number[] };
  my_chat_member?: { chat: TelegramChat; from: TelegramUser; old_chat_member: unknown; new_chat_member: unknown };
}

export interface TelegramInlineKeyboardButton {
  text: string;
  callback_data?: string;
  url?: string;
  switch_inline_query?: string;
  switch_inline_query_current_chat?: string;
}

export interface TelegramInlineKeyboardMarkup {
  inline_keyboard: TelegramInlineKeyboardButton[][];
}

export interface TelegramReplyKeyboardMarkup {
  keyboard: Array<Array<{ text: string }>>;
  resize_keyboard?: boolean;
  one_time_keyboard?: boolean;
  selective?: boolean;
}

export type TelegramReplyMarkup =
  | TelegramInlineKeyboardMarkup
  | TelegramReplyKeyboardMarkup
  | { remove_keyboard: true }
  | { force_reply: true };

export interface TelegramSendMessageParams {
  chat_id: number | string;
  text: string;
  parse_mode?: 'MarkdownV2' | 'HTML' | 'Markdown';
  entities?: unknown[];
  link_preview_options?: { is_disabled?: boolean };
  disable_notification?: boolean;
  protect_content?: boolean;
  reply_parameters?: { message_id: number };
  reply_markup?: TelegramReplyMarkup;
}

export interface TelegramSetWebhookParams {
  url: string;
  certificate?: unknown;
  ip_address?: string;
  max_connections?: number;
  allowed_updates?: string[];
  drop_pending_updates?: boolean;
  secret_token?: string;
}
