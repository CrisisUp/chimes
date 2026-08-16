import { describe, it, expect } from 'vitest';
import { escapeHtml, splitTitleChars } from './copy.js';
import { copyEnterDuration } from './copy.js';
import * as K from './constants.js';

describe('modules/copy.js', () => {
  describe('escapeHtml', () => {
    it('escapes <, >, &, "', () => {
      expect(escapeHtml('<script>alert("x & y")</script>')).toBe(
        '&lt;script&gt;alert(&quot;x &amp; y&quot;)&lt;/script&gt;'
      );
    });

    it('leaves plain text unchanged', () => {
      expect(escapeHtml('Hello world')).toBe('Hello world');
      expect(escapeHtml('')).toBe('');
    });

    it('handles special characters', () => {
      expect(escapeHtml('100% pure & natural')).toBe('100% pure &amp; natural');
    });
  });

  describe('splitTitleChars', () => {
    it('splits title into spans', () => {
      const html = splitTitleChars('AB');
      expect(html).toContain('word');
      expect(html).toContain('char');
    });

    it('handles spaces as char--space with whitespace', () => {
      const html = splitTitleChars('A B');
      expect(html).toContain('char--space');
      expect(html).toContain('&nbsp;');
    });

    it('assigns sequential indices', () => {
      const html = splitTitleChars('AB');
      // Extract --i values
      const match = html.match(/--i:(\d+)/g);
      expect(match).toBeTruthy();
      const indices = match.map((m) => parseInt(m.match(/\d+/)[0], 10));
      expect(indices).toEqual([0, 1]);
    });

    it('escapes HTML-unsafe characters in titles', () => {
      const html = splitTitleChars('A<B');
      expect(html).not.toContain('<B');
      expect(html).toContain('&lt;');
    });

    it('handles empty string', () => {
      expect(splitTitleChars('')).toBe('');
    });
  });

  describe('copyEnterDuration', () => {
    it('scales with title length', () => {
      const short = { title: 'A' };
      const long = { title: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' };
      const dShort = copyEnterDuration(short);
      const dLong = copyEnterDuration(long);
      expect(dLong).toBeGreaterThan(dShort);
    });

    it('honors layer gap + stagger constants', () => {
      const title = 'Hello';
      const chars = title.length;
      const expected =
        K.LAYER_GAP_MS +
        chars * K.CHAR_STAGGER_MS +
        K.CHAR_ANIM_MS +
        K.LAYER_GAP_MS;
      expect(copyEnterDuration({ title })).toBe(expected);
    });
  });
});