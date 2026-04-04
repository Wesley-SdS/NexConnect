import { ulid } from 'ulid';

export class UlidUtil {
  static generate(): string {
    return ulid();
  }
}
