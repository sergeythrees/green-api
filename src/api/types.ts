/**
 * DTOs for the GREEN-API MAX v3 HTTP API.
 *
 * Shapes are taken verbatim from the official documentation, see
 * `docs/api-contracts.md` in this repository.
 */

export interface InstanceData {
  idInstance: number;
  wid: string;
  typeInstance: string;
}

export interface SenderData {
  chatId: string;
  chatName?: string;
  chatType?: string;
  sender: string;
  senderName?: string;
  senderType?: string;
  senderContactName?: string;
  /**
   * Numbers only, e.g. `79876543210`. Documented as an integer, but declared
   * as `number | string` because the service has been observed to send it as a
   * string as well.
   */
  senderPhoneNumber?: number | string;
}

export interface TextMessageData {
  textMessage: string;
}

export interface ExtendedTextMessageData {
  /** Link text or plain text. */
  text: string;
  description?: string;
  title?: string;
  jpegThumbnail?: string;
  isForwarded?: boolean;
  forwardingScore?: number;
}

export interface MessageData {
  typeMessage: string;
  textMessageData?: TextMessageData;
  extendedTextMessageData?: ExtendedTextMessageData;
}

/** Notification types emitted by the service. */
export type WebhookType =
  | 'incomingMessageReceived'
  | 'outgoingMessageReceived'
  | 'outgoingAPIMessageReceived'
  | 'outgoingMessageStatus'
  | 'stateInstanceChanged'
  | 'quotaExceeded';

/** Delivery status of an outgoing message. */
export type MessageDeliveryStatus =
  | 'delivered'
  | 'read'
  | 'failed'
  | 'noAccount'
  | 'notInGroup';

/** Body of an incoming notification. */
export interface NotificationBody {
  /** One of the documented `WebhookType` values; unknown values are tolerated. */
  typeWebhook: WebhookType | string;
  instanceData: InstanceData;
  /** UNIX time in **seconds**. */
  timestamp: number;
  idMessage: string;
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
  | 'starting'
  | 'suspended'
  | 'pendingPassword';

export interface GetStateInstanceResponse {
  stateInstance: InstanceState;
}

export interface SetSettingsResponse {
  saveSettings: boolean;
}

export interface CheckAccountResponse {
  /** Present on a successful check. */
  exist?: boolean;
  chatId?: string;
  fromCache?: boolean;
  /** Documented failure shape: `{ "status": false, "reason": "…" }`. */
  status?: boolean;
  reason?: string;
}

/** Settings accepted by `setSettings`. */
export interface InstanceSettings {
  webhookUrl?: string;
  webhookUrlToken?: string;
  delaySendMessagesMilliseconds?: number;
  markIncomingMessagesReaded?: 'yes' | 'no';
  markIncomingMessagesReadedOnReply?: 'yes' | 'no';
  outgoingWebhook?: 'yes' | 'no';
  outgoingMessageWebhook?: 'yes' | 'no';
  outgoingAPIMessageWebhook?: 'yes' | 'no';
  stateWebhook?: 'yes' | 'no';
  incomingWebhook?: 'yes' | 'no';
}
