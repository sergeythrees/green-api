import type { MessageDeliveryStatus, NotificationBody } from '../api/types';
import { formatPhone, normalizePhone, phoneToChatId } from '../api/phone';

/**
 * Delivery state of an outgoing message, plus the local pre-send state.
 *
 * Telegram has no `sent` webhook status: `sending` and `sent` are purely local
 * (right before and right after `sendMessage` resolves), while everything else
 * comes from `outgoingMessageStatus`.
 */
export type OutgoingStatus = 'sending' | 'sent' | MessageDeliveryStatus;

export interface ChatMessage {
  /**
   * `idMessage` from GREEN-API, or a temporary `local:` id before the send
   * resolves. It is unique inside one chat only.
   */
  id: string;
  chatKey: string;
  text: string;
  /** UNIX time in milliseconds. */
  timestamp: number;
  direction: 'incoming' | 'outgoing';
  /** Only meaningful for outgoing messages. */
  status?: OutgoingStatus;
  error?: string;
}

export interface Chat {
  /** Stable identity of the chat for the lifetime of the session. */
  key: string;
  /** Telegram chat id, once known: positive for users, negative for groups. */
  chatId: string | null;
  /** Recipient phone in digits-only international form, once known. */
  phone: string | null;
  title: string;
  messages: ChatMessage[];
  unread: number;
  /**
   * Set while the chat was found through a notification and its real identity is
   * still unknown. `App` answers it with one `getContactInfo` call and dispatches
   * `chat/identify`; without it the chat would be listed as "Чат <id>".
   */
  needsIdentity: boolean;
  /** UNIX time in milliseconds. */
  lastActivity: number;
}

export interface ChatState {
  chats: Chat[];
  activeChatKey: string | null;
}

export const initialChatState: ChatState = { chats: [], activeChatKey: null };

export function chatKeyForChatId(chatId: string): string {
  return `id:${chatId}`;
}

export function chatKeyForPhone(phone: string): string {
  return `phone:${phone}`;
}

/** Finds a chat by Telegram chat id first, then by recipient phone. */
export function findChatIndex(
  chats: readonly Chat[],
  chatId: string | null,
  phone: string | null,
): number {
  if (chatId) {
    const byId = chats.findIndex((chat) => chat.chatId === chatId);
    if (byId !== -1) return byId;
  }
  if (phone) {
    const byPhone = chats.findIndex((chat) => chat.phone === phone);
    if (byPhone !== -1) return byPhone;
  }
  return -1;
}

/**
 * Extracts the plain text of a notification.
 *
 * Telegram delivers text as `messageData.typeMessage = "textMessage"`; every
 * other kind (images, files, stickers, polls, …) is out of scope for this
 * text-only client and returns `null`.
 */
export function extractText(body: NotificationBody): string | null {
  const data = body.messageData;
  if (!data) return null;
  if (data.typeMessage === 'textMessage' && data.textMessageData?.textMessage) {
    return data.textMessageData.textMessage;
  }
  return null;
}

/**
 * A name that is safe to show as a chat title.
 *
 * Telegram happily returns the user's literal profile name, and `.` is a real
 * value: on the instance this client was tested against the display name is
 * exactly `"."`. Treating it as a name would produce a chat list full of dots.
 */
function usableName(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if (trimmed === '.' || trimmed === '?') return null;
  return trimmed;
}

/** True for the two webhooks that report a message the account sent itself. */
function isOutgoingMessage(body: NotificationBody): boolean {
  return (
    body.typeWebhook === 'outgoingMessageReceived' ||
    body.typeWebhook === 'outgoingAPIMessageReceived'
  );
}

/**
 * Peer identity of a notification.
 *
 * The two webhook families describe `senderData` differently, and getting that
 * wrong mislabels the chat:
 *
 * - **incoming** — `senderData` *is* the peer: id, name and phone.
 * - **outgoing** — `senderData` is the *sending account*. On a live instance the
 *   same block read `sender: "305000000"` (own Saved Messages), `senderName:
 *   "Владелец"`, `senderPhoneNumber: "79001234567"` (own number) next to the real
 *   `chatId: "6900000001"`. The peer is `chatId` alone; the name belongs to us
 *   and the phone is our own number, so taking it would label the chat with the
 *   operator's identity and match unrelated notifications by phone.
 * - `sender === chatId` means the message went to the account's own Saved
 *   Messages chat.
 */
function peerOf(body: NotificationBody): {
  chatId: string | null;
  phone: string | null;
  self: boolean;
} {
  const sender = body.senderData;
  const chatId = sender?.chatId ?? body.chatId ?? null;
  const id = chatId ? String(chatId) : null;

  if (isOutgoingMessage(body)) {
    const own = sender?.sender ? String(sender.sender) : null;
    return { chatId: id, phone: null, self: own !== null && own === id };
  }

  return { chatId: id, phone: normalizeSenderPhone(body), self: false };
}

