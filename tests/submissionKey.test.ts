import { afterEach, expect, it, vi } from 'vitest';
import { submissionKey } from '../lib/submissionKey';

afterEach(() => vi.unstubAllGlobals());

it('keeps retry identity and supports renewal without modern crypto or storage', async () => {
  const crypto = globalThis.crypto;
  vi.stubGlobal('crypto', { getRandomValues: crypto.getRandomValues.bind(crypto) });
  const storage = { getItem: vi.fn(), setItem: vi.fn() };
  vi.stubGlobal('sessionStorage', storage);
  const payload = JSON.stringify({ firstname: 'Shy', lastname: 'Shy' });
  const id = await submissionKey(payload);
  expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  expect(await submissionKey(payload)).toBe(id);
  const renewed = await submissionKey(payload, true);
  expect(renewed).not.toBe(id);
  expect(await submissionKey(payload)).toBe(renewed);
  expect(storage.setItem).not.toHaveBeenCalled();
});
