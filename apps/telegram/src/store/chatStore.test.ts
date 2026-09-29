import { describe, expect, it } from 'vitest';
import type { NotificationBody } from '../api/types';
import {
  chatReducer,
  extractText,
  initialChatState,
  selectActiveChat,
  selectChatsNeedingIdentity,
  selectSendTarget,
  selectSortedChats,
  type ChatState,
} from './chatStore';

const PEER_CHAT_ID = '10000000';
const PEER_PHONE = '79991234567';

function notification(overrides: Partial<NotificationBody> = {}): NotificationBody {
  return {
    typeWebhook: 'incomingMessageReceived',
    instanceData: { idInstance: 4100000000, wid: `${PEER_PHONE}@c.us`, typeInstance: 'telegram' },
    timestamp: 1763115112,
    idMessage: 'msg-1',
    senderData: {
      chatId: PEER_CHAT_ID,
      chatType: 'user',
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

/** A chat whose Telegram chatId is already known, as after `checkAccount`. */
function createResolved(): ChatState {
  return chatReducer(initialChatState, {
    type: 'chat/create',
    chatId: PEER_CHAT_ID,
    phone: PEER_PHONE,
    title: 'Иван Петров',
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

/** Creates a chat with one outgoing message that already has its server id. */
function createWithSentMessage(chatId: string, title: string): ChatState {
  const created = chatReducer(initialChatState, {
    type: 'chat/create',
    chatId,
    phone: null,
    title,
  });
  return sendAndConfirm(created, `local:${chatId}`, 'dup-1');
}

describe('extractText', () => {
  it('reads plain text messages', () => {
    expect(extractText(notification())).toBe('Привет!');
  });

  it('returns null for empty text', () => {
    expect(
      extractText(
        notification({
          messageData: { typeMessage: 'textMessage', textMessageData: { textMessage: '' } },
        }),
      ),
    ).toBeNull();
  });

  it('returns null for message kinds outside the scope of this app', () => {
    expect(extractText(notification({ messageData: { typeMessage: 'imageMessage' } }))).toBeNull();
    expect(extractText(notification({ messageData: { typeMessage: 'pollMessage' } }))).toBeNull();
    expect(extractText(notification({ messageData: undefined }))).toBeNull();
  });
});

describe('chat creation', () => {
  it('creates a chat for a phone number and selects it', () => {
    const state = createByPhone();

    expect(state.chats).toHaveLength(1);
    expect(state.chats[0]).toMatchObject({
      chatId: null,
      phone: PEER_PHONE,
      title: '+7 999 123-45-67',
    });
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

  it('ignores selecting a chat that does not exist', () => {
    const state = receive(initialChatState, notification());
    expect(chatReducer(state, { type: 'chat/select', chatKey: 'id:nope' })).toBe(state);
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

  it('ignores a message notification without an idMessage', () => {
    const state = receive(initialChatState, notification({ idMessage: undefined }));
    expect(state).toBe(initialChatState);
  });

  it('ignores service notifications and unknown webhook types', () => {
    expect(receive(initialChatState, notification({ typeWebhook: 'stateInstanceChanged' }))).toBe(
      initialChatState,
    );
    expect(receive(initialChatState, notification({ typeWebhook: 'quotaExceeded' }))).toBe(
      initialChatState,
    );
    expect(receive(initialChatState, notification({ typeWebhook: 'somethingElse' }))).toBe(
      initialChatState,
    );
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
          chatId: '-10000000000001',
          chatName: 'Группа A',
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
          chatId: '-10000000000002',
          chatName: 'Группа B',
          senderName: 'Группа B',
          senderPhoneNumber: 0,
        },
      }),
    );

    expect(groupB.chats).toHaveLength(2);
    expect(groupB.chats[0].key).toBe('id:-10000000000002');
    expect(groupB.chats[0].messages[0].text).toBe('Привет!');
  });

  it('tolerates a senderData without sender, chatName and senderPhoneNumber', () => {
    const state = receive(
      initialChatState,
      notification({ senderData: { chatId: '500' } }),
    );

    // No usable name anywhere: the chat is listed as "Чат 500" and flagged for a
    // `getContactInfo` lookup, rather than showing a bare id.
    expect(state.chats[0]).toMatchObject({
      chatId: '500',
      phone: null,
      title: 'Чат 500',
      needsIdentity: true,
    });
  });

  it('prefers the contact name over the chat name for the title', () => {
    const state = receive(
      initialChatState,
      notification({
        senderData: {
          chatId: PEER_CHAT_ID,
          chatName: 'Чат',
          senderName: 'Иван',
          senderContactName: 'Иван Петров (контакт)',
          senderPhoneNumber: 0,
        },
      }),
    );

    expect(state.chats[0].title).toBe('Иван Петров (контакт)');
  });

  it('falls back to now when the notification timestamp is unusable', () => {
    const before = Date.now();
    const state = receive(initialChatState, notification({ timestamp: Number.NaN }));

    const [message] = state.chats[0].messages;
    expect(Number.isFinite(message.timestamp)).toBe(true);
    expect(message.timestamp).toBeGreaterThanOrEqual(before);
  });

  it('converts the UNIX seconds timestamp into milliseconds', () => {
    const state = receive(initialChatState, notification({ timestamp: 2000 }));
    expect(state.chats[0].messages[0].timestamp).toBe(2_000_000);
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
    // A resolved chat, as the app really has it: `resolveChatByContact` fills in
    // the chatId before any message can be sent. An outgoing notification has no
    // peer phone to fall back on, so a phone-only chat could not be matched.
    const created = createResolved();
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
      sendAndConfirm(createResolved(), 'local:1', 'srv-1'),
      notification({
        typeWebhook: 'outgoingMessageStatus',
        chatId: PEER_CHAT_ID,
        idMessage: 'srv-1',
        status: 'read',
      }),
    );

    expect(state.chats[0].messages[0].status).toBe('read');
  });

  it('records the reason for a failed delivery receipt', () => {
    const state = receive(
      sendAndConfirm(createResolved(), 'local:1', 'srv-1'),
      notification({
        typeWebhook: 'outgoingMessageStatus',
        chatId: PEER_CHAT_ID,
        idMessage: 'srv-1',
        status: 'failed',
        description: 'chatId unresolvable on this session',
      }),
    );

    expect(state.chats[0].messages[0]).toMatchObject({
      status: 'failed',
      error: 'chatId unresolvable on this session',
    });
  });

  it('provides a Russian default for a noAccount receipt without a description', () => {
    const state = receive(
      sendAndConfirm(createResolved(), 'local:1', 'srv-1'),
      notification({
        typeWebhook: 'outgoingMessageStatus',
        chatId: PEER_CHAT_ID,
        idMessage: 'srv-1',
        status: 'noAccount',
        description: undefined,
      }),
    );

    expect(state.chats[0].messages[0]).toMatchObject({
      status: 'noAccount',
      error: 'На этом номере нет аккаунта Telegram.',
    });
  });

  it('adds a message sent from another client as outgoing with status sent', () => {
    const state = receive(
      createByPhone(),
      notification({ typeWebhook: 'outgoingMessageReceived', idMessage: 'phone-1' }),
    );

    expect(state.chats[0].messages[0]).toMatchObject({
      id: 'phone-1',
      direction: 'outgoing',
      status: 'sent',
    });
  });

  it('creates a chat for an outgoing message to an unknown peer', () => {
    const state = receive(
      initialChatState,
      notification({
        typeWebhook: 'outgoingAPIMessageReceived',
        idMessage: 'api-1',
        senderData: {
          chatId: '-10000000000003',
          chatName: 'Группа C',
          senderPhoneNumber: 0,
        },
      }),
    );

    expect(state.chats).toHaveLength(1);
    expect(state.chats[0]).toMatchObject({ chatId: '-10000000000003', unread: 0 });
    expect(state.chats[0].title).toBe('Группа C');
  });
});

describe('outgoing message status scoping', () => {
  it('ignores a status without idMessage', () => {
    const state = sendAndConfirm(createByPhone(), 'local:1', 'srv-1');

    const after = receive(
      state,
      notification({
        typeWebhook: 'outgoingMessageStatus',
        idMessage: undefined,
        status: 'failed',
      }),
    );

    expect(after).toBe(state);
  });

  it('ignores a status without a status value', () => {
    const state = sendAndConfirm(createByPhone(), 'local:1', 'srv-1');
    const after = receive(
      state,
      notification({ typeWebhook: 'outgoingMessageStatus', status: undefined }),
    );
    expect(after).toBe(state);
  });

  it('ignores a status for a chat we do not know', () => {
    const state = receive(initialChatState, notification());
    const after = receive(
      state,
      notification({
        typeWebhook: 'outgoingMessageStatus',
        chatId: '999',
        idMessage: 'msg-1',
        status: 'read',
      }),
    );

    expect(after).toBe(state);
  });

  it('applies the status only inside the chat the notification names', () => {
    // Telegram `idMessage` is unique per chat, so two chats can legitimately
    // contain a message with the same id.
    const withA = createWithSentMessage('chat-a', 'Чат A');
    const withBoth = chatReducer(withA, { type: 'chat/create', chatId: 'chat-b', phone: null, title: 'Чат B' });
    const key = 'id:chat-b';
    const queued = chatReducer(withBoth, {
      type: 'message/queue',
      chatKey: key,
      localId: 'local:chat-b',
      text: 'Привет',
      timestamp: 1000,
    });
    const state = chatReducer(queued, {
      type: 'message/sent',
      chatKey: key,
      localId: 'local:chat-b',
      idMessage: 'dup-1',
    });

    const after = receive(
      state,
      notification({
        typeWebhook: 'outgoingMessageStatus',
        chatId: 'chat-b',
        idMessage: 'dup-1',
        status: 'read',
      }),
    );

    const chatA = after.chats.find((chat) => chat.key === 'id:chat-a');
    const chatB = after.chats.find((chat) => chat.key === 'id:chat-b');
    expect(chatA?.messages[0].status).toBe('sent');
    expect(chatB?.messages[0].status).toBe('read');
  });

  it('matches a legacy phone@c.us status chatId to a chat known by phone', () => {
    // The documented `noAccount` example reports the peer as `77777777777@c.us`.
    const created = chatReducer(initialChatState, {
      type: 'chat/create',
      chatId: null,
      phone: '77777777777',
      title: '+7 777 777-77-77',
    });
    const state = sendAndConfirm(created, 'local:1', 'srv-1');

    const after = receive(
      state,
      notification({
        typeWebhook: 'outgoingMessageStatus',
        chatId: '77777777777@c.us',
        senderData: undefined,
        idMessage: 'srv-1',
        status: 'noAccount',
        description: undefined,
      }),
    );

    expect(after.chats[0].messages[0]).toMatchObject({
      status: 'noAccount',
      error: 'На этом номере нет аккаунта Telegram.',
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

  it('returns null for a chat with neither chatId nor phone', () => {
    const state = receive(
      initialChatState,
      notification({ senderData: { chatId: '-10000000000001', senderPhoneNumber: 0 } }),
    );

    expect(state.chats[0].chatId).toBe('-10000000000001');
    // A group chat still has a chatId, so it stays sendable.
    expect(selectSendTarget(state.chats[0])).toBe('-10000000000001');
    expect(selectSendTarget({ ...state.chats[0], chatId: null })).toBeNull();
  });
});

describe('state/reset', () => {
  it('returns to the initial state on logout', () => {
    const state = receive(initialChatState, notification());
    expect(chatReducer(state, { type: 'state/reset' })).toEqual(initialChatState);
  });
});

/*
 * Regression tests built from notifications captured on a real GREEN-API
 * Telegram instance (`apiUrl` cluster 4100), not from the documentation.
 *
 * They exist because the two webhook families do NOT describe `senderData` the
 * same way, and reading the docs suggested they did. On an outgoing message
 * `senderData` is the *sending account*: its `senderName`, `senderContactName`
 * and `senderPhoneNumber` all belong to the operator, while the peer is only
 * `chatId`. Treating it as the peer produced a chat list titled after the
 * operator and a message sent to Saved Messages landing in somebody else's chat.
 */

/** Real `outgoingAPIMessageReceived`: a message the account sent to @peer_demo. */
const LIVE_OUTGOING_TO_PEER: NotificationBody = {
  typeWebhook: 'outgoingAPIMessageReceived',
  instanceData: { idInstance: 4100000001, wid: '79001234567@c.us', typeInstance: 'telegram' },
  timestamp: 1790000000,
  idMessage: 'live-out-1',
  senderData: {
    chatId: '6900000001',
    chatType: 'user',
    sender: '305000000',
    chatName: '.',
    senderName: 'Владелец',
    senderType: 'user',
    senderContactName: 'Владелец',
    senderPhoneNumber: 79001234567,
  },
  messageData: {
    typeMessage: 'textMessage',
    textMessageData: { textMessage: 'ffff', forwardingScore: 0, isForwarded: false },
  },
};

/** Real `outgoingAPIMessageReceived`: the same account writing to its own notes. */
const LIVE_OUTGOING_TO_SELF: NotificationBody = {
  typeWebhook: 'outgoingAPIMessageReceived',
  instanceData: { idInstance: 4100000001, wid: '79001234567@c.us', typeInstance: 'telegram' },
  timestamp: 1790000001,
  idMessage: '1790000001200',
  senderData: {
    chatId: '305000000',
    chatType: 'user',
    sender: '305000000',
    chatName: 'Владелец',
    senderName: 'Владелец',
    senderType: 'user',
    senderContactName: 'Владелец',
    senderPhoneNumber: 79001234567,
  },
  messageData: {
    typeMessage: 'textMessage',
    textMessageData: { textMessage: 'Проверка самозаписи 2', isForwarded: false },
  },
};

describe('live payloads from a real instance', () => {
  it('never borrows the account\'s own name or phone for an outgoing chat', () => {
    const state = receive(initialChatState, LIVE_OUTGOING_TO_PEER);
    const chat = state.chats[0];

    // The peer is the chatId; the name and the phone belong to the operator.
    expect(chat.chatId).toBe('6900000001');
    expect(chat.phone).toBeNull();
    // `"."` is the literal profile name, not a name — the chat stays unresolved
    // and asks the app for a `getContactInfo` lookup.
    expect(chat.title).toBe('Чат 6900000001');
    expect(chat.title).not.toContain('Владелец');
    expect(chat.needsIdentity).toBe(true);
  });

  it('names a message to the account\'s own notes chat "Избранное"', () => {
    const state = receive(initialChatState, LIVE_OUTGOING_TO_SELF);
    const chat = state.chats[0];

    expect(chat.chatId).toBe('305000000');
    expect(chat.title).toBe('Избранное');
    // The account already knows who it is; no lookup needed.
    expect(chat.needsIdentity).toBe(false);
  });

  it('applies what getContactInfo reported', () => {
    const unresolved = receive(initialChatState, LIVE_OUTGOING_TO_PEER);
    const identified = chatReducer(unresolved, {
      type: 'chat/identify',
      chatKey: unresolved.chats[0].key,
      // Live `getContactInfo` answer: the profile name is ".", the handle is real.
      title: '@peer_demo',
      phone: '79005556677',
    });

    expect(identified.chats[0]).toMatchObject({
      title: '@peer_demo',
      phone: '79005556677',
      needsIdentity: false,
    });
  });

  it('keeps a message to Saved Messages out of an unrelated chat', () => {
    // The exact chain that mixed two chats: an outgoing peer message creates a
    // chat that used to carry the operator's phone, and the notes message then
    // matched it by that phone.
    let state = receive(initialChatState, LIVE_OUTGOING_TO_PEER);
    state = chatReducer(state, {
      type: 'chat/identify',
      chatKey: state.chats[0].key,
      title: '@peer_demo',
      phone: '79005556677',
    });
    state = receive(state, LIVE_OUTGOING_TO_SELF);

    expect(state.chats).toHaveLength(2);
    const notes = state.chats.find((chat) => chat.chatId === '305000000');
    const peer = state.chats.find((chat) => chat.chatId === '6900000001');
    expect(notes?.messages.map((message) => message.text)).toEqual(['Проверка самозаписи 2']);
    expect(peer?.messages.map((message) => message.text)).toEqual(['ffff']);
  });

  it('lists the chats that still need an identity lookup', () => {
    const state = receive(initialChatState, LIVE_OUTGOING_TO_PEER);
    expect(selectChatsNeedingIdentity(state).map((chat) => chat.chatId)).toEqual(['6900000001']);

    const afterSelf = receive(state, LIVE_OUTGOING_TO_SELF);
    expect(selectChatsNeedingIdentity(afterSelf).map((chat) => chat.chatId)).toEqual(['6900000001']);
  });
});
