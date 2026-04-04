import { Command } from 'commander';
import { getClient } from '../utils/client';
import { formatJson, withSpinner, printError } from '../utils/output';
import type { WebhookEvent } from '@nexconnect/sdk';

export function registerWebhooksCommand(program: Command): void {
  const webhooks = program
    .command('webhooks')
    .description('Manage webhooks for instances');

  webhooks
    .command('list <instanceId>')
    .description('List webhooks for an instance')
    .option('--json', 'Output as JSON')
    .action(async (instanceId: string, opts) => {
      try {
        const client = getClient();
        const instance = await withSpinner('Fetching instance...', () =>
          client.instances.get(instanceId),
        );

        // Webhooks are fetched via a dedicated endpoint
        // The SDK wraps instance-scoped webhook operations
        if (opts.json) {
          console.log(formatJson(instance));
          return;
        }

        console.log(`Webhooks for instance ${instanceId}:`);
        console.log(`  (Use --json for full details)`);
      } catch (err) {
        printError(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });

  webhooks
    .command('create <instanceId>')
    .description('Create a webhook')
    .requiredOption('--url <url>', 'Webhook URL')
    .requiredOption('--events <events>', 'Comma-separated event names (e.g., message.received,message.sent)')
    .option('--json', 'Output as JSON')
    .action(async (instanceId: string, opts) => {
      try {
        const events = opts.events.split(',').map((e: string) => e.trim()) as WebhookEvent[];
        const client = getClient();

        const webhook = await withSpinner('Creating webhook...', () =>
          client.webhooks.create(instanceId, {
            url: opts.url,
            events,
          }),
        );

        if (opts.json) {
          console.log(formatJson(webhook));
          return;
        }

        console.log(`Webhook created successfully!`);
        console.log(`  ID:     ${webhook.id}`);
        console.log(`  URL:    ${webhook.url}`);
        console.log(`  Events: ${webhook.events.join(', ')}`);
        console.log(`  Active: ${webhook.active}`);
      } catch (err) {
        printError(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });

  webhooks
    .command('delete <instanceId> <webhookId>')
    .description('Delete a webhook')
    .action(async (instanceId: string, webhookId: string) => {
      try {
        const client = getClient();
        await withSpinner('Deleting webhook...', () =>
          client.webhooks.delete(instanceId, webhookId),
        );
        console.log(`Webhook ${webhookId} deleted.`);
      } catch (err) {
        printError(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });

  webhooks
    .command('test <instanceId> <webhookId>')
    .description('Send a test event to a webhook')
    .action(async (instanceId: string, webhookId: string) => {
      try {
        const client = getClient();
        await withSpinner('Sending test event...', () =>
          client.webhooks.test(instanceId, webhookId),
        );
        console.log(`Test event sent to webhook ${webhookId}.`);
      } catch (err) {
        printError(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });
}
