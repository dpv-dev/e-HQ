export type MysqlCellValue = string | null;
export type MysqlDumpRecord = Readonly<Record<string, MysqlCellValue>>;

export interface MysqlParsedTable {
  readonly tableName: string;
  readonly insertStatementCount: number;
  readonly rows: readonly MysqlDumpRecord[];
}

export interface MysqlParsedDump {
  readonly tables: ReadonlyMap<string, MysqlParsedTable>;
}

export interface MysqlDumpParseErrorContext {
  readonly statementOffset: number;
  readonly tableName: string | null;
}

export class MysqlDumpParseError extends Error {
  readonly statementOffset: number;
  readonly tableName: string | null;

  constructor(message: string, context: MysqlDumpParseErrorContext) {
    const tableText = context.tableName === null ? "unknown table" : context.tableName;
    super(`${message} at offset ${String(context.statementOffset)} (${tableText}).`);
    this.name = "MysqlDumpParseError";
    this.statementOffset = context.statementOffset;
    this.tableName = context.tableName;
  }
}

interface ParsedInsertStatement {
  readonly tableName: string;
  readonly rows: readonly MysqlDumpRecord[];
}

export type MysqlInsertRowHandler = (tableName: string, row: MysqlDumpRecord) => void;
export type MysqlInsertRowAsyncHandler = (tableName: string, row: MysqlDumpRecord) => Promise<void>;

interface ParsedTableIdentifier {
  readonly tableName: string;
  readonly nextIndex: number;
}

interface ParsedTupleRows {
  readonly rows: readonly MysqlCellValue[][];
}

interface MutableParsedTable {
  insertStatementCount: number;
  readonly rows: MysqlDumpRecord[];
}

export function parseMysqlInsertDump(sql: string, selectedTables: readonly string[]): MysqlParsedDump {
  const selected = new Set<string>(selectedTables);
  const mutableTables = new Map<string, MutableParsedTable>();
  const insertRegex = /\bINSERT\s+INTO\s+/gi;
  let match = insertRegex.exec(sql);

  while (match !== null) {
    const statementStart = match.index;
    const statementEnd = findStatementEnd(sql, insertRegex.lastIndex, statementStart);
    const statement = sql.slice(statementStart, statementEnd + 1);
    insertRegex.lastIndex = statementEnd + 1;
    const parsed = parseInsertStatement(statement, statementStart, selected);
    if (parsed !== null) {
      appendParsedRows(mutableTables, parsed);
    }

    match = insertRegex.exec(sql);
  }

  return { tables: freezeTables(mutableTables) };
}

export function parseMysqlInsertStatementRows(
  statement: string,
  statementOffset: number,
  selectedTables: readonly string[],
  onRow: MysqlInsertRowHandler
): string | null {
  const selected = new Set<string>(selectedTables);
  const insertStart = skipLeadingMysqlTrivia(statement, 0, statementOffset);
  const intoMatch = /^INSERT\s+INTO\s+/i.exec(statement.slice(insertStart));
  if (intoMatch === null) {
    return null;
  }

  let index = insertStart + intoMatch[0].length;
  index = skipWhitespace(statement, index);
  const identifier = parseTableIdentifier(statement, index, statementOffset);
  const tableName = identifier.tableName;
  if (!selected.has(tableName)) {
    return null;
  }

  index = skipWhitespace(statement, identifier.nextIndex);
  if (statement.charAt(index) !== "(") {
    throw new MysqlDumpParseError("Column-list INSERTs are required for selected tables", {
      statementOffset,
      tableName
    });
  }

  const columnEnd = findClosingParen(statement, index, statementOffset, tableName);
  const columns = parseColumnList(statement.slice(index, columnEnd + 1), statementOffset, tableName);
  index = skipWhitespace(statement, columnEnd + 1);
  index = consumeValuesKeyword(statement, index, statementOffset, tableName);
  const valuesText = statement.slice(index, statementTerminatorIndex(statement, statementOffset, tableName));
  forEachTupleRow(valuesText, statementOffset, tableName, (values) => {
    onRow(tableName, recordFromTuple(columns, values, statementOffset, tableName));
  });

  return tableName;
}

