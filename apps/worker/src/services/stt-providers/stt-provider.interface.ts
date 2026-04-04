export interface ISttProvider {
  readonly name: string;
  transcribe(audioBuffer: Buffer, language: string): Promise<string>;
}
