import { Command } from 'commander';
import { readFileSync } from 'fs';
import { getClient } from '../utils/client';
import { formatJson, withSpinner, printError } from '../utils/output';
import type {
  CredentialPayload,
  CreateCredentialRequest,
  ProviderCredentialStatus,
  ProviderType,
} from '@nexconnect/sdk';

const PROVIDER_TYPES: ProviderType[] = [
  'BAILEYS',
  'META_WHATSAPP_CLOUD',
  'META_INSTAGRAM',
  'META_MESSENGER',
  'TWILIO_SMS',
  'TWILIO_WHATSAPP',
  'TWILIO_VOICE',
  'TWILIO_VERIFY',
];

const STATUSES: ProviderCredentialStatus[] = ['ACTIVE', 'REVOKED', 'EXPIRED', 'ERROR'];

function readCredentialsFile(path: string): CredentialPayload {
  try {
    const raw = readFileSync(path, 'utf8');
    const parsed = JSON.parse(raw) as CredentialPayload;
    return parsed;
  } catch (err) {
    throw new Error(
      `Failed to read credentials file at "${path}": ${(err as Error).message}. ` +
        'File must contain a JSON object matching one of the credential shapes.',
    );
  }
}

function assertProviderType(value: string): asserts value is ProviderType {
  if (!PROVIDER_TYPES.includes(value as ProviderType)) {
    throw new Error(
      `Invalid provider "${value}". Expected one of: ${PROVIDER_TYPES.join(', ')}.`,
    );
  }
}

function assertStatus(value: string): asserts value is ProviderCredentialStatus {
  if (!STATUSES.includes(value as ProviderCredentialStatus)) {
    throw new Error(
      `Invalid status "${value}". Expected one of: ${STATUSES.join(', ')}.`,
    );
  }
}

export function registerProvidersCommand(program: Command): void {
  const providers = program
    .command('providers')
    .alias('credentials')
    .description('Manage Meta and Twilio provider credentials');

  providers
    .command('list')
    .description('List provider credentials')
    .option('--provider <provider>', 'Filter by provider type')
    .option('--instance <instanceId>', 'Filter by instance UUID')
    .option('--json', 'Output as JSON')
    .action(async (opts) => {
      try {
        const client = getClient();
        const params: { provider?: ProviderType; instanceId?: string } = {};
        if (opts.provider) {
          assertProviderType(opts.provider);
          params.provider = opts.provider;
        }
        if (opts.instance) params.instanceId = opts.instance;

        const credentials = await withSpinner('Listing credentials...', () =>
          client.providers.listCredentials(params),
        );

        if (opts.json) {
          console.log(formatJson(credentials));
          return;
        }

        if (credentials.length === 0) {
          console.log('No credentials registered.');
          return;
        }

        console.log(`Found ${credentials.length} credential(s):`);
        for (const c of credentials) {
          console.log(
            `  ${c.id}  [${c.status}]  ${c.provider}  "${c.displayName}"` +
              (c.phoneNumber ? `  ${c.phoneNumber}` : ''),
          );
        }
      } catch (err) {
        printError(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });

  providers
    .command('get <id>')
    .description('Get a credential by id')
    .option('--json', 'Output as JSON')
    .action(async (id: string, opts) => {
      try {
        const client = getClient();
        const credential = await withSpinner('Fetching credential...', () =>
          client.providers.getCredential(id),
        );
        console.log(formatJson(credential));
      } catch (err) {
        printError(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });

  providers
    .command('create')
    .description('Register a new provider credential')
    .requiredOption('--provider <provider>', 'Provider type (e.g., META_WHATSAPP_CLOUD)')
    .requiredOption('--name <displayName>', 'Human-readable label')
    .requiredOption(
      '--credentials-file <path>',
      'Path to a JSON file with the provider credentials payload',
    )
    .option('--instance <instanceId>', 'Bind the credential to a specific instance')
    .option('--callback-url <url>', 'Customer webhook callback URL')
    .option('--expires-at <iso>', 'Credential expiry timestamp (ISO 8601)')
    .option('--json', 'Output as JSON')
    .action(async (opts) => {
      try {
        assertProviderType(opts.provider);
        const payload = readCredentialsFile(opts.credentialsFile);

        const body: CreateCredentialRequest = {
          provider: opts.provider,
          displayName: opts.name,
          credentials: payload,
        };
        if (opts.instance) body.instanceId = opts.instance;
        if (opts.callbackUrl) body.webhookCallbackUrl = opts.callbackUrl;
        if (opts.expiresAt) body.expiresAt = opts.expiresAt;

        const client = getClient();
        const created = await withSpinner('Registering credential...', () =>
          client.providers.createCredential(body),
        );

        if (opts.json) {
          console.log(formatJson(created));
          return;
        }
        console.log(`Credential created: ${created.id}`);
        console.log(`  Provider: ${created.provider}`);
        console.log(`  Name:     ${created.displayName}`);
        console.log(`  Status:   ${created.status}`);
        if (created.externalAccountId)
          console.log(`  Account:  ${created.externalAccountId}`);
        if (created.externalPhoneId) console.log(`  Phone ID: ${created.externalPhoneId}`);
      } catch (err) {
        printError(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });

  providers
    .command('rotate <id>')
    .description('Rotate the secret material on an existing credential')
    .requiredOption(
      '--credentials-file <path>',
      'Path to a JSON file with the new provider credentials payload',
    )
    .option('--json', 'Output as JSON')
    .action(async (id: string, opts) => {
      try {
        const payload = readCredentialsFile(opts.credentialsFile);
        const client = getClient();
        const updated = await withSpinner('Rotating credential...', () =>
          client.providers.rotateCredential(id, payload),
        );
        if (opts.json) {
          console.log(formatJson(updated));
          return;
        }
        console.log(`Credential ${id} rotated. Last rotated at ${updated.lastRotatedAt}.`);
      } catch (err) {
        printError(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });

  providers
    .command('set-status <id> <status>')
    .description('Update a credential status (ACTIVE, REVOKED, EXPIRED, ERROR)')
    .action(async (id: string, status: string) => {
      try {
        assertStatus(status);
        const client = getClient();
        const updated = await withSpinner(`Setting status to ${status}...`, () =>
          client.providers.updateCredential(id, { status }),
        );
        console.log(`Credential ${id} status -> ${updated.status}.`);
      } catch (err) {
        printError(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });

  providers
    .command('delete <id>')
    .description('Delete a provider credential')
    .action(async (id: string) => {
      try {
        const client = getClient();
        await withSpinner('Deleting credential...', () =>
          client.providers.deleteCredential(id),
        );
        console.log(`Credential ${id} deleted.`);
      } catch (err) {
        printError(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });
}
