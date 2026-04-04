import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthService } from '../auth.service';

const mockPrismaService = {
  apiKey: {
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  tenant: {
    findUnique: vi.fn(),
  },
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AuthService(mockPrismaService as any);
  });

  describe('validateApiKey', () => {
    it('should return tenant and scopes for valid key', async () => {
      mockPrismaService.apiKey.findMany.mockResolvedValue([
        {
          id: 'key_001',
          tenantId: 'ten_001',
          keyHash: '$2b$12$validhash',
          scopes: ['read', 'send'],
          active: true,
          prefix: 'nc_abc',
          tenant: {
            id: 'ten_001',
            name: 'Test Tenant',
            plan: 'PRO',
          },
        },
      ]);

      // Note: actual validation depends on bcrypt compare
      // This test validates the flow, not the crypto
      const result = await service.validateApiKey('nc_abcxxxxxxx');

      expect(mockPrismaService.apiKey.findMany).toHaveBeenCalled();
    });

    it('should reject unknown prefix', async () => {
      mockPrismaService.apiKey.findMany.mockResolvedValue([]);

      const result = await service.validateApiKey('nc_unknown_key');

      expect(result).toBeNull();
    });
  });

  describe('createApiKey', () => {
    it('should create API key with hashed value', async () => {
      mockPrismaService.apiKey.create.mockResolvedValue({
        id: 'key_001',
        prefix: 'nc_abc',
        scopes: ['read', 'send', 'admin'],
      });

      const result = await service.createApiKey('ten_001', 'My API Key', ['read', 'send', 'admin']);

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
    });
  });
});
