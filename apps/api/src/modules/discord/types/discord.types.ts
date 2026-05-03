/**
 * Strongly-typed subset of the Discord API v10 used by NexConnect.
 * https://discord.com/developers/docs
 */

export type Snowflake = string;

export interface DiscordUser {
  id: Snowflake;
  username: string;
  discriminator?: string;
  global_name?: string;
  bot?: boolean;
  avatar?: string | null;
}

export interface DiscordGuildMember {
  user?: DiscordUser;
  nick?: string;
  roles: Snowflake[];
}

export interface DiscordAttachment {
  id: Snowflake;
  filename: string;
  size: number;
  url: string;
  proxy_url: string;
  content_type?: string;
  width?: number;
  height?: number;
  duration_secs?: number;
}

export interface DiscordEmbed {
  title?: string;
  description?: string;
  url?: string;
  color?: number;
  image?: { url: string };
  thumbnail?: { url: string };
  footer?: { text: string };
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
}

export interface DiscordComponent {
  type: number; // 1=ActionRow, 2=Button, 3=StringSelect, 4=TextInput, 5=UserSelect, 6=RoleSelect, 7=MentionableSelect, 8=ChannelSelect
  components?: DiscordComponent[];
  custom_id?: string;
  label?: string;
  style?: number; // Button styles 1-5; link button = 5
  url?: string;
  emoji?: { name: string; id?: Snowflake; animated?: boolean };
  placeholder?: string;
  options?: Array<{ label: string; value: string; description?: string; default?: boolean }>;
  min_values?: number;
  max_values?: number;
}

export interface DiscordMessage {
  id: Snowflake;
  channel_id: Snowflake;
  guild_id?: Snowflake;
  author: DiscordUser;
  member?: DiscordGuildMember;
  content: string;
  timestamp: string;
  edited_timestamp?: string | null;
  attachments: DiscordAttachment[];
  embeds: DiscordEmbed[];
  components?: DiscordComponent[];
  type: number;
  referenced_message?: DiscordMessage | null;
  message_reference?: { message_id?: Snowflake; channel_id?: Snowflake; guild_id?: Snowflake };
  flags?: number;
}

export interface DiscordCreateMessagePayload {
  content?: string;
  embeds?: DiscordEmbed[];
  components?: DiscordComponent[];
  message_reference?: { message_id: Snowflake; channel_id?: Snowflake; fail_if_not_exists?: boolean };
  attachments?: Array<{ id: number; filename: string; description?: string }>;
  flags?: number;
  tts?: boolean;
  /** When true, text is wrapped in a SUPPRESS_EMBEDS flag. */
  allowed_mentions?: {
    parse?: ('roles' | 'users' | 'everyone')[];
    roles?: Snowflake[];
    users?: Snowflake[];
    replied_user?: boolean;
  };
}

export interface DiscordInteraction {
  id: Snowflake;
  application_id: Snowflake;
  type: number; // 1=PING, 2=APPLICATION_COMMAND, 3=MESSAGE_COMPONENT, 4=APPLICATION_COMMAND_AUTOCOMPLETE, 5=MODAL_SUBMIT
  data?: {
    id?: Snowflake;
    name?: string;
    type?: number;
    custom_id?: string;
    component_type?: number;
    options?: Array<{ name: string; type: number; value?: unknown }>;
    values?: string[];
    components?: DiscordComponent[];
  };
  guild_id?: Snowflake;
  channel_id?: Snowflake;
  member?: DiscordGuildMember;
  user?: DiscordUser;
  token: string;
  message?: DiscordMessage;
  app_permissions?: string;
  locale?: string;
  guild_locale?: string;
}

export enum InteractionType {
  PING = 1,
  APPLICATION_COMMAND = 2,
  MESSAGE_COMPONENT = 3,
  APPLICATION_COMMAND_AUTOCOMPLETE = 4,
  MODAL_SUBMIT = 5,
}

export enum InteractionResponseType {
  PONG = 1,
  CHANNEL_MESSAGE_WITH_SOURCE = 4,
  DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE = 5,
  DEFERRED_UPDATE_MESSAGE = 6,
  UPDATE_MESSAGE = 7,
  APPLICATION_COMMAND_AUTOCOMPLETE_RESULT = 8,
  MODAL = 9,
}
