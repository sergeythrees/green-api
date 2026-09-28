import { useRef, useState, useEffect } from 'react';
import type { FormEvent, JSX, KeyboardEvent } from 'react';

const MAX_HEIGHT = 144;

/** Documented maximum length of a `SendMessage` text. */
const MAX_MESSAGE_LENGTH = 4000;

export default function MessageComposer({
  onSend,
  disabled = false,
}: {
  onSend: (text: string) => void;
  disabled?: boolean;
}): JSX.Element {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, MAX_HEIGHT)}px`;
  }, [value]);

  const canSend = value.trim() !== '' && !disabled;

  const submit = () => {
    const text = value.trim();
    if (!text || disabled || text.length > MAX_MESSAGE_LENGTH) return;
    onSend(text);
    setValue('');
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.focus();
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submit();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  return (
    <form className="composer" onSubmit={handleSubmit}>
      <textarea
        ref={textareaRef}
        className="composer__input"
        value={value}
        rows={1}
        placeholder="Напишите сообщение…"
        maxLength={MAX_MESSAGE_LENGTH}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={handleKeyDown}
      />
      <button
        type="submit"
        className="composer__send"
        aria-label="Отправить"
        title="Отправить"
        disabled={!canSend}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          focusable="false"
        >
          <path d="M21.5 2.5 10.5 13.5" />
          <path d="M21.5 2.5 14.5 21.5 10.5 13.5 2.5 9.5 21.5 2.5Z" />
        </svg>
      </button>
    </form>
  );
}
