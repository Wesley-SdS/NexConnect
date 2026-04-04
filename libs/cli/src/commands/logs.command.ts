import { Command } from 'commander';
import { getClient } from '../utils/client';
import { formatJson, printError } from '../utils/output';
const POLL_INTERVAL_MS = 2000;

export function registerLogsCommand(program: Command): void {
  const logs = program
    .command('logs')
    .description('View instance logs and events');

  logs
    .command('tail <instanceId>')
    .description('Stream events in real time (polling)')
    .option('--json', 'Output as raw JSON')
    .action(async (instanceId: string, opts) => {
      try {
        const client = getClient();
        console.log(`Tailing events for instance ${instanceId}... (Ctrl+C to stop)\n`);

        let lastTimestamp = new Date().toISOString();

        const poll = async (): Promise<void> => {
          try {
            const result = await client.messages.list(instanceId, {
              limit: 10,
              from: lastTimestamp,
            });

            for (const msg of result.data) {
              if (msg.timestamp > lastTimestamp) {
                lastTimestamp = msg.timestamp;
              }

              if (opts.json) {
                console.log(formatJson(msg));
              } else {
                const time = new Date(msg.timestamp).toLocaleTimeString();
                const arrow = msg.direction === 'inbound' ? '<-' : '->';
                const preview = msg.content.text ?? msg.content.caption ?? `[${msg.type}]`;
                console.log(`[${time}] ${arrow} ${msg.remoteJid}: ${preview}`);
              }
            }
          } catch {
            // Silently continue polling on errors
          }
        };

        const interval = setInterval(poll, POLL_INTERVAL_MS);
        await poll();

        process.on('SIGINT', () => {
          clearInterval(interval);
          console.log('\nStopped tailing.');
          process.exit(0);
        });

        // Keep process alive
        await new Promise<void>(() => {});
      } catch (err) {
        printError(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });

  logs
    .command('search <instanceId>')
    .description('Search message logs')
    .option('--type <type>', 'Filter by message type')
    .option('--direction <direction>', 'Filter by direction')
    .option('--from <date>', 'Start date (ISO 8601)')
    .option('--to <date>', 'End date (ISO 8601)')
    .option('--limit <limit>', 'Max results', '50')
    .option('--json', 'Output as JSON')
    .action(async (instanceId: string, opts) => {
      try {
        const client = getClient();
        const result = await client.messages.list(instanceId, {
          type: opts.type,
          direction: opts.direction,
          from: opts.from,
          to: opts.to,
          limit: parseInt(opts.limit, 10),
        });

        if (opts.json) {
          console.log(formatJson(result));
          return;
        }

        if (result.data.length === 0) {
          console.log('No messages found matching the criteria.');
          return;
        }

        for (const msg of result.data) {
          const time = new Date(msg.timestamp).toLocaleString();
          const arrow = msg.direction === 'inbound' ? '<-' : '->';
          const preview = msg.content.text ?? msg.content.caption ?? `[${msg.type}]`;
          console.log(`[${time}] ${arrow} ${msg.remoteJid} (${msg.type}): ${preview}`);
        }
        console.log(`\n${result.data.length} messages found.`);
      } catch (err) {
        printError(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });
}
