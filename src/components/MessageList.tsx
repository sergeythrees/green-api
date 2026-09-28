import { useMemo, useRef, useEffect } from 'react';
import type { JSX } from 'react';
import MessageBubble from './MessageBubble';
import type { Chat, ChatMessage } from '../store/chatStore';

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

/** A message plus the date chip that precedes it (when the day changes). */
interface MessageRow {
  message: ChatMessage;
  dateChip: string | null;
}

export default function MessageList({ chat }: { chat: Chat }): JSX.Element {
  const scrollerRef = useRef<HTMLDivElement>(null);

  const rows = useMemo<MessageRow[]>(() => {
    const result: MessageRow[] = [];
    let previousDay: number | null = null;

    for (const message of chat.messages) {
      const day = dayIndex(message.timestamp);
      const needsChip = previousDay === null || day !== previousDay;
      const label = needsChip ? formatDateLabel(day) : '';
      result.push({
        message,
        dateChip: label === '' ? null : label,
      });
      previousDay = day;
    }

    return result;
  }, [chat.messages]);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    scroller.scrollTop = scroller.scrollHeight;
    // `chat.key` matters too: switching to another chat with the same number of
    // messages must still jump to that conversation's end.
  }, [chat.key, chat.messages.length]);

  return (
    <div className="messages">
      <div className="messages__scroller" ref={scrollerRef}>
        {rows.length === 0 ? (
          <p className="messages__empty">Напишите первое сообщение</p>
        ) : (
          rows.map((row) => (
            <div key={row.message.id}>
              {row.dateChip !== null && (
                <div className="date-chip">
                  <span className="date-chip__label">{row.dateChip}</span>
                </div>
              )}
              <MessageBubble message={row.message} />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
