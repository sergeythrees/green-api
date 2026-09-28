import { describe, expect, it } from 'vitest';
import type { NotificationBody } from '../api/types';
import {
  chatReducer,
  extractText,
  initialChatState,
  selectActiveChat,
  selectSendTarget,
  selectSortedChats,
  type ChatState,
} from './chatStore';

const PEER_CHAT_ID = '10000000';
const PEER_PHONE = '79991234567';

function notification(overrides: Partial<NotificationBody> = {}): NotificationBody {
  return {
    typeWebhook: 'incomingMessageReceived',
    instanceData: { idInstance: 3100000001, wid: `${PEER_PHONE}@c.us`, typeInstance: 'v3' },
    timestamp: 1763115112,
    idMessage: 'msg-1',
    senderData: {
      chatId: PEER_CHAT_ID,
      chatName: 'Иван Петров',
      sender: PEER_CHAT_ID,
      senderName: 'Иван Петров',
      senderPhoneNumber: Number(PEER_PHONE),
    },
    messageData: { typeMessage: 'textMessage', textMessageData: { textMessage: 'Привет!' } },
    ...overrides,
  };
}

function receive(state: ChatState, body: NotificationBody): ChatState {
  return chatReducer(state, { type: 'notification/received', body });
}

function createByPhone(): ChatState {
  return chatReducer(initialChatState, {
    type: 'chat/create',
    chatId: null,
    phone: PEER_PHONE,
    title: '+7 999 123-45-67',
  });
}

function sendAndConfirm(state: ChatState, localId: string, idMessage: string): ChatState {
  const key = state.chats[0].key;
  const queued = chatReducer(state, {
    type: 'message/queue',
    chatKey: key,
    localId,
    text: 'Привет',
    timestamp: 1000,
  });
  return chatReducer(queued, { type: 'message/sent', chatKey: key, localId, idMessage });
}

describe('extractText', () => {
  it('reads plain text messages', () => {
    expect(extractText(notification())).toBe('Привет!');
  });

  it('reads link messages delivered as extendedTextMessage', () => {
    expect(
      extractText(
        notification({
          messageData: {
            typeMessage: 'extendedTextMessage',
            extendedTextMessageData: { text: 'https://green-api.com' },
          },
        }),
      ),
    ).toBe('https://green-api.com');
  });

  it('returns null for message kinds outside the scope of this app', () => {
    expect(extractText(notification({ messageData: { typeMessage: 'imageMessage' } }))).toBeNull();
    expect(extractText(notification({ messageData: undefined }))).toBeNull();
  });
});

describe('chat creation', () => {
  it('creates a chat for a phone number and selects it', () => {
    const state = createByPhone();

    expect(state.chats).toHaveLength(1);
    expect(state.chats[0]).toMatchObject({ chatId: null, phone: PEER_PHONE, title: '+7 999 123-45-67' });
    expect(selectActiveChat(state)?.key).toBe(`phone:${PEER_PHONE}`);
  });

  it('matches an incoming reply to a chat created by phone number', () => {
    const state = receive(createByPhone(), notification());

    expect(state.chats).toHaveLength(1);
    expect(state.chats[0].chatId).toBe(PEER_CHAT_ID);
    expect(state.chats[0].phone).toBe(PEER_PHONE);
    expect(state.chats[0].title).toBe('Иван Петров');
    expect(state.chats[0].messages[0]).toMatchObject({
      direction: 'incoming',
      text: 'Привет!',
      id: 'msg-1',
    });
    // The chat is open, so nothing is unread.
    expect(state.chats[0].unread).toBe(0);
  });

  it('reuses an existing chat when the same chatId is created again', () => {
    const withIncoming = receive(initialChatState, notification());
    const state = chatReducer(withIncoming, {
      type: 'chat/create',
      chatId: PEER_CHAT_ID,
      phone: PEER_PHONE,
    });

    expect(state.chats).toHaveLength(1);
    expect(selectActiveChat(state)?.key).toBe(`id:${PEER_CHAT_ID}`);
  });

  it('does not duplicate a phone chat when the chatId becomes known', () => {
    const state = chatReducer(createByPhone(), {
      type: 'chat/create',
      chatId: PEER_CHAT_ID,
      phone: PEER_PHONE,
    });

    expect(state.chats).toHaveLength(1);
    expect(state.chats[0].chatId).toBe(PEER_CHAT_ID);
  });

  it('clears the unread counter when a chat is selected', () => {
    const withUnread = receive(initialChatState, notification());
    expect(withUnread.chats[0].unread).toBe(1);

    const selected = chatReducer(withUnread, {
      type: 'chat/select',
      chatKey: withUnread.chats[0].key,
    });

    expect(selected.chats[0].unread).toBe(0);
    expect(selectActiveChat(selected)?.key).toBe(`id:${PEER_CHAT_ID}`);
  });
});