/** Title of the account's own notes chat, the way Telegram labels it. */
const SAVED_MESSAGES_TITLE = 'Избранное';

/**
 * Picks the most human-readable name for the peer.
 *
 * For an outgoing message every name in `senderData` is the account owner, so
 * the only candidates are the peer's `chatName` (which the live instance
 * returns as `"."` for a user who has no display name) and the caller's
 * fallback. Resolving a real name is left to `getContactInfo`.
 */
function resolveTitle(
  body: NotificationBody,
  phone: string | null,
  fallback: string,
): string {
  const sender = body.senderData;

  if (isOutgoingMessage(body)) {
    const { self } = peerOf(body);
    if (self) return SAVED_MESSAGES_TITLE;
    return usableName(sender?.chatName) ?? fallback;
  }

  const candidates = [sender?.senderContactName, sender?.senderName, sender?.chatName];
  for (const candidate of candidates) {
    const name = usableName(candidate);
    if (name) return name;
  }
  return phone ? formatPhone(phone) : fallback;
}

function normalizeSenderPhone(body: NotificationBody): string | null {
  const raw = body.senderData?.senderPhoneNumber;
  if (raw === undefined || raw === null || raw === '') return null;

  const digits = String(raw).replace(/\D+/g, '');

  // The API documents `0` as the "number hidden / group chat" sentinel. Treating
  // it as a real phone number would make unrelated chats match each other.
  if (!digits || /^0+$/.test(digits)) return null;

  // Only accept plausible international numbers; anything else is not a usable
  // lookup key and would only produce phantom chats.
  return normalizePhone(digits);
}

/** Notification time in milliseconds, falling back to now for a bad value. */
function timestampMs(body: NotificationBody): number {
  const seconds = Number(body.timestamp);
  return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : Date.now();
}

function appendMessage(chat: Chat, message: ChatMessage): Chat {
  if (chat.messages.some((existing) => existing.id === message.id)) return chat;
  return {
    ...chat,
    messages: [...chat.messages, message],
    lastActivity: Math.max(chat.lastActivity, message.timestamp),
  };
}

/** A title the app made up because the payload carried no usable name. */
function isPlaceholderTitle(title: string, key: string): boolean {
  return !title || title === key || title.startsWith('+') || title.startsWith('Чат ');
}

/**
 * Fills in what a notification could not tell us.
 *
 * A chat title is only replaced when the current one is a placeholder (a phone
 * typed by the user, the raw key, or a synthetic "Чат <id>"), so a name learned
 * later wins without ever overwriting a name the user recognises.
 */
function enrichChat(chat: Chat, chatId: string | null, phone: string | null, title?: string): Chat {
  const nextChatId = chat.chatId ?? chatId;
  const nextPhone = chat.phone ?? phone;
  const nextTitle = title && isPlaceholderTitle(chat.title, chat.key) ? title : chat.title;
  if (nextChatId === chat.chatId && nextPhone === chat.phone && nextTitle === chat.title) {
    return chat;
  }
  return { ...chat, chatId: nextChatId, phone: nextPhone, title: nextTitle || chat.title };
}

function statusError(status: string, description?: string): string | undefined {
  if (status === 'failed') return description || 'Сообщение не отправлено.';
  if (status === 'noAccount') return description || 'На этом номере нет аккаунта Telegram.';
  return undefined;
}

function sortByActivity(chats: Chat[]): Chat[] {
  return [...chats].sort((a, b) => b.lastActivity - a.lastActivity);
}

export type ChatAction =
  | {
      type: 'chat/create';
      chatId: string | null;
      phone: string | null;
      title?: string;
    }
  | { type: 'chat/select'; chatKey: string }
  /** Applies what `getContactInfo` returned for a peer found through a notification. */
  | { type: 'chat/identify'; chatKey: string; title: string | null; phone: string | null }
  | { type: 'message/queue'; chatKey: string; localId: string; text: string; timestamp: number }
  | { type: 'message/sent'; chatKey: string; localId: string; idMessage: string }
  | { type: 'message/failed'; chatKey: string; localId: string; error: string }
  | { type: 'notification/received'; body: NotificationBody }
  | { type: 'state/reset' };

