import { DatabaseSync } from 'node:sqlite';

export function createDatabase(): DatabaseSync {
  const database = new DatabaseSync(':memory:');

  database.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE items (id INTEGER PRIMARY KEY);
    CREATE TABLE selection (
      item_id INTEGER PRIMARY KEY REFERENCES items(id)
    );
  `);

  return database;
}
