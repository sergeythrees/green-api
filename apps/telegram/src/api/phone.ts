/** Phone number and username helpers for Telegram recipient identifiers. */

/** A contact the user typed, already classified as a phone number or a username. */
export interface Recipient {
  kind: 'phone' | 'username';
  /**
   * For `phone`: digits-only international form (`79991234567`).
   * For `username`: the `@`-prefixed handle (`@green_api`).
   */
  value: string;
}

/**
 * Normalises a user-typed phone number to the digits-only international form.
 *
 * Accepts `+7 999 123-45-67`, `8 (999) 123-45-67`, `79991234567`,
 * `+375 29 123-45-67`, and returns `null` when the number cannot be a valid
 * recipient (GREEN-API only supports the `7` and `375` country codes).
 */
export function normalizePhone(input: string): string | null {
  const digits = input.replace(/\D+/g, '');
  if (!digits) return null;

  // Russian domestic format: 8XXXXXXXXXX -> 7XXXXXXXXXX
  const value =
    digits.length === 11 && digits.startsWith('8') ? `7${digits.slice(1)}` : digits;

  if (value.length === 11 && value.startsWith('7')) return value;
  if (value.length === 12 && value.startsWith('375')) return value;
  return null;
}

/**
 * Legacy phone-shaped chatId accepted by SendMessage.
 *
 * The Telegram docs send by the numeric `chatId` and only keep the
 * `phoneNumber@c.us` form "for backward compatibility", so this is used as a
 * fallback target when `checkAccount` fails, and for a chat that was created
 * from a phone number before its real chatId became known.
 */
export function phoneToChatId(phone: string): string {
  return `${phone}@c.us`;
}

/** Formats digits for display, e.g. `79991234567` -> `+7 999 123-45-67`. */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return '';
  const digits = phone.replace(/\D+/g, '');

  const rf = /^(\d)(\d{3})(\d{3})(\d{2})(\d{2})$/.exec(digits);
  if (rf && digits.length === 11) {
    return `+${rf[1]} ${rf[2]} ${rf[3]}-${rf[4]}-${rf[5]}`;
  }

  const rb = /^(\d{3})(\d{2})(\d{3})(\d{2})(\d{2})$/.exec(digits);
  if (rb && digits.length === 12) {
    return `+${rb[1]} ${rb[2]} ${rb[3]}-${rb[4]}-${rb[5]}`;
  }

  return `+${digits}`;
}

/**
 * Normalises a user-typed Telegram username to the `@name` form expected by
 * `checkAccount`.
 *
 * Accepts `green_api` and `@green_api` alike. Telegram usernames may contain
 * latin letters, digits and underscores, so those are preserved verbatim —
 * only surrounding whitespace and a duplicated leading `@` are removed.
 */
export function normalizeUsername(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const name = trimmed.replace(/^@+/, '');
  if (!/^[A-Za-z0-9_]+$/.test(name)) return null;

  return `@${name}`;
}

/**
 * Classifies what the user typed into a phone number or a username.
 *
 * A leading `@` means a username; anything else is treated as a phone number,
 * which is the only other recipient format `checkAccount` accepts.
 */
export function parseRecipient(input: string): Recipient | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('@')) {
    const username = normalizeUsername(trimmed);
    return username ? { kind: 'username', value: username } : null;
  }

  const phone = normalizePhone(trimmed);
  return phone ? { kind: 'phone', value: phone } : null;
}