function reduce(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case 'state/reset':
      return initialChatState;

    case 'chat/create': {
      const index = findChatIndex(state.chats, action.chatId, action.phone);
      if (index !== -1) {
        const chats = [...state.chats];
        const existing = enrichChat(
          chats[index],
          action.chatId,
          action.phone,
          action.title,
        );
        chats[index] = { ...existing, unread: 0 };
        return { chats, activeChatKey: existing.key };
      }

      const key = action.chatId
        ? chatKeyForChatId(action.chatId)
        : chatKeyForPhone(action.phone ?? String(Date.now()));
      const title =
        action.title?.trim() || (action.phone ? formatPhone(action.phone) : key);
      const chat: Chat = {
        key,
        chatId: action.chatId,
        phone: action.phone,
        title,
        messages: [],
        unread: 0,
        needsIdentity: false,
        lastActivity: Date.now(),
      };
      return { chats: [chat, ...state.chats], activeChatKey: key };
    }

    case 'chat/identify': {
      const chats = state.chats.map((chat) => {
        if (chat.key !== action.chatKey) return chat;
        const next = enrichChat(
          { ...chat, needsIdentity: false },
          null,
          action.phone,
          action.title ?? undefined,
        );
        return { ...next, needsIdentity: false };
      });
      return { ...state, chats };
    }

    case 'chat/select': {
      if (!state.chats.some((chat) => chat.key === action.chatKey)) return state;
      return {
        chats: state.chats.map((chat) =>
          chat.key === action.chatKey ? { ...chat, unread: 0 } : chat,
        ),
        activeChatKey: action.chatKey,
      };
    }

    case 'message/queue': {
      const chats = state.chats.map((chat) => {
        if (chat.key !== action.chatKey) return chat;
        return appendMessage(chat, {
          id: action.localId,
          chatKey: chat.key,
          text: action.text,
          timestamp: action.timestamp,
          direction: 'outgoing',
          status: 'sending',
        });
      });
      return { ...state, chats };
    }

    case 'message/sent': {
      const chats = state.chats.map((chat) => {
        if (chat.key !== action.chatKey) return chat;
        const realAlreadyPresent = chat.messages.some(
          (message) => message.id === action.idMessage,
        );
        const messages = chat.messages
          .filter((message) => !(realAlreadyPresent && message.id === action.localId))
          .map((message) =>
            message.id === action.localId
              ? { ...message, id: action.idMessage, status: 'sent' as const }
              : message,
          );
        return { ...chat, messages };
      });
      return { ...state, chats };
    }

    case 'message/failed': {
      const chats = state.chats.map((chat) => {
        if (chat.key !== action.chatKey) return chat;
        return {
          ...chat,
          messages: chat.messages.map((message) =>
            message.id === action.localId
              ? { ...message, status: 'failed' as const, error: action.error }
              : message,
          ),
        };
      });
      return { ...state, chats };
    }

    case 'notification/received':
      return applyNotification(state, action.body);

    default:
      return state;
  }
}

function applyNotification(state: ChatState, body: NotificationBody): ChatState {
  switch (body.typeWebhook) {
    case 'incomingMessageReceived':
      return applyIncoming(state, body);
    case 'outgoingMessageReceived':
      return applyOutgoing(state, body);
    case 'outgoingAPIMessageReceived':
      return applyOutgoing(state, body);
    case 'outgoingMessageStatus':
      return applyStatus(state, body);
    default:
      // `stateInstanceChanged` / `quotaExceeded` carry no chat data.
      return state;
  }
}

/** Creates an empty chat for a peer discovered through a notification. */
function chatForPeer(
  body: NotificationBody,
  chatId: string | null,
  phone: string | null,
  self: boolean,
  key: string,
  timestamp: number,
): Chat {
  const title = resolveTitle(body, phone, `Чат ${chatId ?? key}`);
  return {
    key,
    chatId,
    phone,
    title,
    messages: [],
    unread: 0,
    // Our own Saved Messages chat is already named, and an incoming message that
    // carried a real name needs no lookup either.
    needsIdentity: !self && title.startsWith('Чат '),
    lastActivity: timestamp,
  };
}

function applyIncoming(state: ChatState, body: NotificationBody): ChatState {
  const text = extractText(body);
  const idMessage = body.idMessage;

  // Message notifications always carry `idMessage`; without it the message
  // cannot be de-duplicated against a redelivery, so it is dropped.
  if (text === null || !idMessage) return state;

  const { chatId, phone, self } = peerOf(body);
  const timestamp = timestampMs(body);
  const index = findChatIndex(state.chats, chatId, phone);

  if (index === -1) {
    const key = chatId ? chatKeyForChatId(chatId) : chatKeyForPhone(phone ?? idMessage);
    const chat = chatForPeer(body, chatId, phone, self, key, timestamp);
    const withMessage = appendMessage(chat, {
      id: idMessage,
      chatKey: key,
      text,
      timestamp,
      direction: 'incoming',
    });
    const isActive = state.activeChatKey === key;
    return {
      chats: [{ ...withMessage, unread: isActive ? 0 : 1 }, ...state.chats],
      activeChatKey: state.activeChatKey,
    };
  }

  const chats = [...state.chats];
  const target = enrichChat(
    chats[index],
    chatId,
    phone,
    resolveTitle(body, phone, chats[index].title),
  );
  const isActive = state.activeChatKey === target.key;
  const withMessage = appendMessage(target, {
    id: idMessage,
    chatKey: target.key,
    text,
    timestamp,
    direction: 'incoming',
  });
  const isNewMessage = withMessage !== target;
  chats[index] = {
    ...withMessage,
    unread: isActive ? 0 : target.unread + (isNewMessage ? 1 : 0),
  };
  return { ...state, chats };
}

