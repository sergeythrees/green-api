import { useEffect, useMemo, useRef, useState } from 'react';
import type { JSX } from 'react';
import { Avatar, Badge, Button, Cell, IconButton, Input } from '@telegram-apps/telegram-ui';
import type { Chat } from '../store/chatStore';
import { initialsOf } from './avatar';
import {
  IconLogout,
  IconMenu,
  IconSearch,
  IconTelegramLogo,
  IconTickOne,
  IconTickTwo,
} from './icons';

/** `HH:MM` in 24-hour Russian locale. */
function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';
  try {
    return date.toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  } catch {
    return '';
  }
}

/**
 * Last line of the chat list.
 *
 * Telegram Web shows the message text itself, with no "Вы:" marker — who sent it
 * is already obvious from the ticks on the right.
 */
function previewOf(chat: Chat): string {
  const last = chat.messages.at(-1);
  if (!last) return 'Нет сообщений';
  return last.text;
}

/**
 * Receipt shown next to a chat whose last message we sent; nothing is shown for
 * an incoming last message, exactly like Telegram.
 */
function ticksFor(chat: Chat): JSX.Element | null {
  const last = chat.messages.at(-1);
  if (!last || last.direction !== 'outgoing') return null;
  if (last.status === 'delivered' || last.status === 'read') return <IconTickTwo />;
  return <IconTickOne />;
}

/**
 * Chat list column.
 *
 * Rows are kit `Cell`s: Telegram groups the messages *inside* a conversation
 * (see MessageList's bundle rule), while the list itself shows one row per chat
 * with the last message as its preview.
 *
 * The selected row has to be accent-filled with white content, and the kit's own
 * class names are build-hashed, so the colours are forced onto the row's
 * descendants from `app.css` through our own `chat-row--active` class.
 */
export default function Sidebar({
  chats,
  activeChatKey,
  instanceLabel,
  accountLabel,
  polling,
  onSelect,
  onNewChat,
  onLogout,
}: {
  chats: Chat[];
  activeChatKey: string | null;
  instanceLabel: string;
  /** Own Telegram account (`@username` or phone), like Telegram Web's header. */
  accountLabel: string | null;
  polling: boolean;
  onSelect: (key: string) => void;
  onNewChat: () => void;
  onLogout: () => void;
}): JSX.Element {
  const [query, setQuery] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Telegram Web's burger opens the account menu; dismissing it on an outside
  // click is the whole behaviour a menu needs here.
  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const visibleChats = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle === '') return chats;
    const digits = needle.replace(/\D/g, '');
    return chats.filter(
      (chat) =>
        chat.title.toLowerCase().includes(needle) ||
        (digits !== '' && (chat.phone ?? '').includes(digits)),
    );
  }, [chats, query]);

  return (
    <aside className="sidebar">
      <header className="sidebar__header">
        <div className="sidebar__menu-anchor" ref={menuRef}>
          <IconButton
            type="button"
            mode="plain"
            size="m"
            aria-label="Главное меню"
            title="Главное меню"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <IconMenu />
          </IconButton>

          {menuOpen && (
            <div className="account-menu" role="menu">
              <div className="account-menu__head">
                <IconTelegramLogo width={28} height={28} className="logo-mark" />
                <div className="account-menu__text">
                  <span className="account-menu__name">{accountLabel ?? 'Аккаунт'}</span>
                  <span className="account-menu__hint" title={instanceLabel}>
                    {instanceLabel}
                  </span>
                </div>
              </div>

              <Button
                mode="plain"
                size="m"
                role="menuitem"
                className="account-menu__item"
                before={<IconLogout width={20} height={20} />}
                onClick={onLogout}
              >
                Выйти
              </Button>
            </div>
          )}
        </div>

        <div className="sidebar__search">
          <Input
            className="sidebar__search-field"
            placeholder="Поиск"
            aria-label="Поиск чатов"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            before={<IconSearch width={18} height={18} />}
          />
        </div>
      </header>

      {/* Telegram Web has no such line above the list, so it only appears when
          there is something to say: receiving is stopped or failed. */}
      {!polling && (
        <div className="sidebar__status sidebar__status--stopped" role="status">
          <span className="sidebar__status-dot" aria-hidden="true" />
          <span>Приём сообщений остановлен</span>
        </div>
      )}

      <div className="sidebar__list">
        {visibleChats.length === 0 ? (
          <p className="sidebar__empty">
            {chats.length === 0
              ? 'Нет чатов. Создайте новый чат по номеру телефона или @username.'
              : 'Ничего не найдено.'}
          </p>
        ) : (
          visibleChats.map((chat) => {
            const isActive = chat.key === activeChatKey;
            const ticks = ticksFor(chat);
            return (
              <Cell
                key={chat.key}
                Component="button"
                // `CellProps` is typed from the generic HTML attributes, so the
                // `type` of the button it renders has to be spread in.
                {...{ type: 'button' }}
                className={`chat-row${isActive ? ' chat-row--active' : ''}`}
                aria-current={isActive ? 'true' : undefined}
                onClick={() => onSelect(chat.key)}
                before={
                  <Avatar
                    size={48}
                    acronym={initialsOf(chat.title)}
                    className="chat-row__avatar"
                  />
                }
                hint={<span className="chat-row__time">{formatTime(chat.lastActivity)}</span>}
                subtitle={<span className="chat-row__preview">{previewOf(chat)}</span>}
                after={
                  chat.unread > 0 ? (
                    <Badge type="number" mode="primary" className="chat-row__badge">
                      {chat.unread}
                    </Badge>
                  ) : ticks ? (
                    <span className="chat-row__ticks">{ticks}</span>
                  ) : undefined
                }
              >
                <span className="chat-row__title">{chat.title}</span>
              </Cell>
            );
          })
        )}
      </div>

      {/* Telegram floats a round compose button over the bottom-right corner of
          the chat list rather than putting a "+" in the header. */}
      <IconButton
        type="button"
        mode="plain"
        size="l"
        className="sidebar__compose"
        aria-label="Новый чат"
        title="Новый чат"
        onClick={onNewChat}
      >
        <span className="icon icon--compose" />
      </IconButton>
    </aside>
  );
}
