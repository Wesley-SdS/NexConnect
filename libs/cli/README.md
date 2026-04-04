# @nexconnect/cli

Command-line interface for managing NexConnect instances, messages, and webhooks.

## Installation

```bash
npm install -g @nexconnect/cli
```

## Configuration

Set your API key and base URL:

```bash
nexconnect config set apiKey nc_live_...
nexconnect config set baseUrl https://api.nexconnect.io/v1
```

Configuration is stored in `~/.nexconnect/config.json`.

## Commands

### `nexconnect instances`

Manage WhatsApp instances.

```bash
# List all instances
nexconnect instances list

# Create a new instance
nexconnect instances create --name "My Bot"

# Get instance details
nexconnect instances get <instance-id>

# Connect an instance (returns QR code)
nexconnect instances connect <instance-id>

# Disconnect an instance
nexconnect instances disconnect <instance-id>

# Delete an instance
nexconnect instances delete <instance-id>
```

### `nexconnect send`

Send messages through a connected instance.

```bash
# Send a text message
nexconnect send <instance-id> --to +5511999999999 --text "Hello!"

# Send an image
nexconnect send <instance-id> --to +5511999999999 --image ./photo.jpg --caption "Check this out"

# Send a document
nexconnect send <instance-id> --to +5511999999999 --document ./report.pdf
```

### `nexconnect messages`

View message history.

```bash
# List recent messages
nexconnect messages list <instance-id>

# Filter by direction
nexconnect messages list <instance-id> --direction inbound

# Get message details
nexconnect messages get <instance-id> <message-id>
```

### `nexconnect webhooks`

Manage webhook endpoints.

```bash
# List webhooks for an instance
nexconnect webhooks list <instance-id>

# Create a webhook
nexconnect webhooks create <instance-id> --url https://example.com/webhook --events message.received,message.sent

# Delete a webhook
nexconnect webhooks delete <instance-id> <webhook-id>
```

### `nexconnect logs`

View instance event logs.

```bash
# Stream logs in real-time
nexconnect logs <instance-id>

# Filter by event type
nexconnect logs <instance-id> --type message.received
```

### `nexconnect config`

Manage CLI configuration.

```bash
# Set a config value
nexconnect config set <key> <value>

# Get a config value
nexconnect config get <key>

# Show all config
nexconnect config list
```

## Output Formats

By default, output is formatted for human readability. Use `--json` for machine-readable output:

```bash
nexconnect instances list --json
```

## Dependencies

- Built on [Commander.js](https://github.com/tj/commander.js) for argument parsing
- Uses `@nexconnect/sdk` for API communication
- Colored output via [Chalk](https://github.com/chalk/chalk)
- Loading spinners via [Ora](https://github.com/sindresorhus/ora)
