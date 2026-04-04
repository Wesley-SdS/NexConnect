import { Command } from 'commander';
import { readConfig, setConfigValue } from '../utils/config';
import { formatJson, printError } from '../utils/output';

const KEY_MAP: Record<string, 'apiKey' | 'baseUrl'> = {
  'api-key': 'apiKey',
  'base-url': 'baseUrl',
};

export function registerConfigCommand(program: Command): void {
  const config = program
    .command('config')
    .description('Manage CLI configuration');

  config
    .command('set <key> <value>')
    .description('Set a configuration value (api-key, base-url)')
    .action((key: string, value: string) => {
      try {
        const mappedKey = KEY_MAP[key];
        if (!mappedKey) {
          printError(`Unknown config key "${key}". Valid keys: ${Object.keys(KEY_MAP).join(', ')}`);
          process.exit(1);
        }

        setConfigValue(mappedKey, value);

        const displayValue = mappedKey === 'apiKey'
          ? `${value.slice(0, 8)}...${'*'.repeat(Math.max(0, value.length - 12))}${value.slice(-4)}`
          : value;

        console.log(`Configuration updated: ${key} = ${displayValue}`);
      } catch (err) {
        printError(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });

  config
    .command('get')
    .description('Show current configuration')
    .option('--json', 'Output as JSON')
    .action((opts) => {
      try {
        const cfg = readConfig();

        if (opts.json) {
          console.log(formatJson(cfg));
          return;
        }

        console.log('Current configuration:');
        console.log(`  API Key:  ${cfg.apiKey ? `${cfg.apiKey.slice(0, 8)}...${'*'.repeat(Math.max(0, cfg.apiKey.length - 12))}${cfg.apiKey.slice(-4)}` : '(not set)'}`);
        console.log(`  Base URL: ${cfg.baseUrl ?? '(default: https://api.nexconnect.io/v1)'}`);
      } catch (err) {
        printError(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });
}
