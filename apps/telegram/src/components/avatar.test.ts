import { describe, expect, it } from 'vitest';
import { initialsOf } from '../components/avatar';

describe('initialsOf', () => {
  it('takes the first letter of the first two words', () => {
    expect(initialsOf('Анна Смирнова')).toBe('АС');
    expect(initialsOf('Иван Петровович Кузнецов')).toBe('ИП');
  });

  it('splits a handle into letters instead of showing "@"', () => {
    // The bug this replaced: a chat created by `@username` drew a bare "@".
    expect(initialsOf('@peer_demo')).toBe('PD');
    expect(initialsOf('@green_api')).toBe('GA');
    expect(initialsOf('@telegram')).toBe('T');
  });

  it('uses the leading digits for a phone number', () => {
    expect(initialsOf('+7 999 123-45-67')).toBe('79');
    expect(initialsOf('+375 29 123-45-67')).toBe('37');
  });

  it('falls back when there is nothing to take a letter from', () => {
    expect(initialsOf('')).toBe('?');
    expect(initialsOf('   ')).toBe('?');
    expect(initialsOf('@@')).toBe('?');
  });
});
