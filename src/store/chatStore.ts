import type { MessageDeliveryStatus, NotificationBody } from '../api/types';
import { formatPhone, normalizePhone, phoneToChatId } from '../api/phone';

/** Delivery state of an outgoing message, plus the local pre-send state. */
export type OutgoingStatus = 'sending' | 'sent' | MessageDeliveryStatus;

export interface ChatMessage {
  /** `idMessage` from GREEN-API, or a temporary `local:` id before the send resolves. */
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
  /** Numeric MAX chat id, once known. */
  chatId: string | null;
  /** Recipient phone in digits-only international form, once known. */
  phone: string | null;
  title: string;
  messages: ChatMessage[];
  unread: number;
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

/** Finds a chat by MAX chat id first, then by recipient phone. */
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
 * MAX delivers ordinary text as `textMessage` and text containing a link as
 * `extendedTextMessage`; both are text, and everything else (images, files,
 * stickers, …) is out of scope for this app and returns `null`.
 */
export function extractText(body: NotificationBody): string | null {
  const data = body.messageData;
  if (!data) return null;
  if (data.typeMessage === 'textMessage' && data.textMessageData?.textMessage) {
    return data.textMessageData.textMessage;
  }
  if (data.typeMessage === 'extendedTextMessage' && data.extendedTextMessageData?.text) {
    return data.extendedTextMessageData.text;
  }
  return null;
}

/** Picks the most human-readable name available for a peer. */
function resolveTitle(body: NotificationBody, phone: string | null, fallback: string): string {
  const sender = body.senderData;
  const candidates = [sender?.senderContactName, sender?.senderName, sender?.chatName];
  for (const candidate of candidates) {
    if (candidate && candidate.trim()) return candidate.trim();
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

/**
 * Peer identity of a notification.
 *
 * Incoming notifications describe the peer in `senderData`; outgoing status
 * notifications put the chat in a top-level `chatId`.
 */
function peerOf(body: NotificationBody): { chatId: string | null; phone: string | null } {
  const chatId = body.senderData?.chatId ?? body.chatId ?? null;
  return { chatId: chatId ? String(chatId) : null, phone: normalizeSenderPhone(body) };
}

function appendMessage(chat: Chat, message: ChatMessage): Chat {
  if (chat.messages.some((existing) => existing.id === message.id)) return chat;
  return {
    ...chat,
    messages: [...chat.messages, message],
    lastActivity: Math.max(chat.lastActivity, message.timestamp),
  };
}

/** Ensures the chat has the ids/title we may have learned from a notification. */
function enrichChat(chat: Chat, chatId: string | null, phone: string | null, title?: string): Chat {
  const nextChatId = chat.chatId ?? chatId;
  const nextPhone = chat.phone ?? phone;
  const nextTitle =
    title && (chat.title.startsWith('+') || chat.title === chat.key || !chat.title)
      ? title
      : chat.title;
  if (nextChatId === chat.chatId && nextPhone === chat.phone && nextTitle === chat.title) {
    return chat;
  }
  return { ...chat, chatId: nextChatId, phone: nextPhone, title: nextTitle || chat.title };
}

function statusError(status: string, description?: string): string | undefined {
  if (status === 'failed') return description || 'Сообщение не отправлено.';
  if (status === 'noAccount') return description || 'На номере нет аккаунта MAX.';
  if (status === 'notInGroup') return description || 'Отправитель не участник группы.';
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
        lastActivity: Date.now(),
      };
      return { chats: [chat, ...state.chats], activeChatKey: key };
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
      return applyOutgoing(state, body, false);
    case 'outgoingAPIMessageReceived':
      return applyOutgoing(state, body, true);
    case 'outgoingMessageStatus':
      return applyStatus(state, body);
    default:
      // `stateInstanceChanged` / `quotaExceeded` carry no chat data.
      return state;
  }
}

function applyIncoming(state: ChatState, body: NotificationBody): ChatState {
  const text = extractText(body);
  if (text === null) return state;

  const { chatId, phone } = peerOf(body);
  const timestamp = timestampMs(body);
  const index = findChatIndex(state.chats, chatId, phone);

  if (index === -1) {
    const key = chatId ? chatKeyForChatId(chatId) : chatKeyForPhone(phone ?? body.idMessage);
    const chat: Chat = {
      key,
      chatId,
      phone,
      title: resolveTitle(body, phone, chatId ?? key),
      messages: [],
      unread: 0,
      lastActivity: timestamp,
    };
    const withMessage = appendMessage(chat, {
      id: body.idMessage,
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
    id: body.idMessage,
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

function applyOutgoing(state: ChatState, body: NotificationBody, fromApi: boolean): ChatState {
  const text = extractText(body);
  if (text === null) return state;

  const { chatId, phone } = peerOf(body);
  const timestamp = timestampMs(body);
  const index = findChatIndex(state.chats, chatId, phone);

  if (index === -1) {
    // A message sent from the phone to an unknown peer: create the chat.
    const key = chatId ? chatKeyForChatId(chatId) : chatKeyForPhone(phone ?? body.idMessage);
    const chat: Chat = {
      key,
      chatId,
      phone,
      title: resolveTitle(body, phone, chatId ?? key),
      messages: [],
      unread: 0,
      lastActivity: timestamp,
    };
    const withMessage = appendMessage(chat, {
      id: body.idMessage,
      chatKey: key,
      text,
      timestamp,
      direction: 'outgoing',
      status: fromApi ? 'sent' : 'delivered',
    });
    return { ...state, chats: [withMessage, ...state.chats] };
  }

  const chats = [...state.chats];
  const target = enrichChat(chats[index], chatId, phone);
  chats[index] = appendMessage(target, {
    id: body.idMessage,
    chatKey: target.key,
    text,
    timestamp,
    direction: 'outgoing',
    status: fromApi ? 'sent' : 'delivered',
  });
  return { ...state, chats };
}

function applyStatus(state: ChatState, body: NotificationBody): ChatState {
  const status = body.status;
  if (!status) return state;

  let touched = false;
  const chats = state.chats.map((chat) => {
    if (!chat.messages.some((message) => message.id === body.idMessage)) return chat;
    touched = true;
    return {
      ...chat,
      messages: chat.messages.map((message) =>
        message.id === body.idMessage
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
