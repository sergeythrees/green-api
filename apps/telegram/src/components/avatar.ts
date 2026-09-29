/**
 * Initials for the avatar fallback, the way Telegram Web draws them.
 *
 * Shared by the chat list and the conversation header, which used to carry two
 * copies of this function — and disagreed: both rendered a `@username` chat as
 * a bare "@" because the handle starts with a symbol rather than a letter.
 */

/** One or two letters (or digits) for a chat avatar. */
export function initialsOf(title: string): string {
  const trimmed = title.trim();
  if (!trimmed) return '?';

  // A phone title is a string of digits and dashes ("+7 999 123-45-67"); its
  // first letters would be meaningless, so the leading digits are used instead.
  if (trimmed.startsWith('+')) {
    const digits = trimmed.replace(/\D+/g, '');
    return digits.slice(0, 2) || '?';
  }

  // `@peer_demo` → PD, "Анна Смирнова" → АС. Splitting on every non-letter
  // keeps handles, dots and underscores from collapsing to a single symbol.
  const words = trimmed
    .replace(/^@+/, '')
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);

  const letters = words.slice(0, 2).map((word) => word.charAt(0).toUpperCase());
  return letters.join('') || '?';
}
