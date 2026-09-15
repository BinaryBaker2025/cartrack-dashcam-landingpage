import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';

// Execute production SQL against SQLite rather than mocking query outcomes.
export function createTestDatabase() {
  const sqlite = new DatabaseSync(':memory:');
  const directory = new URL('../migrations/', import.meta.url);
  for (const file of readdirSync(directory)
    .filter((name) => name.endsWith('.sql'))
    .sort())
    sqlite.exec(readFileSync(new URL(file, directory), 'utf8'));
  function prepare(sql: string) {
    let values: (string | number | null)[] = [];
    return {
      bind(...args: (string | number | null)[]) {
        values = args;
        return this;
      },
      async first() {
        return sqlite.prepare(sql).get(...values) || null;
      },
      async all() {
        return sqlite.prepare(sql).all(...values);
      },
    };
  }
  return {
    sqlite,
    prepare,
    async batch(statements: ReturnType<typeof prepare>[]) {
      return Promise.all(statements.map((statement) => statement.all()));
    },
  };
}
