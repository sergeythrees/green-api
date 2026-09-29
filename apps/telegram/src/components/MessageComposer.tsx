import { useState } from 'react';
import type { FormEvent, JSX, KeyboardEvent } from 'react';
import { Button, IconButton, Input } from '@telegram-apps/telegram-ui';
import { IconEmoji } from './icons';

/** Documented maximum length of a `SendMessage` text (vs 4000 for MAX). */
const MAX_MESSAGE_LENGTH = 4096;

/**
 * Writebar: a rounded field and the controls Telegram keeps inside it.
 *
 * The paperclip sits in the field's `before` slot, the emoji and the circular
 * send button in its `after` slot — that is where Telegram Web puts them.
 * Attachments are deliberately out of scope for this text-only client, so the
 * paperclip is inert (styled text, not a button) with a tooltip explaining why
 * rather than hidden.
 */
export default function MessageComposer({
  onSend,
  disabled = false,
}: {
  onSend: (text: string) => void;
  disabled?: boolean;
}): JSX.Element {
  const [value, setValue] = useState('');

  const canSend = value.trim() !== '' && !disabled;

  const submit = () => {
    const text = value.trim();
    if (!text || disabled || text.length > MAX_MESSAGE_LENGTH) return;
    onSend(text);
    setValue('');
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submit();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  return (
    <form className="composer" onSubmit={handleSubmit}>
      <Input
        className="composer__field"
        value={value}
        placeholder="Напишите сообщение…"
        aria-label="Текст сообщения"
        maxLength={MAX_MESSAGE_LENGTH}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={handleKeyDown}
        before={
          <span
            className="icon icon--attach"
            role="img"
            aria-label="Прикрепить файл"
            title="Прикрепление файлов в этой версии недоступно"
          />
        }
        after={
          <>
            <IconButton
              type="button"
              className="composer__emoji"
              mode="plain"
              size="m"
              aria-label="Эмодзи"
              title="Эмодзи в этой версии недоступны"
              disabled
            >
              <IconEmoji />
            </IconButton>

            <Button
              type="submit"
              className="composer__send"
              mode="plain"
              size="s"
              aria-label="Отправить"
              title="Отправить"
              disabled={!canSend}
            >
              <span className="icon icon--send" />
            </Button>
          </>
        }
      />
    </form>
  );
}