/**
 * Handles both `outgoingMessageReceived` (sent from another client of the same
 * account) and `outgoingAPIMessageReceived` (sent through this API).
 *
 * Telegram publishes no local "delivered" state, so a phone-sent message starts
 * as `sent`; the delivery receipt arrives later as `outgoingMessageStatus`.
 */
function applyOutgoing(state: ChatState, body: NotificationBody): ChatState {
  const text = extractText(body);
  const idMessage = body.idMessage;
  if (text === null || !idMessage) return state;

  const { chatId, phone, self } = peerOf(body);
  const timestamp = timestampMs(body);
  const index = findChatIndex(state.chats, chatId, phone);

  if (index === -1) {
    // A message sent from the phone to an unknown peer: create the chat.
    const key = chatId ? chatKeyForChatId(chatId) : chatKeyForPhone(phone ?? idMessage);
    const chat = chatForPeer(body, chatId, phone, self, key, timestamp);
    const withMessage = appendMessage(chat, {
      id: idMessage,
      chatKey: key,
      text,
      timestamp,
      direction: 'outgoing',
      status: 'sent',
    });
    return { ...state, chats: [withMessage, ...state.chats] };
  }

  const chats = [...state.chats];
  const target = enrichChat(chats[index], chatId, phone);
  chats[index] = appendMessage(target, {
    id: idMessage,
    chatKey: target.key,
    text,
    timestamp,
    direction: 'outgoing',
    status: 'sent',
  });
  return { ...state, chats };
}

function applyStatus(state: ChatState, body: NotificationBody): ChatState {
  const status = body.status;
  const idMessage = body.idMessage;

  // The documented `failed` / `noAccount` examples can omit `idMessage`; with no
  // match key there is nothing to update.
  if (!status || !idMessage) return state;

  // Telegram `idMessage` is unique inside a single chat only, so a status is
  // matched within the chat the notification addresses. Scanning every chat
  // could repaint an unrelated message that happens to share the same id.
  const chatId = body.chatId ?? body.senderData?.chatId ?? null;
  // `noAccount` reports the peer as `phoneNumber@c.us`, the legacy form of a
  // chat this client may only know by phone.
  const phoneFromChatId = chatId ? normalizePhone(chatId) : null;
  const scopedIndex = chatId
    ? state.chats.findIndex(
        (chat) =>
          chat.chatId === chatId || (phoneFromChatId !== null && chat.phone === phoneFromChatId),
      )
    : -1;

  // A status for a chat we have never seen is a no-op.
  if (chatId && scopedIndex === -1) return state;

  let touched = false;
  const chats = state.chats.map((chat, index) => {
    if (chatId && index !== scopedIndex) return chat;
    if (!chat.messages.some((message) => message.id === idMessage)) return chat;
    touched = true;
    return {
      ...chat,
      messages: chat.messages.map((message) =>
        message.id === idMessage
          ? {
              ...message,
              status: status as OutgoingStatus,
              error: statusError(String(status), body.description) ?? message.error,
            }
          : message,
      ),
    };
  });

  return touched ? { ...state, chats } : state;
}

/**
 * Reducer for chat state.
 *
 * Kept as a plain function so the message lifecycle (send, receive, receipts,
 * deduplication) can be unit-tested without React.
 */
export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  return reduce(state, action);
}

/** Chats ordered by most recent activity. */
export function selectSortedChats(state: ChatState): Chat[] {
  return sortByActivity(state.chats);
}

export function selectActiveChat(state: ChatState): Chat | null {
  if (!state.activeChatKey) return null;
  return state.chats.find((chat) => chat.key === state.activeChatKey) ?? null;
}

/** The chat the app should send to when the active chat has no resolved chatId. */
export function selectSendTarget(chat: Chat): string | null {
  if (chat.chatId) return chat.chatId;
  if (chat.phone) return phoneToChatId(chat.phone);
  return null;
}

/**
 * Chats whose real identity is still unknown.
 *
 * `App` walks this list and answers each entry with one `getContactInfo` call,
 * which is what turns a "Чат 6900000001" row into a named contact.
 */
export function selectChatsNeedingIdentity(state: ChatState): Chat[] {
  return state.chats.filter((chat) => chat.needsIdentity && chat.chatId !== null);
}