describe('incoming messages', () => {
  it('creates a new unread chat for a message from an unknown peer', () => {
    const state = receive(initialChatState, notification());

    expect(state.chats).toHaveLength(1);
    expect(state.chats[0]).toMatchObject({ key: `id:${PEER_CHAT_ID}`, unread: 1 });
    expect(state.chats[0].title).toBe('Иван Петров');
    expect(selectActiveChat(state)).toBeNull();
  });

  it('ignores a redelivered notification', () => {
    const state = receive(receive(initialChatState, notification()), notification());

    expect(state.chats[0].messages).toHaveLength(1);
    expect(state.chats[0].unread).toBe(1);
  });

  it('ignores notifications that carry no text', () => {
    const state = receive(
      initialChatState,
      notification({ messageData: { typeMessage: 'imageMessage' } }),
    );

    expect(state).toBe(initialChatState);
  });

  it('ignores service notifications', () => {
    const state = receive(initialChatState, notification({ typeWebhook: 'stateInstanceChanged' }));
    expect(state).toBe(initialChatState);
  });

  it('does not treat the senderPhoneNumber 0 sentinel as a real phone number', () => {
    // `0` is the documented "number hidden / group chat" sentinel. If it were
    // kept as a phone, a message from an unrelated chat would be appended to
    // whichever chat happened to be stored first.
    const groupA = receive(
      initialChatState,
      notification({
        idMessage: 'g1',
        senderData: {
          chatId: '-6980000000001',
          sender: '-6980000000001',
          senderName: 'Группа A',
          senderPhoneNumber: 0,
        },
      }),
    );
    expect(groupA.chats[0].phone).toBeNull();
    expect(groupA.chats[0].title).toBe('Группа A');

    const groupB = receive(
      groupA,
      notification({
        idMessage: 'g2',
        senderData: {
          chatId: '-6970000000002',
          sender: '-6970000000002',
          senderName: 'Группа B',
          senderPhoneNumber: 0,
        },
      }),
    );

    expect(groupB.chats).toHaveLength(2);
    expect(groupB.chats[0].key).toBe('id:-6970000000002');
    expect(groupB.chats[0].messages[0].text).toBe('Привет!');
  });

  it('falls back to now when the notification timestamp is unusable', () => {
    const before = Date.now();
    const state = receive(initialChatState, notification({ timestamp: Number.NaN }));

    const [message] = state.chats[0].messages;
    expect(Number.isFinite(message.timestamp)).toBe(true);
    expect(message.timestamp).toBeGreaterThanOrEqual(before);
  });

  it('sorts chats by most recent activity', () => {
    const first = receive(initialChatState, notification({ timestamp: 2000 }));
    const second = receive(
      first,
      notification({
        idMessage: 'msg-2',
        timestamp: 3000,
        senderData: {
          chatId: '999',
          sender: '999',
          senderName: 'Пётр Сидоров',
          senderPhoneNumber: 79001112233,
        },
      }),
    );

    expect(selectSortedChats(second).map((chat) => chat.title)).toEqual([
      'Пётр Сидоров',
      'Иван Петров',
    ]);
  });
});

