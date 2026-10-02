import { DatabaseSync } from 'node:sqlite';

export function createDatabase(): DatabaseSync {
  const database = new DatabaseSync(':memory:');

  database.exec('CREATE TABLE items (id INTEGER PRIMARY KEY)');

  return database;
}
