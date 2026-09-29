import { useState } from 'react';
import type { JSX } from 'react';
import { Avatar, IconButton, Input } from '@telegram-apps/telegram-ui';
import { formatPhone } from '../api/phone';
import type { Chat } from '../store/chatStore';
import { initialsOf } from './avatar';
import { IconMore, IconSearch } from './icons';

/**
 * Conversation header: avatar, title, in-chat search and the context menu.
 *
 * Telegram Web keeps a magnifier and a kebab on the right of every open chat.
 * Both are here and both do something: the magnifier filters the messages of
 * this conversation, the kebab shows what the API actually knows about the peer.
 * A control that opens nothing would be worse than an absent one.
 */
export default function ChatHeader({
  chat,
  query,
  onQueryChange,
}: {
  chat: Chat;
  /** In-chat search query, owned by `App` so the list can filter on it. */
  query: string;
  onQueryChange: (query: string) => void;
}): JSX.Element {
  const [infoOpen, setInfoOpen] = useState(false);
  const searching = query !== '';

  return (
    <header className="chat-header">
      <Avatar size={40} acronym={initialsOf(chat.title)} className="chat-header__avatar" />

      {searching ? (
        <Input
          className="chat-header__search"
          value={query}
          autoFocus
          placeholder="Поиск по чату"
          aria-label="Поиск по чату"
          onChange={(event) => onQueryChange(event.target.value)}
        />
      ) : (
        <div className="chat-header__text">
          <h2 className="chat-header__title" title={chat.title}>
            {chat.title}
          </h2>
          {chat.phone !== null && (
            <p className="chat-header__subtitle">{formatPhone(chat.phone)}</p>
          )}
        </div>
      )}

      <div className="chat-header__actions">
        {searching ? (
          <button
            type="button"
            className="chat-header__cancel"
            onClick={() => onQueryChange('')}
          >
            Отмена
          </button>
        ) : (
          <IconButton
            type="button"
            mode="plain"
            size="m"
            aria-label="Поиск по чату"
            title="Поиск по чату"
            onClick={() => onQueryChange(' ')}
          >
            <IconSearch />
          </IconButton>
        )}

        <div className="chat-header__menu-anchor">
          <IconButton
            type="button"
            mode="plain"
            size="m"
            aria-label="Сведения о чате"
            title="Сведения о чате"
            aria-expanded={infoOpen}
            onClick={() => setInfoOpen((open) => !open)}
          >
            <IconMore />
          </IconButton>

          {infoOpen && (
            <div className="chat-info" role="menu">
              <div className="chat-info__row">
                <span className="chat-info__key">chatId</span>
                <span className="chat-info__value">{chat.chatId ?? '—'}</span>
              </div>
              <div className="chat-info__row">
                <span className="chat-info__key">Телефон</span>
                <span className="chat-info__value">
                  {chat.phone === null ? '—' : formatPhone(chat.phone)}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