export async function parseMysqlInsertStatementRowsAsync(
  statement: string,
  statementOffset: number,
  selectedTables: readonly string[],
  onRow: MysqlInsertRowAsyncHandler
): Promise<string | null> {
  const selected = new Set<string>(selectedTables);
  const insertStart = skipLeadingMysqlTrivia(statement, 0, statementOffset);
  const intoMatch = /^INSERT\s+INTO\s+/i.exec(statement.slice(insertStart));
  if (intoMatch === null) {
    return null;
  }

  let index = insertStart + intoMatch[0].length;
  index = skipWhitespace(statement, index);
  const identifier = parseTableIdentifier(statement, index, statementOffset);
  const tableName = identifier.tableName;
  if (!selected.has(tableName)) {
    return null;
  }

  index = skipWhitespace(statement, identifier.nextIndex);
  if (statement.charAt(index) !== "(") {
    throw new MysqlDumpParseError("Column-list INSERTs are required for selected tables", {
      statementOffset,
      tableName
    });
  }

  const columnEnd = findClosingParen(statement, index, statementOffset, tableName);
  const columns = parseColumnList(statement.slice(index, columnEnd + 1), statementOffset, tableName);
  index = skipWhitespace(statement, columnEnd + 1);
  index = consumeValuesKeyword(statement, index, statementOffset, tableName);
  const valuesText = statement.slice(index, statementTerminatorIndex(statement, statementOffset, tableName));
  await forEachTupleRowAsync(valuesText, statementOffset, tableName, async (values) => {
    await onRow(tableName, recordFromTuple(columns, values, statementOffset, tableName));
  });

  return tableName;
}

