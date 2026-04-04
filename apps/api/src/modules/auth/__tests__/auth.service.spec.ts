import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthService } from '../auth.service';
import { UnauthorizedException } from '@nestjs/common';

vi.mock('@nexconnect/shared', () => ({
  CryptoUtil: {
    verifyApiKey: vi.fn(),
    generateApiKey: vi.fn(() => ({
      raw: 'nc_abc12_full_raw_key',
      hash: '$2b$12$hashedvalue',
      prefix: 'nc_abc12',
    })),
  },
  UlidUtil: {
    generate: vi.fn(() => 'ulid_001'),
  },
}));

import { CryptoUtil } from '@nexconnect/shared';

const mockPrismaService = {
  apiKey: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  tenant: {
    findUnique: vi.fn(),
  },
};

const mockRedisService = {
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
};

const mockTenant = { id: 'ten_001', name: 'Test Tenant', plan: 'PRO' };

const mockCachedApiKey = {
  id: 'key_001',
  keyHash: '$2b$12$validhash',
  scopes: ['read', 'send'],
  expiresAt: null,
  tenant: mockTenant,
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AuthService(
      mockPrismaService as any,
      mockRedisService as any,
    );
  });

  describe('validateApiKey', () => {
    it('should return cached result on cache hit without DB query', async () => {
      mockRedisService.get.mockResolvedValue(JSON.stringify(mockCachedApiKey));
      vi.mocked(CryptoUtil.verifyApiKey).mockReturnValue(true as any);

      const result = await service.validateApiKey('nc_abc12_rest_of_key');

      expect(mockRedisService.get).toHaveBeenCalledWith('auth:apikey:nc_abc12');
      expect(mockPrismaService.apiKey.findFirst).not.toHaveBeenCalled();
      expect(result).toEqual({
        tenant: mockTenant,
        scopes: ['read', 'send'],
        apiKeyId: 'key_001',
      });
    });

    it('should query DB on cache miss and store in cache', async () => {
      mockRedisService.get.mockResolvedValue(null);
      vi.mocked(CryptoUtil.verifyApiKey).mockReturnValue(true as any);
      mockPrismaService.apiKey.findFirst.mockResolvedValue({
        id: 'key_001',
        keyHash: '$2b$12$validhash',
        scopes: ['read', 'send'],
        expiresAt: null,
        tenant: mockTenant,
      });

      const result = await service.validateApiKey('nc_abc12_rest_of_key');

      expect(mockPrismaService.apiKey.findFirst).toHaveBeenCalled();
      expect(mockRedisService.set).toHaveBeenCalledWith(
        'auth:apikey:nc_abc12',
        expect.any(String),
        300,
      );
      expect(result).toEqual({
        tenant: mockTenant,
        scopes: ['read', 'send'],
        apiKeyId: 'key_001',
      });
    });

    it('should remove expired cache entry and query DB', async () => {
      const expiredCached = {
        ...mockCachedApiKey,
        expiresAt: '2020-01-01T00:00:00.000Z',
      };
      mockRedisService.get.mockResolvedValue(JSON.stringify(expiredCached));
      vi.mocked(CryptoUtil.verifyApiKey).mockReturnValue(true as any);
      mockPrismaService.apiKey.findFirst.mockResolvedValue({
        id: 'key_001',
        keyHash: '$2b$12$validhash',
        scopes: ['read', 'send'],
        expiresAt: null,
        tenant: mockTenant,
      });

      const result = await service.validateApiKey('nc_abc12_rest_of_key');

      // Expired cache entry should be deleted
      expect(mockRedisService.del).toHaveBeenCalledWith('auth:apikey:nc_abc12');
      // Should fall through to DB query
      expect(mockPrismaService.apiKey.findFirst).toHaveBeenCalled();
      expect(result).toEqual({
        tenant: mockTenant,
        scopes: ['read', 'send'],
        apiKeyId: 'key_001',
      });
    });

    it('should throw UnauthorizedException for invalid key', async () => {
      mockRedisService.get.mockResolvedValue(null);
      mockPrismaService.apiKey.findFirst.mockResolvedValue(null);

      await expect(
        service.validateApiKey('nc_abc12_invalid'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('revokeApiKey', () => {
    it('should invalidate cache when revoking API key', async () => {
      mockPrismaService.apiKey.findFirst.mockResolvedValue({
        prefix: 'nc_abc12',
      });
      mockPrismaService.apiKey.updateMany.mockResolvedValue({ count: 1 });

      await service.revokeApiKey('key_001', 'ten_001');

      expect(mockPrismaService.apiKey.updateMany).toHaveBeenCalledWith({
        where: { id: 'key_001', tenantId: 'ten_001' },
        data: { active: false },
      });
      expect(mockRedisService.del).toHaveBeenCalledWith('auth:apikey:nc_abc12');
    });
  });

  describe('createApiKey', () => {
    it('should create API key with hashed value', async () => {
      mockPrismaService.apiKey.create.mockResolvedValue({
        id: 'ulid_001',
        prefix: 'nc_abc12',
        scopes: ['read', 'send', 'admin'],
      });

      const result = await service.createApiKey('ten_001', 'My API Key', [
        'read',
        'send',
        'admin',
      ]);

      expect(mockPrismaService.apiKey.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenantId: 'ten_001',
            name: 'My API Key',
            scopes: ['read', 'send', 'admin'],
          }),
        }),
      );
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('key');
    });
  });
});
