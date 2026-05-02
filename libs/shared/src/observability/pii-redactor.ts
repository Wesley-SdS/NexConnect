/**
 * PII Redactor for LGPD compliance.
 *
 * Recursively scans objects and strings, replacing personally identifiable
 * information with redaction tokens. Does NOT mutate the original object.
 */
export class PiiRedactor {
  /** CPF: 000.000.000-00 or 00000000000 */
  private static readonly CPF_PATTERN =
    /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g;

  /** CNPJ: 00.000.000/0000-00 or 00000000000000 */
  private static readonly CNPJ_PATTERN =
    /\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g;

  /** Credit card: 16 digits with optional spaces/dashes */
  private static readonly CREDIT_CARD_PATTERN =
    /\b(?:\d[ -]*?){13,19}\b/g;

  /** Brazilian phone: +55 (XX) 9XXXX-XXXX or variants */
  private static readonly PHONE_PATTERN =
    /\+55\s*\(?\d{2}\)?\s*9?\d{4}[-\s]?\d{4}\b/g;

  /** Email */
  private static readonly EMAIL_PATTERN =
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;

  // Order matters: more specific patterns must run first so a Brazilian
  // phone like "+55 11 91234-5678" doesn't get partially matched as a
  // credit card by the looser 13–19 digit pattern.
  private static readonly PATTERNS: ReadonlyArray<{
    regex: RegExp;
    token: string;
    validate?: (match: string) => boolean;
  }> = [
    { regex: PiiRedactor.EMAIL_PATTERN, token: '[REDACTED_EMAIL]' },
    { regex: PiiRedactor.PHONE_PATTERN, token: '[REDACTED_PHONE]' },
    { regex: PiiRedactor.CNPJ_PATTERN, token: '[REDACTED_CNPJ]', validate: PiiRedactor.isValidCnpjLength },
    { regex: PiiRedactor.CPF_PATTERN, token: '[REDACTED_CPF]', validate: PiiRedactor.isValidCpfLength },
    { regex: PiiRedactor.CREDIT_CARD_PATTERN, token: '[REDACTED_CREDIT_CARD]', validate: PiiRedactor.isValidCardLength },
  ];

  static redact(obj: any): any {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (typeof obj === 'string') {
      return PiiRedactor.redactString(obj);
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => PiiRedactor.redact(item));
    }

    if (typeof obj === 'object') {
      return PiiRedactor.redactObject(obj);
    }

    return obj;
  }

  private static redactString(value: string): string {
    let result = value;

    for (const { regex, token, validate } of PiiRedactor.PATTERNS) {
      result = result.replace(new RegExp(regex.source, regex.flags), (match) => {
        if (validate && !validate(match)) {
          return match;
        }
        return token;
      });
    }

    return result;
  }

  private static redactObject(obj: Record<string, any>): Record<string, any> {
    const redacted: Record<string, any> = {};

    for (const key of Object.keys(obj)) {
      redacted[key] = PiiRedactor.redact(obj[key]);
    }

    return redacted;
  }

  private static isValidCpfLength(match: string): boolean {
    const digits = match.replace(/\D/g, '');
    return digits.length === 11;
  }

  private static isValidCnpjLength(match: string): boolean {
    const digits = match.replace(/\D/g, '');
    return digits.length === 14;
  }

  private static isValidCardLength(match: string): boolean {
    const digits = match.replace(/\D/g, '');
    return digits.length >= 13 && digits.length <= 19;
  }
}
