import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { AppRoot } from '@telegram-apps/telegram-ui';
import {
  DEFAULT_API_URL,
  GreenApiClient,
  GreenApiError,
  resolveChatByContact,
} from './api/greenApi';
import { formatPhone, normalizePhone, parseRecipient } from './api/phone';
import type { InstanceState, NotificationBody } from './api/types';
import { useNotificationPolling } from './hooks/useNotificationPolling';
import {
  chatReducer,
  initialChatState,
  selectActiveChat,
  selectChatsNeedingIdentity,
  selectSendTarget,
  selectSortedChats,
} from './store/chatStore';
import {
  clearCredentials,
  loadCredentials,
  saveCredentials,
  type StoredCredentials,
} from './store/credentials';
import LoginScreen, { type LoginSubmission } from './components/LoginScreen';
import Sidebar from './components/Sidebar';
import ChatHeader from './components/ChatHeader';
import MessageList from './components/MessageList';
import MessageComposer from './components/MessageComposer';
import NewChatDialog from './components/NewChatDialog';
import ChatPlaceholder from './components/ChatPlaceholder';
import Splash from './components/Splash';
import { IconWarning } from './components/icons';

type ConnectionStatus = 'booting' | 'disconnected' | 'connected';

/**
 * A name from `getContactInfo` that is worth showing.
 *
 * Telegram returns the literal `"."` for a profile without a display name — the
 * live instance this client was verified against does exactly that — so a bare
 * dot has to be treated as "no name at all".
 */
function usableContactName(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed || trimmed === '.' || trimmed === '?') return null;
  return trimmed;
}

