import { createHmac } from 'crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SlackSignatureValidator } from '../signature/slack-signature.validator';

describe('SlackSignatureValidator', () => {
  const signingSecret = 'slack-signing-secret-test';
  const body = 'token=xoxb-fake&team_id=T123';
  const FROZEN_NOW_MS = 1_717_000_000_000;
  const timestamp = String(Math.floor(FROZEN_NOW_MS / 1000));

  beforeEach(() => {
    vi.useFakeTimers({ now: FROZEN_NOW_MS });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function sign(ts = timestamp, payload = body): string {
    const base = `v0:${ts}:${payload}`;
    return `v0=${createHmac('sha256', signingSecret).update(base).digest('hex')}`;
  }

  it('accepts a valid signature within tolerance', () => {
    const result = SlackSignatureValidator.validate({
      signatureHeader: sign(),
      timestampHeader: timestamp,
      signingSecret,
      rawBody: body,
    });
    expect(result.valid).toBe(true);
  });

  it('rejects when the timestamp is older than tolerance', () => {
    const oldTs = String(Math.floor(FROZEN_NOW_MS / 1000) - 600); // 10 min old
    const result = SlackSignatureValidator.validate({
      signatureHeader: sign(oldTs),
      timestampHeader: oldTs,
      signingSecret,
      rawBody: body,
    });
    expect(result).toEqual({ valid: false, reason: 'TIMESTAMP_OUT_OF_RANGE' });
  });

  it('rejects malformed header (missing v0= prefix)', () => {
    const result = SlackSignatureValidator.validate({
      signatureHeader: 'abc123',
      timestampHeader: timestamp,
      signingSecret,
      rawBody: body,
    });
    expect(result.reason).toBe('MALFORMED_HEADER');
  });

  it('rejects when signature does not match the raw body', () => {
    const result = SlackSignatureValidator.validate({
      signatureHeader: sign(timestamp, body + 'tampered'),
      timestampHeader: timestamp,
      signingSecret,
      rawBody: body,
    });
    expect(result.reason).toBe('HASH_MISMATCH');
  });

  it('rejects when the wrong signing secret is used', () => {
    const result = SlackSignatureValidator.validate({
      signatureHeader: sign(),
      timestampHeader: timestamp,
      signingSecret: 'wrong-secret',
      rawBody: body,
    });
    expect(result.reason).toBe('HASH_MISMATCH');
  });

  it('round-trips signing and validation', () => {
    const header = SlackSignatureValidator.sign(timestamp, body, signingSecret);
    expect(
      SlackSignatureValidator.validate({
        signatureHeader: header,
        timestampHeader: timestamp,
        signingSecret,
        rawBody: body,
      }).valid,
    ).toBe(true);
  });
});
