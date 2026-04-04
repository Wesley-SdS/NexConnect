export class PhoneUtil {
  private static readonly PHONE_REGEX = /^\+?[1-9]\d{7,14}$/;
  private static readonly NON_DIGIT_REGEX = /\D/g;

  static normalize(phone: string): string {
    const digits = phone.replace(PhoneUtil.NON_DIGIT_REGEX, '');

    if (digits.startsWith('0')) {
      return '55' + digits.substring(1);
    }

    return digits;
  }

  static isValid(phone: string): boolean {
    const normalized = PhoneUtil.normalize(phone);
    return PhoneUtil.PHONE_REGEX.test(normalized);
  }

  static toJid(phone: string): string {
    const normalized = PhoneUtil.normalize(phone);
    return `${normalized}@s.whatsapp.net`;
  }

  static fromJid(jid: string): string {
    const digits = jid.split('@')[0];
    return `+${digits}`;
  }
}
