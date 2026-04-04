import { Injectable, Logger } from '@nestjs/common';
import * as QRCode from 'qrcode';

export interface QrCodeResult {
  base64: string;
  svg: string;
  expiresAt: string;
}

@Injectable()
export class QrCodeService {
  private readonly logger = new Logger(QrCodeService.name);

  async generate(data: string, expiresInMs: number = 45000): Promise<QrCodeResult> {
    const [base64, svg] = await Promise.all([
      QRCode.toDataURL(data, { errorCorrectionLevel: 'M', width: 400 }),
      QRCode.toString(data, { type: 'svg', errorCorrectionLevel: 'M', width: 400 }),
    ]);

    const expiresAt = new Date(Date.now() + expiresInMs).toISOString();

    this.logger.debug({ dataLength: data.length, expiresAt }, 'qrcode.generated');

    return { base64, svg, expiresAt };
  }
}
