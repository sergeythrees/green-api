import { describe, expect, it } from 'vitest';
import {
  formatPhone,
  normalizePhone,
  normalizeUsername,
  parseRecipient,
  phoneToChatId,
} from './phone';

describe('normalizePhone', () => {
  it('accepts a Russian number already in international format', () => {
    expect(normalizePhone('79991234567')).toBe('79991234567');
  });

  it('converts the domestic leading 8 into 7', () => {
    expect(normalizePhone('8 (999) 123-45-67')).toBe('79991234567');
    expect(normalizePhone('89991234567')).toBe('79991234567');
  });

  it('strips spaces, dashes and parentheses', () => {
    expect(normalizePhone('+7 999 123-45-67')).toBe('79991234567');
  });

  it('accepts a Belarusian number', () => {
    expect(normalizePhone('+375 29 123-45-67')).toBe('375291234567');
  });

  it('rejects country codes other than 7 and 375', () => {
    expect(normalizePhone('+1 202 555 0147')).toBeNull();
    expect(normalizePhone('+49 30 123456')).toBeNull();
  });

  it('rejects empty, garbage and too-short input', () => {
    expect(normalizePhone('')).toBeNull();
    expect(normalizePhone('не номер')).toBeNull();
    expect(normalizePhone('799912345')).toBeNull();
  });
});

describe('formatPhone', () => {
  it('formats Russian numbers', () => {
    expect(formatPhone('79991234567')).toBe('+7 999 123-45-67');
  });

  it('formats Belarusian numbers', () => {
    expect(formatPhone('375291234567')).toBe('+375 29 123-45-67');
  });

  it('returns an empty string for empty input', () => {
    expect(formatPhone(null)).toBe('');
    expect(formatPhone(undefined)).toBe('');
    expect(formatPhone('')).toBe('');
  });
});

describe('normalizeUsername', () => {
  it('adds the leading @ to a bare username', () => {
    expect(normalizeUsername('green_api')).toBe('@green_api');
  });

  it('keeps an already prefixed username as is', () => {
    expect(normalizeUsername('@green_api')).toBe('@green_api');
  });

  it('preserves underscores and digits inside the username', () => {
    // Telegram usernames are `[A-Za-z0-9_]`; truncating at `_` would silently
    // address a different person.
    expect(normalizeUsername('@x_1')).toBe('@x_1');
    expect(normalizeUsername('user123')).toBe('@user123');
  });

  it('trims whitespace and collapses duplicated @ signs', () => {
    expect(normalizeUsername('  @@green_api ')).toBe('@green_api');
  });

  it('rejects empty and impossible usernames', () => {
    expect(normalizeUsername('')).toBeNull();
    expect(normalizeUsername('   ')).toBeNull();
    expect(normalizeUsername('@')).toBeNull();
    expect(normalizeUsername('@green-api')).toBeNull();
    expect(normalizeUsername('@иван')).toBeNull();
  });
});

describe('parseRecipient', () => {
  it('classifies plain digits as a phone number', () => {
    expect(parseRecipient('+7 999 123-45-67')).toEqual({
      kind: 'phone',
      value: '79991234567',
    });
  });

  it('classifies a leading @ as a username', () => {
    expect(parseRecipient('@green_api')).toEqual({ kind: 'username', value: '@green_api' });
  });

  it('rejects garbage input', () => {
    expect(parseRecipient('')).toBeNull();
    expect(parseRecipient('позвони мне')).toBeNull();
    // Without `@` a bare word is treated as a phone number and fails to parse.
    expect(parseRecipient('green_api')).toBeNull();
    expect(parseRecipient('@bad name')).toBeNull();
  });
});

describe('phoneToChatId', () => {
  it('builds the legacy phone-shaped chatId', () => {
    expect(phoneToChatId('79991234567')).toBe('79991234567@c.us');
  });
});
