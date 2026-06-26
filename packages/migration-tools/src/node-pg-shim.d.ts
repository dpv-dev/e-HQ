declare module "pg" {
  export interface ClientConfig {
    readonly connectionString: string;
    readonly connectionTimeoutMillis?: number;
    readonly keepAlive?: boolean;
    readonly keepAliveInitialDelayMillis?: number;
    readonly query_timeout?: number;
    readonly statement_timeout?: number;
    readonly ssl?: false | { readonly rejectUnauthorized: boolean };
  }

  export interface QueryResult {
    readonly rows: readonly Readonly<Record<string, unknown>>[];
  }

  export class Client {
    constructor(config: ClientConfig);
    connect(): Promise<void>;
    query(sql: string, values?: readonly unknown[]): Promise<QueryResult>;
    end(): Promise<void>;
  }
}

declare module "pg-copy-streams" {
  export function from(sql: string): unknown;
}

declare module "node:stream" {
  export interface Writable {}

  export class Readable {
    static from(iterable: Iterable<unknown>): unknown;
  }
}

declare module "node:stream/promises" {
  export function pipeline(source: unknown, destination: unknown): Promise<void>;
}

declare module "node:timers/promises" {
  export function setTimeout(delay: number): Promise<void>;
}

declare const process: {
  readonly env: Record<string, string | undefined>;
};
