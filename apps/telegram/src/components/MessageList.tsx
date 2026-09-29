import { useLayoutEffect, useMemo, useRef } from 'react';
import type { JSX } from 'react';
import MessageBubble from './MessageBubble';
import type { Chat, ChatMessage } from '../store/chatStore';

/**
 * Messages closer than this and from the same author are one visual bundle: a
 * single tail, 2px gaps and tightened corners. Five minutes is what Telegram Web
 * uses in the K client.
 */
const BUNDLE_GAP_MS = 5 * 60 * 1000;

/** Calendar-day index (local time), used to group messages by day. */
function dayIndex(timestamp: number): number {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return Number.NaN;
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

/** `Сегодня` / `Вчера` / `DD.MM.YYYY`. */
function formatDateLabel(day: number): string {
  if (Number.isNaN(day)) return '';

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayMs = today.getTime();
  const dayMs = 24 * 60 * 60 * 1000;

  if (day === todayMs) return 'Сегодня';
  if (day === todayMs - dayMs) return 'Вчера';

  const date = new Date(day);
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

/** A message plus its date chip and its position inside a bundle. */
interface MessageRow {
  message: ChatMessage;
  dateChip: string | null;
  isFirstOfBundle: boolean;
  isLastOfBundle: boolean;
}

export default function MessageList({
  chat,
  query = '',
}: {
  chat: Chat;
  /** In-chat search: non-matching messages are hidden, like in Telegram Web. */
  query?: string;
}): JSX.Element {
  const scrollerRef = useRef<HTMLDivElement>(null);

  const rows = useMemo<MessageRow[]>(() => {
    const result: MessageRow[] = [];
    let previousDay: number | null = null;
    const needle = query.trim().toLowerCase();
    // While searching, the list is the matches only: the date chips and bundles
    // are recomputed from what survives, so a search never shows a stray group.
    const visible = needle
      ? chat.messages.filter((message) => message.text.toLowerCase().includes(needle))
      : chat.messages;

    visible.forEach((message, index) => {
      const previous = visible[index - 1];
      const next = visible[index + 1];

      // A bundle breaks on the author side or on a >5 minute pause.
      const isFirstOfBundle =
        !previous ||
        previous.direction !== message.direction ||
        message.timestamp - previous.timestamp > BUNDLE_GAP_MS;
      const isLastOfBundle =
        !next ||
        next.direction !== message.direction ||
        next.timestamp - message.timestamp > BUNDLE_GAP_MS;

      const day = dayIndex(message.timestamp);
      const needsChip = previousDay === null || day !== previousDay;
      const label = needsChip ? formatDateLabel(day) : '';

      result.push({
        message,
        dateChip: label === '' ? null : label,
        isFirstOfBundle,
        isLastOfBundle,
      });
      previousDay = day;
    });

    return result;
  }, [chat.messages, query]);

  // Telegram keeps the newest message in view. A layout effect (not a passive
  // one) matters here: the scroll has to be measured after the new row is in the
  // DOM but before the browser paints, otherwise the conversation is briefly
  // shown scrolled above the newest bubble.
  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    scroller.scrollTop = scroller.scrollHeight;
    // `chat.key` matters too: switching to another chat with the same number of
    // messages must still jump to that conversation's end.
  }, [chat.key, chat.messages.length]);

  return (
    <div className="messages">
      {/* Telegram paints its doodle pattern as a separate layer over the
          gradient: a monochrome vector tile whose colour comes only from
          `opacity` and `filter`. The tile is src/assets/telegram-pattern.svg. */}
      <div className="messages__wallpaper" aria-hidden="true" />

      <div className="messages__scroller" ref={scrollerRef}>
        <div className="messages__inner">
          {rows.length === 0 ? (
            <p className="messages__empty">
              {query.trim() ? 'Ничего не найдено' : 'Напишите первое сообщение'}
            </p>
          ) : (
            rows.map((row) => (
              <div key={row.message.id}>
                {row.dateChip !== null && (
                  <div className="date-chip">
                    <span className="date-chip__label">{row.dateChip}</span>
                  </div>
                )}
                <MessageBubble
                  message={row.message}
                  isFirstOfBundle={row.isFirstOfBundle}
                  isLastOfBundle={row.isLastOfBundle}
                />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
