import { PiiRedactor } from '../observability/pii-redactor';

describe('PiiRedactor', () => {
  describe('CPF redaction', () => {
    it('should redact formatted CPF', () => {
      const result = PiiRedactor.redact('CPF: 123.456.789-09');
      expect(result).toBe('CPF: [REDACTED_CPF]');
    });

    it('should redact unformatted CPF', () => {
      const result = PiiRedactor.redact('CPF: 12345678909');
      expect(result).toBe('CPF: [REDACTED_CPF]');
    });

    it('should redact multiple CPFs in same string', () => {
      const result = PiiRedactor.redact(
        'First: 123.456.789-09, Second: 987.654.321-00',
      );
      expect(result).toBe('First: [REDACTED_CPF], Second: [REDACTED_CPF]');
    });
  });

  describe('CNPJ redaction', () => {
    it('should redact formatted CNPJ', () => {
      const result = PiiRedactor.redact('CNPJ: 12.345.678/0001-90');
      expect(result).toBe('CNPJ: [REDACTED_CNPJ]');
    });

    it('should redact unformatted CNPJ', () => {
      const result = PiiRedactor.redact('CNPJ: 12345678000190');
      expect(result).toBe('CNPJ: [REDACTED_CNPJ]');
    });
  });

  describe('phone redaction', () => {
    it('should redact Brazilian phone with country code', () => {
      const result = PiiRedactor.redact('Phone: +55 11 91234-5678');
      expect(result).toBe('Phone: [REDACTED_PHONE]');
    });

    it('should redact phone with parentheses', () => {
      const result = PiiRedactor.redact('Phone: +55 (11) 91234-5678');
      expect(result).toBe('Phone: [REDACTED_PHONE]');
    });

    it('should redact phone without spaces', () => {
      const result = PiiRedactor.redact('Phone: +5511912345678');
      expect(result).toBe('Phone: [REDACTED_PHONE]');
    });
  });

  describe('email redaction', () => {
    it('should redact email addresses', () => {
      const result = PiiRedactor.redact('Email: user@example.com');
      expect(result).toBe('Email: [REDACTED_EMAIL]');
    });

    it('should redact email with dots and plus signs', () => {
      const result = PiiRedactor.redact('Email: john.doe+tag@company.co.br');
      expect(result).toBe('Email: [REDACTED_EMAIL]');
    });
  });

  describe('credit card redaction', () => {
    it('should redact 16-digit credit card number', () => {
      const result = PiiRedactor.redact('Card: 4111111111111111');
      expect(result).toBe('Card: [REDACTED_CREDIT_CARD]');
    });

    it('should redact card with spaces', () => {
      const result = PiiRedactor.redact('Card: 4111 1111 1111 1111');
      expect(result).toBe('Card: [REDACTED_CREDIT_CARD]');
    });

    it('should redact card with dashes', () => {
      const result = PiiRedactor.redact('Card: 4111-1111-1111-1111');
      expect(result).toBe('Card: [REDACTED_CREDIT_CARD]');
    });
  });

  describe('recursive object redaction', () => {
    it('should redact nested objects', () => {
      const input = {
        user: {
          name: 'John',
          cpf: '123.456.789-09',
          contact: {
            email: 'john@example.com',
            phone: '+55 11 91234-5678',
          },
        },
      };

      const result = PiiRedactor.redact(input);

      expect(result.user.name).toBe('John');
      expect(result.user.cpf).toBe('[REDACTED_CPF]');
      expect(result.user.contact.email).toBe('[REDACTED_EMAIL]');
      expect(result.user.contact.phone).toBe('[REDACTED_PHONE]');
    });

    it('should redact arrays', () => {
      const input = ['user@example.com', '123.456.789-09', 'normal text'];
      const result = PiiRedactor.redact(input);

      expect(result[0]).toBe('[REDACTED_EMAIL]');
      expect(result[1]).toBe('[REDACTED_CPF]');
      expect(result[2]).toBe('normal text');
    });

    it('should handle mixed arrays and objects', () => {
      const input = {
        items: [
          { email: 'a@b.com' },
          { phone: '+55 11 91234-5678' },
        ],
      };

      const result = PiiRedactor.redact(input);

      expect(result.items[0].email).toBe('[REDACTED_EMAIL]');
      expect(result.items[1].phone).toBe('[REDACTED_PHONE]');
    });
  });

  describe('non-sensitive data preservation', () => {
    it('should not alter numbers', () => {
      expect(PiiRedactor.redact(42)).toBe(42);
    });

    it('should not alter booleans', () => {
      expect(PiiRedactor.redact(true)).toBe(true);
    });

    it('should not alter null', () => {
      expect(PiiRedactor.redact(null)).toBeNull();
    });

    it('should not alter undefined', () => {
      expect(PiiRedactor.redact(undefined)).toBeUndefined();
    });

    it('should not alter non-PII strings', () => {
      const input = 'Hello World, order #12345';
      expect(PiiRedactor.redact(input)).toBe(input);
    });

    it('should not mutate original object', () => {
      const input = { email: 'user@example.com' };
      const result = PiiRedactor.redact(input);

      expect(input.email).toBe('user@example.com');
      expect(result.email).toBe('[REDACTED_EMAIL]');
    });
  });
});
