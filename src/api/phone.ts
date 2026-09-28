/** Phone number helpers for MAX recipient identifiers. */

/**
 * Normalises a user-typed phone number to the digits-only international form
 * required by GREEN-API (`11` digits for RF, `12` for RB).
 *
 * Accepts `+7 999 123-45-67`, `8 (999) 123-45-67`, `79991234567`,
 * `+375 29 123-45-67`, and returns `null` when the number cannot be a valid
 * MAX recipient (GREEN-API only supports the `7` and `375` country codes).
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
 * GREEN-API recommends resolving the real numeric `chatId` with `checkAccount`
 * first, so this is only used as a fallback when that call fails.
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
