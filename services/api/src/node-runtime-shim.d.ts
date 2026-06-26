declare module "pg" {
  export interface PoolConfig {
    readonly connectionString: string;
    readonly connectionTimeoutMillis?: number;
    readonly idleTimeoutMillis?: number;
    readonly keepAlive?: boolean;
    readonly keepAliveInitialDelayMillis?: number;
    readonly max?: number;
    readonly query_timeout?: number;
    readonly statement_timeout?: number;
    readonly ssl?: false | { readonly rejectUnauthorized: boolean };
  }

  export interface QueryResult {
    readonly rows: readonly Readonly<Record<string, unknown>>[];
  }

  export class Pool {
    constructor(config: PoolConfig);
    query(sql: string, values?: readonly unknown[]): Promise<QueryResult>;
    end(): Promise<void>;
  }
}

declare module "node:http" {
  import type { Readable } from "node:stream";

  export interface IncomingMessage extends Readable {
    readonly headers: Readonly<Record<string, string | readonly string[] | undefined>>;
    readonly method?: string;
    readonly url?: string;
  }

  export interface ServerResponse {
    writeHead(statusCode: number, headers: Readonly<Record<string, string>>): void;
    end(body?: string): void;
  }

  export interface Server {
    listen(port: number, host: string, callback: () => void): void;
    close(callback: (error?: Error) => void): void;
  }

  export function createServer(listener: (request: IncomingMessage, response: ServerResponse) => void): Server;
}

declare module "node:stream" {
  export class Readable {
    static toWeb(stream: Readable): ReadableStream<Uint8Array>;
    static fromWeb(stream: ReadableStream<Uint8Array>): Readable;
    pipe(destination: unknown): unknown;
  }
}

declare module "node:fs" {
  export function existsSync(path: string): boolean;
  export function readFileSync(path: string, encoding: "utf8"): string;
}

declare module "node:child_process" {
  export interface SpawnOptions {
    readonly cwd?: string;
    readonly env?: Record<string, string | undefined>;
    readonly stdio?: readonly unknown[];
  }

  export interface ChildProcess {
    on(event: "exit", listener: (code: number | null, signal: string | null) => void): ChildProcess;
    on(event: "error", listener: (error: Error) => void): ChildProcess;
    stdout: Readable | null;
    stderr: Readable | null;
    kill(signal?: "SIGTERM" | "SIGKILL"): boolean;
  }

  export function spawn(file: string, args: readonly string[], options: SpawnOptions): ChildProcess;
}

declare module "node:fs/promises" {
  export function mkdir(path: string, options: { readonly recursive: boolean }): Promise<void>;
  export function writeFile(path: string, data: string, encoding: "utf8"): Promise<void>;
}

declare module "node:path" {
  export function resolve(...paths: readonly string[]): string;
  export function dirname(path: string): string;
}

declare const process: {
  readonly env: Record<string, string | undefined>;
  readonly stdout: {
    write(message: string): void;
  };
  on(event: "SIGINT" | "SIGTERM", listener: () => void): void;
  exit(code: number): never;
  cwd(): string;
};
