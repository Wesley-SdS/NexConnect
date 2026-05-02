#!/usr/bin/env node

import { Command } from 'commander';
import { registerInstancesCommand } from './commands/instances.command';
import { registerSendCommand } from './commands/send.command';
import { registerMessagesCommand } from './commands/messages.command';
import { registerLogsCommand } from './commands/logs.command';
import { registerWebhooksCommand } from './commands/webhooks.command';
import { registerConfigCommand } from './commands/config.command';
import { registerProvidersCommand } from './commands/providers.command';

const program = new Command();

program
  .name('nexconnect')
  .description('CLI for NexConnect WhatsApp Engine')
  .version('1.0.0');

registerInstancesCommand(program);
registerSendCommand(program);
registerMessagesCommand(program);
registerLogsCommand(program);
registerWebhooksCommand(program);
registerConfigCommand(program);
registerProvidersCommand(program);

program.parse(process.argv);
