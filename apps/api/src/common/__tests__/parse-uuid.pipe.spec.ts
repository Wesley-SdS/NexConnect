import { describe, it, expect } from 'vitest';
import { ParseUUIDPipe } from '../pipes/parse-uuid.pipe';
import { NotFoundException } from '@nestjs/common';

describe('ParseUUIDPipe', () => {
  const pipe = new ParseUUIDPipe();

  it('should pass a valid UUID', () => {
    const validUuid = '550e8400-e29b-41d4-a716-446655440000';

    const result = pipe.transform(validUuid, { type: 'param', data: 'id' });

    expect(result).toBe(validUuid);
  });

  it('should pass a valid UUID with uppercase letters', () => {
    const validUuid = '550E8400-E29B-41D4-A716-446655440000';

    const result = pipe.transform(validUuid, { type: 'param', data: 'id' });

    expect(result).toBe(validUuid);
  });

  it('should throw NotFoundException for an invalid UUID', () => {
    expect(() =>
      pipe.transform('not-a-uuid', { type: 'param', data: 'id' }),
    ).toThrow(NotFoundException);
  });

  it('should throw NotFoundException for an empty string', () => {
    expect(() =>
      pipe.transform('', { type: 'param', data: 'id' }),
    ).toThrow(NotFoundException);
  });
});
