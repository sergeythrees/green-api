/**
 * DTOs for the GREEN-API Telegram HTTP API.
 *
 * Shapes are taken verbatim from the official documentation, see
 * `docs/telegram/` in this repository (contracts-sending.md,
 * contracts-receiving.md, contracts-account-service.md).
 */

export interface InstanceData {
  idInstance: number;
  wid: string;
  /** `telegram` for this product (`whatsapp` / `v3` belong to the siblings). */
  typeInstance: string;
}

export interface SenderData {
  chatId: string;
  chatType?: string;
  /**
   * Absent in some documented bodies (e.g. the `noAccount` status example),
   * which is why everything except `chatId` is optional here.
   */
  sender?: string;
  chatName?: string;
  senderName?: string;
  senderType?: string;
  senderContactName?: string;
  /**
   * Numbers only, e.g. `79876543210`. Documented as an integer that is `0` when
   * the number is hidden or the chat is a group; declared as `number | string`
   * because the service has been observed to send it as a string as well.
   */
  senderPhoneNumber?: number | string;
}

export interface TextMessageData {
  textMessage: string;
  /** Documented for incoming text messages only. */
  isForwarded?: boolean;
  /** Documented for incoming text messages only. */
  forwardingScore?: number;
}

export interface MessageData {
  typeMessage: string;
  textMessageData?: TextMessageData;
}

/** Notification types emitted by the service. */
export type WebhookType =
  | 'incomingMessageReceived'
  | 'outgoingMessageReceived'
  | 'outgoingAPIMessageReceived'
  | 'outgoingMessageStatus'
  | 'stateInstanceChanged'
  | 'quotaExceeded';

/**
 * Delivery status of an outgoing message.
 *
 * The published list is exactly `delivered | read | failed | noAccount`; there
 * is no `sent` status in the Telegram webhooks (`sent` is only the local state
 * right after `sendMessage` resolves).
 */
export type MessageDeliveryStatus = 'delivered' | 'read' | 'failed' | 'noAccount';

/** Body of an incoming notification. */
export interface NotificationBody {
  /** One of the documented `WebhookType` values; unknown values are tolerated. */
  typeWebhook: WebhookType | string;
  instanceData: InstanceData;
  /** UNIX time in **seconds**. */
  timestamp: number;
  /**
   * Identifier of the message. Optional because the documented `failed` /
   * `noAccount` status examples omit it entirely.
   */
  idMessage?: string;
  senderData?: SenderData;
  messageData?: MessageData;
  /** Present on `outgoingMessageStatus`: chat the message belongs to. */
  chatId?: string;
  /** Present on `outgoingMessageStatus`. */
  status?: MessageDeliveryStatus | string;
  /** Present on `outgoingMessageStatus`. */
  description?: string;
  /** Present on `stateInstanceChanged`. */
  stateInstance?: InstanceState;
}

export interface ReceiveNotificationResponse {
  receiptId: number;
  /** Absent when the service returns a payload without a body. */
  body?: NotificationBody;
}

export interface SendMessageResponse {
  idMessage: string;
}

export interface DeleteNotificationResponse {
  result: boolean;
  reason?: string;
}

/** Possible values of `stateInstance`. */
export type InstanceState =
  | 'notAuthorized'
  | 'authorized'
  | 'blocked'
  | 'suspended'
  | 'starting'
  | 'pendingPassword';

export interface GetStateInstanceResponse {
  stateInstance: InstanceState;
}

export interface SetSettingsResponse {
  saveSettings: boolean;
}

/**
 * Settings accepted by `setSettings`.
 *
 * Only the webhook switches are modelled: they are the ones this client needs
 * to push the instance into HTTP-API delivery mode.
 */
export interface SetSettingsRequest {
  webhookUrl?: string;
  webhookUrlToken?: string;
  incomingWebhook?: 'yes' | 'no';
  outgoingWebhook?: 'yes' | 'no';
  outgoingAPIMessageWebhook?: 'yes' | 'no';
  outgoingMessageWebhook?: 'yes' | 'no';
  stateWebhook?: 'yes' | 'no';
  markIncomingMessagesReaded?: 'yes' | 'no';
  markIncomingMessagesReadedOnReply?: 'yes' | 'no';
  delaySendMessagesMilliseconds?: number;
}

/** Request body of `checkAccount`; exactly one of `phoneNumber` / `username` is needed. */
export interface CheckAccountRequest {
  phoneNumber?: number;
  username?: string;
  force?: boolean;
}

export interface CheckAccountResponse {
  /** Present on a successful check. */
  exist?: boolean;
  chatId?: string;
  username?: string;
  phoneNumber?: number | string;
  fromCache?: boolean;
  /** Documented failure shape: `{ "status": false, "reason": "…" }`. */
  status?: boolean;
  reason?: string;
  /**
   * Documented rate-limit shape, where the reason is nested:
   * `{ "status": false, "data": { "reason": "rate_limit_exceeded", … } }`.
   */
  data?: {
    status?: string;
    reason?: string;
    retryAfter?: number;
  };
}

/**
 * `getContactInfo` answer: the only way to learn who a peer is.
 *
 * Verified live: for a peer whose Telegram profile name is unset, `name` and
 * `contactName` come back as the literal `"."` while `username` and
 * `phoneNumber` are real. `name` is therefore a last resort, not a first one.
 */
export interface GetContactInfoResponse {
  chatId: string;
  chatType?: string;
  /** Display name; the literal `"."` when the profile has none. */
  name?: string;
  contactName?: string;
  /** Public handle, starts with `@`. */
  username?: string;
  /** Digits only; `0` when the number is hidden or the chat is a group. */
  phoneNumber?: number | string;
  avatar?: string;
  description?: string;
}

export interface GetAccountSettingsResponse {
  /** Empty for `notAuthorized`, `blocked`, `starting`. */
  avatar?: string;
  /** Empty for `notAuthorized`, `blocked`, `starting`. */
  phone?: string;
  stateInstance: InstanceState;
  /** "Saved messages" chat id; empty for `notAuthorized`, `blocked`, `starting`. */
  chatId?: string;
  /** Public profile name, starts with `@`. */
  username?: string;
  /** Present only while `stateInstance` is `suspended`. */
  suspendedUntil?: number;
  /** Percent of chat history synchronisation. */
  historySyncProgress?: number;
}
