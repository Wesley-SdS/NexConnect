import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

export interface CliConfig {
  apiKey?: string;
  baseUrl?: string;
}

const CONFIG_DIR = path.join(os.homedir(), '.nexconnect');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

function ensureConfigDir(): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

export function readConfig(): CliConfig {
  try {
    if (!fs.existsSync(CONFIG_FILE)) {
      return {};
    }
    const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
    return JSON.parse(raw) as CliConfig;
  } catch {
    return {};
  }
}

export function writeConfig(config: CliConfig): void {
  ensureConfigDir();
  const existing = readConfig();
  const merged = { ...existing, ...config };
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(merged, null, 2), 'utf-8');
}

export function getConfigValue(key: keyof CliConfig): string | undefined {
  const config = readConfig();
  return config[key];
}

export function setConfigValue(key: keyof CliConfig, value: string): void {
  writeConfig({ [key]: value });
}

export function getApiKey(): string {
  const envKey = process.env['NEXCONNECT_API_KEY'];
  if (envKey) return envKey;

  const configKey = getConfigValue('apiKey');
  if (configKey) return configKey;

  throw new Error(
    'API key not found. Set it via:\n' +
      '  nexconnect config set api-key <key>\n' +
      '  or export NEXCONNECT_API_KEY=<key>',
  );
}

export function getBaseUrl(): string {
  return (
    process.env['NEXCONNECT_BASE_URL'] ??
    getConfigValue('baseUrl') ??
    'https://api.nexconnect.io/v1'
  );
}
