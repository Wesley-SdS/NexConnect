import { Command } from 'commander';
import { getClient } from '../utils/client';
import { formatJson, withSpinner, printError } from '../utils/output';
import type { MessageType, MessageContent } from '@nexconnect/sdk';

export function registerSendCommand(program: Command): void {
  program
    .command('send <instanceId>')
    .description('Send a message through an instance')
    .requiredOption('--to <phone>', 'Recipient phone number (e.g., +5511999999999)')
    .requiredOption('--type <type>', 'Message type (text, image, video, audio, document, location, contact)')
    .option('--text <text>', 'Text content (for type=text)')
    .option('--caption <caption>', 'Caption (for media types)')
    .option('--url <url>', 'Media URL (for image, video, audio, document)')
    .option('--filename <filename>', 'Filename (for document type)')
    .option('--latitude <lat>', 'Latitude (for location type)')
    .option('--longitude <lng>', 'Longitude (for location type)')
    .option('--contact-name <name>', 'Contact name (for contact type)')
    .option('--contact-phone <phone>', 'Contact phone (for contact type)')
    .option('--json', 'Output as JSON')
    .action(async (instanceId: string, opts) => {
      try {
        const content = buildContent(opts);
        const client = getClient();

        const message = await withSpinner('Sending message...', () =>
          client.messages.send(instanceId, {
            to: opts.to,
            type: opts.type as MessageType,
            content,
          }),
        );

        if (opts.json) {
          console.log(formatJson(message));
          return;
        }

        console.log(`Message sent successfully!`);
        console.log(`  ID:        ${message.id}`);
        console.log(`  To:        ${message.remoteJid}`);
        console.log(`  Type:      ${message.type}`);
        console.log(`  Status:    ${message.status}`);
        console.log(`  Timestamp: ${new Date(message.timestamp).toLocaleString()}`);
      } catch (err) {
        printError(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });
}

function buildContent(opts: Record<string, string | undefined>): MessageContent {
  const content: MessageContent = {};

  if (opts.text) content.text = opts.text;
  if (opts.caption) content.caption = opts.caption;
  if (opts.url) content.url = opts.url;
  if (opts.filename) content.filename = opts.filename;
  if (opts.latitude) content.latitude = parseFloat(opts.latitude);
  if (opts.longitude) content.longitude = parseFloat(opts.longitude);
  if (opts.contactName) content.contactName = opts.contactName;
  if (opts.contactPhone) content.contactPhone = opts.contactPhone;

  return content;
}