describe('outgoing messages', () => {
  it('queues optimistically and then adopts the server idMessage', () => {
    const state = sendAndConfirm(createByPhone(), 'local:1', 'srv-1');

    expect(state.chats[0].messages).toHaveLength(1);
    expect(state.chats[0].messages[0]).toMatchObject({
      id: 'srv-1',
      status: 'sent',
      direction: 'outgoing',
      text: 'Привет',
    });
  });

  it('marks a queued message as sending before the response arrives', () => {
    const created = createByPhone();
    const state = chatReducer(created, {
      type: 'message/queue',
      chatKey: created.chats[0].key,
      localId: 'local:1',
      text: 'Привет',
      timestamp: 1000,
    });

    expect(state.chats[0].messages[0].status).toBe('sending');
  });

  it('does not duplicate when the API notification beats the send response', () => {
    const created = createByPhone();
    const key = created.chats[0].key;
    const queued = chatReducer(created, {
      type: 'message/queue',
      chatKey: key,
      localId: 'local:1',
      text: 'Привет',
      timestamp: 1000,
    });

    const echoed = receive(
      queued,
      notification({ typeWebhook: 'outgoingAPIMessageReceived', idMessage: 'srv-1' }),
    );
    expect(echoed.chats[0].messages).toHaveLength(2);

    const confirmed = chatReducer(echoed, {
      type: 'message/sent',
      chatKey: key,
      localId: 'local:1',
      idMessage: 'srv-1',
    });

    expect(confirmed.chats[0].messages).toHaveLength(1);
    expect(confirmed.chats[0].messages[0].id).toBe('srv-1');
  });

  it('records the failure reason when the send request fails', () => {
    const created = createByPhone();
    const key = created.chats[0].key;
    const queued = chatReducer(created, {
      type: 'message/queue',
      chatKey: key,
      localId: 'local:1',
      text: 'Привет',
      timestamp: 1000,
    });
    const failed = chatReducer(queued, {
      type: 'message/failed',
      chatKey: key,
      localId: 'local:1',
      error: 'Нет связи с GREEN-API',
    });

    expect(failed.chats[0].messages[0]).toMatchObject({
      status: 'failed',
      error: 'Нет связи с GREEN-API',
    });
  });

  it('applies a read receipt to the outgoing message', () => {
    const state = receive(
      sendAndConfirm(createByPhone(), 'local:1', 'srv-1'),
      notification({ typeWebhook: 'outgoingMessageStatus', idMessage: 'srv-1', status: 'read' }),
    );

    expect(state.chats[0].messages[0].status).toBe('read');
  });

  it('records the reason for a failed delivery receipt', () => {
    const state = receive(
      sendAndConfirm(createByPhone(), 'local:1', 'srv-1'),
      notification({
        typeWebhook: 'outgoingMessageStatus',
        idMessage: 'srv-1',
        status: 'noAccount',
        description: 'На номере нет MAX',
      }),
    );

    expect(state.chats[0].messages[0]).toMatchObject({
      status: 'noAccount',
      error: 'На номере нет MAX',
    });
  });

  it('adds a message sent from the phone as outgoing', () => {
    const state = receive(
      createByPhone(),
      notification({ typeWebhook: 'outgoingMessageReceived', idMessage: 'phone-1' }),
    );

    expect(state.chats[0].messages[0]).toMatchObject({
      id: 'phone-1',
      direction: 'outgoing',
      status: 'delivered',
    });
  });
});

describe('selectSendTarget', () => {
  it('prefers the resolved chatId and falls back to the phone form', () => {
    const byPhone = createByPhone();
    expect(selectSendTarget(byPhone.chats[0])).toBe('79991234567@c.us');

    const resolved = chatReducer(byPhone, {
      type: 'chat/create',
      chatId: PEER_CHAT_ID,
      phone: PEER_PHONE,
    });
    expect(selectSendTarget(resolved.chats[0])).toBe(PEER_CHAT_ID);
  });
});

describe('state/reset', () => {
  it('returns to the initial state on logout', () => {
    const state = receive(initialChatState, notification());
    expect(chatReducer(state, { type: 'state/reset' })).toEqual(initialChatState);
  });
});
