import { createReadStream } from "node:fs";
import { parseMysqlInsertStatementRows, parseMysqlInsertStatementRowsAsync, type MysqlDumpRecord } from "./mysql-dump-parser.js";

export interface MysqlDumpStreamRow {
  readonly tableName: string;
  readonly row: MysqlDumpRecord;
}

export interface MysqlDumpStreamResult {
  readonly insertStatementCounts: ReadonlyMap<string, number>;
}

export async function streamMysqlInsertDumpRows(
  filePath: string,
  selectedTables: readonly string[],
  onRow: (row: MysqlDumpStreamRow) => void
): Promise<MysqlDumpStreamResult> {
  const insertStatementCounts = new Map<string, number>();
  let buffer = "";
  let statementOffset = 0;

  for await (const chunk of createReadStream(filePath, { encoding: "utf8" })) {
    buffer += chunk;
    let statementEnd = findStatementEnd(buffer);
    while (statementEnd !== -1) {
      const statement = buffer.slice(0, statementEnd + 1);
      const tableName = parseMysqlInsertStatementRows(statement, statementOffset, selectedTables, (parsedTableName, row) => {
        onRow({ tableName: parsedTableName, row });
      });
      if (tableName !== null) {
        insertStatementCounts.set(tableName, (insertStatementCounts.get(tableName) ?? 0) + 1);
      }

      buffer = buffer.slice(statementEnd + 1);
      statementOffset += statementEnd + 1;
      statementEnd = findStatementEnd(buffer);
    }
  }

  if (buffer.trim().length > 0) {
    throw new Error(`Unterminated SQL statement at offset ${String(statementOffset)}.`);
  }

  return { insertStatementCounts };
}

export async function streamMysqlInsertDumpRowsAsync(
  filePath: string,
  selectedTables: readonly string[],
  onRow: (row: MysqlDumpStreamRow) => Promise<void>
): Promise<MysqlDumpStreamResult> {
  const insertStatementCounts = new Map<string, number>();
  let buffer = "";
  let statementOffset = 0;

  for await (const chunk of createReadStream(filePath, { encoding: "utf8" })) {
    buffer += chunk;
    let statementEnd = findStatementEnd(buffer);
    while (statementEnd !== -1) {
      const statement = buffer.slice(0, statementEnd + 1);
      const tableName = await parseMysqlInsertStatementRowsAsync(statement, statementOffset, selectedTables, async (parsedTableName, row) => {
        await onRow({ tableName: parsedTableName, row });
      });
      if (tableName !== null) {
        insertStatementCounts.set(tableName, (insertStatementCounts.get(tableName) ?? 0) + 1);
      }

      buffer = buffer.slice(statementEnd + 1);
      statementOffset += statementEnd + 1;
      statementEnd = findStatementEnd(buffer);
    }
  }

  if (buffer.trim().length > 0) {
    throw new Error(`Unterminated SQL statement at offset ${String(statementOffset)}.`);
  }

  return { insertStatementCounts };
}

function findStatementEnd(text: string): number {
  let inString = false;
  let escaped = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text.charAt(index);
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === "'") {
        if (text.charAt(index + 1) === "'") {
          index += 1;
        } else {
          inString = false;
        }
      }
    } else if (char === "'") {
      inString = true;
    } else if (char === ";") {
      return index;
    }
  }

  return -1;
}
