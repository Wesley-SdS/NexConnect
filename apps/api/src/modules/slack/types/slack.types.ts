/**
 * Strongly-typed subset of Slack Web API + Events API + Block Kit.
 * https://api.slack.com
 */

export interface SlackBlock {
  type: string;
  text?: { type: 'plain_text' | 'mrkdwn'; text: string; emoji?: boolean };
  elements?: SlackBlockElement[];
  accessory?: SlackBlockElement;
  fields?: Array<{ type: 'plain_text' | 'mrkdwn'; text: string }>;
  image_url?: string;
  alt_text?: string;
  block_id?: string;
}

export interface SlackBlockElement {
  type:
    | 'button'
    | 'static_select'
    | 'multi_static_select'
    | 'overflow'
    | 'datepicker'
    | 'plain_text_input'
    | 'image';
  text?: { type: 'plain_text' | 'mrkdwn'; text: string };
  action_id?: string;
  value?: string;
  url?: string;
  style?: 'primary' | 'danger';
  placeholder?: { type: 'plain_text'; text: string };
  options?: Array<{
    text: { type: 'plain_text'; text: string };
    value: string;
    description?: { type: 'plain_text'; text: string };
  }>;
  initial_option?: unknown;
  image_url?: string;
  alt_text?: string;
}

export interface SlackPostMessageParams {
  channel: string;
  text?: string;
  blocks?: SlackBlock[];
  thread_ts?: string;
  reply_broadcast?: boolean;
  unfurl_links?: boolean;
  unfurl_media?: boolean;
  metadata?: { event_type: string; event_payload: Record<string, unknown> };
}

export interface SlackPostMessageResponse {
  ok: boolean;
  channel?: string;
  ts?: string;
  message?: {
    type: string;
    user: string;
    ts: string;
    text: string;
  };
  error?: string;
  response_metadata?: { warnings?: string[] };
}

export interface SlackEventCallback {
  token: string;
  team_id: string;
  api_app_id: string;
  type: 'event_callback' | 'url_verification' | 'app_rate_limited';
  challenge?: string;
  event_id?: string;
  event_time?: number;
  authorizations?: Array<{ enterprise_id?: string; team_id: string; user_id: string; is_bot: boolean }>;
  event?: SlackEvent;
}

export interface SlackEvent {
  type: string; // message, app_mention, reaction_added, message.channels, ...
  subtype?: string;
  user?: string;
  text?: string;
  ts: string;
  channel?: string;
  channel_type?: 'channel' | 'group' | 'im' | 'mpim';
  bot_id?: string;
  files?: Array<{
    id: string;
    name: string;
    mimetype: string;
    url_private: string;
    url_private_download: string;
    size: number;
  }>;
  attachments?: unknown[];
  thread_ts?: string;
  reply_count?: number;
  blocks?: SlackBlock[];
  reaction?: string;
  item?: { type: string; channel: string; ts: string };
  item_user?: string;
  edited?: { user: string; ts: string };
}

export interface SlackInteractivityPayload {
  type: 'block_actions' | 'view_submission' | 'shortcut' | 'message_action';
  team: { id: string; domain: string };
  user: { id: string; username: string; team_id: string };
  api_app_id: string;
  token: string;
  trigger_id: string;
  channel?: { id: string; name: string };
  message?: SlackEvent;
  view?: { id: string; team_id: string; callback_id: string; state: { values: Record<string, Record<string, { value: string; selected_option?: { value: string } }>> } };
  actions?: Array<{
    action_id: string;
    block_id: string;
    type: string;
    value?: string;
    selected_option?: { value: string };
    selected_options?: Array<{ value: string }>;
  }>;
}

export interface SlackSlashCommandPayload {
  token: string;
  team_id: string;
  team_domain: string;
  channel_id: string;
  channel_name: string;
  user_id: string;
  user_name: string;
  command: string;
  text: string;
  response_url: string;
  trigger_id: string;
  api_app_id: string;
}
