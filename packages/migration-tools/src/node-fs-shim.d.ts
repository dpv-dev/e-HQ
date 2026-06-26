declare module "node:fs" {
  export function createReadStream(path: string, options: { readonly encoding: "utf8" }): AsyncIterable<string>;
  export function readFileSync(path: URL, encoding: "utf8"): string;
}

declare module "node:crypto" {
  export interface Hash {
    update(data: string | Uint8Array): Hash;
    digest(): Uint8Array;
  }

  export function createHash(algorithm: "sha1"): Hash;
}
