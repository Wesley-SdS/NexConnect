import { Command } from 'commander';
import { getClient } from '../utils/client';
import { formatTable, formatJson, withSpinner, printError } from '../utils/output';
import type { InstanceStatus } from '@nexconnect/sdk';

export function registerInstancesCommand(program: Command): void {
  const instances = program
    .command('instances')
    .description('Manage WhatsApp instances');

  instances
    .command('list')
    .description('List all instances')
    .option('--status <status>', 'Filter by status (CONNECTED, DISCONNECTED, CONNECTING, BANNED)')
    .option('--page <page>', 'Page number', '1')
    .option('--limit <limit>', 'Items per page', '20')
    .option('--json', 'Output as JSON')
    .action(async (opts) => {
      try {
        const client = getClient();
        const result = await withSpinner('Fetching instances...', () =>
          client.instances.list({
            status: opts.status as InstanceStatus | undefined,
            page: parseInt(opts.page, 10),
            limit: parseInt(opts.limit, 10),
          }),
        );

        if (opts.json) {
          console.log(formatJson(result));
          return;
        }

        console.log(
          formatTable(result.data as unknown as Record<string, unknown>[], [
            { key: 'id', header: 'ID', width: 28 },
            { key: 'name', header: 'NAME', width: 24 },
            { key: 'status', header: 'STATUS', width: 14 },
            { key: 'phoneNumber', header: 'PHONE', width: 16, transform: (v) => String(v ?? '-') },
            { key: 'createdAt', header: 'CREATED', width: 20, transform: (v) => new Date(v as string).toLocaleDateString() },
          ]),
        );
        console.log(`\nPage ${result.meta.page}/${result.meta.totalPages} (${result.meta.total} total)`);
      } catch (err) {
        printError(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });

  instances
    .command('get <id>')
    .description('Get instance details')
    .option('--json', 'Output as JSON')
    .action(async (id: string, opts) => {
      try {
        const client = getClient();
        const instance = await withSpinner('Fetching instance...', () =>
          client.instances.get(id),
        );

        if (opts.json) {
          console.log(formatJson(instance));
          return;
        }

        console.log(
          formatTable([instance as unknown as Record<string, unknown>], [
            { key: 'id', header: 'ID', width: 28 },
            { key: 'name', header: 'NAME', width: 24 },
            { key: 'status', header: 'STATUS', width: 14 },
            { key: 'phoneNumber', header: 'PHONE', width: 16, transform: (v) => String(v ?? '-') },
            { key: 'type', header: 'TYPE', width: 14 },
          ]),
        );
      } catch (err) {
        printError(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });

  instances
    .command('create')
    .description('Create a new instance')
    .requiredOption('--name <name>', 'Instance name')
    .option('--type <type>', 'Connection type (QR_CODE or PAIRING_CODE)', 'QR_CODE')
    .option('--json', 'Output as JSON')
    .action(async (opts) => {
      try {
        const client = getClient();
        const instance = await withSpinner('Creating instance...', () =>
          client.instances.create({
            name: opts.name,
            type: opts.type,
          }),
        );

        if (opts.json) {
          console.log(formatJson(instance));
          return;
        }

        console.log(`Instance created successfully!`);
        console.log(`  ID:     ${instance.id}`);
        console.log(`  Name:   ${instance.name}`);
        console.log(`  Type:   ${instance.type}`);
        console.log(`  Status: ${instance.status}`);
      } catch (err) {
        printError(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });

  instances
    .command('delete <id>')
    .description('Delete an instance')
    .action(async (id: string) => {
      try {
        const client = getClient();
        await withSpinner('Deleting instance...', () => client.instances.delete(id));
        console.log(`Instance ${id} deleted.`);
      } catch (err) {
        printError(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });

  instances
    .command('power-on <id>')
    .description('Power on an instance')
    .action(async (id: string) => {
      try {
        const client = getClient();
        await withSpinner('Powering on...', () => client.instances.powerOn(id));
        console.log(`Instance ${id} powered on.`);
      } catch (err) {
        printError(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });

  instances
    .command('power-off <id>')
    .description('Power off an instance')
    .action(async (id: string) => {
      try {
        const client = getClient();
        await withSpinner('Powering off...', () => client.instances.powerOff(id));
        console.log(`Instance ${id} powered off.`);
      } catch (err) {
        printError(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });

  instances
    .command('restart <id>')
    .description('Restart an instance')
    .action(async (id: string) => {
      try {
        const client = getClient();
        await withSpinner('Restarting...', () => client.instances.restart(id));
        console.log(`Instance ${id} restarted.`);
      } catch (err) {
        printError(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });

  instances
    .command('qrcode <id>')
    .description('Get QR code for an instance')
    .option('--json', 'Output as JSON')
    .action(async (id: string, opts) => {
      try {
        const client = getClient();
        const qr = await withSpinner('Fetching QR code...', () =>
          client.instances.getQrCode(id),
        );

        if (opts.json) {
          console.log(formatJson(qr));
          return;
        }

        console.log(`QR Code (base64):`);
        console.log(qr.qrCode);
        console.log(`\nExpires at: ${new Date(qr.expiresAt).toLocaleString()}`);
      } catch (err) {
        printError(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });
}