function describeError(error: unknown): string {
  if (error instanceof GreenApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Неизвестная ошибка.';
}

/**
 * Validates credentials, and optionally switches the instance to HTTP API mode.
 *
 * The account label is decorative: Telegram Web shows the signed-in account in
 * the top-left corner, and `getAccountSettings` is the only method that returns
 * it. A failure there must not block the session, so it degrades to `null`.
 */
async function establishSession(
  credentials: StoredCredentials,
  configureReceiving: boolean,
): Promise<{ client: GreenApiClient; instanceState: InstanceState; accountLabel: string | null }> {
  const client = new GreenApiClient(credentials);
  const { stateInstance } = await client.getStateInstance();
  if (configureReceiving) await client.enableHttpApiReceiving();

  let accountLabel: string | null = null;
  try {
    const account = await client.getAccountSettings();
    accountLabel = account.username?.trim() || formatPhone(account.phone) || null;
  } catch {
    accountLabel = null;
  }

  return { client, instanceState: stateInstance, accountLabel };
}

function AppShell() {
  const [status, setStatus] = useState<ConnectionStatus>('booting');
  const [session, setSession] = useState<StoredCredentials | null>(null);
  const [prefill, setPrefill] = useState<StoredCredentials | null>(null);
  const [instanceState, setInstanceState] = useState<InstanceState | null>(null);
  const [accountLabel, setAccountLabel] = useState<string | null>(null);
  const [loginPending, setLoginPending] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [pollingEnabled, setPollingEnabled] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  const [chatState, dispatch] = useReducer(chatReducer, initialChatState);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [newChatPending, setNewChatPending] = useState(false);
  const [newChatError, setNewChatError] = useState<string | null>(null);
  const [chatQuery, setChatQuery] = useState('');

  const client = useMemo(() => (session ? new GreenApiClient(session) : null), [session]);

  // Restore a previous session once, on mount.
  //
  // The effect must be safe to run twice: under StrictMode React runs it,
  // immediately cleans it up and runs it again, so the work is re-executed
  // rather than guarded by a ref (a ref guard would leave the second run with
  // nothing to do while the first run has already been cancelled).
  useEffect(() => {
    const saved = loadCredentials();
    if (!saved) {
      setStatus('disconnected');
      return;
    }
    setPrefill(saved);

    let cancelled = false;
    void (async () => {
      try {
        // Do not reconfigure the instance on every page load; just validate.
        const result = await establishSession(saved, false);
        if (cancelled) return;
        setSession(saved);
        setInstanceState(result.instanceState);
        setAccountLabel(result.accountLabel);
        setStatus('connected');
      } catch (error) {
        if (cancelled) return;
        setLoginError(describeError(error));
        setStatus('disconnected');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleLogin = useCallback(async (submission: LoginSubmission) => {
    setLoginPending(true);
    setLoginError(null);
    const credentials: StoredCredentials = {
      apiUrl: submission.apiUrl.trim() || DEFAULT_API_URL,
      idInstance: submission.idInstance.trim(),
      apiTokenInstance: submission.apiTokenInstance.trim(),
    };
    try {
      const result = await establishSession(credentials, submission.configureReceiving);
      if (submission.remember) saveCredentials(credentials);
      else clearCredentials();
      setPrefill(credentials);
      setSession(credentials);
      setInstanceState(result.instanceState);
      setAccountLabel(result.accountLabel);
      setConnectionError(null);
      setPollingEnabled(true);
      setNotice(null);
      setStatus('connected');
    } catch (error) {
      setLoginError(describeError(error));
    } finally {
      setLoginPending(false);
    }
  }, []);

  const handleLogout = useCallback(() => {
    clearCredentials();
    setSession(null);
    setStatus('disconnected');
    setInstanceState(null);
    setAccountLabel(null);
    setConnectionError(null);
    setNotice(null);
    setPollingEnabled(true);
    dispatch({ type: 'state/reset' });
  }, []);

  const handleNotification = useCallback((body: NotificationBody) => {
    // Traffic is flowing again, so any earlier transient error is stale.
    setConnectionError(null);
    dispatch({ type: 'notification/received', body });
  }, []);

  const handlePollingError = useCallback((error: unknown) => {
    setConnectionError(describeError(error));
  }, []);

  const handlePollingFatal = useCallback((error: unknown) => {
    setPollingEnabled(false);
    setConnectionError(describeError(error));
  }, []);

  /** Clears the last polling error and starts the loop again if it was stopped. */
  const retryPolling = useCallback(() => {
    setConnectionError(null);
    setPollingEnabled(true);
  }, []);

  useNotificationPolling({
    client,
    enabled: status === 'connected' && pollingEnabled,
    onNotification: handleNotification,
    onError: handlePollingError,
    onFatal: handlePollingFatal,
  });

  const activeChat = selectActiveChat(chatState);
  const sortedChats = selectSortedChats(chatState);
  const unidentifiedChats = selectChatsNeedingIdentity(chatState);

  /*
   * Names the peers that arrived through a notification.
   *
   * An outgoing notification names the *account*, not the chat, so the chat has
   * to be created as "Чат <id>" and then looked up. One call per chat, tracked
   * in a ref: the effect re-runs on every state change, and without the guard a
   * failed lookup would retry on every incoming message.
   */
  const identityLookup = useRef(new Set<string>());

  useEffect(() => {
    if (!client) return;

    for (const chat of unidentifiedChats) {
      if (identityLookup.current.has(chat.key)) continue;
      identityLookup.current.add(chat.key);
      const chatKey = chat.key;
      const chatId = chat.chatId;

      if (chatId === null) continue;
      void (async () => {
        try {
          const info = await client.getContactInfo(chatId);
          const name = usableContactName(info.name) ?? usableContactName(info.contactName);
          const username = info.username?.trim() ? info.username.trim() : null;
          const phone = normalizePhone(String(info.phoneNumber ?? ''));

          dispatch({
            type: 'chat/identify',
            chatKey,
            // A peer with no display name is far better recognised by the handle
            // Telegram knows than by the synthetic "Чат <id>".
            title: name ?? username ?? (phone ? formatPhone(phone) : null),
            phone,
          });
        } catch {
          // A failed lookup only costs the name: the chat keeps its "Чат <id>"
          // title and the message itself is already on screen.
          dispatch({ type: 'chat/identify', chatKey, title: null, phone: null });
        }
      })();
    }
  }, [client, unidentifiedChats]);

  const handleSend = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!client || !activeChat || !trimmed) return;

      const target = selectSendTarget(activeChat);
      if (!target) return;

      const localId = `local:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
      dispatch({
        type: 'message/queue',
        chatKey: activeChat.key,
        localId,
        text: trimmed,
        timestamp: Date.now(),
      });

      try {
        const { idMessage } = await client.sendMessage(target, trimmed);
        dispatch({ type: 'message/sent', chatKey: activeChat.key, localId, idMessage });
      } catch (error) {
        dispatch({
          type: 'message/failed',
          chatKey: activeChat.key,
          localId,
          error: describeError(error),
        });
      }
    },
    [client, activeChat],
  );

  const handleCreateChat = useCallback(
    async (rawContact: string) => {
      if (!client) return;
      const contact = parseRecipient(rawContact);
      if (!contact) {
        setNewChatError('Введите номер +7 999 123-45-67 или @username.');
        return;
      }

      // The title is the phone as the user will recognise it, or the handle
      // itself; the reducer replaces it with the peer's name once a notification
      // reveals one.
      const title = contact.kind === 'phone' ? formatPhone(contact.value) : contact.value;
      const sentAs =
        contact.kind === 'username' ? `имени пользователя ${contact.value}` : 'номеру телефона';

      setNewChatPending(true);
      setNewChatError(null);
      try {
        const resolved = await resolveChatByContact(client, contact);
        const resolvedChatId = resolved.source === 'checkAccount' ? resolved.chatId : null;

        // Reuse an existing chat for this peer if one already exists.
        dispatch({
          type: 'chat/create',
          chatId: resolvedChatId,
          phone: contact.kind === 'phone' ? contact.value : null,
          title,
        });
        setNewChatOpen(false);

        if (resolved.exists === false) {
          setNotice(`Telegram не подтвердил аккаунт ${title} — сообщение может не дойти.`);
        } else if (resolved.exists === null) {
          setNotice(
            resolved.reason
              ? `Не удалось проверить получателя: ${resolved.reason} Отправка пойдёт по ${sentAs} — ответ может не связаться с этим чатом.`
              : `Не удалось проверить получателя (checkAccount). Отправка пойдёт по ${sentAs} — ответ может не связаться с этим чатом.`,
          );
        } else {
          setNotice(null);
        }
      } catch (error) {
        setNewChatError(describeError(error));
      } finally {
        setNewChatPending(false);
      }
    },
    [client],
  );

  const openNewChat = useCallback(() => {
    setNewChatError(null);
    setNewChatOpen(true);
  }, []);

  const closeNewChat = useCallback(() => setNewChatOpen(false), []);

  const instanceWarning =
    session && instanceState && instanceState !== 'authorized'
      ? `Состояние инстанса: ${instanceState}. Авторизуйте инстанс в личном кабинете GREEN-API.`
      : null;

  // `suspended` still allows sending to saved contacts, so only block the states
  // where Telegram will refuse every outgoing message.
  const cannotSend =
    instanceState === 'notAuthorized' ||
    instanceState === 'blocked' ||
    instanceState === 'pendingPassword';

  function renderBody() {
    if (status === 'booting') {
      return <Splash />;
    }

    if (!session || status === 'disconnected') {
      return (
        <LoginScreen
          initial={prefill}
          pending={loginPending}
          error={loginError}
          onSubmit={handleLogin}
        />
      );
    }

    return (
      <div className="app">
        <Sidebar
          chats={sortedChats}
          activeChatKey={chatState.activeChatKey}
          instanceLabel={`Инстанс ${session.idInstance}`}
          accountLabel={accountLabel}
          polling={pollingEnabled}
          onSelect={(key) => dispatch({ type: 'chat/select', chatKey: key })}
          onNewChat={openNewChat}
          onLogout={handleLogout}
        />

        <main className="chat">
          {/* Banners live outside the chat branch: a polling failure must be
              visible and recoverable even before any chat exists. */}
          {instanceWarning && (
            <div className="banner banner--warn">
              <IconWarning className="banner__icon" width={18} height={18} />
              <span>{instanceWarning}</span>
            </div>
          )}
          {connectionError && (
            <div className="banner banner--error">
              <IconWarning className="banner__icon" width={18} height={18} />
              <span>{connectionError}</span>
              <button
                type="button"
                className="banner__action"
                aria-label={pollingEnabled ? 'Скрыть' : 'Повторить'}
                onClick={retryPolling}
              >
                {pollingEnabled ? 'Скрыть' : 'Повторить'}
              </button>
            </div>
          )}
          {notice && <div className="banner banner--info">{notice}</div>}

          {activeChat ? (
            <div className="chat__body">
              <ChatHeader
                chat={activeChat}
                query={chatQuery}
                onQueryChange={setChatQuery}
              />
              <MessageList chat={activeChat} query={chatQuery} />
              <MessageComposer onSend={handleSend} disabled={cannotSend} />
            </div>
          ) : (
            <ChatPlaceholder onNewChat={openNewChat} />
          )}
        </main>

        <NewChatDialog
          open={newChatOpen}
          pending={newChatPending}
          error={newChatError}
          onSubmit={handleCreateChat}
          onClose={closeNewChat}
        />
      </div>
    );
  }

  // `AppRoot` above is the shell element the layout grid hangs off, so the body
  // is returned as-is rather than wrapped in another full-height container.
  return renderBody();
}

/**
 * `AppRoot` is mandatory, not decorative: it declares the `--tgui--*` theme
 * variables and provides the portal container the kit's `Modal` renders into.
 * Without it every kit component paints unstyled.
 *
 * `appearance` is deliberately left undefined so the kit follows the OS, exactly
 * like our own CSS, which switches themes on the `prefers-color-scheme` media
 * query. That is also why no `data-color-scheme` attribute is needed here: the
 * media query is the single source of truth.
 */
export default function App() {
  return (
    <AppRoot className="tgui-root app-root">
      <AppShell />
    </AppRoot>
  );
}
