import chalk from 'chalk';
import ora from 'ora';

interface Column {
  key: string;
  header: string;
  width?: number;
  transform?: (value: unknown) => string;
}

export function formatTable(data: Record<string, unknown>[], columns: Column[]): string {
  if (data.length === 0) {
    return chalk.yellow('No results found.');
  }

  const resolvedColumns = columns.map((col) => {
    const maxDataWidth = data.reduce((max, row) => {
      const value = col.transform
        ? col.transform(row[col.key])
        : String(row[col.key] ?? '');
      return Math.max(max, value.length);
    }, 0);
    const width = col.width ?? Math.max(col.header.length, maxDataWidth);
    return { ...col, width };
  });

  const headerLine = chalk.bold(
    resolvedColumns.map((col) => col.header.padEnd(col.width)).join('  '),
  );

  const separatorLine = chalk.dim(
    resolvedColumns.map((col) => '-'.repeat(col.width)).join('  '),
  );

  const rows = data.map((row) =>
    resolvedColumns
      .map((col) => {
        const value = col.transform
          ? col.transform(row[col.key])
          : String(row[col.key] ?? '');
        return value.padEnd(col.width);
      })
      .join('  '),
  );

  return [headerLine, separatorLine, ...rows].join('\n');
}

export function formatJson(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

export async function withSpinner<T>(
  message: string,
  fn: () => Promise<T>,
): Promise<T> {
  const spinner = ora(message).start();
  try {
    const result = await fn();
    spinner.succeed();
    return result;
  } catch (err) {
    spinner.fail();
    throw err;
  }
}

export function printError(message: string): void {
  console.error(chalk.red(`Error: ${message}`));
}
