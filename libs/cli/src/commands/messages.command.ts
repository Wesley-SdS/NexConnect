import { Command } from 'commander';
import { getClient } from '../utils/client';
import { formatTable, formatJson, withSpinner, printError } from '../utils/output';

export function registerMessagesCommand(program: Command): void {
  const messages = program
    .command('messages')
    .description('View and manage messages');

  messages
    .command('list <instanceId>')
    .description('List messages for an instance')
    .option('--limit <limit>', 'Items per page', '20')
    .option('--page <page>', 'Page number', '1')
    .option('--direction <direction>', 'Filter by direction (inbound, outbound)')
    .option('--type <type>', 'Filter by message type')
    .option('--json', 'Output as JSON')
    .action(async (instanceId: string, opts) => {
      try {
        const client = getClient();
        const result = await withSpinner('Fetching messages...', () =>
          client.messages.list(instanceId, {
            page: parseInt(opts.page, 10),
            limit: parseInt(opts.limit, 10),
            direction: opts.direction,
            type: opts.type,
          }),
        );

        if (opts.json) {
          console.log(formatJson(result));
          return;
        }

        console.log(
          formatTable(result.data as unknown as Record<string, unknown>[], [
            { key: 'id', header: 'ID', width: 28 },
            { key: 'direction', header: 'DIR', width: 10 },
            { key: 'type', header: 'TYPE', width: 10 },
            { key: 'remoteJid', header: 'REMOTE', width: 20 },
            { key: 'status', header: 'STATUS', width: 12 },
            {
              key: 'timestamp',
              header: 'TIMESTAMP',
              width: 20,
              transform: (v) => new Date(v as string).toLocaleString(),
            },
          ]),
        );
        console.log(`\nPage ${result.meta.page}/${result.meta.totalPages} (${result.meta.total} total)`);
      } catch (err) {
        printError(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });

  messages
    .command('get <instanceId> <messageId>')
    .description('Get a specific message')
    .option('--json', 'Output as JSON')
    .action(async (instanceId: string, messageId: string, opts) => {
      try {
        const client = getClient();
        const message = await withSpinner('Fetching message...', () =>
          client.messages.get(instanceId, messageId),
        );

        if (opts.json) {
          console.log(formatJson(message));
          return;
        }

        console.log(`Message Details:`);
        console.log(`  ID:        ${message.id}`);
        console.log(`  Direction: ${message.direction}`);
        console.log(`  Type:      ${message.type}`);
        console.log(`  Remote:    ${message.remoteJid}`);
        console.log(`  Status:    ${message.status}`);
        console.log(`  Timestamp: ${new Date(message.timestamp).toLocaleString()}`);
        console.log(`  Content:   ${JSON.stringify(message.content)}`);
      } catch (err) {
        printError(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });
}
