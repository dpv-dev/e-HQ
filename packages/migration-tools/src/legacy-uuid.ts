import { createHash } from "node:crypto";

const ehqLegacyRootNamespace = "54f6345b-1d80-42b2-a7b1-2bf1021b3f4e";

export function legacyUuidForTable(tableName: string, legacyId: string | number): string {
  const namespace = uuidV5(`ehq-platform:${tableName}`, ehqLegacyRootNamespace);
  return uuidV5(String(legacyId), namespace);
}

export function legacyIntegerId(value: string | number | bigint | null | undefined, tableName: string, columnName: string): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const text = String(value).trim();
  if (!/^\d+$/u.test(text)) {
    throw new Error(`Legacy ID must be an unsigned integer for ${tableName}.${columnName}: ${text}.`);
  }

  const parsed = Number(text);
  if (!Number.isSafeInteger(parsed)) {
    throw new Error(`Legacy ID exceeds JavaScript safe integer range for ${tableName}.${columnName}: ${text}.`);
  }

  return parsed;
}

function uuidV5(name: string, namespaceUuid: string): string {
  const namespaceBytes = parseUuidBytes(namespaceUuid);
  const nameBytes = new TextEncoder().encode(name);
  const hash = createHash("sha1").update(namespaceBytes).update(nameBytes).digest();
  const uuidBytes = Array.from(hash.slice(0, 16));
  const versionByte = uuidBytes[6];
  const variantByte = uuidBytes[8];

  if (versionByte === undefined || variantByte === undefined) {
    throw new Error("UUIDv5 SHA-1 digest did not contain enough bytes.");
  }

  uuidBytes[6] = (versionByte & 0x0f) | 0x50;
  uuidBytes[8] = (variantByte & 0x3f) | 0x80;
  return formatUuidBytes(uuidBytes);
}

function parseUuidBytes(uuid: string): Uint8Array {
  const normalized = uuid.replaceAll("-", "").toLowerCase();
  if (!/^[0-9a-f]{32}$/u.test(normalized)) {
    throw new Error(`Invalid namespace UUID: ${uuid}.`);
  }

  const bytes = new Uint8Array(16);
  for (let index = 0; index < bytes.length; index += 1) {
    const start = index * 2;
    const hex = normalized.slice(start, start + 2);
    bytes[index] = Number.parseInt(hex, 16);
  }

  return bytes;
}

function formatUuidBytes(bytes: readonly number[]): string {
  const hex = bytes.map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}
