import { describe, it, expect } from 'vitest';
import { PhoneUtil } from '../utils/phone.util';

describe('PhoneUtil', () => {
  describe('normalize', () => {
    // PhoneUtil.normalize returns digits-only (no leading +). Callers that
    // need the international prefix (e.g. Twilio E.164) prepend it themselves.
    it('returns digits-only when input has no prefix', () => {
      expect(PhoneUtil.normalize('5511999998888')).toBe('5511999998888');
    });

    it('strips the + prefix when present', () => {
      expect(PhoneUtil.normalize('+5511999998888')).toBe('5511999998888');
    });

    it('removes spaces and dashes', () => {
      expect(PhoneUtil.normalize('+55 11 99999-8888')).toBe('5511999998888');
    });

    it('removes parentheses', () => {
      expect(PhoneUtil.normalize('+55 (11) 99999-8888')).toBe('5511999998888');
    });

    it('replaces a leading 0 with country code 55 (Brazilian local format)', () => {
      expect(PhoneUtil.normalize('011999998888')).toBe('5511999998888');
    });
  });

  describe('isValid', () => {
    it('should accept valid Brazilian numbers', () => {
      expect(PhoneUtil.isValid('+5511999998888')).toBe(true);
    });

    it('should accept valid international numbers', () => {
      expect(PhoneUtil.isValid('+14155552671')).toBe(true);
    });

    it('should reject too short numbers', () => {
      expect(PhoneUtil.isValid('+123')).toBe(false);
    });

    it('should reject too long numbers', () => {
      expect(PhoneUtil.isValid('+123456789012345678')).toBe(false);
    });

    it('should reject non-numeric after +', () => {
      expect(PhoneUtil.isValid('+55abc')).toBe(false);
    });
  });

  describe('toJid', () => {
    it('should convert phone to WhatsApp JID', () => {
      expect(PhoneUtil.toJid('+5511999998888')).toBe('5511999998888@s.whatsapp.net');
    });

    it('should handle phone without +', () => {
      expect(PhoneUtil.toJid('5511999998888')).toBe('5511999998888@s.whatsapp.net');
    });
  });

  describe('fromJid', () => {
    it('should extract phone from JID', () => {
      expect(PhoneUtil.fromJid('5511999998888@s.whatsapp.net')).toBe('+5511999998888');
    });

    it('should handle group JIDs', () => {
      expect(PhoneUtil.fromJid('120363001234@g.us')).toBe('+120363001234');
    });
  });
});
