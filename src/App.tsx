import { useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import { DEFAULT_API_URL, GreenApiClient, GreenApiError, resolveChatByPhone } from './api/greenApi';
import { formatPhone, normalizePhone } from './api/phone';
import type { InstanceState, NotificationBody } from './api/types';
import { useNotificationPolling } from './hooks/useNotificationPolling';
import {
  chatReducer,
  initialChatState,
  selectActiveChat,
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
import './styles/app.css';

type ConnectionStatus = 'booting' | 'disconnected' | 'connected';

function describeError(error: unknown): string {
  if (error instanceof GreenApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Неизвестная ошибка.';
}

/** Validates credentials, and optionally switches the instance to HTTP API mode. */
async function establishSession(
  credentials: StoredCredentials,
  configureReceiving: boolean,
): Promise<{ client: GreenApiClient; instanceState: InstanceState }> {
  const client = new GreenApiClient(credentials);
  const { stateInstance } = await client.getStateInstance();
  if (configureReceiving) await client.enableHttpApiReceiving();
  return { client, instanceState: stateInstance };
}

export default function App() {
  const [status, setStatus] = useState<ConnectionStatus>('booting');
  const [session, setSession] = useState<StoredCredentials | null>(null);
  const [prefill, setPrefill] = useState<StoredCredentials | null>(null);
  const [instanceState, setInstanceState] = useState<InstanceState | null>(null);
  const [loginPending, setLoginPending] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [pollingEnabled, setPollingEnabled] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  const [chatState, dispatch] = useReducer(chatReducer, initialChatState);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [newChatPending, setNewChatPending] = useState(false);
  const [newChatError, setNewChatError] = useState<string | null>(null);

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
    async (rawPhone: string) => {
      if (!client) return;
      const phone = normalizePhone(rawPhone);
      if (!phone) {
        setNewChatError('Введите номер в формате +7 999 123-45-67 или +375 29 123-45-67.');
        return;
      }

      setNewChatPending(true);
      setNewChatError(null);
      try {
        const resolved = await resolveChatByPhone(client, phone);
        const resolvedChatId = resolved.source === 'checkAccount' ? resolved.chatId : null;

        // Reuse an existing chat for this peer if one already exists.
        dispatch({
          type: 'chat/create',
          chatId: resolvedChatId,
          phone,
          title: formatPhone(phone),
        });
        setNewChatOpen(false);

        if (resolved.exists === false) {
          setNotice(
            `MAX не подтвердил аккаунт на номере ${formatPhone(phone)} — сообщение может не дойти.`,
          );
        } else if (resolved.exists === null) {
          setNotice(
            resolved.reason
              ? `Не удалось проверить номер: ${resolved.reason} Отправка пойдёт по номеру телефона — ответ может не связаться с этим чатом.`
              : 'Не удалось проверить номер (checkAccount). Отправка пойдёт по номеру телефона — ответ может не связаться с этим чатом.',
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

  const instanceWarning =
    instanceState && instanceState !== 'authorized'
      ? `Состояние инстанса: ${instanceState}. Авторизуйте инстанс в личном кабинете GREEN-API.`
      : null;

  // `suspended` still allows sending to saved contacts, so only block the states
  // where MAX will refuse every outgoing message.
  const cannotSend =
    instanceState === 'notAuthorized' ||
    instanceState === 'blocked' ||
    instanceState === 'pendingPassword';

  return (
    <div className="app">
      <Sidebar
        chats={sortedChats}
        activeChatKey={chatState.activeChatKey}
        instanceLabel={`Инстанс ${session.idInstance}`}
        polling={pollingEnabled}
        onSelect={(key) => dispatch({ type: 'chat/select', chatKey: key })}
        onNewChat={openNewChat}
        onLogout={handleLogout}
      />

      <main className="chat">
        {/* Banners live outside the chat branch: a polling failure must be
            visible and recoverable even before any chat exists. */}
        {instanceWarning && <div className="banner banner--warn">{instanceWarning}</div>}
        {connectionError && (
          <div className="banner banner--error">
            <span>{connectionError}</span>
            <button type="button" className="banner__action" onClick={retryPolling}>
              {pollingEnabled ? 'Скрыть' : 'Повторить'}
            </button>
          </div>
        )}
        {notice && <div className="banner banner--info">{notice}</div>}

        {activeChat ? (
          <>
            <ChatHeader chat={activeChat} />
            <MessageList chat={activeChat} />
            <MessageComposer onSend={handleSend} disabled={cannotSend} />
          </>
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