function findStatementEnd(sql: string, startIndex: number, statementStart: number): number {
  let inString = false;
  let escaped = false;
  let index = startIndex;
  while (index < sql.length) {
    const char = sql.charAt(index);
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === "'") {
        if (sql.charAt(index + 1) === "'") {
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

    index += 1;
  }

  throw new MysqlDumpParseError("Unterminated INSERT statement", {
    statementOffset: statementStart,
    tableName: null
  });
}

function parseInsertStatement(statement: string, statementOffset: number, selectedTables: ReadonlySet<string>): ParsedInsertStatement | null {
  const insertStart = skipLeadingMysqlTrivia(statement, 0, statementOffset);
  const intoMatch = /^INSERT\s+INTO\s+/i.exec(statement.slice(insertStart));
  if (intoMatch === null) {
    throw new MysqlDumpParseError("Invalid INSERT statement header", {
      statementOffset,
      tableName: null
    });
  }

  let index = insertStart + intoMatch[0].length;
  index = skipWhitespace(statement, index);
  const identifier = parseTableIdentifier(statement, index, statementOffset);
  const tableName = identifier.tableName;
  if (!selectedTables.has(tableName)) {
    return null;
  }

  index = skipWhitespace(statement, identifier.nextIndex);
  if (statement.charAt(index) !== "(") {
    throw new MysqlDumpParseError("Column-list INSERTs are required for selected tables", {
      statementOffset,
      tableName
    });
  }

  const columnEnd = findClosingParen(statement, index, statementOffset, tableName);
  const columns = parseColumnList(statement.slice(index, columnEnd + 1), statementOffset, tableName);
  index = skipWhitespace(statement, columnEnd + 1);
  index = consumeValuesKeyword(statement, index, statementOffset, tableName);
  const valuesText = statement.slice(index, statementTerminatorIndex(statement, statementOffset, tableName));
  const tupleRows = parseTupleRows(valuesText, statementOffset, tableName);
  const rows = tupleRows.rows.map((row) => recordFromTuple(columns, row, statementOffset, tableName));

  return {
    tableName,
    rows
  };
}

function statementTerminatorIndex(statement: string, statementOffset: number, tableName: string): number {
  let index = statement.length - 1;
  while (index >= 0 && /\s/.test(statement.charAt(index))) {
    index -= 1;
  }

  if (statement.charAt(index) !== ";") {
    throw new MysqlDumpParseError("Missing INSERT statement terminator", {
      statementOffset,
      tableName
    });
  }

  return index;
}

function skipLeadingMysqlTrivia(statement: string, startIndex: number, statementOffset: number): number {
  let index = skipWhitespace(statement, startIndex);
  while (index < statement.length) {
    if (statement.startsWith("--", index)) {
      index = skipUntilLineEnd(statement, index + 2);
      index = skipWhitespace(statement, index);
    } else if (statement.startsWith("#", index)) {
      index = skipUntilLineEnd(statement, index + 1);
      index = skipWhitespace(statement, index);
    } else if (statement.startsWith("/*", index)) {
      const commentEnd = statement.indexOf("*/", index + 2);
      if (commentEnd === -1) {
        throw new MysqlDumpParseError("Unterminated leading SQL comment", {
          statementOffset,
          tableName: null
        });
      }

      index = skipWhitespace(statement, commentEnd + 2);
    } else {
      return index;
    }
  }

  return index;
}

function skipUntilLineEnd(statement: string, startIndex: number): number {
  let index = startIndex;
  while (index < statement.length && statement.charAt(index) !== "\n") {
    index += 1;
  }

  return index;
}

function parseTableIdentifier(statement: string, startIndex: number, statementOffset: number): ParsedTableIdentifier {
  if (statement.charAt(startIndex) === "`") {
    let index = startIndex + 1;
    let tableName = "";
    while (index < statement.length) {
      const char = statement.charAt(index);
      if (char === "`") {
        return {
          tableName,
          nextIndex: index + 1
        };
      }

      tableName += char;
      index += 1;
    }

    throw new MysqlDumpParseError("Unterminated quoted table identifier", {
      statementOffset,
      tableName: null
    });
  }

  let index = startIndex;
  let tableName = "";
  while (index < statement.length) {
    const char = statement.charAt(index);
    if (/\s|\(/.test(char)) {
      break;
    }

    tableName += char;
    index += 1;
  }

  if (tableName.length === 0) {
    throw new MysqlDumpParseError("Missing table identifier", {
      statementOffset,
      tableName: null
    });
  }

  return {
    tableName,
    nextIndex: index
  };
}

function findClosingParen(statement: string, openIndex: number, statementOffset: number, tableName: string): number {
  let inBacktick = false;
  let index = openIndex + 1;
  while (index < statement.length) {
    const char = statement.charAt(index);
    if (char === "`") {
      inBacktick = !inBacktick;
    } else if (!inBacktick && char === ")") {
      return index;
    }

    index += 1;
  }

  throw new MysqlDumpParseError("Unterminated column list", {
    statementOffset,
    tableName
  });
}

function parseColumnList(columnListText: string, statementOffset: number, tableName: string): readonly string[] {
  const inner = columnListText.slice(1, columnListText.length - 1);
  const columns = inner.split(",").map((column) => normalizeColumnIdentifier(column));
  if (columns.length === 0 || columns.some((column) => column.length === 0)) {
    throw new MysqlDumpParseError("Invalid column list", {
      statementOffset,
      tableName
    });
  }

  return columns;
}

function normalizeColumnIdentifier(column: string): string {
  const trimmed = column.trim();
  if (trimmed.startsWith("`") && trimmed.endsWith("`")) {
    return trimmed.slice(1, trimmed.length - 1).replaceAll("``", "`");
  }

  return trimmed;
}

function consumeValuesKeyword(statement: string, startIndex: number, statementOffset: number, tableName: string): number {
  const remaining = statement.slice(startIndex);
  const match = /^\s*VALUES\s*/i.exec(remaining);
  if (match === null) {
    throw new MysqlDumpParseError("INSERT statement is missing VALUES", {
      statementOffset,
      tableName
    });
  }

  return startIndex + match[0].length;
}

function parseTupleRows(valuesText: string, statementOffset: number, tableName: string): ParsedTupleRows {
  const rows: MysqlCellValue[][] = [];
  forEachTupleRow(valuesText, statementOffset, tableName, (row) => {
    rows.push([...row]);
  });

  return { rows };
}

function forEachTupleRow(
  valuesText: string,
  statementOffset: number,
  tableName: string,
  onTuple: (values: readonly MysqlCellValue[]) => void
): void {
  let index = 0;
  while (index < valuesText.length) {
    index = skipTupleSeparator(valuesText, index);
    if (index >= valuesText.length) {
      break;
    }

    if (valuesText.charAt(index) !== "(") {
      throw new MysqlDumpParseError("Expected row tuple", {
        statementOffset,
        tableName
      });
    }

    const tuple = parseTuple(valuesText, index + 1, statementOffset, tableName);
    onTuple(tuple.values);
    index = tuple.nextIndex;
  }
}

async function forEachTupleRowAsync(
  valuesText: string,
  statementOffset: number,
  tableName: string,
  onTuple: (values: readonly MysqlCellValue[]) => Promise<void>
): Promise<void> {
  let index = 0;
  while (index < valuesText.length) {
    index = skipTupleSeparator(valuesText, index);
    if (index >= valuesText.length) {
      break;
    }

    if (valuesText.charAt(index) !== "(") {
      throw new MysqlDumpParseError("Expected row tuple", {
        statementOffset,
        tableName
      });
    }

    const tuple = parseTuple(valuesText, index + 1, statementOffset, tableName);
    await onTuple(tuple.values);
    index = tuple.nextIndex;
  }
}

interface ParsedTuple {
  readonly values: readonly MysqlCellValue[];
  readonly nextIndex: number;
}

function parseTuple(valuesText: string, startIndex: number, statementOffset: number, tableName: string): ParsedTuple {
  const values: MysqlCellValue[] = [];
  let token = "";
  let quoted = false;
  let inString = false;
  let index = startIndex;

  while (index < valuesText.length) {
    const char = valuesText.charAt(index);
    if (inString) {
      if (char === "\\") {
        const escaped = valuesText.charAt(index + 1);
        if (escaped.length === 0) {
          throw new MysqlDumpParseError("Unterminated string escape", {
            statementOffset,
            tableName
          });
        }

        token += decodeMysqlEscape(escaped);
        index += 2;
        continue;
      }

      if (char === "'") {
        if (valuesText.charAt(index + 1) === "'") {
          token += "'";
          index += 2;
          continue;
        }

        inString = false;
        index += 1;
        continue;
      }

      token += char;
      index += 1;
      continue;
    }

    if (char === "'") {
      if (token.trim().length > 0) {
        throw new MysqlDumpParseError("Quoted value has unexpected prefix", {
          statementOffset,
          tableName
        });
      }

      token = "";
      quoted = true;
      inString = true;
      index += 1;
      continue;
    }

    if (char === "," || char === ")") {
      values.push(finalizeMysqlCell(token, quoted, statementOffset, tableName));
      token = "";
      quoted = false;
      index += 1;
      if (char === ")") {
        return {
          values,
          nextIndex: index
        };
      }

      continue;
    }

    if (quoted && /\s/.test(char)) {
      index += 1;
      continue;
    }

    token += char;
    index += 1;
  }

  throw new MysqlDumpParseError("Unterminated row tuple", {
    statementOffset,
    tableName
  });
}

function finalizeMysqlCell(token: string, quoted: boolean, statementOffset: number, tableName: string): MysqlCellValue {
  if (quoted) {
    return token;
  }

  const trimmed = token.trim();
  if (/^NULL$/i.test(trimmed)) {
    return null;
  }

  if (trimmed.length === 0) {
    throw new MysqlDumpParseError("Empty unquoted cell", {
      statementOffset,
      tableName
    });
  }

  return trimmed;
}

function decodeMysqlEscape(value: string): string {
  if (value === "0") {
    return "\0";
  }

  if (value === "b") {
    return "\b";
  }

  if (value === "n") {
    return "\n";
  }

  if (value === "r") {
    return "\r";
  }

  if (value === "t") {
    return "\t";
  }

  if (value === "Z") {
    return "\u001a";
  }

  return value;
}

function skipTupleSeparator(valuesText: string, startIndex: number): number {
  let index = startIndex;
  while (index < valuesText.length) {
    const char = valuesText.charAt(index);
    if (char !== "," && !/\s/.test(char)) {
      return index;
    }

    index += 1;
  }

  return index;
}

function recordFromTuple(columns: readonly string[], values: readonly MysqlCellValue[], statementOffset: number, tableName: string): MysqlDumpRecord {
  if (columns.length !== values.length) {
    throw new MysqlDumpParseError(`Column/value mismatch: ${String(columns.length)} columns, ${String(values.length)} values`, {
      statementOffset,
      tableName
    });
  }

  const record: Record<string, MysqlCellValue> = {};
  columns.forEach((column, index) => {
    const value = values[index];
    if (value === undefined) {
      throw new MysqlDumpParseError("Missing tuple value", {
        statementOffset,
        tableName
      });
    }

    record[column] = value;
  });

  return record;
}

function appendParsedRows(tables: Map<string, MutableParsedTable>, parsed: ParsedInsertStatement): void {
  const existing = tables.get(parsed.tableName);
  if (existing === undefined) {
    tables.set(parsed.tableName, {
      insertStatementCount: 1,
      rows: [...parsed.rows]
    });
    return;
  }

  existing.insertStatementCount += 1;
  existing.rows.push(...parsed.rows);
}

function freezeTables(tables: ReadonlyMap<string, MutableParsedTable>): ReadonlyMap<string, MysqlParsedTable> {
  const frozen = new Map<string, MysqlParsedTable>();
  for (const [tableName, table] of tables.entries()) {
    frozen.set(tableName, {
      tableName,
      insertStatementCount: table.insertStatementCount,
      rows: [...table.rows]
    });
  }

  return frozen;
}

function skipWhitespace(text: string, startIndex: number): number {
  let index = startIndex;
  while (index < text.length && /\s/.test(text.charAt(index))) {
    index += 1;
  }

  return index;
}
