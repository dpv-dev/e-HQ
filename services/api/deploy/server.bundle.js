var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/server.ts
import { createServer } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { Readable } from "node:stream";
import { dirname, resolve } from "node:path";

// ../../packages/auth/src/index.ts
function getAuthRoleFromMetadata(appMetadata, userMetadata) {
  return normalizeAuthRoleId(
    stringFromMetadata(appMetadata, "role") ?? stringFromMetadata(userMetadata, "role") ?? stringFromMetadata(appMetadata, "ehq_role") ?? stringFromMetadata(userMetadata, "ehq_role")
  );
}
function normalizeAuthRoleId(role) {
  const normalizedRole = role?.trim().toLowerCase() ?? "";
  if (normalizedRole === "administrator" || normalizedRole === "admin") {
    return "administrator";
  }
  if (normalizedRole === "operator") {
    return "operator";
  }
  if (normalizedRole === "office") {
    return "office";
  }
  if (normalizedRole === "distribution") {
    return "distribution";
  }
  if (normalizedRole === "bot_office" || normalizedRole === "bot-office" || normalizedRole === "sophie") {
    return "bot_office";
  }
  if (normalizedRole === "bot_distribution" || normalizedRole === "bot-distribution" || normalizedRole === "theo" || normalizedRole === "th\xE9o") {
    return "bot_distribution";
  }
  return "viewer";
}
function stringFromMetadata(metadata, key) {
  const value = metadata[key];
  if (typeof value !== "string") {
    return null;
  }
  const trimmedValue = value.trim();
  return trimmedValue.length === 0 ? null : trimmedValue;
}

// ../../node_modules/.pnpm/jose@6.2.3/node_modules/jose/dist/webapi/lib/buffer_utils.js
var encoder = new TextEncoder();
var decoder = new TextDecoder();
var MAX_INT32 = 2 ** 32;
function concat(...buffers) {
  const size = buffers.reduce((acc, { length }) => acc + length, 0);
  const buf = new Uint8Array(size);
  let i = 0;
  for (const buffer of buffers) {
    buf.set(buffer, i);
    i += buffer.length;
  }
  return buf;
}
function encode(string) {
  const bytes = new Uint8Array(string.length);
  for (let i = 0; i < string.length; i++) {
    const code = string.charCodeAt(i);
    if (code > 127) {
      throw new TypeError("non-ASCII string encountered in encode()");
    }
    bytes[i] = code;
  }
  return bytes;
}

// ../../node_modules/.pnpm/jose@6.2.3/node_modules/jose/dist/webapi/lib/base64.js
function decodeBase64(encoded) {
  if (Uint8Array.fromBase64) {
    return Uint8Array.fromBase64(encoded);
  }
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// ../../node_modules/.pnpm/jose@6.2.3/node_modules/jose/dist/webapi/util/base64url.js
function decode(input) {
  if (Uint8Array.fromBase64) {
    return Uint8Array.fromBase64(typeof input === "string" ? input : decoder.decode(input), {
      alphabet: "base64url"
    });
  }
  let encoded = input;
  if (encoded instanceof Uint8Array) {
    encoded = decoder.decode(encoded);
  }
  encoded = encoded.replace(/-/g, "+").replace(/_/g, "/");
  try {
    return decodeBase64(encoded);
  } catch {
    throw new TypeError("The input to be decoded is not correctly encoded.");
  }
}

// ../../node_modules/.pnpm/jose@6.2.3/node_modules/jose/dist/webapi/lib/crypto_key.js
var unusable = (name, prop = "algorithm.name") => new TypeError(`CryptoKey does not support this operation, its ${prop} must be ${name}`);
var isAlgorithm = (algorithm, name) => algorithm.name === name;
function getHashLength(hash) {
  return parseInt(hash.name.slice(4), 10);
}
function checkHashLength(algorithm, expected) {
  const actual = getHashLength(algorithm.hash);
  if (actual !== expected)
    throw unusable(`SHA-${expected}`, "algorithm.hash");
}
function getNamedCurve(alg) {
  switch (alg) {
    case "ES256":
      return "P-256";
    case "ES384":
      return "P-384";
    case "ES512":
      return "P-521";
    default:
      throw new Error("unreachable");
  }
}
function checkUsage(key, usage) {
  if (usage && !key.usages.includes(usage)) {
    throw new TypeError(`CryptoKey does not support this operation, its usages must include ${usage}.`);
  }
}
function checkSigCryptoKey(key, alg, usage) {
  switch (alg) {
    case "HS256":
    case "HS384":
    case "HS512": {
      if (!isAlgorithm(key.algorithm, "HMAC"))
        throw unusable("HMAC");
      checkHashLength(key.algorithm, parseInt(alg.slice(2), 10));
      break;
    }
    case "RS256":
    case "RS384":
    case "RS512": {
      if (!isAlgorithm(key.algorithm, "RSASSA-PKCS1-v1_5"))
        throw unusable("RSASSA-PKCS1-v1_5");
      checkHashLength(key.algorithm, parseInt(alg.slice(2), 10));
      break;
    }
    case "PS256":
    case "PS384":
    case "PS512": {
      if (!isAlgorithm(key.algorithm, "RSA-PSS"))
        throw unusable("RSA-PSS");
      checkHashLength(key.algorithm, parseInt(alg.slice(2), 10));
      break;
    }
    case "Ed25519":
    case "EdDSA": {
      if (!isAlgorithm(key.algorithm, "Ed25519"))
        throw unusable("Ed25519");
      break;
    }
    case "ML-DSA-44":
    case "ML-DSA-65":
    case "ML-DSA-87": {
      if (!isAlgorithm(key.algorithm, alg))
        throw unusable(alg);
      break;
    }
    case "ES256":
    case "ES384":
    case "ES512": {
      if (!isAlgorithm(key.algorithm, "ECDSA"))
        throw unusable("ECDSA");
      const expected = getNamedCurve(alg);
      const actual = key.algorithm.namedCurve;
      if (actual !== expected)
        throw unusable(expected, "algorithm.namedCurve");
      break;
    }
    default:
      throw new TypeError("CryptoKey does not support this operation");
  }
  checkUsage(key, usage);
}

// ../../node_modules/.pnpm/jose@6.2.3/node_modules/jose/dist/webapi/lib/invalid_key_input.js
function message(msg, actual, ...types2) {
  types2 = types2.filter(Boolean);
  if (types2.length > 2) {
    const last = types2.pop();
    msg += `one of type ${types2.join(", ")}, or ${last}.`;
  } else if (types2.length === 2) {
    msg += `one of type ${types2[0]} or ${types2[1]}.`;
  } else {
    msg += `of type ${types2[0]}.`;
  }
  if (actual == null) {
    msg += ` Received ${actual}`;
  } else if (typeof actual === "function" && actual.name) {
    msg += ` Received function ${actual.name}`;
  } else if (typeof actual === "object" && actual != null) {
    if (actual.constructor?.name) {
      msg += ` Received an instance of ${actual.constructor.name}`;
    }
  }
  return msg;
}
var invalidKeyInput = (actual, ...types2) => message("Key must be ", actual, ...types2);
var withAlg = (alg, actual, ...types2) => message(`Key for the ${alg} algorithm must be `, actual, ...types2);

// ../../node_modules/.pnpm/jose@6.2.3/node_modules/jose/dist/webapi/util/errors.js
var JOSEError = class extends Error {
  static code = "ERR_JOSE_GENERIC";
  code = "ERR_JOSE_GENERIC";
  constructor(message2, options) {
    super(message2, options);
    this.name = this.constructor.name;
    Error.captureStackTrace?.(this, this.constructor);
  }
};
var JWTClaimValidationFailed = class extends JOSEError {
  static code = "ERR_JWT_CLAIM_VALIDATION_FAILED";
  code = "ERR_JWT_CLAIM_VALIDATION_FAILED";
  claim;
  reason;
  payload;
  constructor(message2, payload, claim = "unspecified", reason = "unspecified") {
    super(message2, { cause: { claim, reason, payload } });
    this.claim = claim;
    this.reason = reason;
    this.payload = payload;
  }
};
var JWTExpired = class extends JOSEError {
  static code = "ERR_JWT_EXPIRED";
  code = "ERR_JWT_EXPIRED";
  claim;
  reason;
  payload;
  constructor(message2, payload, claim = "unspecified", reason = "unspecified") {
    super(message2, { cause: { claim, reason, payload } });
    this.claim = claim;
    this.reason = reason;
    this.payload = payload;
  }
};
var JOSEAlgNotAllowed = class extends JOSEError {
  static code = "ERR_JOSE_ALG_NOT_ALLOWED";
  code = "ERR_JOSE_ALG_NOT_ALLOWED";
};
var JOSENotSupported = class extends JOSEError {
  static code = "ERR_JOSE_NOT_SUPPORTED";
  code = "ERR_JOSE_NOT_SUPPORTED";
};
var JWSInvalid = class extends JOSEError {
  static code = "ERR_JWS_INVALID";
  code = "ERR_JWS_INVALID";
};
var JWTInvalid = class extends JOSEError {
  static code = "ERR_JWT_INVALID";
  code = "ERR_JWT_INVALID";
};
var JWKSInvalid = class extends JOSEError {
  static code = "ERR_JWKS_INVALID";
  code = "ERR_JWKS_INVALID";
};
var JWKSNoMatchingKey = class extends JOSEError {
  static code = "ERR_JWKS_NO_MATCHING_KEY";
  code = "ERR_JWKS_NO_MATCHING_KEY";
  constructor(message2 = "no applicable key found in the JSON Web Key Set", options) {
    super(message2, options);
  }
};
var JWKSMultipleMatchingKeys = class extends JOSEError {
  [Symbol.asyncIterator];
  static code = "ERR_JWKS_MULTIPLE_MATCHING_KEYS";
  code = "ERR_JWKS_MULTIPLE_MATCHING_KEYS";
  constructor(message2 = "multiple matching keys found in the JSON Web Key Set", options) {
    super(message2, options);
  }
};
var JWKSTimeout = class extends JOSEError {
  static code = "ERR_JWKS_TIMEOUT";
  code = "ERR_JWKS_TIMEOUT";
  constructor(message2 = "request timed out", options) {
    super(message2, options);
  }
};
var JWSSignatureVerificationFailed = class extends JOSEError {
  static code = "ERR_JWS_SIGNATURE_VERIFICATION_FAILED";
  code = "ERR_JWS_SIGNATURE_VERIFICATION_FAILED";
  constructor(message2 = "signature verification failed", options) {
    super(message2, options);
  }
};

// ../../node_modules/.pnpm/jose@6.2.3/node_modules/jose/dist/webapi/lib/is_key_like.js
var isCryptoKey = (key) => {
  if (key?.[Symbol.toStringTag] === "CryptoKey")
    return true;
  try {
    return key instanceof CryptoKey;
  } catch {
    return false;
  }
};
var isKeyObject = (key) => key?.[Symbol.toStringTag] === "KeyObject";
var isKeyLike = (key) => isCryptoKey(key) || isKeyObject(key);

// ../../node_modules/.pnpm/jose@6.2.3/node_modules/jose/dist/webapi/lib/helpers.js
function decodeBase64url(value, label, ErrorClass) {
  try {
    return decode(value);
  } catch {
    throw new ErrorClass(`Failed to base64url decode the ${label}`);
  }
}

// ../../node_modules/.pnpm/jose@6.2.3/node_modules/jose/dist/webapi/lib/type_checks.js
var isObjectLike = (value) => typeof value === "object" && value !== null;
function isObject(input) {
  if (!isObjectLike(input) || Object.prototype.toString.call(input) !== "[object Object]") {
    return false;
  }
  if (Object.getPrototypeOf(input) === null) {
    return true;
  }
  let proto = input;
  while (Object.getPrototypeOf(proto) !== null) {
    proto = Object.getPrototypeOf(proto);
  }
  return Object.getPrototypeOf(input) === proto;
}
function isDisjoint(...headers) {
  const sources = headers.filter(Boolean);
  if (sources.length === 0 || sources.length === 1) {
    return true;
  }
  let acc;
  for (const header of sources) {
    const parameters = Object.keys(header);
    if (!acc || acc.size === 0) {
      acc = new Set(parameters);
      continue;
    }
    for (const parameter of parameters) {
      if (acc.has(parameter)) {
        return false;
      }
      acc.add(parameter);
    }
  }
  return true;
}
var isJWK = (key) => isObject(key) && typeof key.kty === "string";
var isPrivateJWK = (key) => key.kty !== "oct" && (key.kty === "AKP" && typeof key.priv === "string" || typeof key.d === "string");
var isPublicJWK = (key) => key.kty !== "oct" && key.d === void 0 && key.priv === void 0;
var isSecretJWK = (key) => key.kty === "oct" && typeof key.k === "string";

// ../../node_modules/.pnpm/jose@6.2.3/node_modules/jose/dist/webapi/lib/signing.js
function checkKeyLength(alg, key) {
  if (alg.startsWith("RS") || alg.startsWith("PS")) {
    const { modulusLength } = key.algorithm;
    if (typeof modulusLength !== "number" || modulusLength < 2048) {
      throw new TypeError(`${alg} requires key modulusLength to be 2048 bits or larger`);
    }
  }
}
function subtleAlgorithm(alg, algorithm) {
  const hash = `SHA-${alg.slice(-3)}`;
  switch (alg) {
    case "HS256":
    case "HS384":
    case "HS512":
      return { hash, name: "HMAC" };
    case "PS256":
    case "PS384":
    case "PS512":
      return { hash, name: "RSA-PSS", saltLength: parseInt(alg.slice(-3), 10) >> 3 };
    case "RS256":
    case "RS384":
    case "RS512":
      return { hash, name: "RSASSA-PKCS1-v1_5" };
    case "ES256":
    case "ES384":
    case "ES512":
      return { hash, name: "ECDSA", namedCurve: algorithm.namedCurve };
    case "Ed25519":
    case "EdDSA":
      return { name: "Ed25519" };
    case "ML-DSA-44":
    case "ML-DSA-65":
    case "ML-DSA-87":
      return { name: alg };
    default:
      throw new JOSENotSupported(`alg ${alg} is not supported either by JOSE or your javascript runtime`);
  }
}
async function getSigKey(alg, key, usage) {
  if (key instanceof Uint8Array) {
    if (!alg.startsWith("HS")) {
      throw new TypeError(invalidKeyInput(key, "CryptoKey", "KeyObject", "JSON Web Key"));
    }
    return crypto.subtle.importKey("raw", key, { hash: `SHA-${alg.slice(-3)}`, name: "HMAC" }, false, [usage]);
  }
  checkSigCryptoKey(key, alg, usage);
  return key;
}
async function verify(alg, key, signature, data) {
  const cryptoKey = await getSigKey(alg, key, "verify");
  checkKeyLength(alg, cryptoKey);
  const algorithm = subtleAlgorithm(alg, cryptoKey.algorithm);
  try {
    return await crypto.subtle.verify(algorithm, cryptoKey, signature, data);
  } catch {
    return false;
  }
}

// ../../node_modules/.pnpm/jose@6.2.3/node_modules/jose/dist/webapi/lib/jwk_to_key.js
var unsupportedAlg = 'Invalid or unsupported JWK "alg" (Algorithm) Parameter value';
function subtleMapping(jwk) {
  let algorithm;
  let keyUsages;
  switch (jwk.kty) {
    case "AKP": {
      switch (jwk.alg) {
        case "ML-DSA-44":
        case "ML-DSA-65":
        case "ML-DSA-87":
          algorithm = { name: jwk.alg };
          keyUsages = jwk.priv ? ["sign"] : ["verify"];
          break;
        default:
          throw new JOSENotSupported(unsupportedAlg);
      }
      break;
    }
    case "RSA": {
      switch (jwk.alg) {
        case "PS256":
        case "PS384":
        case "PS512":
          algorithm = { name: "RSA-PSS", hash: `SHA-${jwk.alg.slice(-3)}` };
          keyUsages = jwk.d ? ["sign"] : ["verify"];
          break;
        case "RS256":
        case "RS384":
        case "RS512":
          algorithm = { name: "RSASSA-PKCS1-v1_5", hash: `SHA-${jwk.alg.slice(-3)}` };
          keyUsages = jwk.d ? ["sign"] : ["verify"];
          break;
        case "RSA-OAEP":
        case "RSA-OAEP-256":
        case "RSA-OAEP-384":
        case "RSA-OAEP-512":
          algorithm = {
            name: "RSA-OAEP",
            hash: `SHA-${parseInt(jwk.alg.slice(-3), 10) || 1}`
          };
          keyUsages = jwk.d ? ["decrypt", "unwrapKey"] : ["encrypt", "wrapKey"];
          break;
        default:
          throw new JOSENotSupported(unsupportedAlg);
      }
      break;
    }
    case "EC": {
      switch (jwk.alg) {
        case "ES256":
        case "ES384":
        case "ES512":
          algorithm = {
            name: "ECDSA",
            namedCurve: { ES256: "P-256", ES384: "P-384", ES512: "P-521" }[jwk.alg]
          };
          keyUsages = jwk.d ? ["sign"] : ["verify"];
          break;
        case "ECDH-ES":
        case "ECDH-ES+A128KW":
        case "ECDH-ES+A192KW":
        case "ECDH-ES+A256KW":
          algorithm = { name: "ECDH", namedCurve: jwk.crv };
          keyUsages = jwk.d ? ["deriveBits"] : [];
          break;
        default:
          throw new JOSENotSupported(unsupportedAlg);
      }
      break;
    }
    case "OKP": {
      switch (jwk.alg) {
        case "Ed25519":
        case "EdDSA":
          algorithm = { name: "Ed25519" };
          keyUsages = jwk.d ? ["sign"] : ["verify"];
          break;
        case "ECDH-ES":
        case "ECDH-ES+A128KW":
        case "ECDH-ES+A192KW":
        case "ECDH-ES+A256KW":
          algorithm = { name: jwk.crv };
          keyUsages = jwk.d ? ["deriveBits"] : [];
          break;
        default:
          throw new JOSENotSupported(unsupportedAlg);
      }
      break;
    }
    default:
      throw new JOSENotSupported('Invalid or unsupported JWK "kty" (Key Type) Parameter value');
  }
  return { algorithm, keyUsages };
}
async function jwkToKey(jwk) {
  if (!jwk.alg) {
    throw new TypeError('"alg" argument is required when "jwk.alg" is not present');
  }
  const { algorithm, keyUsages } = subtleMapping(jwk);
  const keyData = { ...jwk };
  if (keyData.kty !== "AKP") {
    delete keyData.alg;
  }
  delete keyData.use;
  return crypto.subtle.importKey("jwk", keyData, algorithm, jwk.ext ?? (jwk.d || jwk.priv ? false : true), jwk.key_ops ?? keyUsages);
}

// ../../node_modules/.pnpm/jose@6.2.3/node_modules/jose/dist/webapi/lib/normalize_key.js
var unusableForAlg = "given KeyObject instance cannot be used for this algorithm";
var cache;
var handleJWK = async (key, jwk, alg, freeze = false) => {
  cache ||= /* @__PURE__ */ new WeakMap();
  let cached = cache.get(key);
  if (cached?.[alg]) {
    return cached[alg];
  }
  const cryptoKey = await jwkToKey({ ...jwk, alg });
  if (freeze)
    Object.freeze(key);
  if (!cached) {
    cache.set(key, { [alg]: cryptoKey });
  } else {
    cached[alg] = cryptoKey;
  }
  return cryptoKey;
};
var handleKeyObject = (keyObject, alg) => {
  cache ||= /* @__PURE__ */ new WeakMap();
  let cached = cache.get(keyObject);
  if (cached?.[alg]) {
    return cached[alg];
  }
  const isPublic = keyObject.type === "public";
  const extractable = isPublic ? true : false;
  let cryptoKey;
  if (keyObject.asymmetricKeyType === "x25519") {
    switch (alg) {
      case "ECDH-ES":
      case "ECDH-ES+A128KW":
      case "ECDH-ES+A192KW":
      case "ECDH-ES+A256KW":
        break;
      default:
        throw new TypeError(unusableForAlg);
    }
    cryptoKey = keyObject.toCryptoKey(keyObject.asymmetricKeyType, extractable, isPublic ? [] : ["deriveBits"]);
  }
  if (keyObject.asymmetricKeyType === "ed25519") {
    if (alg !== "EdDSA" && alg !== "Ed25519") {
      throw new TypeError(unusableForAlg);
    }
    cryptoKey = keyObject.toCryptoKey(keyObject.asymmetricKeyType, extractable, [
      isPublic ? "verify" : "sign"
    ]);
  }
  switch (keyObject.asymmetricKeyType) {
    case "ml-dsa-44":
    case "ml-dsa-65":
    case "ml-dsa-87": {
      if (alg !== keyObject.asymmetricKeyType.toUpperCase()) {
        throw new TypeError(unusableForAlg);
      }
      cryptoKey = keyObject.toCryptoKey(keyObject.asymmetricKeyType, extractable, [
        isPublic ? "verify" : "sign"
      ]);
    }
  }
  if (keyObject.asymmetricKeyType === "rsa") {
    let hash;
    switch (alg) {
      case "RSA-OAEP":
        hash = "SHA-1";
        break;
      case "RS256":
      case "PS256":
      case "RSA-OAEP-256":
        hash = "SHA-256";
        break;
      case "RS384":
      case "PS384":
      case "RSA-OAEP-384":
        hash = "SHA-384";
        break;
      case "RS512":
      case "PS512":
      case "RSA-OAEP-512":
        hash = "SHA-512";
        break;
      default:
        throw new TypeError(unusableForAlg);
    }
    if (alg.startsWith("RSA-OAEP")) {
      return keyObject.toCryptoKey({
        name: "RSA-OAEP",
        hash
      }, extractable, isPublic ? ["encrypt"] : ["decrypt"]);
    }
    cryptoKey = keyObject.toCryptoKey({
      name: alg.startsWith("PS") ? "RSA-PSS" : "RSASSA-PKCS1-v1_5",
      hash
    }, extractable, [isPublic ? "verify" : "sign"]);
  }
  if (keyObject.asymmetricKeyType === "ec") {
    const nist = /* @__PURE__ */ new Map([
      ["prime256v1", "P-256"],
      ["secp384r1", "P-384"],
      ["secp521r1", "P-521"]
    ]);
    const namedCurve = nist.get(keyObject.asymmetricKeyDetails?.namedCurve);
    if (!namedCurve) {
      throw new TypeError(unusableForAlg);
    }
    const expectedCurve = { ES256: "P-256", ES384: "P-384", ES512: "P-521" };
    if (expectedCurve[alg] && namedCurve === expectedCurve[alg]) {
      cryptoKey = keyObject.toCryptoKey({
        name: "ECDSA",
        namedCurve
      }, extractable, [isPublic ? "verify" : "sign"]);
    }
    if (alg.startsWith("ECDH-ES")) {
      cryptoKey = keyObject.toCryptoKey({
        name: "ECDH",
        namedCurve
      }, extractable, isPublic ? [] : ["deriveBits"]);
    }
  }
  if (!cryptoKey) {
    throw new TypeError(unusableForAlg);
  }
  if (!cached) {
    cache.set(keyObject, { [alg]: cryptoKey });
  } else {
    cached[alg] = cryptoKey;
  }
  return cryptoKey;
};
async function normalizeKey(key, alg) {
  if (key instanceof Uint8Array) {
    return key;
  }
  if (isCryptoKey(key)) {
    return key;
  }
  if (isKeyObject(key)) {
    if (key.type === "secret") {
      return key.export();
    }
    if ("toCryptoKey" in key && typeof key.toCryptoKey === "function") {
      try {
        return handleKeyObject(key, alg);
      } catch (err) {
        if (err instanceof TypeError) {
          throw err;
        }
      }
    }
    let jwk = key.export({ format: "jwk" });
    return handleJWK(key, jwk, alg);
  }
  if (isJWK(key)) {
    if (key.k) {
      return decode(key.k);
    }
    return handleJWK(key, key, alg, true);
  }
  throw new Error("unreachable");
}

// ../../node_modules/.pnpm/jose@6.2.3/node_modules/jose/dist/webapi/key/import.js
async function importJWK(jwk, alg, options) {
  if (!isObject(jwk)) {
    throw new TypeError("JWK must be an object");
  }
  let ext;
  alg ??= jwk.alg;
  ext ??= options?.extractable ?? jwk.ext;
  switch (jwk.kty) {
    case "oct":
      if (typeof jwk.k !== "string" || !jwk.k) {
        throw new TypeError('missing "k" (Key Value) Parameter value');
      }
      return decode(jwk.k);
    case "RSA":
      if ("oth" in jwk && jwk.oth !== void 0) {
        throw new JOSENotSupported('RSA JWK "oth" (Other Primes Info) Parameter value is not supported');
      }
      return jwkToKey({ ...jwk, alg, ext });
    case "AKP": {
      if (typeof jwk.alg !== "string" || !jwk.alg) {
        throw new TypeError('missing "alg" (Algorithm) Parameter value');
      }
      if (alg !== void 0 && alg !== jwk.alg) {
        throw new TypeError("JWK alg and alg option value mismatch");
      }
      return jwkToKey({ ...jwk, ext });
    }
    case "EC":
    case "OKP":
      return jwkToKey({ ...jwk, alg, ext });
    default:
      throw new JOSENotSupported('Unsupported "kty" (Key Type) Parameter value');
  }
}

// ../../node_modules/.pnpm/jose@6.2.3/node_modules/jose/dist/webapi/lib/validate_crit.js
function validateCrit(Err, recognizedDefault, recognizedOption, protectedHeader, joseHeader) {
  if (joseHeader.crit !== void 0 && protectedHeader?.crit === void 0) {
    throw new Err('"crit" (Critical) Header Parameter MUST be integrity protected');
  }
  if (!protectedHeader || protectedHeader.crit === void 0) {
    return /* @__PURE__ */ new Set();
  }
  if (!Array.isArray(protectedHeader.crit) || protectedHeader.crit.length === 0 || protectedHeader.crit.some((input) => typeof input !== "string" || input.length === 0)) {
    throw new Err('"crit" (Critical) Header Parameter MUST be an array of non-empty strings when present');
  }
  let recognized;
  if (recognizedOption !== void 0) {
    recognized = new Map([...Object.entries(recognizedOption), ...recognizedDefault.entries()]);
  } else {
    recognized = recognizedDefault;
  }
  for (const parameter of protectedHeader.crit) {
    if (!recognized.has(parameter)) {
      throw new JOSENotSupported(`Extension Header Parameter "${parameter}" is not recognized`);
    }
    if (joseHeader[parameter] === void 0) {
      throw new Err(`Extension Header Parameter "${parameter}" is missing`);
    }
    if (recognized.get(parameter) && protectedHeader[parameter] === void 0) {
      throw new Err(`Extension Header Parameter "${parameter}" MUST be integrity protected`);
    }
  }
  return new Set(protectedHeader.crit);
}

// ../../node_modules/.pnpm/jose@6.2.3/node_modules/jose/dist/webapi/lib/validate_algorithms.js
function validateAlgorithms(option, algorithms) {
  if (algorithms !== void 0 && (!Array.isArray(algorithms) || algorithms.some((s) => typeof s !== "string"))) {
    throw new TypeError(`"${option}" option must be an array of strings`);
  }
  if (!algorithms) {
    return void 0;
  }
  return new Set(algorithms);
}

// ../../node_modules/.pnpm/jose@6.2.3/node_modules/jose/dist/webapi/lib/check_key_type.js
var tag = (key) => key?.[Symbol.toStringTag];
var jwkMatchesOp = (alg, key, usage) => {
  if (key.use !== void 0) {
    let expected;
    switch (usage) {
      case "sign":
      case "verify":
        expected = "sig";
        break;
      case "encrypt":
      case "decrypt":
        expected = "enc";
        break;
    }
    if (key.use !== expected) {
      throw new TypeError(`Invalid key for this operation, its "use" must be "${expected}" when present`);
    }
  }
  if (key.alg !== void 0 && key.alg !== alg) {
    throw new TypeError(`Invalid key for this operation, its "alg" must be "${alg}" when present`);
  }
  if (Array.isArray(key.key_ops)) {
    let expectedKeyOp;
    switch (true) {
      case (usage === "sign" || usage === "verify"):
      case alg === "dir":
      case alg.includes("CBC-HS"):
        expectedKeyOp = usage;
        break;
      case alg.startsWith("PBES2"):
        expectedKeyOp = "deriveBits";
        break;
      case /^A\d{3}(?:GCM)?(?:KW)?$/.test(alg):
        if (!alg.includes("GCM") && alg.endsWith("KW")) {
          expectedKeyOp = usage === "encrypt" ? "wrapKey" : "unwrapKey";
        } else {
          expectedKeyOp = usage;
        }
        break;
      case (usage === "encrypt" && alg.startsWith("RSA")):
        expectedKeyOp = "wrapKey";
        break;
      case usage === "decrypt":
        expectedKeyOp = alg.startsWith("RSA") ? "unwrapKey" : "deriveBits";
        break;
    }
    if (expectedKeyOp && key.key_ops?.includes?.(expectedKeyOp) === false) {
      throw new TypeError(`Invalid key for this operation, its "key_ops" must include "${expectedKeyOp}" when present`);
    }
  }
  return true;
};
var symmetricTypeCheck = (alg, key, usage) => {
  if (key instanceof Uint8Array)
    return;
  if (isJWK(key)) {
    if (isSecretJWK(key) && jwkMatchesOp(alg, key, usage))
      return;
    throw new TypeError(`JSON Web Key for symmetric algorithms must have JWK "kty" (Key Type) equal to "oct" and the JWK "k" (Key Value) present`);
  }
  if (!isKeyLike(key)) {
    throw new TypeError(withAlg(alg, key, "CryptoKey", "KeyObject", "JSON Web Key", "Uint8Array"));
  }
  if (key.type !== "secret") {
    throw new TypeError(`${tag(key)} instances for symmetric algorithms must be of type "secret"`);
  }
};
var asymmetricTypeCheck = (alg, key, usage) => {
  if (isJWK(key)) {
    switch (usage) {
      case "decrypt":
      case "sign":
        if (isPrivateJWK(key) && jwkMatchesOp(alg, key, usage))
          return;
        throw new TypeError(`JSON Web Key for this operation must be a private JWK`);
      case "encrypt":
      case "verify":
        if (isPublicJWK(key) && jwkMatchesOp(alg, key, usage))
          return;
        throw new TypeError(`JSON Web Key for this operation must be a public JWK`);
    }
  }
  if (!isKeyLike(key)) {
    throw new TypeError(withAlg(alg, key, "CryptoKey", "KeyObject", "JSON Web Key"));
  }
  if (key.type === "secret") {
    throw new TypeError(`${tag(key)} instances for asymmetric algorithms must not be of type "secret"`);
  }
  if (key.type === "public") {
    switch (usage) {
      case "sign":
        throw new TypeError(`${tag(key)} instances for asymmetric algorithm signing must be of type "private"`);
      case "decrypt":
        throw new TypeError(`${tag(key)} instances for asymmetric algorithm decryption must be of type "private"`);
    }
  }
  if (key.type === "private") {
    switch (usage) {
      case "verify":
        throw new TypeError(`${tag(key)} instances for asymmetric algorithm verifying must be of type "public"`);
      case "encrypt":
        throw new TypeError(`${tag(key)} instances for asymmetric algorithm encryption must be of type "public"`);
    }
  }
};
function checkKeyType(alg, key, usage) {
  switch (alg.substring(0, 2)) {
    case "A1":
    case "A2":
    case "di":
    case "HS":
    case "PB":
      symmetricTypeCheck(alg, key, usage);
      break;
    default:
      asymmetricTypeCheck(alg, key, usage);
  }
}

// ../../node_modules/.pnpm/jose@6.2.3/node_modules/jose/dist/webapi/jws/flattened/verify.js
async function flattenedVerify(jws, key, options) {
  if (!isObject(jws)) {
    throw new JWSInvalid("Flattened JWS must be an object");
  }
  if (jws.protected === void 0 && jws.header === void 0) {
    throw new JWSInvalid('Flattened JWS must have either of the "protected" or "header" members');
  }
  if (jws.protected !== void 0 && typeof jws.protected !== "string") {
    throw new JWSInvalid("JWS Protected Header incorrect type");
  }
  if (jws.payload === void 0) {
    throw new JWSInvalid("JWS Payload missing");
  }
  if (typeof jws.signature !== "string") {
    throw new JWSInvalid("JWS Signature missing or incorrect type");
  }
  if (jws.header !== void 0 && !isObject(jws.header)) {
    throw new JWSInvalid("JWS Unprotected Header incorrect type");
  }
  let parsedProt = {};
  if (jws.protected) {
    try {
      const protectedHeader = decode(jws.protected);
      parsedProt = JSON.parse(decoder.decode(protectedHeader));
    } catch {
      throw new JWSInvalid("JWS Protected Header is invalid");
    }
  }
  if (!isDisjoint(parsedProt, jws.header)) {
    throw new JWSInvalid("JWS Protected and JWS Unprotected Header Parameter names must be disjoint");
  }
  const joseHeader = {
    ...parsedProt,
    ...jws.header
  };
  const extensions = validateCrit(JWSInvalid, /* @__PURE__ */ new Map([["b64", true]]), options?.crit, parsedProt, joseHeader);
  let b64 = true;
  if (extensions.has("b64")) {
    b64 = parsedProt.b64;
    if (typeof b64 !== "boolean") {
      throw new JWSInvalid('The "b64" (base64url-encode payload) Header Parameter must be a boolean');
    }
  }
  const { alg } = joseHeader;
  if (typeof alg !== "string" || !alg) {
    throw new JWSInvalid('JWS "alg" (Algorithm) Header Parameter missing or invalid');
  }
  const algorithms = options && validateAlgorithms("algorithms", options.algorithms);
  if (algorithms && !algorithms.has(alg)) {
    throw new JOSEAlgNotAllowed('"alg" (Algorithm) Header Parameter value not allowed');
  }
  if (b64) {
    if (typeof jws.payload !== "string") {
      throw new JWSInvalid("JWS Payload must be a string");
    }
  } else if (typeof jws.payload !== "string" && !(jws.payload instanceof Uint8Array)) {
    throw new JWSInvalid("JWS Payload must be a string or an Uint8Array instance");
  }
  let resolvedKey = false;
  if (typeof key === "function") {
    key = await key(parsedProt, jws);
    resolvedKey = true;
  }
  checkKeyType(alg, key, "verify");
  const data = concat(jws.protected !== void 0 ? encode(jws.protected) : new Uint8Array(), encode("."), typeof jws.payload === "string" ? b64 ? encode(jws.payload) : encoder.encode(jws.payload) : jws.payload);
  const signature = decodeBase64url(jws.signature, "signature", JWSInvalid);
  const k = await normalizeKey(key, alg);
  const verified = await verify(alg, k, signature, data);
  if (!verified) {
    throw new JWSSignatureVerificationFailed();
  }
  let payload;
  if (b64) {
    payload = decodeBase64url(jws.payload, "payload", JWSInvalid);
  } else if (typeof jws.payload === "string") {
    payload = encoder.encode(jws.payload);
  } else {
    payload = jws.payload;
  }
  const result = { payload };
  if (jws.protected !== void 0) {
    result.protectedHeader = parsedProt;
  }
  if (jws.header !== void 0) {
    result.unprotectedHeader = jws.header;
  }
  if (resolvedKey) {
    return { ...result, key: k };
  }
  return result;
}

// ../../node_modules/.pnpm/jose@6.2.3/node_modules/jose/dist/webapi/jws/compact/verify.js
async function compactVerify(jws, key, options) {
  if (jws instanceof Uint8Array) {
    jws = decoder.decode(jws);
  }
  if (typeof jws !== "string") {
    throw new JWSInvalid("Compact JWS must be a string or Uint8Array");
  }
  const { 0: protectedHeader, 1: payload, 2: signature, length } = jws.split(".");
  if (length !== 3) {
    throw new JWSInvalid("Invalid Compact JWS");
  }
  const verified = await flattenedVerify({ payload, protected: protectedHeader, signature }, key, options);
  const result = { payload: verified.payload, protectedHeader: verified.protectedHeader };
  if (typeof key === "function") {
    return { ...result, key: verified.key };
  }
  return result;
}

// ../../node_modules/.pnpm/jose@6.2.3/node_modules/jose/dist/webapi/lib/jwt_claims_set.js
var epoch = (date) => Math.floor(date.getTime() / 1e3);
var minute = 60;
var hour = minute * 60;
var day = hour * 24;
var week = day * 7;
var year = day * 365.25;
var REGEX = /^(\+|\-)? ?(\d+|\d+\.\d+) ?(seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|years?|yrs?|y)(?: (ago|from now))?$/i;
function secs(str) {
  const matched = REGEX.exec(str);
  if (!matched || matched[4] && matched[1]) {
    throw new TypeError("Invalid time period format");
  }
  const value = parseFloat(matched[2]);
  const unit = matched[3].toLowerCase();
  let numericDate;
  switch (unit) {
    case "sec":
    case "secs":
    case "second":
    case "seconds":
    case "s":
      numericDate = Math.round(value);
      break;
    case "minute":
    case "minutes":
    case "min":
    case "mins":
    case "m":
      numericDate = Math.round(value * minute);
      break;
    case "hour":
    case "hours":
    case "hr":
    case "hrs":
    case "h":
      numericDate = Math.round(value * hour);
      break;
    case "day":
    case "days":
    case "d":
      numericDate = Math.round(value * day);
      break;
    case "week":
    case "weeks":
    case "w":
      numericDate = Math.round(value * week);
      break;
    default:
      numericDate = Math.round(value * year);
      break;
  }
  if (matched[1] === "-" || matched[4] === "ago") {
    return -numericDate;
  }
  return numericDate;
}
var normalizeTyp = (value) => {
  if (value.includes("/")) {
    return value.toLowerCase();
  }
  return `application/${value.toLowerCase()}`;
};
var checkAudiencePresence = (audPayload, audOption) => {
  if (typeof audPayload === "string") {
    return audOption.includes(audPayload);
  }
  if (Array.isArray(audPayload)) {
    return audOption.some(Set.prototype.has.bind(new Set(audPayload)));
  }
  return false;
};
function validateClaimsSet(protectedHeader, encodedPayload, options = {}) {
  let payload;
  try {
    payload = JSON.parse(decoder.decode(encodedPayload));
  } catch {
  }
  if (!isObject(payload)) {
    throw new JWTInvalid("JWT Claims Set must be a top-level JSON object");
  }
  const { typ } = options;
  if (typ && (typeof protectedHeader.typ !== "string" || normalizeTyp(protectedHeader.typ) !== normalizeTyp(typ))) {
    throw new JWTClaimValidationFailed('unexpected "typ" JWT header value', payload, "typ", "check_failed");
  }
  const { requiredClaims = [], issuer, subject, audience, maxTokenAge } = options;
  const presenceCheck = [...requiredClaims];
  if (maxTokenAge !== void 0)
    presenceCheck.push("iat");
  if (audience !== void 0)
    presenceCheck.push("aud");
  if (subject !== void 0)
    presenceCheck.push("sub");
  if (issuer !== void 0)
    presenceCheck.push("iss");
  for (const claim of new Set(presenceCheck.reverse())) {
    if (!(claim in payload)) {
      throw new JWTClaimValidationFailed(`missing required "${claim}" claim`, payload, claim, "missing");
    }
  }
  if (issuer && !(Array.isArray(issuer) ? issuer : [issuer]).includes(payload.iss)) {
    throw new JWTClaimValidationFailed('unexpected "iss" claim value', payload, "iss", "check_failed");
  }
  if (subject && payload.sub !== subject) {
    throw new JWTClaimValidationFailed('unexpected "sub" claim value', payload, "sub", "check_failed");
  }
  if (audience && !checkAudiencePresence(payload.aud, typeof audience === "string" ? [audience] : audience)) {
    throw new JWTClaimValidationFailed('unexpected "aud" claim value', payload, "aud", "check_failed");
  }
  let tolerance;
  switch (typeof options.clockTolerance) {
    case "string":
      tolerance = secs(options.clockTolerance);
      break;
    case "number":
      tolerance = options.clockTolerance;
      break;
    case "undefined":
      tolerance = 0;
      break;
    default:
      throw new TypeError("Invalid clockTolerance option type");
  }
  const { currentDate } = options;
  const now = epoch(currentDate || /* @__PURE__ */ new Date());
  if ((payload.iat !== void 0 || maxTokenAge) && typeof payload.iat !== "number") {
    throw new JWTClaimValidationFailed('"iat" claim must be a number', payload, "iat", "invalid");
  }
  if (payload.nbf !== void 0) {
    if (typeof payload.nbf !== "number") {
      throw new JWTClaimValidationFailed('"nbf" claim must be a number', payload, "nbf", "invalid");
    }
    if (payload.nbf > now + tolerance) {
      throw new JWTClaimValidationFailed('"nbf" claim timestamp check failed', payload, "nbf", "check_failed");
    }
  }
  if (payload.exp !== void 0) {
    if (typeof payload.exp !== "number") {
      throw new JWTClaimValidationFailed('"exp" claim must be a number', payload, "exp", "invalid");
    }
    if (payload.exp <= now - tolerance) {
      throw new JWTExpired('"exp" claim timestamp check failed', payload, "exp", "check_failed");
    }
  }
  if (maxTokenAge) {
    const age = now - payload.iat;
    const max = typeof maxTokenAge === "number" ? maxTokenAge : secs(maxTokenAge);
    if (age - tolerance > max) {
      throw new JWTExpired('"iat" claim timestamp check failed (too far in the past)', payload, "iat", "check_failed");
    }
    if (age < 0 - tolerance) {
      throw new JWTClaimValidationFailed('"iat" claim timestamp check failed (it should be in the past)', payload, "iat", "check_failed");
    }
  }
  return payload;
}

// ../../node_modules/.pnpm/jose@6.2.3/node_modules/jose/dist/webapi/jwt/verify.js
async function jwtVerify(jwt, key, options) {
  const verified = await compactVerify(jwt, key, options);
  if (verified.protectedHeader.crit?.includes("b64") && verified.protectedHeader.b64 === false) {
    throw new JWTInvalid("JWTs MUST NOT use unencoded payload");
  }
  const payload = validateClaimsSet(verified.protectedHeader, verified.payload, options);
  const result = { payload, protectedHeader: verified.protectedHeader };
  if (typeof key === "function") {
    return { ...result, key: verified.key };
  }
  return result;
}

// ../../node_modules/.pnpm/jose@6.2.3/node_modules/jose/dist/webapi/jwks/local.js
function getKtyFromAlg(alg) {
  switch (typeof alg === "string" && alg.slice(0, 2)) {
    case "RS":
    case "PS":
      return "RSA";
    case "ES":
      return "EC";
    case "Ed":
      return "OKP";
    case "ML":
      return "AKP";
    default:
      throw new JOSENotSupported('Unsupported "alg" value for a JSON Web Key Set');
  }
}
function isJWKSLike(jwks) {
  return jwks && typeof jwks === "object" && Array.isArray(jwks.keys) && jwks.keys.every(isJWKLike);
}
function isJWKLike(key) {
  return isObject(key);
}
var LocalJWKSet = class {
  #jwks;
  #cached = /* @__PURE__ */ new WeakMap();
  constructor(jwks) {
    if (!isJWKSLike(jwks)) {
      throw new JWKSInvalid("JSON Web Key Set malformed");
    }
    this.#jwks = structuredClone(jwks);
  }
  jwks() {
    return this.#jwks;
  }
  async getKey(protectedHeader, token) {
    const { alg, kid } = { ...protectedHeader, ...token?.header };
    const kty = getKtyFromAlg(alg);
    const candidates = this.#jwks.keys.filter((jwk2) => {
      let candidate = kty === jwk2.kty;
      if (candidate && typeof kid === "string") {
        candidate = kid === jwk2.kid;
      }
      if (candidate && (typeof jwk2.alg === "string" || kty === "AKP")) {
        candidate = alg === jwk2.alg;
      }
      if (candidate && typeof jwk2.use === "string") {
        candidate = jwk2.use === "sig";
      }
      if (candidate && Array.isArray(jwk2.key_ops)) {
        candidate = jwk2.key_ops.includes("verify");
      }
      if (candidate) {
        switch (alg) {
          case "ES256":
            candidate = jwk2.crv === "P-256";
            break;
          case "ES384":
            candidate = jwk2.crv === "P-384";
            break;
          case "ES512":
            candidate = jwk2.crv === "P-521";
            break;
          case "Ed25519":
          case "EdDSA":
            candidate = jwk2.crv === "Ed25519";
            break;
        }
      }
      return candidate;
    });
    const { 0: jwk, length } = candidates;
    if (length === 0) {
      throw new JWKSNoMatchingKey();
    }
    if (length !== 1) {
      const error = new JWKSMultipleMatchingKeys();
      const _cached = this.#cached;
      error[Symbol.asyncIterator] = async function* () {
        for (const jwk2 of candidates) {
          try {
            yield await importWithAlgCache(_cached, jwk2, alg);
          } catch {
          }
        }
      };
      throw error;
    }
    return importWithAlgCache(this.#cached, jwk, alg);
  }
};
async function importWithAlgCache(cache2, jwk, alg) {
  const cached = cache2.get(jwk) || cache2.set(jwk, {}).get(jwk);
  if (cached[alg] === void 0) {
    const key = await importJWK({ ...jwk, ext: true }, alg);
    if (key instanceof Uint8Array || key.type !== "public") {
      throw new JWKSInvalid("JSON Web Key Set members must be public keys");
    }
    cached[alg] = key;
  }
  return cached[alg];
}
function createLocalJWKSet(jwks) {
  const set = new LocalJWKSet(jwks);
  const localJWKSet = async (protectedHeader, token) => set.getKey(protectedHeader, token);
  Object.defineProperties(localJWKSet, {
    jwks: {
      value: () => structuredClone(set.jwks()),
      enumerable: false,
      configurable: false,
      writable: false
    }
  });
  return localJWKSet;
}

// ../../node_modules/.pnpm/jose@6.2.3/node_modules/jose/dist/webapi/jwks/remote.js
function isCloudflareWorkers() {
  return typeof WebSocketPair !== "undefined" || typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers" || typeof EdgeRuntime !== "undefined" && EdgeRuntime === "vercel";
}
var USER_AGENT;
if (typeof navigator === "undefined" || !navigator.userAgent?.startsWith?.("Mozilla/5.0 ")) {
  const NAME = "jose";
  const VERSION = "v6.2.3";
  USER_AGENT = `${NAME}/${VERSION}`;
}
var customFetch = /* @__PURE__ */ Symbol();
async function fetchJwks(url, headers, signal, fetchImpl = fetch) {
  const response = await fetchImpl(url, {
    method: "GET",
    signal,
    redirect: "manual",
    headers
  }).catch((err) => {
    if (err.name === "TimeoutError") {
      throw new JWKSTimeout();
    }
    throw err;
  });
  if (response.status !== 200) {
    throw new JOSEError("Expected 200 OK from the JSON Web Key Set HTTP response");
  }
  try {
    return await response.json();
  } catch {
    throw new JOSEError("Failed to parse the JSON Web Key Set HTTP response as JSON");
  }
}
var jwksCache = /* @__PURE__ */ Symbol();
function isFreshJwksCache(input, cacheMaxAge) {
  if (typeof input !== "object" || input === null) {
    return false;
  }
  if (!("uat" in input) || typeof input.uat !== "number" || Date.now() - input.uat >= cacheMaxAge) {
    return false;
  }
  if (!("jwks" in input) || !isObject(input.jwks) || !Array.isArray(input.jwks.keys) || !Array.prototype.every.call(input.jwks.keys, isObject)) {
    return false;
  }
  return true;
}
var RemoteJWKSet = class {
  #url;
  #timeoutDuration;
  #cooldownDuration;
  #cacheMaxAge;
  #jwksTimestamp;
  #pendingFetch;
  #headers;
  #customFetch;
  #local;
  #cache;
  constructor(url, options) {
    if (!(url instanceof URL)) {
      throw new TypeError("url must be an instance of URL");
    }
    this.#url = new URL(url.href);
    this.#timeoutDuration = typeof options?.timeoutDuration === "number" ? options?.timeoutDuration : 5e3;
    this.#cooldownDuration = typeof options?.cooldownDuration === "number" ? options?.cooldownDuration : 3e4;
    this.#cacheMaxAge = typeof options?.cacheMaxAge === "number" ? options?.cacheMaxAge : 6e5;
    this.#headers = new Headers(options?.headers);
    if (USER_AGENT && !this.#headers.has("User-Agent")) {
      this.#headers.set("User-Agent", USER_AGENT);
    }
    if (!this.#headers.has("accept")) {
      this.#headers.set("accept", "application/json");
      this.#headers.append("accept", "application/jwk-set+json");
    }
    this.#customFetch = options?.[customFetch];
    if (options?.[jwksCache] !== void 0) {
      this.#cache = options?.[jwksCache];
      if (isFreshJwksCache(options?.[jwksCache], this.#cacheMaxAge)) {
        this.#jwksTimestamp = this.#cache.uat;
        this.#local = createLocalJWKSet(this.#cache.jwks);
      }
    }
  }
  pendingFetch() {
    return !!this.#pendingFetch;
  }
  coolingDown() {
    return typeof this.#jwksTimestamp === "number" ? Date.now() < this.#jwksTimestamp + this.#cooldownDuration : false;
  }
  fresh() {
    return typeof this.#jwksTimestamp === "number" ? Date.now() < this.#jwksTimestamp + this.#cacheMaxAge : false;
  }
  jwks() {
    return this.#local?.jwks();
  }
  async getKey(protectedHeader, token) {
    if (!this.#local || !this.fresh()) {
      await this.reload();
    }
    try {
      return await this.#local(protectedHeader, token);
    } catch (err) {
      if (err instanceof JWKSNoMatchingKey) {
        if (this.coolingDown() === false) {
          await this.reload();
          return this.#local(protectedHeader, token);
        }
      }
      throw err;
    }
  }
  async reload() {
    if (this.#pendingFetch && isCloudflareWorkers()) {
      this.#pendingFetch = void 0;
    }
    this.#pendingFetch ||= fetchJwks(this.#url.href, this.#headers, AbortSignal.timeout(this.#timeoutDuration), this.#customFetch).then((json) => {
      this.#local = createLocalJWKSet(json);
      if (this.#cache) {
        this.#cache.uat = Date.now();
        this.#cache.jwks = json;
      }
      this.#jwksTimestamp = Date.now();
      this.#pendingFetch = void 0;
    }).catch((err) => {
      this.#pendingFetch = void 0;
      throw err;
    });
    await this.#pendingFetch;
  }
};
function createRemoteJWKSet(url, options) {
  const set = new RemoteJWKSet(url, options);
  const remoteJWKSet = async (protectedHeader, token) => set.getKey(protectedHeader, token);
  Object.defineProperties(remoteJWKSet, {
    coolingDown: {
      get: () => set.coolingDown(),
      enumerable: true,
      configurable: false
    },
    fresh: {
      get: () => set.fresh(),
      enumerable: true,
      configurable: false
    },
    reload: {
      value: () => set.reload(),
      enumerable: true,
      configurable: false,
      writable: false
    },
    reloading: {
      get: () => set.pendingFetch(),
      enumerable: true,
      configurable: false
    },
    jwks: {
      value: () => set.jwks(),
      enumerable: true,
      configurable: false,
      writable: false
    }
  });
  return remoteJWKSet;
}

// ../../node_modules/.pnpm/jose@6.2.3/node_modules/jose/dist/webapi/util/decode_protected_header.js
function decodeProtectedHeader(token) {
  let protectedB64u;
  if (typeof token === "string") {
    const parts = token.split(".");
    if (parts.length === 3 || parts.length === 5) {
      ;
      [protectedB64u] = parts;
    }
  } else if (typeof token === "object" && token) {
    if ("protected" in token) {
      protectedB64u = token.protected;
    } else {
      throw new TypeError("Token does not contain a Protected Header");
    }
  }
  try {
    if (typeof protectedB64u !== "string" || !protectedB64u) {
      throw new Error();
    }
    const result = JSON.parse(decoder.decode(decode(protectedB64u)));
    if (!isObject(result)) {
      throw new Error();
    }
    return result;
  } catch {
    throw new TypeError("Invalid Token or Protected Header formatting");
  }
}

// src/auth.ts
var asymmetricAlgorithms = ["RS256", "RS384", "RS512", "ES256", "ES384", "ES512"];
var AuthConfigurationError = class extends Error {
  context;
  constructor(input) {
    super(input.message);
    this.name = "AuthConfigurationError";
    this.context = input.context;
  }
};
var AuthVerificationError = class extends Error {
  context;
  constructor(input) {
    super(input.message);
    this.name = "AuthVerificationError";
    this.context = input.context;
  }
};
function createSupabaseJwtAuthConfig(env) {
  return {
    jwtSecret: nullableEnv(env, "SUPABASE_JWT_SECRET"),
    supabaseUrl: nullableEnv(env, "SUPABASE_URL")
  };
}
function createSupabaseJwtVerifier(config) {
  const remoteJwkSet = config.supabaseUrl === null ? null : createRemoteJWKSet(supabaseJwksUrl(config.supabaseUrl));
  return {
    verify: (token) => verifySupabaseJwt(token, config, remoteJwkSet)
  };
}
function createSupabaseAuthMiddleware(verifier) {
  return async (context, next) => {
    try {
      const token = bearerTokenFromHeader(context.req.header("Authorization") ?? null);
      const authUser = await verifier.verify(token);
      context.set("authUser", authUser);
      await next();
      return void 0;
    } catch (_error) {
      return context.json({ error: "unauthorized" }, 401);
    }
  };
}
async function verifySupabaseJwt(token, config, remoteJwkSet) {
  const protectedHeader = decodeProtectedHeader(token);
  const algorithm = protectedHeader.alg;
  if (algorithm === void 0) {
    throw new AuthVerificationError({
      message: "Supabase JWT header is missing alg.",
      context: ["header.alg=undefined"]
    });
  }
  if (algorithm === "HS256") {
    return authenticatedUserFromPayload(await verifySymmetricJwt(token, config));
  }
  if (isAsymmetricAlgorithm(algorithm)) {
    return authenticatedUserFromPayload(await verifyAsymmetricJwt(token, remoteJwkSet, algorithm));
  }
  throw new AuthVerificationError({
    message: "Supabase JWT uses an unsupported signing algorithm.",
    context: [`alg=${algorithm}`]
  });
}
async function verifySymmetricJwt(token, config) {
  if (config.jwtSecret === null) {
    throw new AuthConfigurationError({
      message: "SUPABASE_JWT_SECRET is required for HS256 Supabase JWT verification.",
      context: ["env=SUPABASE_JWT_SECRET"]
    });
  }
  const secret = new TextEncoder().encode(config.jwtSecret);
  const result = await jwtVerify(token, secret);
  return result.payload;
}
async function verifyAsymmetricJwt(token, remoteJwkSet, algorithm) {
  if (remoteJwkSet === null) {
    throw new AuthConfigurationError({
      message: "SUPABASE_URL is required for asymmetric Supabase JWT verification.",
      context: [`alg=${algorithm}`, "env=SUPABASE_URL"]
    });
  }
  const result = await jwtVerify(token, remoteJwkSet);
  return result.payload;
}
function authenticatedUserFromPayload(payload) {
  if (typeof payload.sub !== "string" || payload.sub.trim().length === 0) {
    throw new AuthVerificationError({
      message: "Supabase JWT payload is missing sub.",
      context: ["claim=sub"]
    });
  }
  const appMetadata = metadataFromClaim(payload["app_metadata"]);
  const userMetadata = metadataFromClaim(payload["user_metadata"]);
  return {
    userId: payload.sub,
    email: stringClaim(payload["email"]),
    role: getAuthRoleFromMetadata(appMetadata, userMetadata),
    workspaceId: workspaceIdFromMetadata(appMetadata, userMetadata)
  };
}
function bearerTokenFromHeader(authorizationHeader) {
  if (authorizationHeader === null) {
    throw new AuthVerificationError({
      message: "Authorization header is missing.",
      context: ["header=Authorization"]
    });
  }
  const parts = authorizationHeader.trim().split(/\s+/u);
  if (parts.length !== 2 || parts[0] !== "Bearer" || parts[1] === void 0 || parts[1].trim().length === 0) {
    throw new AuthVerificationError({
      message: "Authorization header must use Bearer token syntax.",
      context: [`authorization=${authorizationHeader}`]
    });
  }
  return parts[1];
}
function metadataFromClaim(value) {
  if (!isRecord(value)) {
    return {};
  }
  return value;
}
function stringClaim(value) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmedValue = value.trim();
  return trimmedValue.length === 0 ? null : trimmedValue;
}
function workspaceIdFromMetadata(appMetadata, userMetadata) {
  return stringFromMetadata2(appMetadata, "workspaceId") ?? stringFromMetadata2(userMetadata, "workspaceId") ?? stringFromMetadata2(appMetadata, "workspace_id") ?? stringFromMetadata2(userMetadata, "workspace_id") ?? stringFromMetadata2(appMetadata, "ehq_workspace_id") ?? stringFromMetadata2(userMetadata, "ehq_workspace_id");
}
function stringFromMetadata2(metadata, key) {
  const value = metadata[key];
  if (typeof value !== "string") {
    return null;
  }
  const trimmedValue = value.trim();
  return trimmedValue.length === 0 ? null : trimmedValue;
}
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isAsymmetricAlgorithm(algorithm) {
  return asymmetricAlgorithms.includes(algorithm);
}
function supabaseJwksUrl(supabaseUrl) {
  const trimmedUrl = supabaseUrl.trim();
  if (trimmedUrl.length === 0) {
    throw new AuthConfigurationError({
      message: "SUPABASE_URL must not be empty when asymmetric JWT verification is enabled.",
      context: ["env=SUPABASE_URL"]
    });
  }
  return new URL("/auth/v1/.well-known/jwks.json", `${trimmedUrl.replace(/\/+$/u, "")}/`);
}
function nullableEnv(env, key) {
  const value = env[key];
  if (value === void 0 || value.trim().length === 0) {
    return null;
  }
  return value.trim();
}

// src/index.ts
import { randomUUID as randomUUID2 } from "node:crypto";

// ../../node_modules/.pnpm/hono@4.12.26/node_modules/hono/dist/compose.js
var compose = (middleware, onError, onNotFound) => {
  return (context, next) => {
    let index = -1;
    return dispatch(0);
    async function dispatch(i) {
      if (i <= index) {
        throw new Error("next() called multiple times");
      }
      index = i;
      let res;
      let isError = false;
      let handler;
      if (middleware[i]) {
        handler = middleware[i][0][0];
        context.req.routeIndex = i;
      } else {
        handler = i === middleware.length && next || void 0;
      }
      if (handler) {
        try {
          res = await handler(context, () => dispatch(i + 1));
        } catch (err) {
          if (err instanceof Error && onError) {
            context.error = err;
            res = await onError(err, context);
            isError = true;
          } else {
            throw err;
          }
        }
      } else {
        if (context.finalized === false && onNotFound) {
          res = await onNotFound(context);
        }
      }
      if (res && (context.finalized === false || isError)) {
        context.res = res;
      }
      return context;
    }
  };
};

// ../../node_modules/.pnpm/hono@4.12.26/node_modules/hono/dist/request/constants.js
var GET_MATCH_RESULT = /* @__PURE__ */ Symbol();

// ../../node_modules/.pnpm/hono@4.12.26/node_modules/hono/dist/utils/body.js
var parseBody = async (request, options = /* @__PURE__ */ Object.create(null)) => {
  const { all = false, dot = false } = options;
  const headers = request instanceof HonoRequest ? request.raw.headers : request.headers;
  const contentType = headers.get("Content-Type");
  if (contentType?.startsWith("multipart/form-data") || contentType?.startsWith("application/x-www-form-urlencoded")) {
    return parseFormData(request, { all, dot });
  }
  return {};
};
async function parseFormData(request, options) {
  const formData = await request.formData();
  if (formData) {
    return convertFormDataToBodyData(formData, options);
  }
  return {};
}
function convertFormDataToBodyData(formData, options) {
  const form = /* @__PURE__ */ Object.create(null);
  formData.forEach((value, key) => {
    const shouldParseAllValues = options.all || key.endsWith("[]");
    if (!shouldParseAllValues) {
      form[key] = value;
    } else {
      handleParsingAllValues(form, key, value);
    }
  });
  if (options.dot) {
    Object.entries(form).forEach(([key, value]) => {
      const shouldParseDotValues = key.includes(".");
      if (shouldParseDotValues) {
        handleParsingNestedValues(form, key, value);
        delete form[key];
      }
    });
  }
  return form;
}
var handleParsingAllValues = (form, key, value) => {
  if (form[key] !== void 0) {
    if (Array.isArray(form[key])) {
      ;
      form[key].push(value);
    } else {
      form[key] = [form[key], value];
    }
  } else {
    if (!key.endsWith("[]")) {
      form[key] = value;
    } else {
      form[key] = [value];
    }
  }
};
var handleParsingNestedValues = (form, key, value) => {
  if (/(?:^|\.)__proto__\./.test(key)) {
    return;
  }
  let nestedForm = form;
  const keys = key.split(".");
  keys.forEach((key2, index) => {
    if (index === keys.length - 1) {
      nestedForm[key2] = value;
    } else {
      if (!nestedForm[key2] || typeof nestedForm[key2] !== "object" || Array.isArray(nestedForm[key2]) || nestedForm[key2] instanceof File) {
        nestedForm[key2] = /* @__PURE__ */ Object.create(null);
      }
      nestedForm = nestedForm[key2];
    }
  });
};

// ../../node_modules/.pnpm/hono@4.12.26/node_modules/hono/dist/utils/url.js
var splitPath = (path) => {
  const paths = path.split("/");
  if (paths[0] === "") {
    paths.shift();
  }
  return paths;
};
var splitRoutingPath = (routePath) => {
  const { groups, path } = extractGroupsFromPath(routePath);
  const paths = splitPath(path);
  return replaceGroupMarks(paths, groups);
};
var extractGroupsFromPath = (path) => {
  const groups = [];
  path = path.replace(/\{[^}]+\}/g, (match2, index) => {
    const mark = `@${index}`;
    groups.push([mark, match2]);
    return mark;
  });
  return { groups, path };
};
var replaceGroupMarks = (paths, groups) => {
  for (let i = groups.length - 1; i >= 0; i--) {
    const [mark] = groups[i];
    for (let j = paths.length - 1; j >= 0; j--) {
      if (paths[j].includes(mark)) {
        paths[j] = paths[j].replace(mark, groups[i][1]);
        break;
      }
    }
  }
  return paths;
};
var patternCache = {};
var getPattern = (label, next) => {
  if (label === "*") {
    return "*";
  }
  const match2 = label.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);
  if (match2) {
    const cacheKey = `${label}#${next}`;
    if (!patternCache[cacheKey]) {
      if (match2[2]) {
        patternCache[cacheKey] = next && next[0] !== ":" && next[0] !== "*" ? [cacheKey, match2[1], new RegExp(`^${match2[2]}(?=/${next})`)] : [label, match2[1], new RegExp(`^${match2[2]}$`)];
      } else {
        patternCache[cacheKey] = [label, match2[1], true];
      }
    }
    return patternCache[cacheKey];
  }
  return null;
};
var tryDecode = (str, decoder2) => {
  try {
    return decoder2(str);
  } catch {
    return str.replace(/(?:%[0-9A-Fa-f]{2})+/g, (match2) => {
      try {
        return decoder2(match2);
      } catch {
        return match2;
      }
    });
  }
};
var tryDecodeURI = (str) => tryDecode(str, decodeURI);
var getPath = (request) => {
  const url = request.url;
  const start = url.indexOf("/", url.indexOf(":") + 4);
  let i = start;
  for (; i < url.length; i++) {
    const charCode = url.charCodeAt(i);
    if (charCode === 37) {
      const queryIndex = url.indexOf("?", i);
      const hashIndex = url.indexOf("#", i);
      const end = queryIndex === -1 ? hashIndex === -1 ? void 0 : hashIndex : hashIndex === -1 ? queryIndex : Math.min(queryIndex, hashIndex);
      const path = url.slice(start, end);
      return tryDecodeURI(path.includes("%25") ? path.replace(/%25/g, "%2525") : path);
    } else if (charCode === 63 || charCode === 35) {
      break;
    }
  }
  return url.slice(start, i);
};
var getPathNoStrict = (request) => {
  const result = getPath(request);
  return result.length > 1 && result.at(-1) === "/" ? result.slice(0, -1) : result;
};
var mergePath = (base, sub2, ...rest) => {
  if (rest.length) {
    sub2 = mergePath(sub2, ...rest);
  }
  return `${base?.[0] === "/" ? "" : "/"}${base}${sub2 === "/" ? "" : `${base?.at(-1) === "/" ? "" : "/"}${sub2?.[0] === "/" ? sub2.slice(1) : sub2}`}`;
};
var checkOptionalParameter = (path) => {
  if (path.charCodeAt(path.length - 1) !== 63 || !path.includes(":")) {
    return null;
  }
  const segments = path.split("/");
  const results = [];
  let basePath = "";
  segments.forEach((segment) => {
    if (segment !== "" && !/\:/.test(segment)) {
      basePath += "/" + segment;
    } else if (/\:/.test(segment)) {
      if (/\?/.test(segment)) {
        if (results.length === 0 && basePath === "") {
          results.push("/");
        } else {
          results.push(basePath);
        }
        const optionalSegment = segment.replace("?", "");
        basePath += "/" + optionalSegment;
        results.push(basePath);
      } else {
        basePath += "/" + segment;
      }
    }
  });
  return results.filter((v, i, a) => a.indexOf(v) === i);
};
var _decodeURI = (value) => {
  if (!/[%+]/.test(value)) {
    return value;
  }
  if (value.indexOf("+") !== -1) {
    value = value.replace(/\+/g, " ");
  }
  return value.indexOf("%") !== -1 ? tryDecode(value, decodeURIComponent_) : value;
};
var _getQueryParam = (url, key, multiple) => {
  let encoded;
  if (!multiple && key && !/[%+]/.test(key)) {
    let keyIndex2 = url.indexOf("?", 8);
    if (keyIndex2 === -1) {
      return void 0;
    }
    if (!url.startsWith(key, keyIndex2 + 1)) {
      keyIndex2 = url.indexOf(`&${key}`, keyIndex2 + 1);
    }
    while (keyIndex2 !== -1) {
      const trailingKeyCode = url.charCodeAt(keyIndex2 + key.length + 1);
      if (trailingKeyCode === 61) {
        const valueIndex = keyIndex2 + key.length + 2;
        const endIndex = url.indexOf("&", valueIndex);
        return _decodeURI(url.slice(valueIndex, endIndex === -1 ? void 0 : endIndex));
      } else if (trailingKeyCode == 38 || isNaN(trailingKeyCode)) {
        return "";
      }
      keyIndex2 = url.indexOf(`&${key}`, keyIndex2 + 1);
    }
    encoded = /[%+]/.test(url);
    if (!encoded) {
      return void 0;
    }
  }
  const results = {};
  encoded ??= /[%+]/.test(url);
  let keyIndex = url.indexOf("?", 8);
  while (keyIndex !== -1) {
    const nextKeyIndex = url.indexOf("&", keyIndex + 1);
    let valueIndex = url.indexOf("=", keyIndex);
    if (valueIndex > nextKeyIndex && nextKeyIndex !== -1) {
      valueIndex = -1;
    }
    let name = url.slice(
      keyIndex + 1,
      valueIndex === -1 ? nextKeyIndex === -1 ? void 0 : nextKeyIndex : valueIndex
    );
    if (encoded) {
      name = _decodeURI(name);
    }
    keyIndex = nextKeyIndex;
    if (name === "") {
      continue;
    }
    let value;
    if (valueIndex === -1) {
      value = "";
    } else {
      value = url.slice(valueIndex + 1, nextKeyIndex === -1 ? void 0 : nextKeyIndex);
      if (encoded) {
        value = _decodeURI(value);
      }
    }
    if (multiple) {
      if (!(results[name] && Array.isArray(results[name]))) {
        results[name] = [];
      }
      ;
      results[name].push(value);
    } else {
      results[name] ??= value;
    }
  }
  return key ? results[key] : results;
};
var getQueryParam = _getQueryParam;
var getQueryParams = (url, key) => {
  return _getQueryParam(url, key, true);
};
var decodeURIComponent_ = decodeURIComponent;

// ../../node_modules/.pnpm/hono@4.12.26/node_modules/hono/dist/request.js
var tryDecodeURIComponent = (str) => tryDecode(str, decodeURIComponent_);
var HonoRequest = class {
  /**
   * `.raw` can get the raw Request object.
   *
   * @see {@link https://hono.dev/docs/api/request#raw}
   *
   * @example
   * ```ts
   * // For Cloudflare Workers
   * app.post('/', async (c) => {
   *   const metadata = c.req.raw.cf?.hostMetadata?
   *   ...
   * })
   * ```
   */
  raw;
  #validatedData;
  // Short name of validatedData
  #matchResult;
  routeIndex = 0;
  /**
   * `.path` can get the pathname of the request.
   *
   * @see {@link https://hono.dev/docs/api/request#path}
   *
   * @example
   * ```ts
   * app.get('/about/me', (c) => {
   *   const pathname = c.req.path // `/about/me`
   * })
   * ```
   */
  path;
  bodyCache = {};
  constructor(request, path = "/", matchResult = [[]]) {
    this.raw = request;
    this.path = path;
    this.#matchResult = matchResult;
    this.#validatedData = {};
  }
  param(key) {
    return key ? this.#getDecodedParam(key) : this.#getAllDecodedParams();
  }
  #getDecodedParam(key) {
    const paramKey = this.#matchResult[0][this.routeIndex][1][key];
    const param = this.#getParamValue(paramKey);
    return param && /\%/.test(param) ? tryDecodeURIComponent(param) : param;
  }
  #getAllDecodedParams() {
    const decoded = {};
    const keys = Object.keys(this.#matchResult[0][this.routeIndex][1]);
    for (const key of keys) {
      const value = this.#getParamValue(this.#matchResult[0][this.routeIndex][1][key]);
      if (value !== void 0) {
        decoded[key] = /\%/.test(value) ? tryDecodeURIComponent(value) : value;
      }
    }
    return decoded;
  }
  #getParamValue(paramKey) {
    return this.#matchResult[1] ? this.#matchResult[1][paramKey] : paramKey;
  }
  query(key) {
    return getQueryParam(this.url, key);
  }
  queries(key) {
    return getQueryParams(this.url, key);
  }
  header(name) {
    if (name) {
      return this.raw.headers.get(name) ?? void 0;
    }
    const headerData = {};
    this.raw.headers.forEach((value, key) => {
      headerData[key] = value;
    });
    return headerData;
  }
  async parseBody(options) {
    return parseBody(this, options);
  }
  #cachedBody = (key) => {
    const { bodyCache, raw: raw2 } = this;
    const cachedBody = bodyCache[key];
    if (cachedBody) {
      return cachedBody;
    }
    const anyCachedKey = Object.keys(bodyCache)[0];
    if (anyCachedKey) {
      return bodyCache[anyCachedKey].then((body) => {
        if (anyCachedKey === "json") {
          body = JSON.stringify(body);
        }
        return new Response(body)[key]();
      });
    }
    return bodyCache[key] = raw2[key]();
  };
  /**
   * `.json()` can parse Request body of type `application/json`
   *
   * @see {@link https://hono.dev/docs/api/request#json}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.json()
   * })
   * ```
   */
  json() {
    return this.#cachedBody("text").then((text) => JSON.parse(text));
  }
  /**
   * `.text()` can parse Request body of type `text/plain`
   *
   * @see {@link https://hono.dev/docs/api/request#text}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.text()
   * })
   * ```
   */
  text() {
    return this.#cachedBody("text");
  }
  /**
   * `.arrayBuffer()` parse Request body as an `ArrayBuffer`
   *
   * @see {@link https://hono.dev/docs/api/request#arraybuffer}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.arrayBuffer()
   * })
   * ```
   */
  arrayBuffer() {
    return this.#cachedBody("arrayBuffer");
  }
  /**
   * `.bytes()` parses the request body as a `Uint8Array`.
   *
   * @see {@link https://hono.dev/docs/api/request#bytes}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.bytes()
   * })
   * ```
   */
  bytes() {
    return this.#cachedBody("arrayBuffer").then((buffer) => new Uint8Array(buffer));
  }
  /**
   * Parses the request body as a `Blob`.
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.blob();
   * });
   * ```
   * @see https://hono.dev/docs/api/request#blob
   */
  blob() {
    return this.#cachedBody("blob");
  }
  /**
   * Parses the request body as `FormData`.
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.formData();
   * });
   * ```
   * @see https://hono.dev/docs/api/request#formdata
   */
  formData() {
    return this.#cachedBody("formData");
  }
  /**
   * Adds validated data to the request.
   *
   * @param target - The target of the validation.
   * @param data - The validated data to add.
   */
  addValidatedData(target, data) {
    this.#validatedData[target] = data;
  }
  valid(target) {
    return this.#validatedData[target];
  }
  /**
   * `.url()` can get the request url strings.
   *
   * @see {@link https://hono.dev/docs/api/request#url}
   *
   * @example
   * ```ts
   * app.get('/about/me', (c) => {
   *   const url = c.req.url // `http://localhost:8787/about/me`
   *   ...
   * })
   * ```
   */
  get url() {
    return this.raw.url;
  }
  /**
   * `.method()` can get the method name of the request.
   *
   * @see {@link https://hono.dev/docs/api/request#method}
   *
   * @example
   * ```ts
   * app.get('/about/me', (c) => {
   *   const method = c.req.method // `GET`
   * })
   * ```
   */
  get method() {
    return this.raw.method;
  }
  get [GET_MATCH_RESULT]() {
    return this.#matchResult;
  }
  /**
   * `.matchedRoutes()` can return a matched route in the handler
   *
   * @deprecated
   *
   * Use matchedRoutes helper defined in "hono/route" instead.
   *
   * @see {@link https://hono.dev/docs/api/request#matchedroutes}
   *
   * @example
   * ```ts
   * app.use('*', async function logger(c, next) {
   *   await next()
   *   c.req.matchedRoutes.forEach(({ handler, method, path }, i) => {
   *     const name = handler.name || (handler.length < 2 ? '[handler]' : '[middleware]')
   *     console.log(
   *       method,
   *       ' ',
   *       path,
   *       ' '.repeat(Math.max(10 - path.length, 0)),
   *       name,
   *       i === c.req.routeIndex ? '<- respond from here' : ''
   *     )
   *   })
   * })
   * ```
   */
  get matchedRoutes() {
    return this.#matchResult[0].map(([[, route]]) => route);
  }
  /**
   * `routePath()` can retrieve the path registered within the handler
   *
   * @deprecated
   *
   * Use routePath helper defined in "hono/route" instead.
   *
   * @see {@link https://hono.dev/docs/api/request#routepath}
   *
   * @example
   * ```ts
   * app.get('/posts/:id', (c) => {
   *   return c.json({ path: c.req.routePath })
   * })
   * ```
   */
  get routePath() {
    return this.#matchResult[0].map(([[, route]]) => route)[this.routeIndex].path;
  }
};

// ../../node_modules/.pnpm/hono@4.12.26/node_modules/hono/dist/utils/html.js
var HtmlEscapedCallbackPhase = {
  Stringify: 1,
  BeforeStream: 2,
  Stream: 3
};
var raw = (value, callbacks) => {
  const escapedString = new String(value);
  escapedString.isEscaped = true;
  escapedString.callbacks = callbacks;
  return escapedString;
};
var resolveCallback = async (str, phase, preserveCallbacks, context, buffer) => {
  if (typeof str === "object" && !(str instanceof String)) {
    if (!(str instanceof Promise)) {
      str = str.toString();
    }
    if (str instanceof Promise) {
      str = await str;
    }
  }
  const callbacks = str.callbacks;
  if (!callbacks?.length) {
    return Promise.resolve(str);
  }
  if (buffer) {
    buffer[0] += str;
  } else {
    buffer = [str];
  }
  const resStr = Promise.all(callbacks.map((c) => c({ phase, buffer, context }))).then(
    (res) => Promise.all(
      res.filter(Boolean).map((str2) => resolveCallback(str2, phase, false, context, buffer))
    ).then(() => buffer[0])
  );
  if (preserveCallbacks) {
    return raw(await resStr, callbacks);
  } else {
    return resStr;
  }
};

// ../../node_modules/.pnpm/hono@4.12.26/node_modules/hono/dist/context.js
var TEXT_PLAIN = "text/plain; charset=UTF-8";
var setDefaultContentType = (contentType, headers) => {
  return {
    "Content-Type": contentType,
    ...headers
  };
};
var createResponseInstance = (body, init) => new Response(body, init);
var Context = class {
  #rawRequest;
  #req;
  /**
   * `.env` can get bindings (environment variables, secrets, KV namespaces, D1 database, R2 bucket etc.) in Cloudflare Workers.
   *
   * @see {@link https://hono.dev/docs/api/context#env}
   *
   * @example
   * ```ts
   * // Environment object for Cloudflare Workers
   * app.get('*', async c => {
   *   const counter = c.env.COUNTER
   * })
   * ```
   */
  env = {};
  #var;
  finalized = false;
  /**
   * `.error` can get the error object from the middleware if the Handler throws an error.
   *
   * @see {@link https://hono.dev/docs/api/context#error}
   *
   * @example
   * ```ts
   * app.use('*', async (c, next) => {
   *   await next()
   *   if (c.error) {
   *     // do something...
   *   }
   * })
   * ```
   */
  error;
  #status;
  #executionCtx;
  #res;
  #layout;
  #renderer;
  #notFoundHandler;
  #preparedHeaders;
  #matchResult;
  #path;
  /**
   * Creates an instance of the Context class.
   *
   * @param req - The Request object.
   * @param options - Optional configuration options for the context.
   */
  constructor(req, options) {
    this.#rawRequest = req;
    if (options) {
      this.#executionCtx = options.executionCtx;
      this.env = options.env;
      this.#notFoundHandler = options.notFoundHandler;
      this.#path = options.path;
      this.#matchResult = options.matchResult;
    }
  }
  /**
   * `.req` is the instance of {@link HonoRequest}.
   */
  get req() {
    this.#req ??= new HonoRequest(this.#rawRequest, this.#path, this.#matchResult);
    return this.#req;
  }
  /**
   * @see {@link https://hono.dev/docs/api/context#event}
   * The FetchEvent associated with the current request.
   *
   * @throws Will throw an error if the context does not have a FetchEvent.
   */
  get event() {
    if (this.#executionCtx && "respondWith" in this.#executionCtx) {
      return this.#executionCtx;
    } else {
      throw Error("This context has no FetchEvent");
    }
  }
  /**
   * @see {@link https://hono.dev/docs/api/context#executionctx}
   * The ExecutionContext associated with the current request.
   *
   * @throws Will throw an error if the context does not have an ExecutionContext.
   */
  get executionCtx() {
    if (this.#executionCtx) {
      return this.#executionCtx;
    } else {
      throw Error("This context has no ExecutionContext");
    }
  }
  /**
   * @see {@link https://hono.dev/docs/api/context#res}
   * The Response object for the current request.
   */
  get res() {
    return this.#res ||= createResponseInstance(null, {
      headers: this.#preparedHeaders ??= new Headers()
    });
  }
  /**
   * Sets the Response object for the current request.
   *
   * @param _res - The Response object to set.
   */
  set res(_res) {
    if (this.#res && _res) {
      _res = createResponseInstance(_res.body, _res);
      for (const [k, v] of this.#res.headers.entries()) {
        if (k === "content-type") {
          continue;
        }
        if (k === "set-cookie") {
          const cookies = this.#res.headers.getSetCookie();
          _res.headers.delete("set-cookie");
          for (const cookie of cookies) {
            _res.headers.append("set-cookie", cookie);
          }
        } else {
          _res.headers.set(k, v);
        }
      }
    }
    this.#res = _res;
    this.finalized = true;
  }
  /**
   * `.render()` can create a response within a layout.
   *
   * @see {@link https://hono.dev/docs/api/context#render-setrenderer}
   *
   * @example
   * ```ts
   * app.get('/', (c) => {
   *   return c.render('Hello!')
   * })
   * ```
   */
  render = (...args) => {
    this.#renderer ??= (content) => this.html(content);
    return this.#renderer(...args);
  };
  /**
   * Sets the layout for the response.
   *
   * @param layout - The layout to set.
   * @returns The layout function.
   */
  setLayout = (layout) => this.#layout = layout;
  /**
   * Gets the current layout for the response.
   *
   * @returns The current layout function.
   */
  getLayout = () => this.#layout;
  /**
   * `.setRenderer()` can set the layout in the custom middleware.
   *
   * @see {@link https://hono.dev/docs/api/context#render-setrenderer}
   *
   * @example
   * ```tsx
   * app.use('*', async (c, next) => {
   *   c.setRenderer((content) => {
   *     return c.html(
   *       <html>
   *         <body>
   *           <p>{content}</p>
   *         </body>
   *       </html>
   *     )
   *   })
   *   await next()
   * })
   * ```
   */
  setRenderer = (renderer) => {
    this.#renderer = renderer;
  };
  /**
   * `.header()` can set headers.
   *
   * @see {@link https://hono.dev/docs/api/context#header}
   *
   * @example
   * ```ts
   * app.get('/welcome', (c) => {
   *   // Set headers
   *   c.header('X-Message', 'Hello!')
   *   c.header('Content-Type', 'text/plain')
   *
   *   return c.body('Thank you for coming')
   * })
   * ```
   */
  header = (name, value, options) => {
    if (this.finalized) {
      this.#res = createResponseInstance(this.#res.body, this.#res);
    }
    const headers = this.#res ? this.#res.headers : this.#preparedHeaders ??= new Headers();
    if (value === void 0) {
      headers.delete(name);
    } else if (options?.append) {
      headers.append(name, value);
    } else {
      headers.set(name, value);
    }
  };
  status = (status) => {
    this.#status = status;
  };
  /**
   * `.set()` can set the value specified by the key.
   *
   * @see {@link https://hono.dev/docs/api/context#set-get}
   *
   * @example
   * ```ts
   * app.use('*', async (c, next) => {
   *   c.set('message', 'Hono is hot!!')
   *   await next()
   * })
   * ```
   */
  set = (key, value) => {
    this.#var ??= /* @__PURE__ */ new Map();
    this.#var.set(key, value);
  };
  /**
   * `.get()` can use the value specified by the key.
   *
   * @see {@link https://hono.dev/docs/api/context#set-get}
   *
   * @example
   * ```ts
   * app.get('/', (c) => {
   *   const message = c.get('message')
   *   return c.text(`The message is "${message}"`)
   * })
   * ```
   */
  get = (key) => {
    return this.#var ? this.#var.get(key) : void 0;
  };
  /**
   * `.var` can access the value of a variable.
   *
   * @see {@link https://hono.dev/docs/api/context#var}
   *
   * @example
   * ```ts
   * const result = c.var.client.oneMethod()
   * ```
   */
  // c.var.propName is a read-only
  get var() {
    if (!this.#var) {
      return {};
    }
    return Object.fromEntries(this.#var);
  }
  #newResponse(data, arg, headers) {
    const responseHeaders2 = this.#res ? new Headers(this.#res.headers) : this.#preparedHeaders ?? new Headers();
    if (typeof arg === "object" && "headers" in arg) {
      const argHeaders = arg.headers instanceof Headers ? arg.headers : new Headers(arg.headers);
      for (const [key, value] of argHeaders) {
        if (key.toLowerCase() === "set-cookie") {
          responseHeaders2.append(key, value);
        } else {
          responseHeaders2.set(key, value);
        }
      }
    }
    if (headers) {
      for (const [k, v] of Object.entries(headers)) {
        if (typeof v === "string") {
          responseHeaders2.set(k, v);
        } else {
          responseHeaders2.delete(k);
          for (const v2 of v) {
            responseHeaders2.append(k, v2);
          }
        }
      }
    }
    const status = typeof arg === "number" ? arg : arg?.status ?? this.#status;
    return createResponseInstance(data, { status, headers: responseHeaders2 });
  }
  newResponse = (...args) => this.#newResponse(...args);
  /**
   * `.body()` can return the HTTP response.
   * You can set headers with `.header()` and set HTTP status code with `.status`.
   * This can also be set in `.text()`, `.json()` and so on.
   *
   * @see {@link https://hono.dev/docs/api/context#body}
   *
   * @example
   * ```ts
   * app.get('/welcome', (c) => {
   *   // Set headers
   *   c.header('X-Message', 'Hello!')
   *   c.header('Content-Type', 'text/plain')
   *   // Set HTTP status code
   *   c.status(201)
   *
   *   // Return the response body
   *   return c.body('Thank you for coming')
   * })
   * ```
   */
  body = (data, arg, headers) => this.#newResponse(data, arg, headers);
  /**
   * `.text()` can render text as `Content-Type:text/plain`.
   *
   * @see {@link https://hono.dev/docs/api/context#text}
   *
   * @example
   * ```ts
   * app.get('/say', (c) => {
   *   return c.text('Hello!')
   * })
   * ```
   */
  text = (text, arg, headers) => {
    return !this.#preparedHeaders && !this.#status && !arg && !headers && !this.finalized ? new Response(text) : this.#newResponse(
      text,
      arg,
      setDefaultContentType(TEXT_PLAIN, headers)
    );
  };
  /**
   * `.json()` can render JSON as `Content-Type:application/json`.
   *
   * @see {@link https://hono.dev/docs/api/context#json}
   *
   * @example
   * ```ts
   * app.get('/api', (c) => {
   *   return c.json({ message: 'Hello!' })
   * })
   * ```
   */
  json = (object, arg, headers) => {
    return this.#newResponse(
      JSON.stringify(object),
      arg,
      setDefaultContentType("application/json", headers)
    );
  };
  html = (html, arg, headers) => {
    const res = (html2) => this.#newResponse(html2, arg, setDefaultContentType("text/html; charset=UTF-8", headers));
    return typeof html === "object" ? resolveCallback(html, HtmlEscapedCallbackPhase.Stringify, false, {}).then(res) : res(html);
  };
  /**
   * `.redirect()` can Redirect, default status code is 302.
   *
   * @see {@link https://hono.dev/docs/api/context#redirect}
   *
   * @example
   * ```ts
   * app.get('/redirect', (c) => {
   *   return c.redirect('/')
   * })
   * app.get('/redirect-permanently', (c) => {
   *   return c.redirect('/', 301)
   * })
   * ```
   */
  redirect = (location, status) => {
    const locationString = String(location);
    this.header(
      "Location",
      // Multibyes should be encoded
      // eslint-disable-next-line no-control-regex
      !/[^\x00-\xFF]/.test(locationString) ? locationString : encodeURI(locationString)
    );
    return this.newResponse(null, status ?? 302);
  };
  /**
   * `.notFound()` can return the Not Found Response.
   *
   * @see {@link https://hono.dev/docs/api/context#notfound}
   *
   * @example
   * ```ts
   * app.get('/notfound', (c) => {
   *   return c.notFound()
   * })
   * ```
   */
  notFound = () => {
    this.#notFoundHandler ??= () => createResponseInstance();
    return this.#notFoundHandler(this);
  };
};

// ../../node_modules/.pnpm/hono@4.12.26/node_modules/hono/dist/router.js
var METHOD_NAME_ALL = "ALL";
var METHOD_NAME_ALL_LOWERCASE = "all";
var METHODS = ["get", "post", "put", "delete", "options", "patch"];
var MESSAGE_MATCHER_IS_ALREADY_BUILT = "Can not add a route since the matcher is already built.";
var UnsupportedPathError = class extends Error {
};

// ../../node_modules/.pnpm/hono@4.12.26/node_modules/hono/dist/utils/constants.js
var COMPOSED_HANDLER = "__COMPOSED_HANDLER";

// ../../node_modules/.pnpm/hono@4.12.26/node_modules/hono/dist/hono-base.js
var notFoundHandler = (c) => {
  return c.text("404 Not Found", 404);
};
var errorHandler = (err, c) => {
  if ("getResponse" in err) {
    const res = err.getResponse();
    return c.newResponse(res.body, res);
  }
  console.error(err);
  return c.text("Internal Server Error", 500);
};
var Hono = class _Hono {
  get;
  post;
  put;
  delete;
  options;
  patch;
  all;
  on;
  use;
  /*
    This class is like an abstract class and does not have a router.
    To use it, inherit the class and implement router in the constructor.
  */
  router;
  getPath;
  // Cannot use `#` because it requires visibility at JavaScript runtime.
  _basePath = "/";
  #path = "/";
  routes = [];
  constructor(options = {}) {
    const allMethods = [...METHODS, METHOD_NAME_ALL_LOWERCASE];
    allMethods.forEach((method) => {
      this[method] = (args1, ...args) => {
        if (typeof args1 === "string") {
          this.#path = args1;
        } else {
          this.#addRoute(method, this.#path, args1);
        }
        args.forEach((handler) => {
          this.#addRoute(method, this.#path, handler);
        });
        return this;
      };
    });
    this.on = (method, path, ...handlers) => {
      for (const p of [path].flat()) {
        this.#path = p;
        for (const m of [method].flat()) {
          handlers.map((handler) => {
            this.#addRoute(m.toUpperCase(), this.#path, handler);
          });
        }
      }
      return this;
    };
    this.use = (arg1, ...handlers) => {
      if (typeof arg1 === "string") {
        this.#path = arg1;
      } else {
        this.#path = "*";
        handlers.unshift(arg1);
      }
      handlers.forEach((handler) => {
        this.#addRoute(METHOD_NAME_ALL, this.#path, handler);
      });
      return this;
    };
    const { strict, ...optionsWithoutStrict } = options;
    Object.assign(this, optionsWithoutStrict);
    this.getPath = strict ?? true ? options.getPath ?? getPath : getPathNoStrict;
  }
  #clone() {
    const clone = new _Hono({
      router: this.router,
      getPath: this.getPath
    });
    clone.errorHandler = this.errorHandler;
    clone.#notFoundHandler = this.#notFoundHandler;
    clone.routes = this.routes;
    return clone;
  }
  #notFoundHandler = notFoundHandler;
  // Cannot use `#` because it requires visibility at JavaScript runtime.
  errorHandler = errorHandler;
  /**
   * `.route()` allows grouping other Hono instance in routes.
   *
   * @see {@link https://hono.dev/docs/api/routing#grouping}
   *
   * @param {string} path - base Path
   * @param {Hono} app - other Hono instance
   * @returns {Hono} routed Hono instance
   *
   * @example
   * ```ts
   * const app = new Hono()
   * const app2 = new Hono()
   *
   * app2.get("/user", (c) => c.text("user"))
   * app.route("/api", app2) // GET /api/user
   * ```
   */
  route(path, app) {
    const subApp = this.basePath(path);
    app.routes.map((r) => {
      let handler;
      if (app.errorHandler === errorHandler) {
        handler = r.handler;
      } else {
        handler = async (c, next) => (await compose([], app.errorHandler)(c, () => r.handler(c, next))).res;
        handler[COMPOSED_HANDLER] = r.handler;
      }
      subApp.#addRoute(r.method, r.path, handler, r.basePath);
    });
    return this;
  }
  /**
   * `.basePath()` allows base paths to be specified.
   *
   * @see {@link https://hono.dev/docs/api/routing#base-path}
   *
   * @param {string} path - base Path
   * @returns {Hono} changed Hono instance
   *
   * @example
   * ```ts
   * const api = new Hono().basePath('/api')
   * ```
   */
  basePath(path) {
    const subApp = this.#clone();
    subApp._basePath = mergePath(this._basePath, path);
    return subApp;
  }
  /**
   * `.onError()` handles an error and returns a customized Response.
   *
   * @see {@link https://hono.dev/docs/api/hono#error-handling}
   *
   * @param {ErrorHandler} handler - request Handler for error
   * @returns {Hono} changed Hono instance
   *
   * @example
   * ```ts
   * app.onError((err, c) => {
   *   console.error(`${err}`)
   *   return c.text('Custom Error Message', 500)
   * })
   * ```
   */
  onError = (handler) => {
    this.errorHandler = handler;
    return this;
  };
  /**
   * `.notFound()` allows you to customize a Not Found Response.
   *
   * @see {@link https://hono.dev/docs/api/hono#not-found}
   *
   * @param {NotFoundHandler} handler - request handler for not-found
   * @returns {Hono} changed Hono instance
   *
   * @example
   * ```ts
   * app.notFound((c) => {
   *   return c.text('Custom 404 Message', 404)
   * })
   * ```
   */
  notFound = (handler) => {
    this.#notFoundHandler = handler;
    return this;
  };
  /**
   * `.mount()` allows you to mount applications built with other frameworks into your Hono application.
   *
   * @see {@link https://hono.dev/docs/api/hono#mount}
   *
   * @param {string} path - base Path
   * @param {Function} applicationHandler - other Request Handler
   * @param {MountOptions} [options] - options of `.mount()`
   * @returns {Hono} mounted Hono instance
   *
   * @example
   * ```ts
   * import { Router as IttyRouter } from 'itty-router'
   * import { Hono } from 'hono'
   * // Create itty-router application
   * const ittyRouter = IttyRouter()
   * // GET /itty-router/hello
   * ittyRouter.get('/hello', () => new Response('Hello from itty-router'))
   *
   * const app = new Hono()
   * app.mount('/itty-router', ittyRouter.handle)
   * ```
   *
   * @example
   * ```ts
   * const app = new Hono()
   * // Send the request to another application without modification.
   * app.mount('/app', anotherApp, {
   *   replaceRequest: (req) => req,
   * })
   * ```
   */
  mount(path, applicationHandler, options) {
    let replaceRequest;
    let optionHandler;
    if (options) {
      if (typeof options === "function") {
        optionHandler = options;
      } else {
        optionHandler = options.optionHandler;
        if (options.replaceRequest === false) {
          replaceRequest = (request) => request;
        } else {
          replaceRequest = options.replaceRequest;
        }
      }
    }
    const getOptions = optionHandler ? (c) => {
      const options2 = optionHandler(c);
      return Array.isArray(options2) ? options2 : [options2];
    } : (c) => {
      let executionContext = void 0;
      try {
        executionContext = c.executionCtx;
      } catch {
      }
      return [c.env, executionContext];
    };
    replaceRequest ||= (() => {
      const mergedPath = mergePath(this._basePath, path);
      const pathPrefixLength = mergedPath === "/" ? 0 : mergedPath.length;
      return (request) => {
        const url = new URL(request.url);
        url.pathname = this.getPath(request).slice(pathPrefixLength) || "/";
        return new Request(url, request);
      };
    })();
    const handler = async (c, next) => {
      const res = await applicationHandler(replaceRequest(c.req.raw), ...getOptions(c));
      if (res) {
        return res;
      }
      await next();
    };
    this.#addRoute(METHOD_NAME_ALL, mergePath(path, "*"), handler);
    return this;
  }
  #addRoute(method, path, handler, baseRoutePath) {
    method = method.toUpperCase();
    path = mergePath(this._basePath, path);
    const r = {
      basePath: baseRoutePath !== void 0 ? mergePath(this._basePath, baseRoutePath) : this._basePath,
      path,
      method,
      handler
    };
    this.router.add(method, path, [handler, r]);
    this.routes.push(r);
  }
  #handleError(err, c) {
    if (err instanceof Error) {
      return this.errorHandler(err, c);
    }
    throw err;
  }
  #dispatch(request, executionCtx, env, method) {
    if (method === "HEAD") {
      return (async () => new Response(null, await this.#dispatch(request, executionCtx, env, "GET")))();
    }
    const path = this.getPath(request, { env });
    const matchResult = this.router.match(method, path);
    const c = new Context(request, {
      path,
      matchResult,
      env,
      executionCtx,
      notFoundHandler: this.#notFoundHandler
    });
    if (matchResult[0].length === 1) {
      let res;
      try {
        res = matchResult[0][0][0][0](c, async () => {
          c.res = await this.#notFoundHandler(c);
        });
      } catch (err) {
        return this.#handleError(err, c);
      }
      return res instanceof Promise ? res.then(
        (resolved) => resolved || (c.finalized ? c.res : this.#notFoundHandler(c))
      ).catch((err) => this.#handleError(err, c)) : res ?? this.#notFoundHandler(c);
    }
    const composed = compose(matchResult[0], this.errorHandler, this.#notFoundHandler);
    return (async () => {
      try {
        const context = await composed(c);
        if (!context.finalized) {
          throw new Error(
            "Context is not finalized. Did you forget to return a Response object or `await next()`?"
          );
        }
        return context.res;
      } catch (err) {
        return this.#handleError(err, c);
      }
    })();
  }
  /**
   * `.fetch()` will be entry point of your app.
   *
   * @see {@link https://hono.dev/docs/api/hono#fetch}
   *
   * @param {Request} request - request Object of request
   * @param {Env} Env - env Object
   * @param {ExecutionContext} - context of execution
   * @returns {Response | Promise<Response>} response of request
   *
   */
  fetch = (request, ...rest) => {
    return this.#dispatch(request, rest[1], rest[0], request.method);
  };
  /**
   * `.request()` is a useful method for testing.
   * You can pass a URL or pathname to send a GET request.
   * app will return a Response object.
   * ```ts
   * test('GET /hello is ok', async () => {
   *   const res = await app.request('/hello')
   *   expect(res.status).toBe(200)
   * })
   * ```
   * @see https://hono.dev/docs/api/hono#request
   */
  request = (input, requestInit, Env, executionCtx) => {
    if (input instanceof Request) {
      return this.fetch(requestInit ? new Request(input, requestInit) : input, Env, executionCtx);
    }
    input = input.toString();
    return this.fetch(
      new Request(
        /^https?:\/\//.test(input) ? input : `http://localhost${mergePath("/", input)}`,
        requestInit
      ),
      Env,
      executionCtx
    );
  };
  /**
   * `.fire()` automatically adds a global fetch event listener.
   * This can be useful for environments that adhere to the Service Worker API, such as non-ES module Cloudflare Workers.
   * @deprecated
   * Use `fire` from `hono/service-worker` instead.
   * ```ts
   * import { Hono } from 'hono'
   * import { fire } from 'hono/service-worker'
   *
   * const app = new Hono()
   * // ...
   * fire(app)
   * ```
   * @see https://hono.dev/docs/api/hono#fire
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API
   * @see https://developers.cloudflare.com/workers/reference/migrate-to-module-workers/
   */
  fire = () => {
    addEventListener("fetch", (event) => {
      event.respondWith(this.#dispatch(event.request, event, void 0, event.request.method));
    });
  };
};

// ../../node_modules/.pnpm/hono@4.12.26/node_modules/hono/dist/router/reg-exp-router/matcher.js
var emptyParam = [];
function match(method, path) {
  const matchers = this.buildAllMatchers();
  const match2 = ((method2, path2) => {
    const matcher = matchers[method2] || matchers[METHOD_NAME_ALL];
    const staticMatch = matcher[2][path2];
    if (staticMatch) {
      return staticMatch;
    }
    const match3 = path2.match(matcher[0]);
    if (!match3) {
      return [[], emptyParam];
    }
    const index = match3.indexOf("", 1);
    return [matcher[1][index], match3];
  });
  this.match = match2;
  return match2(method, path);
}

// ../../node_modules/.pnpm/hono@4.12.26/node_modules/hono/dist/router/reg-exp-router/node.js
var LABEL_REG_EXP_STR = "[^/]+";
var ONLY_WILDCARD_REG_EXP_STR = ".*";
var TAIL_WILDCARD_REG_EXP_STR = "(?:|/.*)";
var PATH_ERROR = /* @__PURE__ */ Symbol();
var regExpMetaChars = new Set(".\\+*[^]$()");
function compareKey(a, b) {
  if (a.length === 1) {
    return b.length === 1 ? a < b ? -1 : 1 : -1;
  }
  if (b.length === 1) {
    return 1;
  }
  if (a === ONLY_WILDCARD_REG_EXP_STR || a === TAIL_WILDCARD_REG_EXP_STR) {
    return 1;
  } else if (b === ONLY_WILDCARD_REG_EXP_STR || b === TAIL_WILDCARD_REG_EXP_STR) {
    return -1;
  }
  if (a === LABEL_REG_EXP_STR) {
    return 1;
  } else if (b === LABEL_REG_EXP_STR) {
    return -1;
  }
  return a.length === b.length ? a < b ? -1 : 1 : b.length - a.length;
}
var Node = class _Node {
  #index;
  #varIndex;
  #children = /* @__PURE__ */ Object.create(null);
  insert(tokens, index, paramMap, context, pathErrorCheckOnly) {
    if (tokens.length === 0) {
      if (this.#index !== void 0) {
        throw PATH_ERROR;
      }
      if (pathErrorCheckOnly) {
        return;
      }
      this.#index = index;
      return;
    }
    const [token, ...restTokens] = tokens;
    const pattern = token === "*" ? restTokens.length === 0 ? ["", "", ONLY_WILDCARD_REG_EXP_STR] : ["", "", LABEL_REG_EXP_STR] : token === "/*" ? ["", "", TAIL_WILDCARD_REG_EXP_STR] : token.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);
    let node;
    if (pattern) {
      const name = pattern[1];
      let regexpStr = pattern[2] || LABEL_REG_EXP_STR;
      if (name && pattern[2]) {
        if (regexpStr === ".*") {
          throw PATH_ERROR;
        }
        regexpStr = regexpStr.replace(/^\((?!\?:)(?=[^)]+\)$)/, "(?:");
        if (/\((?!\?:)/.test(regexpStr)) {
          throw PATH_ERROR;
        }
      }
      node = this.#children[regexpStr];
      if (!node) {
        if (Object.keys(this.#children).some(
          (k) => k !== ONLY_WILDCARD_REG_EXP_STR && k !== TAIL_WILDCARD_REG_EXP_STR
        )) {
          throw PATH_ERROR;
        }
        if (pathErrorCheckOnly) {
          return;
        }
        node = this.#children[regexpStr] = new _Node();
        if (name !== "") {
          node.#varIndex = context.varIndex++;
        }
      }
      if (!pathErrorCheckOnly && name !== "") {
        paramMap.push([name, node.#varIndex]);
      }
    } else {
      node = this.#children[token];
      if (!node) {
        if (Object.keys(this.#children).some(
          (k) => k.length > 1 && k !== ONLY_WILDCARD_REG_EXP_STR && k !== TAIL_WILDCARD_REG_EXP_STR
        )) {
          throw PATH_ERROR;
        }
        if (pathErrorCheckOnly) {
          return;
        }
        node = this.#children[token] = new _Node();
      }
    }
    node.insert(restTokens, index, paramMap, context, pathErrorCheckOnly);
  }
  buildRegExpStr() {
    const childKeys = Object.keys(this.#children).sort(compareKey);
    const strList = childKeys.map((k) => {
      const c = this.#children[k];
      return (typeof c.#varIndex === "number" ? `(${k})@${c.#varIndex}` : regExpMetaChars.has(k) ? `\\${k}` : k) + c.buildRegExpStr();
    });
    if (typeof this.#index === "number") {
      strList.unshift(`#${this.#index}`);
    }
    if (strList.length === 0) {
      return "";
    }
    if (strList.length === 1) {
      return strList[0];
    }
    return "(?:" + strList.join("|") + ")";
  }
};

// ../../node_modules/.pnpm/hono@4.12.26/node_modules/hono/dist/router/reg-exp-router/trie.js
var Trie = class {
  #context = { varIndex: 0 };
  #root = new Node();
  insert(path, index, pathErrorCheckOnly) {
    const paramAssoc = [];
    const groups = [];
    for (let i = 0; ; ) {
      let replaced = false;
      path = path.replace(/\{[^}]+\}/g, (m) => {
        const mark = `@\\${i}`;
        groups[i] = [mark, m];
        i++;
        replaced = true;
        return mark;
      });
      if (!replaced) {
        break;
      }
    }
    const tokens = path.match(/(?::[^\/]+)|(?:\/\*$)|./g) || [];
    for (let i = groups.length - 1; i >= 0; i--) {
      const [mark] = groups[i];
      for (let j = tokens.length - 1; j >= 0; j--) {
        if (tokens[j].indexOf(mark) !== -1) {
          tokens[j] = tokens[j].replace(mark, groups[i][1]);
          break;
        }
      }
    }
    this.#root.insert(tokens, index, paramAssoc, this.#context, pathErrorCheckOnly);
    return paramAssoc;
  }
  buildRegExp() {
    let regexp = this.#root.buildRegExpStr();
    if (regexp === "") {
      return [/^$/, [], []];
    }
    let captureIndex = 0;
    const indexReplacementMap = [];
    const paramReplacementMap = [];
    regexp = regexp.replace(/#(\d+)|@(\d+)|\.\*\$/g, (_, handlerIndex, paramIndex) => {
      if (handlerIndex !== void 0) {
        indexReplacementMap[++captureIndex] = Number(handlerIndex);
        return "$()";
      }
      if (paramIndex !== void 0) {
        paramReplacementMap[Number(paramIndex)] = ++captureIndex;
        return "";
      }
      return "";
    });
    return [new RegExp(`^${regexp}`), indexReplacementMap, paramReplacementMap];
  }
};

// ../../node_modules/.pnpm/hono@4.12.26/node_modules/hono/dist/router/reg-exp-router/router.js
var nullMatcher = [/^$/, [], /* @__PURE__ */ Object.create(null)];
var wildcardRegExpCache = /* @__PURE__ */ Object.create(null);
function buildWildcardRegExp(path) {
  return wildcardRegExpCache[path] ??= new RegExp(
    path === "*" ? "" : `^${path.replace(
      /\/\*$|([.\\+*[^\]$()])/g,
      (_, metaChar) => metaChar ? `\\${metaChar}` : "(?:|/.*)"
    )}$`
  );
}
function clearWildcardRegExpCache() {
  wildcardRegExpCache = /* @__PURE__ */ Object.create(null);
}
function buildMatcherFromPreprocessedRoutes(routes) {
  const trie = new Trie();
  const handlerData = [];
  if (routes.length === 0) {
    return nullMatcher;
  }
  const routesWithStaticPathFlag = routes.map(
    (route) => [!/\*|\/:/.test(route[0]), ...route]
  ).sort(
    ([isStaticA, pathA], [isStaticB, pathB]) => isStaticA ? 1 : isStaticB ? -1 : pathA.length - pathB.length
  );
  const staticMap = /* @__PURE__ */ Object.create(null);
  for (let i = 0, j = -1, len = routesWithStaticPathFlag.length; i < len; i++) {
    const [pathErrorCheckOnly, path, handlers] = routesWithStaticPathFlag[i];
    if (pathErrorCheckOnly) {
      staticMap[path] = [handlers.map(([h]) => [h, /* @__PURE__ */ Object.create(null)]), emptyParam];
    } else {
      j++;
    }
    let paramAssoc;
    try {
      paramAssoc = trie.insert(path, j, pathErrorCheckOnly);
    } catch (e) {
      throw e === PATH_ERROR ? new UnsupportedPathError(path) : e;
    }
    if (pathErrorCheckOnly) {
      continue;
    }
    handlerData[j] = handlers.map(([h, paramCount]) => {
      const paramIndexMap = /* @__PURE__ */ Object.create(null);
      paramCount -= 1;
      for (; paramCount >= 0; paramCount--) {
        const [key, value] = paramAssoc[paramCount];
        paramIndexMap[key] = value;
      }
      return [h, paramIndexMap];
    });
  }
  const [regexp, indexReplacementMap, paramReplacementMap] = trie.buildRegExp();
  for (let i = 0, len = handlerData.length; i < len; i++) {
    for (let j = 0, len2 = handlerData[i].length; j < len2; j++) {
      const map = handlerData[i][j]?.[1];
      if (!map) {
        continue;
      }
      const keys = Object.keys(map);
      for (let k = 0, len3 = keys.length; k < len3; k++) {
        map[keys[k]] = paramReplacementMap[map[keys[k]]];
      }
    }
  }
  const handlerMap = [];
  for (const i in indexReplacementMap) {
    handlerMap[i] = handlerData[indexReplacementMap[i]];
  }
  return [regexp, handlerMap, staticMap];
}
function findMiddleware(middleware, path) {
  if (!middleware) {
    return void 0;
  }
  for (const k of Object.keys(middleware).sort((a, b) => b.length - a.length)) {
    if (buildWildcardRegExp(k).test(path)) {
      return [...middleware[k]];
    }
  }
  return void 0;
}
var RegExpRouter = class {
  name = "RegExpRouter";
  #middleware;
  #routes;
  constructor() {
    this.#middleware = { [METHOD_NAME_ALL]: /* @__PURE__ */ Object.create(null) };
    this.#routes = { [METHOD_NAME_ALL]: /* @__PURE__ */ Object.create(null) };
  }
  add(method, path, handler) {
    const middleware = this.#middleware;
    const routes = this.#routes;
    if (!middleware || !routes) {
      throw new Error(MESSAGE_MATCHER_IS_ALREADY_BUILT);
    }
    if (!middleware[method]) {
      ;
      [middleware, routes].forEach((handlerMap) => {
        handlerMap[method] = /* @__PURE__ */ Object.create(null);
        Object.keys(handlerMap[METHOD_NAME_ALL]).forEach((p) => {
          handlerMap[method][p] = [...handlerMap[METHOD_NAME_ALL][p]];
        });
      });
    }
    if (path === "/*") {
      path = "*";
    }
    const paramCount = (path.match(/\/:/g) || []).length;
    if (/\*$/.test(path)) {
      const re = buildWildcardRegExp(path);
      if (method === METHOD_NAME_ALL) {
        Object.keys(middleware).forEach((m) => {
          middleware[m][path] ||= findMiddleware(middleware[m], path) || findMiddleware(middleware[METHOD_NAME_ALL], path) || [];
        });
      } else {
        middleware[method][path] ||= findMiddleware(middleware[method], path) || findMiddleware(middleware[METHOD_NAME_ALL], path) || [];
      }
      Object.keys(middleware).forEach((m) => {
        if (method === METHOD_NAME_ALL || method === m) {
          Object.keys(middleware[m]).forEach((p) => {
            re.test(p) && middleware[m][p].push([handler, paramCount]);
          });
        }
      });
      Object.keys(routes).forEach((m) => {
        if (method === METHOD_NAME_ALL || method === m) {
          Object.keys(routes[m]).forEach(
            (p) => re.test(p) && routes[m][p].push([handler, paramCount])
          );
        }
      });
      return;
    }
    const paths = checkOptionalParameter(path) || [path];
    for (let i = 0, len = paths.length; i < len; i++) {
      const path2 = paths[i];
      Object.keys(routes).forEach((m) => {
        if (method === METHOD_NAME_ALL || method === m) {
          routes[m][path2] ||= [
            ...findMiddleware(middleware[m], path2) || findMiddleware(middleware[METHOD_NAME_ALL], path2) || []
          ];
          routes[m][path2].push([handler, paramCount - len + i + 1]);
        }
      });
    }
  }
  match = match;
  buildAllMatchers() {
    const matchers = /* @__PURE__ */ Object.create(null);
    Object.keys(this.#routes).concat(Object.keys(this.#middleware)).forEach((method) => {
      matchers[method] ||= this.#buildMatcher(method);
    });
    this.#middleware = this.#routes = void 0;
    clearWildcardRegExpCache();
    return matchers;
  }
  #buildMatcher(method) {
    const routes = [];
    let hasOwnRoute = method === METHOD_NAME_ALL;
    [this.#middleware, this.#routes].forEach((r) => {
      const ownRoute = r[method] ? Object.keys(r[method]).map((path) => [path, r[method][path]]) : [];
      if (ownRoute.length !== 0) {
        hasOwnRoute ||= true;
        routes.push(...ownRoute);
      } else if (method !== METHOD_NAME_ALL) {
        routes.push(
          ...Object.keys(r[METHOD_NAME_ALL]).map((path) => [path, r[METHOD_NAME_ALL][path]])
        );
      }
    });
    if (!hasOwnRoute) {
      return null;
    } else {
      return buildMatcherFromPreprocessedRoutes(routes);
    }
  }
};

// ../../node_modules/.pnpm/hono@4.12.26/node_modules/hono/dist/router/smart-router/router.js
var SmartRouter = class {
  name = "SmartRouter";
  #routers = [];
  #routes = [];
  constructor(init) {
    this.#routers = init.routers;
  }
  add(method, path, handler) {
    if (!this.#routes) {
      throw new Error(MESSAGE_MATCHER_IS_ALREADY_BUILT);
    }
    this.#routes.push([method, path, handler]);
  }
  match(method, path) {
    if (!this.#routes) {
      throw new Error("Fatal error");
    }
    const routers = this.#routers;
    const routes = this.#routes;
    const len = routers.length;
    let i = 0;
    let res;
    for (; i < len; i++) {
      const router = routers[i];
      try {
        for (let i2 = 0, len2 = routes.length; i2 < len2; i2++) {
          router.add(...routes[i2]);
        }
        res = router.match(method, path);
      } catch (e) {
        if (e instanceof UnsupportedPathError) {
          continue;
        }
        throw e;
      }
      this.match = router.match.bind(router);
      this.#routers = [router];
      this.#routes = void 0;
      break;
    }
    if (i === len) {
      throw new Error("Fatal error");
    }
    this.name = `SmartRouter + ${this.activeRouter.name}`;
    return res;
  }
  get activeRouter() {
    if (this.#routes || this.#routers.length !== 1) {
      throw new Error("No active router has been determined yet.");
    }
    return this.#routers[0];
  }
};

// ../../node_modules/.pnpm/hono@4.12.26/node_modules/hono/dist/router/trie-router/node.js
var emptyParams = /* @__PURE__ */ Object.create(null);
var hasChildren = (children) => {
  for (const _ in children) {
    return true;
  }
  return false;
};
var Node2 = class _Node2 {
  #methods;
  #children;
  #patterns;
  #order = 0;
  #params = emptyParams;
  constructor(method, handler, children) {
    this.#children = children || /* @__PURE__ */ Object.create(null);
    this.#methods = [];
    if (method && handler) {
      const m = /* @__PURE__ */ Object.create(null);
      m[method] = { handler, possibleKeys: [], score: 0 };
      this.#methods = [m];
    }
    this.#patterns = [];
  }
  insert(method, path, handler) {
    this.#order = ++this.#order;
    let curNode = this;
    const parts = splitRoutingPath(path);
    const possibleKeys = [];
    for (let i = 0, len = parts.length; i < len; i++) {
      const p = parts[i];
      const nextP = parts[i + 1];
      const pattern = getPattern(p, nextP);
      const key = Array.isArray(pattern) ? pattern[0] : p;
      if (key in curNode.#children) {
        curNode = curNode.#children[key];
        if (pattern) {
          possibleKeys.push(pattern[1]);
        }
        continue;
      }
      curNode.#children[key] = new _Node2();
      if (pattern) {
        curNode.#patterns.push(pattern);
        possibleKeys.push(pattern[1]);
      }
      curNode = curNode.#children[key];
    }
    curNode.#methods.push({
      [method]: {
        handler,
        possibleKeys: possibleKeys.filter((v, i, a) => a.indexOf(v) === i),
        score: this.#order
      }
    });
    return curNode;
  }
  #pushHandlerSets(handlerSets, node, method, nodeParams, params) {
    for (let i = 0, len = node.#methods.length; i < len; i++) {
      const m = node.#methods[i];
      const handlerSet = m[method] || m[METHOD_NAME_ALL];
      const processedSet = {};
      if (handlerSet !== void 0) {
        handlerSet.params = /* @__PURE__ */ Object.create(null);
        handlerSets.push(handlerSet);
        if (nodeParams !== emptyParams || params && params !== emptyParams) {
          for (let i2 = 0, len2 = handlerSet.possibleKeys.length; i2 < len2; i2++) {
            const key = handlerSet.possibleKeys[i2];
            const processed = processedSet[handlerSet.score];
            handlerSet.params[key] = params?.[key] && !processed ? params[key] : nodeParams[key] ?? params?.[key];
            processedSet[handlerSet.score] = true;
          }
        }
      }
    }
  }
  search(method, path) {
    const handlerSets = [];
    this.#params = emptyParams;
    const curNode = this;
    let curNodes = [curNode];
    const parts = splitPath(path);
    const curNodesQueue = [];
    const len = parts.length;
    let partOffsets = null;
    for (let i = 0; i < len; i++) {
      const part = parts[i];
      const isLast = i === len - 1;
      const tempNodes = [];
      for (let j = 0, len2 = curNodes.length; j < len2; j++) {
        const node = curNodes[j];
        const nextNode = node.#children[part];
        if (nextNode) {
          nextNode.#params = node.#params;
          if (isLast) {
            if (nextNode.#children["*"]) {
              this.#pushHandlerSets(handlerSets, nextNode.#children["*"], method, node.#params);
            }
            this.#pushHandlerSets(handlerSets, nextNode, method, node.#params);
          } else {
            tempNodes.push(nextNode);
          }
        }
        for (let k = 0, len3 = node.#patterns.length; k < len3; k++) {
          const pattern = node.#patterns[k];
          const params = node.#params === emptyParams ? {} : { ...node.#params };
          if (pattern === "*") {
            const astNode = node.#children["*"];
            if (astNode) {
              this.#pushHandlerSets(handlerSets, astNode, method, node.#params);
              astNode.#params = params;
              tempNodes.push(astNode);
            }
            continue;
          }
          const [key, name, matcher] = pattern;
          if (!part && !(matcher instanceof RegExp)) {
            continue;
          }
          const child = node.#children[key];
          if (matcher instanceof RegExp) {
            if (partOffsets === null) {
              partOffsets = new Array(len);
              let offset = path[0] === "/" ? 1 : 0;
              for (let p = 0; p < len; p++) {
                partOffsets[p] = offset;
                offset += parts[p].length + 1;
              }
            }
            const restPathString = path.substring(partOffsets[i]);
            const m = matcher.exec(restPathString);
            if (m) {
              params[name] = m[0];
              this.#pushHandlerSets(handlerSets, child, method, node.#params, params);
              if (hasChildren(child.#children)) {
                child.#params = params;
                const componentCount = m[0].match(/\//)?.length ?? 0;
                const targetCurNodes = curNodesQueue[componentCount] ||= [];
                targetCurNodes.push(child);
              }
              continue;
            }
          }
          if (matcher === true || matcher.test(part)) {
            params[name] = part;
            if (isLast) {
              this.#pushHandlerSets(handlerSets, child, method, params, node.#params);
              if (child.#children["*"]) {
                this.#pushHandlerSets(
                  handlerSets,
                  child.#children["*"],
                  method,
                  params,
                  node.#params
                );
              }
            } else {
              child.#params = params;
              tempNodes.push(child);
            }
          }
        }
      }
      const shifted = curNodesQueue.shift();
      curNodes = shifted ? tempNodes.concat(shifted) : tempNodes;
    }
    if (handlerSets.length > 1) {
      handlerSets.sort((a, b) => {
        return a.score - b.score;
      });
    }
    return [handlerSets.map(({ handler, params }) => [handler, params])];
  }
};

// ../../node_modules/.pnpm/hono@4.12.26/node_modules/hono/dist/router/trie-router/router.js
var TrieRouter = class {
  name = "TrieRouter";
  #node;
  constructor() {
    this.#node = new Node2();
  }
  add(method, path, handler) {
    const results = checkOptionalParameter(path);
    if (results) {
      for (let i = 0, len = results.length; i < len; i++) {
        this.#node.insert(method, results[i], handler);
      }
      return;
    }
    this.#node.insert(method, path, handler);
  }
  match(method, path) {
    return this.#node.search(method, path);
  }
};

// ../../node_modules/.pnpm/hono@4.12.26/node_modules/hono/dist/hono.js
var Hono2 = class extends Hono {
  /**
   * Creates an instance of the Hono class.
   *
   * @param options - Optional configuration options for the Hono instance.
   */
  constructor(options = {}) {
    super(options);
    this.router = options.router ?? new SmartRouter({
      routers: [new RegExpRouter(), new TrieRouter()]
    });
  }
};

// ../../node_modules/.pnpm/hono@4.12.26/node_modules/hono/dist/middleware/cors/index.js
var cors = (options) => {
  const opts = {
    origin: "*",
    allowMethods: ["GET", "HEAD", "PUT", "POST", "DELETE", "PATCH"],
    allowHeaders: [],
    exposeHeaders: [],
    ...options
  };
  const findAllowOrigin = ((optsOrigin) => {
    if (typeof optsOrigin === "string") {
      if (optsOrigin === "*") {
        return () => optsOrigin;
      } else {
        return (origin) => optsOrigin === origin ? origin : null;
      }
    } else if (typeof optsOrigin === "function") {
      return optsOrigin;
    } else {
      return (origin) => optsOrigin.includes(origin) ? origin : null;
    }
  })(opts.origin);
  const findAllowMethods = ((optsAllowMethods) => {
    if (typeof optsAllowMethods === "function") {
      return optsAllowMethods;
    } else if (Array.isArray(optsAllowMethods)) {
      return () => optsAllowMethods;
    } else {
      return () => [];
    }
  })(opts.allowMethods);
  return async function cors2(c, next) {
    function set(key, value) {
      c.res.headers.set(key, value);
    }
    const allowOrigin = await findAllowOrigin(c.req.header("origin") || "", c);
    if (allowOrigin) {
      set("Access-Control-Allow-Origin", allowOrigin);
    }
    if (opts.credentials) {
      set("Access-Control-Allow-Credentials", "true");
    }
    if (opts.exposeHeaders?.length) {
      set("Access-Control-Expose-Headers", opts.exposeHeaders.join(","));
    }
    if (c.req.method === "OPTIONS") {
      if (opts.origin !== "*") {
        set("Vary", "Origin");
      }
      if (opts.maxAge != null) {
        set("Access-Control-Max-Age", opts.maxAge.toString());
      }
      const allowMethods = await findAllowMethods(c.req.header("origin") || "", c);
      if (allowMethods.length) {
        set("Access-Control-Allow-Methods", allowMethods.join(","));
      }
      let headers = opts.allowHeaders;
      if (!headers?.length) {
        const requestHeaders = c.req.header("Access-Control-Request-Headers");
        if (requestHeaders) {
          headers = requestHeaders.split(/\s*,\s*/);
        }
      }
      if (headers?.length) {
        set("Access-Control-Allow-Headers", headers.join(","));
        c.res.headers.append("Vary", "Access-Control-Request-Headers");
      }
      c.res.headers.delete("Content-Length");
      c.res.headers.delete("Content-Type");
      return new Response(null, {
        headers: c.res.headers,
        status: 204,
        statusText: "No Content"
      });
    }
    await next();
    if (opts.origin !== "*") {
      c.header("Vary", "Origin", { append: true });
    }
  };
};

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.3_pg@8.22.0/node_modules/drizzle-orm/entity.js
var entityKind = /* @__PURE__ */ Symbol.for("drizzle:entityKind");
function is(value, type) {
  if (!value || typeof value !== "object") {
    return false;
  }
  if (value instanceof type) {
    return true;
  }
  if (!Object.prototype.hasOwnProperty.call(type, entityKind)) {
    throw new Error(
      `Class "${type.name ?? "<unknown>"}" doesn't look like a Drizzle entity. If this is incorrect and the class is provided by Drizzle, please report this as a bug.`
    );
  }
  let cls = Object.getPrototypeOf(value).constructor;
  if (cls) {
    while (cls) {
      if (entityKind in cls && cls[entityKind] === type[entityKind]) {
        return true;
      }
      cls = Object.getPrototypeOf(cls);
    }
  }
  return false;
}

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.3_pg@8.22.0/node_modules/drizzle-orm/column.js
var Column = class {
  constructor(table, config) {
    this.table = table;
    this.config = config;
    this.name = config.name;
    this.keyAsName = config.keyAsName;
    this.notNull = config.notNull;
    this.default = config.default;
    this.defaultFn = config.defaultFn;
    this.onUpdateFn = config.onUpdateFn;
    this.hasDefault = config.hasDefault;
    this.primary = config.primaryKey;
    this.isUnique = config.isUnique;
    this.uniqueName = config.uniqueName;
    this.uniqueType = config.uniqueType;
    this.dataType = config.dataType;
    this.columnType = config.columnType;
    this.generated = config.generated;
    this.generatedIdentity = config.generatedIdentity;
  }
  static [entityKind] = "Column";
  name;
  keyAsName;
  primary;
  notNull;
  default;
  defaultFn;
  onUpdateFn;
  hasDefault;
  isUnique;
  uniqueName;
  uniqueType;
  dataType;
  columnType;
  enumValues = void 0;
  generated = void 0;
  generatedIdentity = void 0;
  config;
  mapFromDriverValue(value) {
    return value;
  }
  mapToDriverValue(value) {
    return value;
  }
  // ** @internal */
  shouldDisableInsert() {
    return this.config.generated !== void 0 && this.config.generated.type !== "byDefault";
  }
};

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.3_pg@8.22.0/node_modules/drizzle-orm/column-builder.js
var ColumnBuilder = class {
  static [entityKind] = "ColumnBuilder";
  config;
  constructor(name, dataType, columnType) {
    this.config = {
      name,
      keyAsName: name === "",
      notNull: false,
      default: void 0,
      hasDefault: false,
      primaryKey: false,
      isUnique: false,
      uniqueName: void 0,
      uniqueType: void 0,
      dataType,
      columnType,
      generated: void 0
    };
  }
  /**
   * Changes the data type of the column. Commonly used with `json` columns. Also, useful for branded types.
   *
   * @example
   * ```ts
   * const users = pgTable('users', {
   * 	id: integer('id').$type<UserId>().primaryKey(),
   * 	details: json('details').$type<UserDetails>().notNull(),
   * });
   * ```
   */
  $type() {
    return this;
  }
  /**
   * Adds a `not null` clause to the column definition.
   *
   * Affects the `select` model of the table - columns *without* `not null` will be nullable on select.
   */
  notNull() {
    this.config.notNull = true;
    return this;
  }
  /**
   * Adds a `default <value>` clause to the column definition.
   *
   * Affects the `insert` model of the table - columns *with* `default` are optional on insert.
   *
   * If you need to set a dynamic default value, use {@link $defaultFn} instead.
   */
  default(value) {
    this.config.default = value;
    this.config.hasDefault = true;
    return this;
  }
  /**
   * Adds a dynamic default value to the column.
   * The function will be called when the row is inserted, and the returned value will be used as the column value.
   *
   * **Note:** This value does not affect the `drizzle-kit` behavior, it is only used at runtime in `drizzle-orm`.
   */
  $defaultFn(fn) {
    this.config.defaultFn = fn;
    this.config.hasDefault = true;
    return this;
  }
  /**
   * Alias for {@link $defaultFn}.
   */
  $default = this.$defaultFn;
  /**
   * Adds a dynamic update value to the column.
   * The function will be called when the row is updated, and the returned value will be used as the column value if none is provided.
   * If no `default` (or `$defaultFn`) value is provided, the function will be called when the row is inserted as well, and the returned value will be used as the column value.
   *
   * **Note:** This value does not affect the `drizzle-kit` behavior, it is only used at runtime in `drizzle-orm`.
   */
  $onUpdateFn(fn) {
    this.config.onUpdateFn = fn;
    this.config.hasDefault = true;
    return this;
  }
  /**
   * Alias for {@link $onUpdateFn}.
   */
  $onUpdate = this.$onUpdateFn;
  /**
   * Adds a `primary key` clause to the column definition. This implicitly makes the column `not null`.
   *
   * In SQLite, `integer primary key` implicitly makes the column auto-incrementing.
   */
  primaryKey() {
    this.config.primaryKey = true;
    this.config.notNull = true;
    return this;
  }
  /** @internal Sets the name of the column to the key within the table definition if a name was not given. */
  setName(name) {
    if (this.config.name !== "") return;
    this.config.name = name;
  }
};

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.3_pg@8.22.0/node_modules/drizzle-orm/table.utils.js
var TableName = /* @__PURE__ */ Symbol.for("drizzle:Name");

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.3_pg@8.22.0/node_modules/drizzle-orm/pg-core/foreign-keys.js
var ForeignKeyBuilder = class {
  static [entityKind] = "PgForeignKeyBuilder";
  /** @internal */
  reference;
  /** @internal */
  _onUpdate = "no action";
  /** @internal */
  _onDelete = "no action";
  constructor(config, actions) {
    this.reference = () => {
      const { name, columns, foreignColumns } = config();
      return { name, columns, foreignTable: foreignColumns[0].table, foreignColumns };
    };
    if (actions) {
      this._onUpdate = actions.onUpdate;
      this._onDelete = actions.onDelete;
    }
  }
  onUpdate(action) {
    this._onUpdate = action === void 0 ? "no action" : action;
    return this;
  }
  onDelete(action) {
    this._onDelete = action === void 0 ? "no action" : action;
    return this;
  }
  /** @internal */
  build(table) {
    return new ForeignKey(table, this);
  }
};
var ForeignKey = class {
  constructor(table, builder) {
    this.table = table;
    this.reference = builder.reference;
    this.onUpdate = builder._onUpdate;
    this.onDelete = builder._onDelete;
  }
  static [entityKind] = "PgForeignKey";
  reference;
  onUpdate;
  onDelete;
  getName() {
    const { name, columns, foreignColumns } = this.reference();
    const columnNames = columns.map((column) => column.name);
    const foreignColumnNames = foreignColumns.map((column) => column.name);
    const chunks = [
      this.table[TableName],
      ...columnNames,
      foreignColumns[0].table[TableName],
      ...foreignColumnNames
    ];
    return name ?? `${chunks.join("_")}_fk`;
  }
};

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.3_pg@8.22.0/node_modules/drizzle-orm/tracing-utils.js
function iife(fn, ...args) {
  return fn(...args);
}

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.3_pg@8.22.0/node_modules/drizzle-orm/pg-core/unique-constraint.js
function uniqueKeyName(table, columns) {
  return `${table[TableName]}_${columns.join("_")}_unique`;
}
var UniqueConstraintBuilder = class {
  constructor(columns, name) {
    this.name = name;
    this.columns = columns;
  }
  static [entityKind] = "PgUniqueConstraintBuilder";
  /** @internal */
  columns;
  /** @internal */
  nullsNotDistinctConfig = false;
  nullsNotDistinct() {
    this.nullsNotDistinctConfig = true;
    return this;
  }
  /** @internal */
  build(table) {
    return new UniqueConstraint(table, this.columns, this.nullsNotDistinctConfig, this.name);
  }
};
var UniqueOnConstraintBuilder = class {
  static [entityKind] = "PgUniqueOnConstraintBuilder";
  /** @internal */
  name;
  constructor(name) {
    this.name = name;
  }
  on(...columns) {
    return new UniqueConstraintBuilder(columns, this.name);
  }
};
var UniqueConstraint = class {
  constructor(table, columns, nullsNotDistinct, name) {
    this.table = table;
    this.columns = columns;
    this.name = name ?? uniqueKeyName(this.table, this.columns.map((column) => column.name));
    this.nullsNotDistinct = nullsNotDistinct;
  }
  static [entityKind] = "PgUniqueConstraint";
  columns;
  name;
  nullsNotDistinct = false;
  getName() {
    return this.name;
  }
};

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.3_pg@8.22.0/node_modules/drizzle-orm/pg-core/utils/array.js
function parsePgArrayValue(arrayString, startFrom, inQuotes) {
  for (let i = startFrom; i < arrayString.length; i++) {
    const char = arrayString[i];
    if (char === "\\") {
      i++;
      continue;
    }
    if (char === '"') {
      return [arrayString.slice(startFrom, i).replace(/\\/g, ""), i + 1];
    }
    if (inQuotes) {
      continue;
    }
    if (char === "," || char === "}") {
      return [arrayString.slice(startFrom, i).replace(/\\/g, ""), i];
    }
  }
  return [arrayString.slice(startFrom).replace(/\\/g, ""), arrayString.length];
}
function parsePgNestedArray(arrayString, startFrom = 0) {
  const result = [];
  let i = startFrom;
  let lastCharIsComma = false;
  while (i < arrayString.length) {
    const char = arrayString[i];
    if (char === ",") {
      if (lastCharIsComma || i === startFrom) {
        result.push("");
      }
      lastCharIsComma = true;
      i++;
      continue;
    }
    lastCharIsComma = false;
    if (char === "\\") {
      i += 2;
      continue;
    }
    if (char === '"') {
      const [value2, startFrom2] = parsePgArrayValue(arrayString, i + 1, true);
      result.push(value2);
      i = startFrom2;
      continue;
    }
    if (char === "}") {
      return [result, i + 1];
    }
    if (char === "{") {
      const [value2, startFrom2] = parsePgNestedArray(arrayString, i + 1);
      result.push(value2);
      i = startFrom2;
      continue;
    }
    const [value, newStartFrom] = parsePgArrayValue(arrayString, i, false);
    result.push(value);
    i = newStartFrom;
  }
  return [result, i];
}
function parsePgArray(arrayString) {
  const [result] = parsePgNestedArray(arrayString, 1);
  return result;
}
function makePgArray(array) {
  return `{${array.map((item) => {
    if (Array.isArray(item)) {
      return makePgArray(item);
    }
    if (typeof item === "string") {
      return `"${item.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
    }
    return `${item}`;
  }).join(",")}}`;
}

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.3_pg@8.22.0/node_modules/drizzle-orm/pg-core/columns/common.js
var PgColumnBuilder = class extends ColumnBuilder {
  foreignKeyConfigs = [];
  static [entityKind] = "PgColumnBuilder";
  array(size) {
    return new PgArrayBuilder(this.config.name, this, size);
  }
  references(ref, actions = {}) {
    this.foreignKeyConfigs.push({ ref, actions });
    return this;
  }
  unique(name, config) {
    this.config.isUnique = true;
    this.config.uniqueName = name;
    this.config.uniqueType = config?.nulls;
    return this;
  }
  generatedAlwaysAs(as) {
    this.config.generated = {
      as,
      type: "always",
      mode: "stored"
    };
    return this;
  }
  /** @internal */
  buildForeignKeys(column, table) {
    return this.foreignKeyConfigs.map(({ ref, actions }) => {
      return iife(
        (ref2, actions2) => {
          const builder = new ForeignKeyBuilder(() => {
            const foreignColumn = ref2();
            return { columns: [column], foreignColumns: [foreignColumn] };
          });
          if (actions2.onUpdate) {
            builder.onUpdate(actions2.onUpdate);
          }
          if (actions2.onDelete) {
            builder.onDelete(actions2.onDelete);
          }
          return builder.build(table);
        },
        ref,
        actions
      );
    });
  }
  /** @internal */
  buildExtraConfigColumn(table) {
    return new ExtraConfigColumn(table, this.config);
  }
};
var PgColumn = class extends Column {
  constructor(table, config) {
    if (!config.uniqueName) {
      config.uniqueName = uniqueKeyName(table, [config.name]);
    }
    super(table, config);
    this.table = table;
  }
  static [entityKind] = "PgColumn";
};
var ExtraConfigColumn = class extends PgColumn {
  static [entityKind] = "ExtraConfigColumn";
  getSQLType() {
    return this.getSQLType();
  }
  indexConfig = {
    order: this.config.order ?? "asc",
    nulls: this.config.nulls ?? "last",
    opClass: this.config.opClass
  };
  defaultConfig = {
    order: "asc",
    nulls: "last",
    opClass: void 0
  };
  asc() {
    this.indexConfig.order = "asc";
    return this;
  }
  desc() {
    this.indexConfig.order = "desc";
    return this;
  }
  nullsFirst() {
    this.indexConfig.nulls = "first";
    return this;
  }
  nullsLast() {
    this.indexConfig.nulls = "last";
    return this;
  }
  /**
   * ### PostgreSQL documentation quote
   *
   * > An operator class with optional parameters can be specified for each column of an index.
   * The operator class identifies the operators to be used by the index for that column.
   * For example, a B-tree index on four-byte integers would use the int4_ops class;
   * this operator class includes comparison functions for four-byte integers.
   * In practice the default operator class for the column's data type is usually sufficient.
   * The main point of having operator classes is that for some data types, there could be more than one meaningful ordering.
   * For example, we might want to sort a complex-number data type either by absolute value or by real part.
   * We could do this by defining two operator classes for the data type and then selecting the proper class when creating an index.
   * More information about operator classes check:
   *
   * ### Useful links
   * https://www.postgresql.org/docs/current/sql-createindex.html
   *
   * https://www.postgresql.org/docs/current/indexes-opclass.html
   *
   * https://www.postgresql.org/docs/current/xindex.html
   *
   * ### Additional types
   * If you have the `pg_vector` extension installed in your database, you can use the
   * `vector_l2_ops`, `vector_ip_ops`, `vector_cosine_ops`, `vector_l1_ops`, `bit_hamming_ops`, `bit_jaccard_ops`, `halfvec_l2_ops`, `sparsevec_l2_ops` options, which are predefined types.
   *
   * **You can always specify any string you want in the operator class, in case Drizzle doesn't have it natively in its types**
   *
   * @param opClass
   * @returns
   */
  op(opClass) {
    this.indexConfig.opClass = opClass;
    return this;
  }
};
var IndexedColumn = class {
  static [entityKind] = "IndexedColumn";
  constructor(name, keyAsName, type, indexConfig) {
    this.name = name;
    this.keyAsName = keyAsName;
    this.type = type;
    this.indexConfig = indexConfig;
  }
  name;
  keyAsName;
  type;
  indexConfig;
};
var PgArrayBuilder = class extends PgColumnBuilder {
  static [entityKind] = "PgArrayBuilder";
  constructor(name, baseBuilder, size) {
    super(name, "array", "PgArray");
    this.config.baseBuilder = baseBuilder;
    this.config.size = size;
  }
  /** @internal */
  build(table) {
    const baseColumn = this.config.baseBuilder.build(table);
    return new PgArray(
      table,
      this.config,
      baseColumn
    );
  }
};
var PgArray = class _PgArray extends PgColumn {
  constructor(table, config, baseColumn, range) {
    super(table, config);
    this.baseColumn = baseColumn;
    this.range = range;
    this.size = config.size;
  }
  size;
  static [entityKind] = "PgArray";
  getSQLType() {
    return `${this.baseColumn.getSQLType()}[${typeof this.size === "number" ? this.size : ""}]`;
  }
  mapFromDriverValue(value) {
    if (typeof value === "string") {
      value = parsePgArray(value);
    }
    return value.map((v) => this.baseColumn.mapFromDriverValue(v));
  }
  mapToDriverValue(value, isNestedArray = false) {
    const a = value.map(
      (v) => v === null ? null : is(this.baseColumn, _PgArray) ? this.baseColumn.mapToDriverValue(v, true) : this.baseColumn.mapToDriverValue(v)
    );
    if (isNestedArray) return a;
    return makePgArray(a);
  }
};

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.3_pg@8.22.0/node_modules/drizzle-orm/pg-core/columns/enum.js
var PgEnumObjectColumnBuilder = class extends PgColumnBuilder {
  static [entityKind] = "PgEnumObjectColumnBuilder";
  constructor(name, enumInstance) {
    super(name, "string", "PgEnumObjectColumn");
    this.config.enum = enumInstance;
  }
  /** @internal */
  build(table) {
    return new PgEnumObjectColumn(
      table,
      this.config
    );
  }
};
var PgEnumObjectColumn = class extends PgColumn {
  static [entityKind] = "PgEnumObjectColumn";
  enum;
  enumValues = this.config.enum.enumValues;
  constructor(table, config) {
    super(table, config);
    this.enum = config.enum;
  }
  getSQLType() {
    return this.enum.enumName;
  }
};
var isPgEnumSym = /* @__PURE__ */ Symbol.for("drizzle:isPgEnum");
function isPgEnum(obj) {
  return !!obj && typeof obj === "function" && isPgEnumSym in obj && obj[isPgEnumSym] === true;
}
var PgEnumColumnBuilder = class extends PgColumnBuilder {
  static [entityKind] = "PgEnumColumnBuilder";
  constructor(name, enumInstance) {
    super(name, "string", "PgEnumColumn");
    this.config.enum = enumInstance;
  }
  /** @internal */
  build(table) {
    return new PgEnumColumn(
      table,
      this.config
    );
  }
};
var PgEnumColumn = class extends PgColumn {
  static [entityKind] = "PgEnumColumn";
  enum = this.config.enum;
  enumValues = this.config.enum.enumValues;
  constructor(table, config) {
    super(table, config);
    this.enum = config.enum;
  }
  getSQLType() {
    return this.enum.enumName;
  }
};

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.3_pg@8.22.0/node_modules/drizzle-orm/subquery.js
var Subquery = class {
  static [entityKind] = "Subquery";
  constructor(sql2, fields, alias, isWith = false, usedTables = []) {
    this._ = {
      brand: "Subquery",
      sql: sql2,
      selectedFields: fields,
      alias,
      isWith,
      usedTables
    };
  }
  // getSQL(): SQL<unknown> {
  // 	return new SQL([this]);
  // }
};
var WithSubquery = class extends Subquery {
  static [entityKind] = "WithSubquery";
};

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.3_pg@8.22.0/node_modules/drizzle-orm/version.js
var version = "0.45.2";

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.3_pg@8.22.0/node_modules/drizzle-orm/tracing.js
var otel;
var rawTracer;
var tracer = {
  startActiveSpan(name, fn) {
    if (!otel) {
      return fn();
    }
    if (!rawTracer) {
      rawTracer = otel.trace.getTracer("drizzle-orm", version);
    }
    return iife(
      (otel2, rawTracer2) => rawTracer2.startActiveSpan(
        name,
        (span) => {
          try {
            return fn(span);
          } catch (e) {
            span.setStatus({
              code: otel2.SpanStatusCode.ERROR,
              message: e instanceof Error ? e.message : "Unknown error"
              // eslint-disable-line no-instanceof/no-instanceof
            });
            throw e;
          } finally {
            span.end();
          }
        }
      ),
      otel,
      rawTracer
    );
  }
};

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.3_pg@8.22.0/node_modules/drizzle-orm/view-common.js
var ViewBaseConfig = /* @__PURE__ */ Symbol.for("drizzle:ViewBaseConfig");

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.3_pg@8.22.0/node_modules/drizzle-orm/table.js
var Schema = /* @__PURE__ */ Symbol.for("drizzle:Schema");
var Columns = /* @__PURE__ */ Symbol.for("drizzle:Columns");
var ExtraConfigColumns = /* @__PURE__ */ Symbol.for("drizzle:ExtraConfigColumns");
var OriginalName = /* @__PURE__ */ Symbol.for("drizzle:OriginalName");
var BaseName = /* @__PURE__ */ Symbol.for("drizzle:BaseName");
var IsAlias = /* @__PURE__ */ Symbol.for("drizzle:IsAlias");
var ExtraConfigBuilder = /* @__PURE__ */ Symbol.for("drizzle:ExtraConfigBuilder");
var IsDrizzleTable = /* @__PURE__ */ Symbol.for("drizzle:IsDrizzleTable");
var Table = class {
  static [entityKind] = "Table";
  /** @internal */
  static Symbol = {
    Name: TableName,
    Schema,
    OriginalName,
    Columns,
    ExtraConfigColumns,
    BaseName,
    IsAlias,
    ExtraConfigBuilder
  };
  /**
   * @internal
   * Can be changed if the table is aliased.
   */
  [TableName];
  /**
   * @internal
   * Used to store the original name of the table, before any aliasing.
   */
  [OriginalName];
  /** @internal */
  [Schema];
  /** @internal */
  [Columns];
  /** @internal */
  [ExtraConfigColumns];
  /**
   *  @internal
   * Used to store the table name before the transformation via the `tableCreator` functions.
   */
  [BaseName];
  /** @internal */
  [IsAlias] = false;
  /** @internal */
  [IsDrizzleTable] = true;
  /** @internal */
  [ExtraConfigBuilder] = void 0;
  constructor(name, schema, baseName) {
    this[TableName] = this[OriginalName] = name;
    this[Schema] = schema;
    this[BaseName] = baseName;
  }
};
function getTableName(table) {
  return table[TableName];
}
function getTableUniqueName(table) {
  return `${table[Schema] ?? "public"}.${table[TableName]}`;
}

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.3_pg@8.22.0/node_modules/drizzle-orm/sql/sql.js
var FakePrimitiveParam = class {
  static [entityKind] = "FakePrimitiveParam";
};
function isSQLWrapper(value) {
  return value !== null && value !== void 0 && typeof value.getSQL === "function";
}
function mergeQueries(queries) {
  const result = { sql: "", params: [] };
  for (const query of queries) {
    result.sql += query.sql;
    result.params.push(...query.params);
    if (query.typings?.length) {
      if (!result.typings) {
        result.typings = [];
      }
      result.typings.push(...query.typings);
    }
  }
  return result;
}
var StringChunk = class {
  static [entityKind] = "StringChunk";
  value;
  constructor(value) {
    this.value = Array.isArray(value) ? value : [value];
  }
  getSQL() {
    return new SQL([this]);
  }
};
var SQL = class _SQL {
  constructor(queryChunks) {
    this.queryChunks = queryChunks;
    for (const chunk of queryChunks) {
      if (is(chunk, Table)) {
        const schemaName = chunk[Table.Symbol.Schema];
        this.usedTables.push(
          schemaName === void 0 ? chunk[Table.Symbol.Name] : schemaName + "." + chunk[Table.Symbol.Name]
        );
      }
    }
  }
  static [entityKind] = "SQL";
  /** @internal */
  decoder = noopDecoder;
  shouldInlineParams = false;
  /** @internal */
  usedTables = [];
  append(query) {
    this.queryChunks.push(...query.queryChunks);
    return this;
  }
  toQuery(config) {
    return tracer.startActiveSpan("drizzle.buildSQL", (span) => {
      const query = this.buildQueryFromSourceParams(this.queryChunks, config);
      span?.setAttributes({
        "drizzle.query.text": query.sql,
        "drizzle.query.params": JSON.stringify(query.params)
      });
      return query;
    });
  }
  buildQueryFromSourceParams(chunks, _config) {
    const config = Object.assign({}, _config, {
      inlineParams: _config.inlineParams || this.shouldInlineParams,
      paramStartIndex: _config.paramStartIndex || { value: 0 }
    });
    const {
      casing,
      escapeName,
      escapeParam,
      prepareTyping,
      inlineParams,
      paramStartIndex
    } = config;
    return mergeQueries(chunks.map((chunk) => {
      if (is(chunk, StringChunk)) {
        return { sql: chunk.value.join(""), params: [] };
      }
      if (is(chunk, Name)) {
        return { sql: escapeName(chunk.value), params: [] };
      }
      if (chunk === void 0) {
        return { sql: "", params: [] };
      }
      if (Array.isArray(chunk)) {
        const result = [new StringChunk("(")];
        for (const [i, p] of chunk.entries()) {
          result.push(p);
          if (i < chunk.length - 1) {
            result.push(new StringChunk(", "));
          }
        }
        result.push(new StringChunk(")"));
        return this.buildQueryFromSourceParams(result, config);
      }
      if (is(chunk, _SQL)) {
        return this.buildQueryFromSourceParams(chunk.queryChunks, {
          ...config,
          inlineParams: inlineParams || chunk.shouldInlineParams
        });
      }
      if (is(chunk, Table)) {
        const schemaName = chunk[Table.Symbol.Schema];
        const tableName = chunk[Table.Symbol.Name];
        return {
          sql: schemaName === void 0 || chunk[IsAlias] ? escapeName(tableName) : escapeName(schemaName) + "." + escapeName(tableName),
          params: []
        };
      }
      if (is(chunk, Column)) {
        const columnName = casing.getColumnCasing(chunk);
        if (_config.invokeSource === "indexes") {
          return { sql: escapeName(columnName), params: [] };
        }
        const schemaName = chunk.table[Table.Symbol.Schema];
        return {
          sql: chunk.table[IsAlias] || schemaName === void 0 ? escapeName(chunk.table[Table.Symbol.Name]) + "." + escapeName(columnName) : escapeName(schemaName) + "." + escapeName(chunk.table[Table.Symbol.Name]) + "." + escapeName(columnName),
          params: []
        };
      }
      if (is(chunk, View)) {
        const schemaName = chunk[ViewBaseConfig].schema;
        const viewName = chunk[ViewBaseConfig].name;
        return {
          sql: schemaName === void 0 || chunk[ViewBaseConfig].isAlias ? escapeName(viewName) : escapeName(schemaName) + "." + escapeName(viewName),
          params: []
        };
      }
      if (is(chunk, Param)) {
        if (is(chunk.value, Placeholder)) {
          return { sql: escapeParam(paramStartIndex.value++, chunk), params: [chunk], typings: ["none"] };
        }
        const mappedValue = chunk.value === null ? null : chunk.encoder.mapToDriverValue(chunk.value);
        if (is(mappedValue, _SQL)) {
          return this.buildQueryFromSourceParams([mappedValue], config);
        }
        if (inlineParams) {
          return { sql: this.mapInlineParam(mappedValue, config), params: [] };
        }
        let typings = ["none"];
        if (prepareTyping) {
          typings = [prepareTyping(chunk.encoder)];
        }
        return { sql: escapeParam(paramStartIndex.value++, mappedValue), params: [mappedValue], typings };
      }
      if (is(chunk, Placeholder)) {
        return { sql: escapeParam(paramStartIndex.value++, chunk), params: [chunk], typings: ["none"] };
      }
      if (is(chunk, _SQL.Aliased) && chunk.fieldAlias !== void 0) {
        return { sql: escapeName(chunk.fieldAlias), params: [] };
      }
      if (is(chunk, Subquery)) {
        if (chunk._.isWith) {
          return { sql: escapeName(chunk._.alias), params: [] };
        }
        return this.buildQueryFromSourceParams([
          new StringChunk("("),
          chunk._.sql,
          new StringChunk(") "),
          new Name(chunk._.alias)
        ], config);
      }
      if (isPgEnum(chunk)) {
        if (chunk.schema) {
          return { sql: escapeName(chunk.schema) + "." + escapeName(chunk.enumName), params: [] };
        }
        return { sql: escapeName(chunk.enumName), params: [] };
      }
      if (isSQLWrapper(chunk)) {
        if (chunk.shouldOmitSQLParens?.()) {
          return this.buildQueryFromSourceParams([chunk.getSQL()], config);
        }
        return this.buildQueryFromSourceParams([
          new StringChunk("("),
          chunk.getSQL(),
          new StringChunk(")")
        ], config);
      }
      if (inlineParams) {
        return { sql: this.mapInlineParam(chunk, config), params: [] };
      }
      return { sql: escapeParam(paramStartIndex.value++, chunk), params: [chunk], typings: ["none"] };
    }));
  }
  mapInlineParam(chunk, { escapeString }) {
    if (chunk === null) {
      return "null";
    }
    if (typeof chunk === "number" || typeof chunk === "boolean") {
      return chunk.toString();
    }
    if (typeof chunk === "string") {
      return escapeString(chunk);
    }
    if (typeof chunk === "object") {
      const mappedValueAsString = chunk.toString();
      if (mappedValueAsString === "[object Object]") {
        return escapeString(JSON.stringify(chunk));
      }
      return escapeString(mappedValueAsString);
    }
    throw new Error("Unexpected param value: " + chunk);
  }
  getSQL() {
    return this;
  }
  as(alias) {
    if (alias === void 0) {
      return this;
    }
    return new _SQL.Aliased(this, alias);
  }
  mapWith(decoder2) {
    this.decoder = typeof decoder2 === "function" ? { mapFromDriverValue: decoder2 } : decoder2;
    return this;
  }
  inlineParams() {
    this.shouldInlineParams = true;
    return this;
  }
  /**
   * This method is used to conditionally include a part of the query.
   *
   * @param condition - Condition to check
   * @returns itself if the condition is `true`, otherwise `undefined`
   */
  if(condition) {
    return condition ? this : void 0;
  }
};
var Name = class {
  constructor(value) {
    this.value = value;
  }
  static [entityKind] = "Name";
  brand;
  getSQL() {
    return new SQL([this]);
  }
};
function isDriverValueEncoder(value) {
  return typeof value === "object" && value !== null && "mapToDriverValue" in value && typeof value.mapToDriverValue === "function";
}
var noopDecoder = {
  mapFromDriverValue: (value) => value
};
var noopEncoder = {
  mapToDriverValue: (value) => value
};
var noopMapper = {
  ...noopDecoder,
  ...noopEncoder
};
var Param = class {
  /**
   * @param value - Parameter value
   * @param encoder - Encoder to convert the value to a driver parameter
   */
  constructor(value, encoder2 = noopEncoder) {
    this.value = value;
    this.encoder = encoder2;
  }
  static [entityKind] = "Param";
  brand;
  getSQL() {
    return new SQL([this]);
  }
};
function sql(strings, ...params) {
  const queryChunks = [];
  if (params.length > 0 || strings.length > 0 && strings[0] !== "") {
    queryChunks.push(new StringChunk(strings[0]));
  }
  for (const [paramIndex, param2] of params.entries()) {
    queryChunks.push(param2, new StringChunk(strings[paramIndex + 1]));
  }
  return new SQL(queryChunks);
}
((sql2) => {
  function empty() {
    return new SQL([]);
  }
  sql2.empty = empty;
  function fromList(list) {
    return new SQL(list);
  }
  sql2.fromList = fromList;
  function raw2(str) {
    return new SQL([new StringChunk(str)]);
  }
  sql2.raw = raw2;
  function join(chunks, separator) {
    const result = [];
    for (const [i, chunk] of chunks.entries()) {
      if (i > 0 && separator !== void 0) {
        result.push(separator);
      }
      result.push(chunk);
    }
    return new SQL(result);
  }
  sql2.join = join;
  function identifier(value) {
    return new Name(value);
  }
  sql2.identifier = identifier;
  function placeholder2(name2) {
    return new Placeholder(name2);
  }
  sql2.placeholder = placeholder2;
  function param2(value, encoder2) {
    return new Param(value, encoder2);
  }
  sql2.param = param2;
})(sql || (sql = {}));
((SQL2) => {
  class Aliased {
    constructor(sql2, fieldAlias) {
      this.sql = sql2;
      this.fieldAlias = fieldAlias;
    }
    static [entityKind] = "SQL.Aliased";
    /** @internal */
    isSelectionField = false;
    getSQL() {
      return this.sql;
    }
    /** @internal */
    clone() {
      return new Aliased(this.sql, this.fieldAlias);
    }
  }
  SQL2.Aliased = Aliased;
})(SQL || (SQL = {}));
var Placeholder = class {
  constructor(name2) {
    this.name = name2;
  }
  static [entityKind] = "Placeholder";
  getSQL() {
    return new SQL([this]);
  }
};
function fillPlaceholders(params, values) {
  return params.map((p) => {
    if (is(p, Placeholder)) {
      if (!(p.name in values)) {
        throw new Error(`No value for placeholder "${p.name}" was provided`);
      }
      return values[p.name];
    }
    if (is(p, Param) && is(p.value, Placeholder)) {
      if (!(p.value.name in values)) {
        throw new Error(`No value for placeholder "${p.value.name}" was provided`);
      }
      return p.encoder.mapToDriverValue(values[p.value.name]);
    }
    return p;
  });
}
var IsDrizzleView = /* @__PURE__ */ Symbol.for("drizzle:IsDrizzleView");
var View = class {
  static [entityKind] = "View";
  /** @internal */
  [ViewBaseConfig];
  /** @internal */
  [IsDrizzleView] = true;
  constructor({ name: name2, schema, selectedFields, query }) {
    this[ViewBaseConfig] = {
      name: name2,
      originalName: name2,
      schema,
      selectedFields,
      query,
      isExisting: !query,
      isAlias: false
    };
  }
  getSQL() {
    return new SQL([this]);
  }
};
Column.prototype.getSQL = function() {
  return new SQL([this]);
};
Table.prototype.getSQL = function() {
  return new SQL([this]);
};
Subquery.prototype.getSQL = function() {
  return new SQL([this]);
};

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.3_pg@8.22.0/node_modules/drizzle-orm/alias.js
var ColumnAliasProxyHandler = class {
  constructor(table) {
    this.table = table;
  }
  static [entityKind] = "ColumnAliasProxyHandler";
  get(columnObj, prop) {
    if (prop === "table") {
      return this.table;
    }
    return columnObj[prop];
  }
};
var TableAliasProxyHandler = class {
  constructor(alias, replaceOriginalName) {
    this.alias = alias;
    this.replaceOriginalName = replaceOriginalName;
  }
  static [entityKind] = "TableAliasProxyHandler";
  get(target, prop) {
    if (prop === Table.Symbol.IsAlias) {
      return true;
    }
    if (prop === Table.Symbol.Name) {
      return this.alias;
    }
    if (this.replaceOriginalName && prop === Table.Symbol.OriginalName) {
      return this.alias;
    }
    if (prop === ViewBaseConfig) {
      return {
        ...target[ViewBaseConfig],
        name: this.alias,
        isAlias: true
      };
    }
    if (prop === Table.Symbol.Columns) {
      const columns = target[Table.Symbol.Columns];
      if (!columns) {
        return columns;
      }
      const proxiedColumns = {};
      Object.keys(columns).map((key) => {
        proxiedColumns[key] = new Proxy(
          columns[key],
          new ColumnAliasProxyHandler(new Proxy(target, this))
        );
      });
      return proxiedColumns;
    }
    const value = target[prop];
    if (is(value, Column)) {
      return new Proxy(value, new ColumnAliasProxyHandler(new Proxy(target, this)));
    }
    return value;
  }
};
var RelationTableAliasProxyHandler = class {
  constructor(alias) {
    this.alias = alias;
  }
  static [entityKind] = "RelationTableAliasProxyHandler";
  get(target, prop) {
    if (prop === "sourceTable") {
      return aliasedTable(target.sourceTable, this.alias);
    }
    return target[prop];
  }
};
function aliasedTable(table, tableAlias) {
  return new Proxy(table, new TableAliasProxyHandler(tableAlias, false));
}
function aliasedTableColumn(column, tableAlias) {
  return new Proxy(
    column,
    new ColumnAliasProxyHandler(new Proxy(column.table, new TableAliasProxyHandler(tableAlias, false)))
  );
}
function mapColumnsInAliasedSQLToAlias(query, alias) {
  return new SQL.Aliased(mapColumnsInSQLToAlias(query.sql, alias), query.fieldAlias);
}
function mapColumnsInSQLToAlias(query, alias) {
  return sql.join(query.queryChunks.map((c) => {
    if (is(c, Column)) {
      return aliasedTableColumn(c, alias);
    }
    if (is(c, SQL)) {
      return mapColumnsInSQLToAlias(c, alias);
    }
    if (is(c, SQL.Aliased)) {
      return mapColumnsInAliasedSQLToAlias(c, alias);
    }
    return c;
  }));
}

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.3_pg@8.22.0/node_modules/drizzle-orm/errors.js
var DrizzleError = class extends Error {
  static [entityKind] = "DrizzleError";
  constructor({ message: message2, cause }) {
    super(message2);
    this.name = "DrizzleError";
    this.cause = cause;
  }
};
var DrizzleQueryError = class _DrizzleQueryError extends Error {
  constructor(query, params, cause) {
    super(`Failed query: ${query}
params: ${params}`);
    this.query = query;
    this.params = params;
    this.cause = cause;
    Error.captureStackTrace(this, _DrizzleQueryError);
    if (cause) this.cause = cause;
  }
};
var TransactionRollbackError = class extends DrizzleError {
  static [entityKind] = "TransactionRollbackError";
  constructor() {
    super({ message: "Rollback" });
  }
};

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.3_pg@8.22.0/node_modules/drizzle-orm/logger.js
var ConsoleLogWriter = class {
  static [entityKind] = "ConsoleLogWriter";
  write(message2) {
    console.log(message2);
  }
};
var DefaultLogger = class {
  static [entityKind] = "DefaultLogger";
  writer;
  constructor(config) {
    this.writer = config?.writer ?? new ConsoleLogWriter();
  }
  logQuery(query, params) {
    const stringifiedParams = params.map((p) => {
      try {
        return JSON.stringify(p);
      } catch {
        return String(p);
      }
    });
    const paramsStr = stringifiedParams.length ? ` -- params: [${stringifiedParams.join(", ")}]` : "";
    this.writer.write(`Query: ${query}${paramsStr}`);
  }
};
var NoopLogger = class {
  static [entityKind] = "NoopLogger";
  logQuery() {
  }
};

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.3_pg@8.22.0/node_modules/drizzle-orm/query-promise.js
var QueryPromise = class {
  static [entityKind] = "QueryPromise";
  [Symbol.toStringTag] = "QueryPromise";
  catch(onRejected) {
    return this.then(void 0, onRejected);
  }
  finally(onFinally) {
    return this.then(
      (value) => {
        onFinally?.();
        return value;
      },
      (reason) => {
        onFinally?.();
        throw reason;
      }
    );
  }
  then(onFulfilled, onRejected) {
    return this.execute().then(onFulfilled, onRejected);
  }
};

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.3_pg@8.22.0/node_modules/drizzle-orm/utils.js
function mapResultRow(columns, row, joinsNotNullableMap) {
  const nullifyMap = {};
  const result = columns.reduce(
    (result2, { path, field }, columnIndex) => {
      let decoder2;
      if (is(field, Column)) {
        decoder2 = field;
      } else if (is(field, SQL)) {
        decoder2 = field.decoder;
      } else if (is(field, Subquery)) {
        decoder2 = field._.sql.decoder;
      } else {
        decoder2 = field.sql.decoder;
      }
      let node = result2;
      for (const [pathChunkIndex, pathChunk] of path.entries()) {
        if (pathChunkIndex < path.length - 1) {
          if (!(pathChunk in node)) {
            node[pathChunk] = {};
          }
          node = node[pathChunk];
        } else {
          const rawValue = row[columnIndex];
          const value = node[pathChunk] = rawValue === null ? null : decoder2.mapFromDriverValue(rawValue);
          if (joinsNotNullableMap && is(field, Column) && path.length === 2) {
            const objectName = path[0];
            if (!(objectName in nullifyMap)) {
              nullifyMap[objectName] = value === null ? getTableName(field.table) : false;
            } else if (typeof nullifyMap[objectName] === "string" && nullifyMap[objectName] !== getTableName(field.table)) {
              nullifyMap[objectName] = false;
            }
          }
        }
      }
      return result2;
    },
    {}
  );
  if (joinsNotNullableMap && Object.keys(nullifyMap).length > 0) {
    for (const [objectName, tableName] of Object.entries(nullifyMap)) {
      if (typeof tableName === "string" && !joinsNotNullableMap[tableName]) {
        result[objectName] = null;
      }
    }
  }
  return result;
}
function orderSelectedFields(fields, pathPrefix) {
  return Object.entries(fields).reduce((result, [name, field]) => {
    if (typeof name !== "string") {
      return result;
    }
    const newPath = pathPrefix ? [...pathPrefix, name] : [name];
    if (is(field, Column) || is(field, SQL) || is(field, SQL.Aliased) || is(field, Subquery)) {
      result.push({ path: newPath, field });
    } else if (is(field, Table)) {
      result.push(...orderSelectedFields(field[Table.Symbol.Columns], newPath));
    } else {
      result.push(...orderSelectedFields(field, newPath));
    }
    return result;
  }, []);
}
function haveSameKeys(left, right) {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) {
    return false;
  }
  for (const [index, key] of leftKeys.entries()) {
    if (key !== rightKeys[index]) {
      return false;
    }
  }
  return true;
}
function mapUpdateSet(table, values) {
  const entries = Object.entries(values).filter(([, value]) => value !== void 0).map(([key, value]) => {
    if (is(value, SQL) || is(value, Column)) {
      return [key, value];
    } else {
      return [key, new Param(value, table[Table.Symbol.Columns][key])];
    }
  });
  if (entries.length === 0) {
    throw new Error("No values to set");
  }
  return Object.fromEntries(entries);
}
function applyMixins(baseClass, extendedClasses) {
  for (const extendedClass of extendedClasses) {
    for (const name of Object.getOwnPropertyNames(extendedClass.prototype)) {
      if (name === "constructor") continue;
      Object.defineProperty(
        baseClass.prototype,
        name,
        Object.getOwnPropertyDescriptor(extendedClass.prototype, name) || /* @__PURE__ */ Object.create(null)
      );
    }
  }
}
function getTableColumns(table) {
  return table[Table.Symbol.Columns];
}
function getTableLikeName(table) {
  return is(table, Subquery) ? table._.alias : is(table, View) ? table[ViewBaseConfig].name : is(table, SQL) ? void 0 : table[Table.Symbol.IsAlias] ? table[Table.Symbol.Name] : table[Table.Symbol.BaseName];
}
function isConfig(data) {
  if (typeof data !== "object" || data === null) return false;
  if (data.constructor.name !== "Object") return false;
  if ("logger" in data) {
    const type = typeof data["logger"];
    if (type !== "boolean" && (type !== "object" || typeof data["logger"]["logQuery"] !== "function") && type !== "undefined") return false;
    return true;
  }
  if ("schema" in data) {
    const type = typeof data["schema"];
    if (type !== "object" && type !== "undefined") return false;
    return true;
  }
  if ("casing" in data) {
    const type = typeof data["casing"];
    if (type !== "string" && type !== "undefined") return false;
    return true;
  }
  if ("mode" in data) {
    if (data["mode"] !== "default" || data["mode"] !== "planetscale" || data["mode"] !== void 0) return false;
    return true;
  }
  if ("connection" in data) {
    const type = typeof data["connection"];
    if (type !== "string" && type !== "object" && type !== "undefined") return false;
    return true;
  }
  if ("client" in data) {
    const type = typeof data["client"];
    if (type !== "object" && type !== "function" && type !== "undefined") return false;
    return true;
  }
  if (Object.keys(data).length === 0) return true;
  return false;
}
var textDecoder = typeof TextDecoder === "undefined" ? null : new TextDecoder();

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.3_pg@8.22.0/node_modules/drizzle-orm/pg-core/columns/date.common.js
var PgDateColumnBaseBuilder = class extends PgColumnBuilder {
  static [entityKind] = "PgDateColumnBaseBuilder";
  defaultNow() {
    return this.default(sql`now()`);
  }
};

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.3_pg@8.22.0/node_modules/drizzle-orm/pg-core/columns/date.js
var PgDateBuilder = class extends PgDateColumnBaseBuilder {
  static [entityKind] = "PgDateBuilder";
  constructor(name) {
    super(name, "date", "PgDate");
  }
  /** @internal */
  build(table) {
    return new PgDate(table, this.config);
  }
};
var PgDate = class extends PgColumn {
  static [entityKind] = "PgDate";
  getSQLType() {
    return "date";
  }
  mapFromDriverValue(value) {
    if (typeof value === "string") return new Date(value);
    return value;
  }
  mapToDriverValue(value) {
    return value.toISOString();
  }
};
var PgDateStringBuilder = class extends PgDateColumnBaseBuilder {
  static [entityKind] = "PgDateStringBuilder";
  constructor(name) {
    super(name, "string", "PgDateString");
  }
  /** @internal */
  build(table) {
    return new PgDateString(
      table,
      this.config
    );
  }
};
var PgDateString = class extends PgColumn {
  static [entityKind] = "PgDateString";
  getSQLType() {
    return "date";
  }
  mapFromDriverValue(value) {
    if (typeof value === "string") return value;
    return value.toISOString().slice(0, -14);
  }
};

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.3_pg@8.22.0/node_modules/drizzle-orm/pg-core/columns/json.js
var PgJsonBuilder = class extends PgColumnBuilder {
  static [entityKind] = "PgJsonBuilder";
  constructor(name) {
    super(name, "json", "PgJson");
  }
  /** @internal */
  build(table) {
    return new PgJson(table, this.config);
  }
};
var PgJson = class extends PgColumn {
  static [entityKind] = "PgJson";
  constructor(table, config) {
    super(table, config);
  }
  getSQLType() {
    return "json";
  }
  mapToDriverValue(value) {
    return JSON.stringify(value);
  }
  mapFromDriverValue(value) {
    if (typeof value === "string") {
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }
    return value;
  }
};

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.3_pg@8.22.0/node_modules/drizzle-orm/pg-core/columns/jsonb.js
var PgJsonbBuilder = class extends PgColumnBuilder {
  static [entityKind] = "PgJsonbBuilder";
  constructor(name) {
    super(name, "json", "PgJsonb");
  }
  /** @internal */
  build(table) {
    return new PgJsonb(table, this.config);
  }
};
var PgJsonb = class extends PgColumn {
  static [entityKind] = "PgJsonb";
  constructor(table, config) {
    super(table, config);
  }
  getSQLType() {
    return "jsonb";
  }
  mapToDriverValue(value) {
    return JSON.stringify(value);
  }
  mapFromDriverValue(value) {
    if (typeof value === "string") {
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }
    return value;
  }
};

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.3_pg@8.22.0/node_modules/drizzle-orm/pg-core/columns/numeric.js
var PgNumericBuilder = class extends PgColumnBuilder {
  static [entityKind] = "PgNumericBuilder";
  constructor(name, precision, scale) {
    super(name, "string", "PgNumeric");
    this.config.precision = precision;
    this.config.scale = scale;
  }
  /** @internal */
  build(table) {
    return new PgNumeric(table, this.config);
  }
};
var PgNumeric = class extends PgColumn {
  static [entityKind] = "PgNumeric";
  precision;
  scale;
  constructor(table, config) {
    super(table, config);
    this.precision = config.precision;
    this.scale = config.scale;
  }
  mapFromDriverValue(value) {
    if (typeof value === "string") return value;
    return String(value);
  }
  getSQLType() {
    if (this.precision !== void 0 && this.scale !== void 0) {
      return `numeric(${this.precision}, ${this.scale})`;
    } else if (this.precision === void 0) {
      return "numeric";
    } else {
      return `numeric(${this.precision})`;
    }
  }
};
var PgNumericNumberBuilder = class extends PgColumnBuilder {
  static [entityKind] = "PgNumericNumberBuilder";
  constructor(name, precision, scale) {
    super(name, "number", "PgNumericNumber");
    this.config.precision = precision;
    this.config.scale = scale;
  }
  /** @internal */
  build(table) {
    return new PgNumericNumber(
      table,
      this.config
    );
  }
};
var PgNumericNumber = class extends PgColumn {
  static [entityKind] = "PgNumericNumber";
  precision;
  scale;
  constructor(table, config) {
    super(table, config);
    this.precision = config.precision;
    this.scale = config.scale;
  }
  mapFromDriverValue(value) {
    if (typeof value === "number") return value;
    return Number(value);
  }
  mapToDriverValue = String;
  getSQLType() {
    if (this.precision !== void 0 && this.scale !== void 0) {
      return `numeric(${this.precision}, ${this.scale})`;
    } else if (this.precision === void 0) {
      return "numeric";
    } else {
      return `numeric(${this.precision})`;
    }
  }
};
var PgNumericBigIntBuilder = class extends PgColumnBuilder {
  static [entityKind] = "PgNumericBigIntBuilder";
  constructor(name, precision, scale) {
    super(name, "bigint", "PgNumericBigInt");
    this.config.precision = precision;
    this.config.scale = scale;
  }
  /** @internal */
  build(table) {
    return new PgNumericBigInt(
      table,
      this.config
    );
  }
};
var PgNumericBigInt = class extends PgColumn {
  static [entityKind] = "PgNumericBigInt";
  precision;
  scale;
  constructor(table, config) {
    super(table, config);
    this.precision = config.precision;
    this.scale = config.scale;
  }
  mapFromDriverValue = BigInt;
  mapToDriverValue = String;
  getSQLType() {
    if (this.precision !== void 0 && this.scale !== void 0) {
      return `numeric(${this.precision}, ${this.scale})`;
    } else if (this.precision === void 0) {
      return "numeric";
    } else {
      return `numeric(${this.precision})`;
    }
  }
};

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.3_pg@8.22.0/node_modules/drizzle-orm/pg-core/columns/time.js
var PgTimeBuilder = class extends PgDateColumnBaseBuilder {
  constructor(name, withTimezone, precision) {
    super(name, "string", "PgTime");
    this.withTimezone = withTimezone;
    this.precision = precision;
    this.config.withTimezone = withTimezone;
    this.config.precision = precision;
  }
  static [entityKind] = "PgTimeBuilder";
  /** @internal */
  build(table) {
    return new PgTime(table, this.config);
  }
};
var PgTime = class extends PgColumn {
  static [entityKind] = "PgTime";
  withTimezone;
  precision;
  constructor(table, config) {
    super(table, config);
    this.withTimezone = config.withTimezone;
    this.precision = config.precision;
  }
  getSQLType() {
    const precision = this.precision === void 0 ? "" : `(${this.precision})`;
    return `time${precision}${this.withTimezone ? " with time zone" : ""}`;
  }
};

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.3_pg@8.22.0/node_modules/drizzle-orm/pg-core/columns/timestamp.js
var PgTimestampBuilder = class extends PgDateColumnBaseBuilder {
  static [entityKind] = "PgTimestampBuilder";
  constructor(name, withTimezone, precision) {
    super(name, "date", "PgTimestamp");
    this.config.withTimezone = withTimezone;
    this.config.precision = precision;
  }
  /** @internal */
  build(table) {
    return new PgTimestamp(table, this.config);
  }
};
var PgTimestamp = class extends PgColumn {
  static [entityKind] = "PgTimestamp";
  withTimezone;
  precision;
  constructor(table, config) {
    super(table, config);
    this.withTimezone = config.withTimezone;
    this.precision = config.precision;
  }
  getSQLType() {
    const precision = this.precision === void 0 ? "" : ` (${this.precision})`;
    return `timestamp${precision}${this.withTimezone ? " with time zone" : ""}`;
  }
  mapFromDriverValue(value) {
    if (typeof value === "string") return new Date(this.withTimezone ? value : value + "+0000");
    return value;
  }
  mapToDriverValue = (value) => {
    return value.toISOString();
  };
};
var PgTimestampStringBuilder = class extends PgDateColumnBaseBuilder {
  static [entityKind] = "PgTimestampStringBuilder";
  constructor(name, withTimezone, precision) {
    super(name, "string", "PgTimestampString");
    this.config.withTimezone = withTimezone;
    this.config.precision = precision;
  }
  /** @internal */
  build(table) {
    return new PgTimestampString(
      table,
      this.config
    );
  }
};
var PgTimestampString = class extends PgColumn {
  static [entityKind] = "PgTimestampString";
  withTimezone;
  precision;
  constructor(table, config) {
    super(table, config);
    this.withTimezone = config.withTimezone;
    this.precision = config.precision;
  }
  getSQLType() {
    const precision = this.precision === void 0 ? "" : `(${this.precision})`;
    return `timestamp${precision}${this.withTimezone ? " with time zone" : ""}`;
  }
  mapFromDriverValue(value) {
    if (typeof value === "string") return value;
    const shortened = value.toISOString().slice(0, -1).replace("T", " ");
    if (this.withTimezone) {
      const offset = value.getTimezoneOffset();
      const sign = offset <= 0 ? "+" : "-";
      return `${shortened}${sign}${Math.floor(Math.abs(offset) / 60).toString().padStart(2, "0")}`;
    }
    return shortened;
  }
};

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.3_pg@8.22.0/node_modules/drizzle-orm/pg-core/columns/uuid.js
var PgUUIDBuilder = class extends PgColumnBuilder {
  static [entityKind] = "PgUUIDBuilder";
  constructor(name) {
    super(name, "string", "PgUUID");
  }
  /**
   * Adds `default gen_random_uuid()` to the column definition.
   */
  defaultRandom() {
    return this.default(sql`gen_random_uuid()`);
  }
  /** @internal */
  build(table) {
    return new PgUUID(table, this.config);
  }
};
var PgUUID = class extends PgColumn {
  static [entityKind] = "PgUUID";
  getSQLType() {
    return "uuid";
  }
};

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.3_pg@8.22.0/node_modules/drizzle-orm/pg-core/table.js
var InlineForeignKeys = /* @__PURE__ */ Symbol.for("drizzle:PgInlineForeignKeys");
var EnableRLS = /* @__PURE__ */ Symbol.for("drizzle:EnableRLS");
var PgTable = class extends Table {
  static [entityKind] = "PgTable";
  /** @internal */
  static Symbol = Object.assign({}, Table.Symbol, {
    InlineForeignKeys,
    EnableRLS
  });
  /**@internal */
  [InlineForeignKeys] = [];
  /** @internal */
  [EnableRLS] = false;
  /** @internal */
  [Table.Symbol.ExtraConfigBuilder] = void 0;
  /** @internal */
  [Table.Symbol.ExtraConfigColumns] = {};
};

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.3_pg@8.22.0/node_modules/drizzle-orm/pg-core/primary-keys.js
var PrimaryKeyBuilder = class {
  static [entityKind] = "PgPrimaryKeyBuilder";
  /** @internal */
  columns;
  /** @internal */
  name;
  constructor(columns, name) {
    this.columns = columns;
    this.name = name;
  }
  /** @internal */
  build(table) {
    return new PrimaryKey(table, this.columns, this.name);
  }
};
var PrimaryKey = class {
  constructor(table, columns, name) {
    this.table = table;
    this.columns = columns;
    this.name = name;
  }
  static [entityKind] = "PgPrimaryKey";
  columns;
  name;
  getName() {
    return this.name ?? `${this.table[PgTable.Symbol.Name]}_${this.columns.map((column) => column.name).join("_")}_pk`;
  }
};

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.3_pg@8.22.0/node_modules/drizzle-orm/sql/expressions/conditions.js
function bindIfParam(value, column) {
  if (isDriverValueEncoder(column) && !isSQLWrapper(value) && !is(value, Param) && !is(value, Placeholder) && !is(value, Column) && !is(value, Table) && !is(value, View)) {
    return new Param(value, column);
  }
  return value;
}
var eq = (left, right) => {
  return sql`${left} = ${bindIfParam(right, left)}`;
};
var ne = (left, right) => {
  return sql`${left} <> ${bindIfParam(right, left)}`;
};
function and(...unfilteredConditions) {
  const conditions = unfilteredConditions.filter(
    (c) => c !== void 0
  );
  if (conditions.length === 0) {
    return void 0;
  }
  if (conditions.length === 1) {
    return new SQL(conditions);
  }
  return new SQL([
    new StringChunk("("),
    sql.join(conditions, new StringChunk(" and ")),
    new StringChunk(")")
  ]);
}
function or(...unfilteredConditions) {
  const conditions = unfilteredConditions.filter(
    (c) => c !== void 0
  );
  if (conditions.length === 0) {
    return void 0;
  }
  if (conditions.length === 1) {
    return new SQL(conditions);
  }
  return new SQL([
    new StringChunk("("),
    sql.join(conditions, new StringChunk(" or ")),
    new StringChunk(")")
  ]);
}
function not(condition) {
  return sql`not ${condition}`;
}
var gt = (left, right) => {
  return sql`${left} > ${bindIfParam(right, left)}`;
};
var gte = (left, right) => {
  return sql`${left} >= ${bindIfParam(right, left)}`;
};
var lt = (left, right) => {
  return sql`${left} < ${bindIfParam(right, left)}`;
};
var lte = (left, right) => {
  return sql`${left} <= ${bindIfParam(right, left)}`;
};
function inArray(column, values) {
  if (Array.isArray(values)) {
    if (values.length === 0) {
      return sql`false`;
    }
    return sql`${column} in ${values.map((v) => bindIfParam(v, column))}`;
  }
  return sql`${column} in ${bindIfParam(values, column)}`;
}
function notInArray(column, values) {
  if (Array.isArray(values)) {
    if (values.length === 0) {
      return sql`true`;
    }
    return sql`${column} not in ${values.map((v) => bindIfParam(v, column))}`;
  }
  return sql`${column} not in ${bindIfParam(values, column)}`;
}
function isNull(value) {
  return sql`${value} is null`;
}
function isNotNull(value) {
  return sql`${value} is not null`;
}
function exists(subquery) {
  return sql`exists ${subquery}`;
}
function notExists(subquery) {
  return sql`not exists ${subquery}`;
}
function between(column, min, max) {
  return sql`${column} between ${bindIfParam(min, column)} and ${bindIfParam(
    max,
    column
  )}`;
}
function notBetween(column, min, max) {
  return sql`${column} not between ${bindIfParam(
    min,
    column
  )} and ${bindIfParam(max, column)}`;
}
function like(column, value) {
  return sql`${column} like ${value}`;
}
function notLike(column, value) {
  return sql`${column} not like ${value}`;
}
function ilike(column, value) {
  return sql`${column} ilike ${value}`;
}
function notIlike(column, value) {
  return sql`${column} not ilike ${value}`;
}

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.3_pg@8.22.0/node_modules/drizzle-orm/sql/expressions/select.js
function asc(column) {
  return sql`${column} asc`;
}
function desc(column) {
  return sql`${column} desc`;
}

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.3_pg@8.22.0/node_modules/drizzle-orm/relations.js
var Relation = class {
  constructor(sourceTable, referencedTable, relationName) {
    this.sourceTable = sourceTable;
    this.referencedTable = referencedTable;
    this.relationName = relationName;
    this.referencedTableName = referencedTable[Table.Symbol.Name];
  }
  static [entityKind] = "Relation";
  referencedTableName;
  fieldName;
};
var Relations = class {
  constructor(table, config) {
    this.table = table;
    this.config = config;
  }
  static [entityKind] = "Relations";
};
var One = class _One extends Relation {
  constructor(sourceTable, referencedTable, config, isNullable) {
    super(sourceTable, referencedTable, config?.relationName);
    this.config = config;
    this.isNullable = isNullable;
  }
  static [entityKind] = "One";
  withFieldName(fieldName) {
    const relation = new _One(
      this.sourceTable,
      this.referencedTable,
      this.config,
      this.isNullable
    );
    relation.fieldName = fieldName;
    return relation;
  }
};
var Many = class _Many extends Relation {
  constructor(sourceTable, referencedTable, config) {
    super(sourceTable, referencedTable, config?.relationName);
    this.config = config;
  }
  static [entityKind] = "Many";
  withFieldName(fieldName) {
    const relation = new _Many(
      this.sourceTable,
      this.referencedTable,
      this.config
    );
    relation.fieldName = fieldName;
    return relation;
  }
};
function getOperators() {
  return {
    and,
    between,
    eq,
    exists,
    gt,
    gte,
    ilike,
    inArray,
    isNull,
    isNotNull,
    like,
    lt,
    lte,
    ne,
    not,
    notBetween,
    notExists,
    notLike,
    notIlike,
    notInArray,
    or,
    sql
  };
}
function getOrderByOperators() {
  return {
    sql,
    asc,
    desc
  };
}
function extractTablesRelationalConfig(schema, configHelpers) {
  if (Object.keys(schema).length === 1 && "default" in schema && !is(schema["default"], Table)) {
    schema = schema["default"];
  }
  const tableNamesMap = {};
  const relationsBuffer = {};
  const tablesConfig = {};
  for (const [key, value] of Object.entries(schema)) {
    if (is(value, Table)) {
      const dbName = getTableUniqueName(value);
      const bufferedRelations = relationsBuffer[dbName];
      tableNamesMap[dbName] = key;
      tablesConfig[key] = {
        tsName: key,
        dbName: value[Table.Symbol.Name],
        schema: value[Table.Symbol.Schema],
        columns: value[Table.Symbol.Columns],
        relations: bufferedRelations?.relations ?? {},
        primaryKey: bufferedRelations?.primaryKey ?? []
      };
      for (const column of Object.values(
        value[Table.Symbol.Columns]
      )) {
        if (column.primary) {
          tablesConfig[key].primaryKey.push(column);
        }
      }
      const extraConfig = value[Table.Symbol.ExtraConfigBuilder]?.(value[Table.Symbol.ExtraConfigColumns]);
      if (extraConfig) {
        for (const configEntry of Object.values(extraConfig)) {
          if (is(configEntry, PrimaryKeyBuilder)) {
            tablesConfig[key].primaryKey.push(...configEntry.columns);
          }
        }
      }
    } else if (is(value, Relations)) {
      const dbName = getTableUniqueName(value.table);
      const tableName = tableNamesMap[dbName];
      const relations2 = value.config(
        configHelpers(value.table)
      );
      let primaryKey;
      for (const [relationName, relation] of Object.entries(relations2)) {
        if (tableName) {
          const tableConfig = tablesConfig[tableName];
          tableConfig.relations[relationName] = relation;
          if (primaryKey) {
            tableConfig.primaryKey.push(...primaryKey);
          }
        } else {
          if (!(dbName in relationsBuffer)) {
            relationsBuffer[dbName] = {
              relations: {},
              primaryKey
            };
          }
          relationsBuffer[dbName].relations[relationName] = relation;
        }
      }
    }
  }
  return { tables: tablesConfig, tableNamesMap };
}
function createOne(sourceTable) {
  return function one(table, config) {
    return new One(
      sourceTable,
      table,
      config,
      config?.fields.reduce((res, f) => res && f.notNull, true) ?? false
    );
  };
}
function createMany(sourceTable) {
  return function many(referencedTable, config) {
    return new Many(sourceTable, referencedTable, config);
  };
}
function normalizeRelation(schema, tableNamesMap, relation) {
  if (is(relation, One) && relation.config) {
    return {
      fields: relation.config.fields,
      references: relation.config.references
    };
  }
  const referencedTableTsName = tableNamesMap[getTableUniqueName(relation.referencedTable)];
  if (!referencedTableTsName) {
    throw new Error(
      `Table "${relation.referencedTable[Table.Symbol.Name]}" not found in schema`
    );
  }
  const referencedTableConfig = schema[referencedTableTsName];
  if (!referencedTableConfig) {
    throw new Error(`Table "${referencedTableTsName}" not found in schema`);
  }
  const sourceTable = relation.sourceTable;
  const sourceTableTsName = tableNamesMap[getTableUniqueName(sourceTable)];
  if (!sourceTableTsName) {
    throw new Error(
      `Table "${sourceTable[Table.Symbol.Name]}" not found in schema`
    );
  }
  const reverseRelations = [];
  for (const referencedTableRelation of Object.values(
    referencedTableConfig.relations
  )) {
    if (relation.relationName && relation !== referencedTableRelation && referencedTableRelation.relationName === relation.relationName || !relation.relationName && referencedTableRelation.referencedTable === relation.sourceTable) {
      reverseRelations.push(referencedTableRelation);
    }
  }
  if (reverseRelations.length > 1) {
    throw relation.relationName ? new Error(
      `There are multiple relations with name "${relation.relationName}" in table "${referencedTableTsName}"`
    ) : new Error(
      `There are multiple relations between "${referencedTableTsName}" and "${relation.sourceTable[Table.Symbol.Name]}". Please specify relation name`
    );
  }
  if (reverseRelations[0] && is(reverseRelations[0], One) && reverseRelations[0].config) {
    return {
      fields: reverseRelations[0].config.references,
      references: reverseRelations[0].config.fields
    };
  }
  throw new Error(
    `There is not enough information to infer relation "${sourceTableTsName}.${relation.fieldName}"`
  );
}
function createTableRelationsHelpers(sourceTable) {
  return {
    one: createOne(sourceTable),
    many: createMany(sourceTable)
  };
}
function mapRelationalRow(tablesConfig, tableConfig, row, buildQueryResultSelection, mapColumnValue = (value) => value) {
  const result = {};
  for (const [
    selectionItemIndex,
    selectionItem
  ] of buildQueryResultSelection.entries()) {
    if (selectionItem.isJson) {
      const relation = tableConfig.relations[selectionItem.tsKey];
      const rawSubRows = row[selectionItemIndex];
      const subRows = typeof rawSubRows === "string" ? JSON.parse(rawSubRows) : rawSubRows;
      result[selectionItem.tsKey] = is(relation, One) ? subRows && mapRelationalRow(
        tablesConfig,
        tablesConfig[selectionItem.relationTableTsKey],
        subRows,
        selectionItem.selection,
        mapColumnValue
      ) : subRows.map(
        (subRow) => mapRelationalRow(
          tablesConfig,
          tablesConfig[selectionItem.relationTableTsKey],
          subRow,
          selectionItem.selection,
          mapColumnValue
        )
      );
    } else {
      const value = mapColumnValue(row[selectionItemIndex]);
      const field = selectionItem.field;
      let decoder2;
      if (is(field, Column)) {
        decoder2 = field;
      } else if (is(field, SQL)) {
        decoder2 = field.decoder;
      } else {
        decoder2 = field.sql.decoder;
      }
      result[selectionItem.tsKey] = value === null ? null : decoder2.mapFromDriverValue(value);
    }
  }
  return result;
}

// ../../node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/external.js
var external_exports = {};
__export(external_exports, {
  BRAND: () => BRAND,
  DIRTY: () => DIRTY,
  EMPTY_PATH: () => EMPTY_PATH,
  INVALID: () => INVALID,
  NEVER: () => NEVER,
  OK: () => OK,
  ParseStatus: () => ParseStatus,
  Schema: () => ZodType,
  ZodAny: () => ZodAny,
  ZodArray: () => ZodArray,
  ZodBigInt: () => ZodBigInt,
  ZodBoolean: () => ZodBoolean,
  ZodBranded: () => ZodBranded,
  ZodCatch: () => ZodCatch,
  ZodDate: () => ZodDate,
  ZodDefault: () => ZodDefault,
  ZodDiscriminatedUnion: () => ZodDiscriminatedUnion,
  ZodEffects: () => ZodEffects,
  ZodEnum: () => ZodEnum,
  ZodError: () => ZodError,
  ZodFirstPartyTypeKind: () => ZodFirstPartyTypeKind,
  ZodFunction: () => ZodFunction,
  ZodIntersection: () => ZodIntersection,
  ZodIssueCode: () => ZodIssueCode,
  ZodLazy: () => ZodLazy,
  ZodLiteral: () => ZodLiteral,
  ZodMap: () => ZodMap,
  ZodNaN: () => ZodNaN,
  ZodNativeEnum: () => ZodNativeEnum,
  ZodNever: () => ZodNever,
  ZodNull: () => ZodNull,
  ZodNullable: () => ZodNullable,
  ZodNumber: () => ZodNumber,
  ZodObject: () => ZodObject,
  ZodOptional: () => ZodOptional,
  ZodParsedType: () => ZodParsedType,
  ZodPipeline: () => ZodPipeline,
  ZodPromise: () => ZodPromise,
  ZodReadonly: () => ZodReadonly,
  ZodRecord: () => ZodRecord,
  ZodSchema: () => ZodType,
  ZodSet: () => ZodSet,
  ZodString: () => ZodString,
  ZodSymbol: () => ZodSymbol,
  ZodTransformer: () => ZodEffects,
  ZodTuple: () => ZodTuple,
  ZodType: () => ZodType,
  ZodUndefined: () => ZodUndefined,
  ZodUnion: () => ZodUnion,
  ZodUnknown: () => ZodUnknown,
  ZodVoid: () => ZodVoid,
  addIssueToContext: () => addIssueToContext,
  any: () => anyType,
  array: () => arrayType,
  bigint: () => bigIntType,
  boolean: () => booleanType,
  coerce: () => coerce,
  custom: () => custom,
  date: () => dateType,
  datetimeRegex: () => datetimeRegex,
  defaultErrorMap: () => en_default,
  discriminatedUnion: () => discriminatedUnionType,
  effect: () => effectsType,
  enum: () => enumType,
  function: () => functionType,
  getErrorMap: () => getErrorMap,
  getParsedType: () => getParsedType,
  instanceof: () => instanceOfType,
  intersection: () => intersectionType,
  isAborted: () => isAborted,
  isAsync: () => isAsync,
  isDirty: () => isDirty,
  isValid: () => isValid,
  late: () => late,
  lazy: () => lazyType,
  literal: () => literalType,
  makeIssue: () => makeIssue,
  map: () => mapType,
  nan: () => nanType,
  nativeEnum: () => nativeEnumType,
  never: () => neverType,
  null: () => nullType,
  nullable: () => nullableType,
  number: () => numberType,
  object: () => objectType,
  objectUtil: () => objectUtil,
  oboolean: () => oboolean,
  onumber: () => onumber,
  optional: () => optionalType,
  ostring: () => ostring,
  pipeline: () => pipelineType,
  preprocess: () => preprocessType,
  promise: () => promiseType,
  quotelessJson: () => quotelessJson,
  record: () => recordType,
  set: () => setType,
  setErrorMap: () => setErrorMap,
  strictObject: () => strictObjectType,
  string: () => stringType,
  symbol: () => symbolType,
  transformer: () => effectsType,
  tuple: () => tupleType,
  undefined: () => undefinedType,
  union: () => unionType,
  unknown: () => unknownType,
  util: () => util,
  void: () => voidType
});

// ../../node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/helpers/util.js
var util;
(function(util2) {
  util2.assertEqual = (_) => {
  };
  function assertIs(_arg) {
  }
  util2.assertIs = assertIs;
  function assertNever(_x) {
    throw new Error();
  }
  util2.assertNever = assertNever;
  util2.arrayToEnum = (items) => {
    const obj = {};
    for (const item of items) {
      obj[item] = item;
    }
    return obj;
  };
  util2.getValidEnumValues = (obj) => {
    const validKeys = util2.objectKeys(obj).filter((k) => typeof obj[obj[k]] !== "number");
    const filtered = {};
    for (const k of validKeys) {
      filtered[k] = obj[k];
    }
    return util2.objectValues(filtered);
  };
  util2.objectValues = (obj) => {
    return util2.objectKeys(obj).map(function(e) {
      return obj[e];
    });
  };
  util2.objectKeys = typeof Object.keys === "function" ? (obj) => Object.keys(obj) : (object) => {
    const keys = [];
    for (const key in object) {
      if (Object.prototype.hasOwnProperty.call(object, key)) {
        keys.push(key);
      }
    }
    return keys;
  };
  util2.find = (arr, checker) => {
    for (const item of arr) {
      if (checker(item))
        return item;
    }
    return void 0;
  };
  util2.isInteger = typeof Number.isInteger === "function" ? (val) => Number.isInteger(val) : (val) => typeof val === "number" && Number.isFinite(val) && Math.floor(val) === val;
  function joinValues(array, separator = " | ") {
    return array.map((val) => typeof val === "string" ? `'${val}'` : val).join(separator);
  }
  util2.joinValues = joinValues;
  util2.jsonStringifyReplacer = (_, value) => {
    if (typeof value === "bigint") {
      return value.toString();
    }
    return value;
  };
})(util || (util = {}));
var objectUtil;
(function(objectUtil2) {
  objectUtil2.mergeShapes = (first, second) => {
    return {
      ...first,
      ...second
      // second overwrites first
    };
  };
})(objectUtil || (objectUtil = {}));
var ZodParsedType = util.arrayToEnum([
  "string",
  "nan",
  "number",
  "integer",
  "float",
  "boolean",
  "date",
  "bigint",
  "symbol",
  "function",
  "undefined",
  "null",
  "array",
  "object",
  "unknown",
  "promise",
  "void",
  "never",
  "map",
  "set"
]);
var getParsedType = (data) => {
  const t = typeof data;
  switch (t) {
    case "undefined":
      return ZodParsedType.undefined;
    case "string":
      return ZodParsedType.string;
    case "number":
      return Number.isNaN(data) ? ZodParsedType.nan : ZodParsedType.number;
    case "boolean":
      return ZodParsedType.boolean;
    case "function":
      return ZodParsedType.function;
    case "bigint":
      return ZodParsedType.bigint;
    case "symbol":
      return ZodParsedType.symbol;
    case "object":
      if (Array.isArray(data)) {
        return ZodParsedType.array;
      }
      if (data === null) {
        return ZodParsedType.null;
      }
      if (data.then && typeof data.then === "function" && data.catch && typeof data.catch === "function") {
        return ZodParsedType.promise;
      }
      if (typeof Map !== "undefined" && data instanceof Map) {
        return ZodParsedType.map;
      }
      if (typeof Set !== "undefined" && data instanceof Set) {
        return ZodParsedType.set;
      }
      if (typeof Date !== "undefined" && data instanceof Date) {
        return ZodParsedType.date;
      }
      return ZodParsedType.object;
    default:
      return ZodParsedType.unknown;
  }
};

// ../../node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/ZodError.js
var ZodIssueCode = util.arrayToEnum([
  "invalid_type",
  "invalid_literal",
  "custom",
  "invalid_union",
  "invalid_union_discriminator",
  "invalid_enum_value",
  "unrecognized_keys",
  "invalid_arguments",
  "invalid_return_type",
  "invalid_date",
  "invalid_string",
  "too_small",
  "too_big",
  "invalid_intersection_types",
  "not_multiple_of",
  "not_finite"
]);
var quotelessJson = (obj) => {
  const json = JSON.stringify(obj, null, 2);
  return json.replace(/"([^"]+)":/g, "$1:");
};
var ZodError = class _ZodError extends Error {
  get errors() {
    return this.issues;
  }
  constructor(issues) {
    super();
    this.issues = [];
    this.addIssue = (sub2) => {
      this.issues = [...this.issues, sub2];
    };
    this.addIssues = (subs = []) => {
      this.issues = [...this.issues, ...subs];
    };
    const actualProto = new.target.prototype;
    if (Object.setPrototypeOf) {
      Object.setPrototypeOf(this, actualProto);
    } else {
      this.__proto__ = actualProto;
    }
    this.name = "ZodError";
    this.issues = issues;
  }
  format(_mapper) {
    const mapper = _mapper || function(issue) {
      return issue.message;
    };
    const fieldErrors = { _errors: [] };
    const processError = (error) => {
      for (const issue of error.issues) {
        if (issue.code === "invalid_union") {
          issue.unionErrors.map(processError);
        } else if (issue.code === "invalid_return_type") {
          processError(issue.returnTypeError);
        } else if (issue.code === "invalid_arguments") {
          processError(issue.argumentsError);
        } else if (issue.path.length === 0) {
          fieldErrors._errors.push(mapper(issue));
        } else {
          let curr = fieldErrors;
          let i = 0;
          while (i < issue.path.length) {
            const el = issue.path[i];
            const terminal = i === issue.path.length - 1;
            if (!terminal) {
              curr[el] = curr[el] || { _errors: [] };
            } else {
              curr[el] = curr[el] || { _errors: [] };
              curr[el]._errors.push(mapper(issue));
            }
            curr = curr[el];
            i++;
          }
        }
      }
    };
    processError(this);
    return fieldErrors;
  }
  static assert(value) {
    if (!(value instanceof _ZodError)) {
      throw new Error(`Not a ZodError: ${value}`);
    }
  }
  toString() {
    return this.message;
  }
  get message() {
    return JSON.stringify(this.issues, util.jsonStringifyReplacer, 2);
  }
  get isEmpty() {
    return this.issues.length === 0;
  }
  flatten(mapper = (issue) => issue.message) {
    const fieldErrors = {};
    const formErrors = [];
    for (const sub2 of this.issues) {
      if (sub2.path.length > 0) {
        const firstEl = sub2.path[0];
        fieldErrors[firstEl] = fieldErrors[firstEl] || [];
        fieldErrors[firstEl].push(mapper(sub2));
      } else {
        formErrors.push(mapper(sub2));
      }
    }
    return { formErrors, fieldErrors };
  }
  get formErrors() {
    return this.flatten();
  }
};
ZodError.create = (issues) => {
  const error = new ZodError(issues);
  return error;
};

// ../../node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/locales/en.js
var errorMap = (issue, _ctx) => {
  let message2;
  switch (issue.code) {
    case ZodIssueCode.invalid_type:
      if (issue.received === ZodParsedType.undefined) {
        message2 = "Required";
      } else {
        message2 = `Expected ${issue.expected}, received ${issue.received}`;
      }
      break;
    case ZodIssueCode.invalid_literal:
      message2 = `Invalid literal value, expected ${JSON.stringify(issue.expected, util.jsonStringifyReplacer)}`;
      break;
    case ZodIssueCode.unrecognized_keys:
      message2 = `Unrecognized key(s) in object: ${util.joinValues(issue.keys, ", ")}`;
      break;
    case ZodIssueCode.invalid_union:
      message2 = `Invalid input`;
      break;
    case ZodIssueCode.invalid_union_discriminator:
      message2 = `Invalid discriminator value. Expected ${util.joinValues(issue.options)}`;
      break;
    case ZodIssueCode.invalid_enum_value:
      message2 = `Invalid enum value. Expected ${util.joinValues(issue.options)}, received '${issue.received}'`;
      break;
    case ZodIssueCode.invalid_arguments:
      message2 = `Invalid function arguments`;
      break;
    case ZodIssueCode.invalid_return_type:
      message2 = `Invalid function return type`;
      break;
    case ZodIssueCode.invalid_date:
      message2 = `Invalid date`;
      break;
    case ZodIssueCode.invalid_string:
      if (typeof issue.validation === "object") {
        if ("includes" in issue.validation) {
          message2 = `Invalid input: must include "${issue.validation.includes}"`;
          if (typeof issue.validation.position === "number") {
            message2 = `${message2} at one or more positions greater than or equal to ${issue.validation.position}`;
          }
        } else if ("startsWith" in issue.validation) {
          message2 = `Invalid input: must start with "${issue.validation.startsWith}"`;
        } else if ("endsWith" in issue.validation) {
          message2 = `Invalid input: must end with "${issue.validation.endsWith}"`;
        } else {
          util.assertNever(issue.validation);
        }
      } else if (issue.validation !== "regex") {
        message2 = `Invalid ${issue.validation}`;
      } else {
        message2 = "Invalid";
      }
      break;
    case ZodIssueCode.too_small:
      if (issue.type === "array")
        message2 = `Array must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `more than`} ${issue.minimum} element(s)`;
      else if (issue.type === "string")
        message2 = `String must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `over`} ${issue.minimum} character(s)`;
      else if (issue.type === "number")
        message2 = `Number must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${issue.minimum}`;
      else if (issue.type === "bigint")
        message2 = `Number must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${issue.minimum}`;
      else if (issue.type === "date")
        message2 = `Date must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${new Date(Number(issue.minimum))}`;
      else
        message2 = "Invalid input";
      break;
    case ZodIssueCode.too_big:
      if (issue.type === "array")
        message2 = `Array must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `less than`} ${issue.maximum} element(s)`;
      else if (issue.type === "string")
        message2 = `String must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `under`} ${issue.maximum} character(s)`;
      else if (issue.type === "number")
        message2 = `Number must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
      else if (issue.type === "bigint")
        message2 = `BigInt must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
      else if (issue.type === "date")
        message2 = `Date must be ${issue.exact ? `exactly` : issue.inclusive ? `smaller than or equal to` : `smaller than`} ${new Date(Number(issue.maximum))}`;
      else
        message2 = "Invalid input";
      break;
    case ZodIssueCode.custom:
      message2 = `Invalid input`;
      break;
    case ZodIssueCode.invalid_intersection_types:
      message2 = `Intersection results could not be merged`;
      break;
    case ZodIssueCode.not_multiple_of:
      message2 = `Number must be a multiple of ${issue.multipleOf}`;
      break;
    case ZodIssueCode.not_finite:
      message2 = "Number must be finite";
      break;
    default:
      message2 = _ctx.defaultError;
      util.assertNever(issue);
  }
  return { message: message2 };
};
var en_default = errorMap;

// ../../node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/errors.js
var overrideErrorMap = en_default;
function setErrorMap(map) {
  overrideErrorMap = map;
}
function getErrorMap() {
  return overrideErrorMap;
}

// ../../node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/helpers/parseUtil.js
var makeIssue = (params) => {
  const { data, path, errorMaps, issueData } = params;
  const fullPath = [...path, ...issueData.path || []];
  const fullIssue = {
    ...issueData,
    path: fullPath
  };
  if (issueData.message !== void 0) {
    return {
      ...issueData,
      path: fullPath,
      message: issueData.message
    };
  }
  let errorMessage = "";
  const maps = errorMaps.filter((m) => !!m).slice().reverse();
  for (const map of maps) {
    errorMessage = map(fullIssue, { data, defaultError: errorMessage }).message;
  }
  return {
    ...issueData,
    path: fullPath,
    message: errorMessage
  };
};
var EMPTY_PATH = [];
function addIssueToContext(ctx, issueData) {
  const overrideMap = getErrorMap();
  const issue = makeIssue({
    issueData,
    data: ctx.data,
    path: ctx.path,
    errorMaps: [
      ctx.common.contextualErrorMap,
      // contextual error map is first priority
      ctx.schemaErrorMap,
      // then schema-bound map if available
      overrideMap,
      // then global override map
      overrideMap === en_default ? void 0 : en_default
      // then global default map
    ].filter((x) => !!x)
  });
  ctx.common.issues.push(issue);
}
var ParseStatus = class _ParseStatus {
  constructor() {
    this.value = "valid";
  }
  dirty() {
    if (this.value === "valid")
      this.value = "dirty";
  }
  abort() {
    if (this.value !== "aborted")
      this.value = "aborted";
  }
  static mergeArray(status, results) {
    const arrayValue = [];
    for (const s of results) {
      if (s.status === "aborted")
        return INVALID;
      if (s.status === "dirty")
        status.dirty();
      arrayValue.push(s.value);
    }
    return { status: status.value, value: arrayValue };
  }
  static async mergeObjectAsync(status, pairs) {
    const syncPairs = [];
    for (const pair of pairs) {
      const key = await pair.key;
      const value = await pair.value;
      syncPairs.push({
        key,
        value
      });
    }
    return _ParseStatus.mergeObjectSync(status, syncPairs);
  }
  static mergeObjectSync(status, pairs) {
    const finalObject = {};
    for (const pair of pairs) {
      const { key, value } = pair;
      if (key.status === "aborted")
        return INVALID;
      if (value.status === "aborted")
        return INVALID;
      if (key.status === "dirty")
        status.dirty();
      if (value.status === "dirty")
        status.dirty();
      if (key.value !== "__proto__" && (typeof value.value !== "undefined" || pair.alwaysSet)) {
        finalObject[key.value] = value.value;
      }
    }
    return { status: status.value, value: finalObject };
  }
};
var INVALID = Object.freeze({
  status: "aborted"
});
var DIRTY = (value) => ({ status: "dirty", value });
var OK = (value) => ({ status: "valid", value });
var isAborted = (x) => x.status === "aborted";
var isDirty = (x) => x.status === "dirty";
var isValid = (x) => x.status === "valid";
var isAsync = (x) => typeof Promise !== "undefined" && x instanceof Promise;

// ../../node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/helpers/errorUtil.js
var errorUtil;
(function(errorUtil2) {
  errorUtil2.errToObj = (message2) => typeof message2 === "string" ? { message: message2 } : message2 || {};
  errorUtil2.toString = (message2) => typeof message2 === "string" ? message2 : message2?.message;
})(errorUtil || (errorUtil = {}));

// ../../node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/types.js
var ParseInputLazyPath = class {
  constructor(parent, value, path, key) {
    this._cachedPath = [];
    this.parent = parent;
    this.data = value;
    this._path = path;
    this._key = key;
  }
  get path() {
    if (!this._cachedPath.length) {
      if (Array.isArray(this._key)) {
        this._cachedPath.push(...this._path, ...this._key);
      } else {
        this._cachedPath.push(...this._path, this._key);
      }
    }
    return this._cachedPath;
  }
};
var handleResult = (ctx, result) => {
  if (isValid(result)) {
    return { success: true, data: result.value };
  } else {
    if (!ctx.common.issues.length) {
      throw new Error("Validation failed but no issues detected.");
    }
    return {
      success: false,
      get error() {
        if (this._error)
          return this._error;
        const error = new ZodError(ctx.common.issues);
        this._error = error;
        return this._error;
      }
    };
  }
};
function processCreateParams(params) {
  if (!params)
    return {};
  const { errorMap: errorMap2, invalid_type_error, required_error, description } = params;
  if (errorMap2 && (invalid_type_error || required_error)) {
    throw new Error(`Can't use "invalid_type_error" or "required_error" in conjunction with custom error map.`);
  }
  if (errorMap2)
    return { errorMap: errorMap2, description };
  const customMap = (iss, ctx) => {
    const { message: message2 } = params;
    if (iss.code === "invalid_enum_value") {
      return { message: message2 ?? ctx.defaultError };
    }
    if (typeof ctx.data === "undefined") {
      return { message: message2 ?? required_error ?? ctx.defaultError };
    }
    if (iss.code !== "invalid_type")
      return { message: ctx.defaultError };
    return { message: message2 ?? invalid_type_error ?? ctx.defaultError };
  };
  return { errorMap: customMap, description };
}
var ZodType = class {
  get description() {
    return this._def.description;
  }
  _getType(input) {
    return getParsedType(input.data);
  }
  _getOrReturnCtx(input, ctx) {
    return ctx || {
      common: input.parent.common,
      data: input.data,
      parsedType: getParsedType(input.data),
      schemaErrorMap: this._def.errorMap,
      path: input.path,
      parent: input.parent
    };
  }
  _processInputParams(input) {
    return {
      status: new ParseStatus(),
      ctx: {
        common: input.parent.common,
        data: input.data,
        parsedType: getParsedType(input.data),
        schemaErrorMap: this._def.errorMap,
        path: input.path,
        parent: input.parent
      }
    };
  }
  _parseSync(input) {
    const result = this._parse(input);
    if (isAsync(result)) {
      throw new Error("Synchronous parse encountered promise.");
    }
    return result;
  }
  _parseAsync(input) {
    const result = this._parse(input);
    return Promise.resolve(result);
  }
  parse(data, params) {
    const result = this.safeParse(data, params);
    if (result.success)
      return result.data;
    throw result.error;
  }
  safeParse(data, params) {
    const ctx = {
      common: {
        issues: [],
        async: params?.async ?? false,
        contextualErrorMap: params?.errorMap
      },
      path: params?.path || [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data)
    };
    const result = this._parseSync({ data, path: ctx.path, parent: ctx });
    return handleResult(ctx, result);
  }
  "~validate"(data) {
    const ctx = {
      common: {
        issues: [],
        async: !!this["~standard"].async
      },
      path: [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data)
    };
    if (!this["~standard"].async) {
      try {
        const result = this._parseSync({ data, path: [], parent: ctx });
        return isValid(result) ? {
          value: result.value
        } : {
          issues: ctx.common.issues
        };
      } catch (err) {
        if (err?.message?.toLowerCase()?.includes("encountered")) {
          this["~standard"].async = true;
        }
        ctx.common = {
          issues: [],
          async: true
        };
      }
    }
    return this._parseAsync({ data, path: [], parent: ctx }).then((result) => isValid(result) ? {
      value: result.value
    } : {
      issues: ctx.common.issues
    });
  }
  async parseAsync(data, params) {
    const result = await this.safeParseAsync(data, params);
    if (result.success)
      return result.data;
    throw result.error;
  }
  async safeParseAsync(data, params) {
    const ctx = {
      common: {
        issues: [],
        contextualErrorMap: params?.errorMap,
        async: true
      },
      path: params?.path || [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data)
    };
    const maybeAsyncResult = this._parse({ data, path: ctx.path, parent: ctx });
    const result = await (isAsync(maybeAsyncResult) ? maybeAsyncResult : Promise.resolve(maybeAsyncResult));
    return handleResult(ctx, result);
  }
  refine(check, message2) {
    const getIssueProperties = (val) => {
      if (typeof message2 === "string" || typeof message2 === "undefined") {
        return { message: message2 };
      } else if (typeof message2 === "function") {
        return message2(val);
      } else {
        return message2;
      }
    };
    return this._refinement((val, ctx) => {
      const result = check(val);
      const setError = () => ctx.addIssue({
        code: ZodIssueCode.custom,
        ...getIssueProperties(val)
      });
      if (typeof Promise !== "undefined" && result instanceof Promise) {
        return result.then((data) => {
          if (!data) {
            setError();
            return false;
          } else {
            return true;
          }
        });
      }
      if (!result) {
        setError();
        return false;
      } else {
        return true;
      }
    });
  }
  refinement(check, refinementData) {
    return this._refinement((val, ctx) => {
      if (!check(val)) {
        ctx.addIssue(typeof refinementData === "function" ? refinementData(val, ctx) : refinementData);
        return false;
      } else {
        return true;
      }
    });
  }
  _refinement(refinement) {
    return new ZodEffects({
      schema: this,
      typeName: ZodFirstPartyTypeKind.ZodEffects,
      effect: { type: "refinement", refinement }
    });
  }
  superRefine(refinement) {
    return this._refinement(refinement);
  }
  constructor(def) {
    this.spa = this.safeParseAsync;
    this._def = def;
    this.parse = this.parse.bind(this);
    this.safeParse = this.safeParse.bind(this);
    this.parseAsync = this.parseAsync.bind(this);
    this.safeParseAsync = this.safeParseAsync.bind(this);
    this.spa = this.spa.bind(this);
    this.refine = this.refine.bind(this);
    this.refinement = this.refinement.bind(this);
    this.superRefine = this.superRefine.bind(this);
    this.optional = this.optional.bind(this);
    this.nullable = this.nullable.bind(this);
    this.nullish = this.nullish.bind(this);
    this.array = this.array.bind(this);
    this.promise = this.promise.bind(this);
    this.or = this.or.bind(this);
    this.and = this.and.bind(this);
    this.transform = this.transform.bind(this);
    this.brand = this.brand.bind(this);
    this.default = this.default.bind(this);
    this.catch = this.catch.bind(this);
    this.describe = this.describe.bind(this);
    this.pipe = this.pipe.bind(this);
    this.readonly = this.readonly.bind(this);
    this.isNullable = this.isNullable.bind(this);
    this.isOptional = this.isOptional.bind(this);
    this["~standard"] = {
      version: 1,
      vendor: "zod",
      validate: (data) => this["~validate"](data)
    };
  }
  optional() {
    return ZodOptional.create(this, this._def);
  }
  nullable() {
    return ZodNullable.create(this, this._def);
  }
  nullish() {
    return this.nullable().optional();
  }
  array() {
    return ZodArray.create(this);
  }
  promise() {
    return ZodPromise.create(this, this._def);
  }
  or(option) {
    return ZodUnion.create([this, option], this._def);
  }
  and(incoming) {
    return ZodIntersection.create(this, incoming, this._def);
  }
  transform(transform) {
    return new ZodEffects({
      ...processCreateParams(this._def),
      schema: this,
      typeName: ZodFirstPartyTypeKind.ZodEffects,
      effect: { type: "transform", transform }
    });
  }
  default(def) {
    const defaultValueFunc = typeof def === "function" ? def : () => def;
    return new ZodDefault({
      ...processCreateParams(this._def),
      innerType: this,
      defaultValue: defaultValueFunc,
      typeName: ZodFirstPartyTypeKind.ZodDefault
    });
  }
  brand() {
    return new ZodBranded({
      typeName: ZodFirstPartyTypeKind.ZodBranded,
      type: this,
      ...processCreateParams(this._def)
    });
  }
  catch(def) {
    const catchValueFunc = typeof def === "function" ? def : () => def;
    return new ZodCatch({
      ...processCreateParams(this._def),
      innerType: this,
      catchValue: catchValueFunc,
      typeName: ZodFirstPartyTypeKind.ZodCatch
    });
  }
  describe(description) {
    const This = this.constructor;
    return new This({
      ...this._def,
      description
    });
  }
  pipe(target) {
    return ZodPipeline.create(this, target);
  }
  readonly() {
    return ZodReadonly.create(this);
  }
  isOptional() {
    return this.safeParse(void 0).success;
  }
  isNullable() {
    return this.safeParse(null).success;
  }
};
var cuidRegex = /^c[^\s-]{8,}$/i;
var cuid2Regex = /^[0-9a-z]+$/;
var ulidRegex = /^[0-9A-HJKMNP-TV-Z]{26}$/i;
var uuidRegex = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/i;
var nanoidRegex = /^[a-z0-9_-]{21}$/i;
var jwtRegex = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/;
var durationRegex = /^[-+]?P(?!$)(?:(?:[-+]?\d+Y)|(?:[-+]?\d+[.,]\d+Y$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:(?:[-+]?\d+W)|(?:[-+]?\d+[.,]\d+W$))?(?:(?:[-+]?\d+D)|(?:[-+]?\d+[.,]\d+D$))?(?:T(?=[\d+-])(?:(?:[-+]?\d+H)|(?:[-+]?\d+[.,]\d+H$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:[-+]?\d+(?:[.,]\d+)?S)?)??$/;
var emailRegex = /^(?!\.)(?!.*\.\.)([A-Z0-9_'+\-\.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9\-]*\.)+[A-Z]{2,}$/i;
var _emojiRegex = `^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$`;
var emojiRegex;
var ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/;
var ipv4CidrRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/(3[0-2]|[12]?[0-9])$/;
var ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;
var ipv6CidrRegex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/;
var base64Regex = /^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/;
var base64urlRegex = /^([0-9a-zA-Z-_]{4})*(([0-9a-zA-Z-_]{2}(==)?)|([0-9a-zA-Z-_]{3}(=)?))?$/;
var dateRegexSource = `((\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-((0[13578]|1[02])-(0[1-9]|[12]\\d|3[01])|(0[469]|11)-(0[1-9]|[12]\\d|30)|(02)-(0[1-9]|1\\d|2[0-8])))`;
var dateRegex = new RegExp(`^${dateRegexSource}$`);
function timeRegexSource(args) {
  let secondsRegexSource = `[0-5]\\d`;
  if (args.precision) {
    secondsRegexSource = `${secondsRegexSource}\\.\\d{${args.precision}}`;
  } else if (args.precision == null) {
    secondsRegexSource = `${secondsRegexSource}(\\.\\d+)?`;
  }
  const secondsQuantifier = args.precision ? "+" : "?";
  return `([01]\\d|2[0-3]):[0-5]\\d(:${secondsRegexSource})${secondsQuantifier}`;
}
function timeRegex(args) {
  return new RegExp(`^${timeRegexSource(args)}$`);
}
function datetimeRegex(args) {
  let regex = `${dateRegexSource}T${timeRegexSource(args)}`;
  const opts = [];
  opts.push(args.local ? `Z?` : `Z`);
  if (args.offset)
    opts.push(`([+-]\\d{2}:?\\d{2})`);
  regex = `${regex}(${opts.join("|")})`;
  return new RegExp(`^${regex}$`);
}
function isValidIP(ip, version2) {
  if ((version2 === "v4" || !version2) && ipv4Regex.test(ip)) {
    return true;
  }
  if ((version2 === "v6" || !version2) && ipv6Regex.test(ip)) {
    return true;
  }
  return false;
}
function isValidJWT(jwt, alg) {
  if (!jwtRegex.test(jwt))
    return false;
  try {
    const [header] = jwt.split(".");
    if (!header)
      return false;
    const base64 = header.replace(/-/g, "+").replace(/_/g, "/").padEnd(header.length + (4 - header.length % 4) % 4, "=");
    const decoded = JSON.parse(atob(base64));
    if (typeof decoded !== "object" || decoded === null)
      return false;
    if ("typ" in decoded && decoded?.typ !== "JWT")
      return false;
    if (!decoded.alg)
      return false;
    if (alg && decoded.alg !== alg)
      return false;
    return true;
  } catch {
    return false;
  }
}
function isValidCidr(ip, version2) {
  if ((version2 === "v4" || !version2) && ipv4CidrRegex.test(ip)) {
    return true;
  }
  if ((version2 === "v6" || !version2) && ipv6CidrRegex.test(ip)) {
    return true;
  }
  return false;
}
var ZodString = class _ZodString extends ZodType {
  _parse(input) {
    if (this._def.coerce) {
      input.data = String(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.string) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.string,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    const status = new ParseStatus();
    let ctx = void 0;
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        if (input.data.length < check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            minimum: check.value,
            type: "string",
            inclusive: true,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        if (input.data.length > check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            maximum: check.value,
            type: "string",
            inclusive: true,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "length") {
        const tooBig = input.data.length > check.value;
        const tooSmall = input.data.length < check.value;
        if (tooBig || tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          if (tooBig) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_big,
              maximum: check.value,
              type: "string",
              inclusive: true,
              exact: true,
              message: check.message
            });
          } else if (tooSmall) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_small,
              minimum: check.value,
              type: "string",
              inclusive: true,
              exact: true,
              message: check.message
            });
          }
          status.dirty();
        }
      } else if (check.kind === "email") {
        if (!emailRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "email",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "emoji") {
        if (!emojiRegex) {
          emojiRegex = new RegExp(_emojiRegex, "u");
        }
        if (!emojiRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "emoji",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "uuid") {
        if (!uuidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "uuid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "nanoid") {
        if (!nanoidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "nanoid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "cuid") {
        if (!cuidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "cuid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "cuid2") {
        if (!cuid2Regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "cuid2",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "ulid") {
        if (!ulidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "ulid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "url") {
        try {
          new URL(input.data);
        } catch {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "url",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "regex") {
        check.regex.lastIndex = 0;
        const testResult = check.regex.test(input.data);
        if (!testResult) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "regex",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "trim") {
        input.data = input.data.trim();
      } else if (check.kind === "includes") {
        if (!input.data.includes(check.value, check.position)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { includes: check.value, position: check.position },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "toLowerCase") {
        input.data = input.data.toLowerCase();
      } else if (check.kind === "toUpperCase") {
        input.data = input.data.toUpperCase();
      } else if (check.kind === "startsWith") {
        if (!input.data.startsWith(check.value)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { startsWith: check.value },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "endsWith") {
        if (!input.data.endsWith(check.value)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { endsWith: check.value },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "datetime") {
        const regex = datetimeRegex(check);
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "datetime",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "date") {
        const regex = dateRegex;
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "date",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "time") {
        const regex = timeRegex(check);
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "time",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "duration") {
        if (!durationRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "duration",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "ip") {
        if (!isValidIP(input.data, check.version)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "ip",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "jwt") {
        if (!isValidJWT(input.data, check.alg)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "jwt",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "cidr") {
        if (!isValidCidr(input.data, check.version)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "cidr",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "base64") {
        if (!base64Regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "base64",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "base64url") {
        if (!base64urlRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "base64url",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  _regex(regex, validation, message2) {
    return this.refinement((data) => regex.test(data), {
      validation,
      code: ZodIssueCode.invalid_string,
      ...errorUtil.errToObj(message2)
    });
  }
  _addCheck(check) {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  email(message2) {
    return this._addCheck({ kind: "email", ...errorUtil.errToObj(message2) });
  }
  url(message2) {
    return this._addCheck({ kind: "url", ...errorUtil.errToObj(message2) });
  }
  emoji(message2) {
    return this._addCheck({ kind: "emoji", ...errorUtil.errToObj(message2) });
  }
  uuid(message2) {
    return this._addCheck({ kind: "uuid", ...errorUtil.errToObj(message2) });
  }
  nanoid(message2) {
    return this._addCheck({ kind: "nanoid", ...errorUtil.errToObj(message2) });
  }
  cuid(message2) {
    return this._addCheck({ kind: "cuid", ...errorUtil.errToObj(message2) });
  }
  cuid2(message2) {
    return this._addCheck({ kind: "cuid2", ...errorUtil.errToObj(message2) });
  }
  ulid(message2) {
    return this._addCheck({ kind: "ulid", ...errorUtil.errToObj(message2) });
  }
  base64(message2) {
    return this._addCheck({ kind: "base64", ...errorUtil.errToObj(message2) });
  }
  base64url(message2) {
    return this._addCheck({
      kind: "base64url",
      ...errorUtil.errToObj(message2)
    });
  }
  jwt(options) {
    return this._addCheck({ kind: "jwt", ...errorUtil.errToObj(options) });
  }
  ip(options) {
    return this._addCheck({ kind: "ip", ...errorUtil.errToObj(options) });
  }
  cidr(options) {
    return this._addCheck({ kind: "cidr", ...errorUtil.errToObj(options) });
  }
  datetime(options) {
    if (typeof options === "string") {
      return this._addCheck({
        kind: "datetime",
        precision: null,
        offset: false,
        local: false,
        message: options
      });
    }
    return this._addCheck({
      kind: "datetime",
      precision: typeof options?.precision === "undefined" ? null : options?.precision,
      offset: options?.offset ?? false,
      local: options?.local ?? false,
      ...errorUtil.errToObj(options?.message)
    });
  }
  date(message2) {
    return this._addCheck({ kind: "date", message: message2 });
  }
  time(options) {
    if (typeof options === "string") {
      return this._addCheck({
        kind: "time",
        precision: null,
        message: options
      });
    }
    return this._addCheck({
      kind: "time",
      precision: typeof options?.precision === "undefined" ? null : options?.precision,
      ...errorUtil.errToObj(options?.message)
    });
  }
  duration(message2) {
    return this._addCheck({ kind: "duration", ...errorUtil.errToObj(message2) });
  }
  regex(regex, message2) {
    return this._addCheck({
      kind: "regex",
      regex,
      ...errorUtil.errToObj(message2)
    });
  }
  includes(value, options) {
    return this._addCheck({
      kind: "includes",
      value,
      position: options?.position,
      ...errorUtil.errToObj(options?.message)
    });
  }
  startsWith(value, message2) {
    return this._addCheck({
      kind: "startsWith",
      value,
      ...errorUtil.errToObj(message2)
    });
  }
  endsWith(value, message2) {
    return this._addCheck({
      kind: "endsWith",
      value,
      ...errorUtil.errToObj(message2)
    });
  }
  min(minLength, message2) {
    return this._addCheck({
      kind: "min",
      value: minLength,
      ...errorUtil.errToObj(message2)
    });
  }
  max(maxLength, message2) {
    return this._addCheck({
      kind: "max",
      value: maxLength,
      ...errorUtil.errToObj(message2)
    });
  }
  length(len, message2) {
    return this._addCheck({
      kind: "length",
      value: len,
      ...errorUtil.errToObj(message2)
    });
  }
  /**
   * Equivalent to `.min(1)`
   */
  nonempty(message2) {
    return this.min(1, errorUtil.errToObj(message2));
  }
  trim() {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "trim" }]
    });
  }
  toLowerCase() {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "toLowerCase" }]
    });
  }
  toUpperCase() {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "toUpperCase" }]
    });
  }
  get isDatetime() {
    return !!this._def.checks.find((ch) => ch.kind === "datetime");
  }
  get isDate() {
    return !!this._def.checks.find((ch) => ch.kind === "date");
  }
  get isTime() {
    return !!this._def.checks.find((ch) => ch.kind === "time");
  }
  get isDuration() {
    return !!this._def.checks.find((ch) => ch.kind === "duration");
  }
  get isEmail() {
    return !!this._def.checks.find((ch) => ch.kind === "email");
  }
  get isURL() {
    return !!this._def.checks.find((ch) => ch.kind === "url");
  }
  get isEmoji() {
    return !!this._def.checks.find((ch) => ch.kind === "emoji");
  }
  get isUUID() {
    return !!this._def.checks.find((ch) => ch.kind === "uuid");
  }
  get isNANOID() {
    return !!this._def.checks.find((ch) => ch.kind === "nanoid");
  }
  get isCUID() {
    return !!this._def.checks.find((ch) => ch.kind === "cuid");
  }
  get isCUID2() {
    return !!this._def.checks.find((ch) => ch.kind === "cuid2");
  }
  get isULID() {
    return !!this._def.checks.find((ch) => ch.kind === "ulid");
  }
  get isIP() {
    return !!this._def.checks.find((ch) => ch.kind === "ip");
  }
  get isCIDR() {
    return !!this._def.checks.find((ch) => ch.kind === "cidr");
  }
  get isBase64() {
    return !!this._def.checks.find((ch) => ch.kind === "base64");
  }
  get isBase64url() {
    return !!this._def.checks.find((ch) => ch.kind === "base64url");
  }
  get minLength() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxLength() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
};
ZodString.create = (params) => {
  return new ZodString({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodString,
    coerce: params?.coerce ?? false,
    ...processCreateParams(params)
  });
};
function floatSafeRemainder(val, step) {
  const valDecCount = (val.toString().split(".")[1] || "").length;
  const stepDecCount = (step.toString().split(".")[1] || "").length;
  const decCount = valDecCount > stepDecCount ? valDecCount : stepDecCount;
  const valInt = Number.parseInt(val.toFixed(decCount).replace(".", ""));
  const stepInt = Number.parseInt(step.toFixed(decCount).replace(".", ""));
  return valInt % stepInt / 10 ** decCount;
}
var ZodNumber = class _ZodNumber extends ZodType {
  constructor() {
    super(...arguments);
    this.min = this.gte;
    this.max = this.lte;
    this.step = this.multipleOf;
  }
  _parse(input) {
    if (this._def.coerce) {
      input.data = Number(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.number) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.number,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    let ctx = void 0;
    const status = new ParseStatus();
    for (const check of this._def.checks) {
      if (check.kind === "int") {
        if (!util.isInteger(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: "integer",
            received: "float",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "min") {
        const tooSmall = check.inclusive ? input.data < check.value : input.data <= check.value;
        if (tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            minimum: check.value,
            type: "number",
            inclusive: check.inclusive,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        const tooBig = check.inclusive ? input.data > check.value : input.data >= check.value;
        if (tooBig) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            maximum: check.value,
            type: "number",
            inclusive: check.inclusive,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "multipleOf") {
        if (floatSafeRemainder(input.data, check.value) !== 0) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_multiple_of,
            multipleOf: check.value,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "finite") {
        if (!Number.isFinite(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_finite,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  gte(value, message2) {
    return this.setLimit("min", value, true, errorUtil.toString(message2));
  }
  gt(value, message2) {
    return this.setLimit("min", value, false, errorUtil.toString(message2));
  }
  lte(value, message2) {
    return this.setLimit("max", value, true, errorUtil.toString(message2));
  }
  lt(value, message2) {
    return this.setLimit("max", value, false, errorUtil.toString(message2));
  }
  setLimit(kind, value, inclusive, message2) {
    return new _ZodNumber({
      ...this._def,
      checks: [
        ...this._def.checks,
        {
          kind,
          value,
          inclusive,
          message: errorUtil.toString(message2)
        }
      ]
    });
  }
  _addCheck(check) {
    return new _ZodNumber({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  int(message2) {
    return this._addCheck({
      kind: "int",
      message: errorUtil.toString(message2)
    });
  }
  positive(message2) {
    return this._addCheck({
      kind: "min",
      value: 0,
      inclusive: false,
      message: errorUtil.toString(message2)
    });
  }
  negative(message2) {
    return this._addCheck({
      kind: "max",
      value: 0,
      inclusive: false,
      message: errorUtil.toString(message2)
    });
  }
  nonpositive(message2) {
    return this._addCheck({
      kind: "max",
      value: 0,
      inclusive: true,
      message: errorUtil.toString(message2)
    });
  }
  nonnegative(message2) {
    return this._addCheck({
      kind: "min",
      value: 0,
      inclusive: true,
      message: errorUtil.toString(message2)
    });
  }
  multipleOf(value, message2) {
    return this._addCheck({
      kind: "multipleOf",
      value,
      message: errorUtil.toString(message2)
    });
  }
  finite(message2) {
    return this._addCheck({
      kind: "finite",
      message: errorUtil.toString(message2)
    });
  }
  safe(message2) {
    return this._addCheck({
      kind: "min",
      inclusive: true,
      value: Number.MIN_SAFE_INTEGER,
      message: errorUtil.toString(message2)
    })._addCheck({
      kind: "max",
      inclusive: true,
      value: Number.MAX_SAFE_INTEGER,
      message: errorUtil.toString(message2)
    });
  }
  get minValue() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxValue() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
  get isInt() {
    return !!this._def.checks.find((ch) => ch.kind === "int" || ch.kind === "multipleOf" && util.isInteger(ch.value));
  }
  get isFinite() {
    let max = null;
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "finite" || ch.kind === "int" || ch.kind === "multipleOf") {
        return true;
      } else if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      } else if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return Number.isFinite(min) && Number.isFinite(max);
  }
};
ZodNumber.create = (params) => {
  return new ZodNumber({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodNumber,
    coerce: params?.coerce || false,
    ...processCreateParams(params)
  });
};
var ZodBigInt = class _ZodBigInt extends ZodType {
  constructor() {
    super(...arguments);
    this.min = this.gte;
    this.max = this.lte;
  }
  _parse(input) {
    if (this._def.coerce) {
      try {
        input.data = BigInt(input.data);
      } catch {
        return this._getInvalidInput(input);
      }
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.bigint) {
      return this._getInvalidInput(input);
    }
    let ctx = void 0;
    const status = new ParseStatus();
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        const tooSmall = check.inclusive ? input.data < check.value : input.data <= check.value;
        if (tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            type: "bigint",
            minimum: check.value,
            inclusive: check.inclusive,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        const tooBig = check.inclusive ? input.data > check.value : input.data >= check.value;
        if (tooBig) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            type: "bigint",
            maximum: check.value,
            inclusive: check.inclusive,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "multipleOf") {
        if (input.data % check.value !== BigInt(0)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_multiple_of,
            multipleOf: check.value,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  _getInvalidInput(input) {
    const ctx = this._getOrReturnCtx(input);
    addIssueToContext(ctx, {
      code: ZodIssueCode.invalid_type,
      expected: ZodParsedType.bigint,
      received: ctx.parsedType
    });
    return INVALID;
  }
  gte(value, message2) {
    return this.setLimit("min", value, true, errorUtil.toString(message2));
  }
  gt(value, message2) {
    return this.setLimit("min", value, false, errorUtil.toString(message2));
  }
  lte(value, message2) {
    return this.setLimit("max", value, true, errorUtil.toString(message2));
  }
  lt(value, message2) {
    return this.setLimit("max", value, false, errorUtil.toString(message2));
  }
  setLimit(kind, value, inclusive, message2) {
    return new _ZodBigInt({
      ...this._def,
      checks: [
        ...this._def.checks,
        {
          kind,
          value,
          inclusive,
          message: errorUtil.toString(message2)
        }
      ]
    });
  }
  _addCheck(check) {
    return new _ZodBigInt({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  positive(message2) {
    return this._addCheck({
      kind: "min",
      value: BigInt(0),
      inclusive: false,
      message: errorUtil.toString(message2)
    });
  }
  negative(message2) {
    return this._addCheck({
      kind: "max",
      value: BigInt(0),
      inclusive: false,
      message: errorUtil.toString(message2)
    });
  }
  nonpositive(message2) {
    return this._addCheck({
      kind: "max",
      value: BigInt(0),
      inclusive: true,
      message: errorUtil.toString(message2)
    });
  }
  nonnegative(message2) {
    return this._addCheck({
      kind: "min",
      value: BigInt(0),
      inclusive: true,
      message: errorUtil.toString(message2)
    });
  }
  multipleOf(value, message2) {
    return this._addCheck({
      kind: "multipleOf",
      value,
      message: errorUtil.toString(message2)
    });
  }
  get minValue() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxValue() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
};
ZodBigInt.create = (params) => {
  return new ZodBigInt({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodBigInt,
    coerce: params?.coerce ?? false,
    ...processCreateParams(params)
  });
};
var ZodBoolean = class extends ZodType {
  _parse(input) {
    if (this._def.coerce) {
      input.data = Boolean(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.boolean) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.boolean,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodBoolean.create = (params) => {
  return new ZodBoolean({
    typeName: ZodFirstPartyTypeKind.ZodBoolean,
    coerce: params?.coerce || false,
    ...processCreateParams(params)
  });
};
var ZodDate = class _ZodDate extends ZodType {
  _parse(input) {
    if (this._def.coerce) {
      input.data = new Date(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.date) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.date,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    if (Number.isNaN(input.data.getTime())) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_date
      });
      return INVALID;
    }
    const status = new ParseStatus();
    let ctx = void 0;
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        if (input.data.getTime() < check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            message: check.message,
            inclusive: true,
            exact: false,
            minimum: check.value,
            type: "date"
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        if (input.data.getTime() > check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            message: check.message,
            inclusive: true,
            exact: false,
            maximum: check.value,
            type: "date"
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return {
      status: status.value,
      value: new Date(input.data.getTime())
    };
  }
  _addCheck(check) {
    return new _ZodDate({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  min(minDate, message2) {
    return this._addCheck({
      kind: "min",
      value: minDate.getTime(),
      message: errorUtil.toString(message2)
    });
  }
  max(maxDate, message2) {
    return this._addCheck({
      kind: "max",
      value: maxDate.getTime(),
      message: errorUtil.toString(message2)
    });
  }
  get minDate() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min != null ? new Date(min) : null;
  }
  get maxDate() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max != null ? new Date(max) : null;
  }
};
ZodDate.create = (params) => {
  return new ZodDate({
    checks: [],
    coerce: params?.coerce || false,
    typeName: ZodFirstPartyTypeKind.ZodDate,
    ...processCreateParams(params)
  });
};
var ZodSymbol = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.symbol) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.symbol,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodSymbol.create = (params) => {
  return new ZodSymbol({
    typeName: ZodFirstPartyTypeKind.ZodSymbol,
    ...processCreateParams(params)
  });
};
var ZodUndefined = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.undefined) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.undefined,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodUndefined.create = (params) => {
  return new ZodUndefined({
    typeName: ZodFirstPartyTypeKind.ZodUndefined,
    ...processCreateParams(params)
  });
};
var ZodNull = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.null) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.null,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodNull.create = (params) => {
  return new ZodNull({
    typeName: ZodFirstPartyTypeKind.ZodNull,
    ...processCreateParams(params)
  });
};
var ZodAny = class extends ZodType {
  constructor() {
    super(...arguments);
    this._any = true;
  }
  _parse(input) {
    return OK(input.data);
  }
};
ZodAny.create = (params) => {
  return new ZodAny({
    typeName: ZodFirstPartyTypeKind.ZodAny,
    ...processCreateParams(params)
  });
};
var ZodUnknown = class extends ZodType {
  constructor() {
    super(...arguments);
    this._unknown = true;
  }
  _parse(input) {
    return OK(input.data);
  }
};
ZodUnknown.create = (params) => {
  return new ZodUnknown({
    typeName: ZodFirstPartyTypeKind.ZodUnknown,
    ...processCreateParams(params)
  });
};
var ZodNever = class extends ZodType {
  _parse(input) {
    const ctx = this._getOrReturnCtx(input);
    addIssueToContext(ctx, {
      code: ZodIssueCode.invalid_type,
      expected: ZodParsedType.never,
      received: ctx.parsedType
    });
    return INVALID;
  }
};
ZodNever.create = (params) => {
  return new ZodNever({
    typeName: ZodFirstPartyTypeKind.ZodNever,
    ...processCreateParams(params)
  });
};
var ZodVoid = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.undefined) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.void,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodVoid.create = (params) => {
  return new ZodVoid({
    typeName: ZodFirstPartyTypeKind.ZodVoid,
    ...processCreateParams(params)
  });
};
var ZodArray = class _ZodArray extends ZodType {
  _parse(input) {
    const { ctx, status } = this._processInputParams(input);
    const def = this._def;
    if (ctx.parsedType !== ZodParsedType.array) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.array,
        received: ctx.parsedType
      });
      return INVALID;
    }
    if (def.exactLength !== null) {
      const tooBig = ctx.data.length > def.exactLength.value;
      const tooSmall = ctx.data.length < def.exactLength.value;
      if (tooBig || tooSmall) {
        addIssueToContext(ctx, {
          code: tooBig ? ZodIssueCode.too_big : ZodIssueCode.too_small,
          minimum: tooSmall ? def.exactLength.value : void 0,
          maximum: tooBig ? def.exactLength.value : void 0,
          type: "array",
          inclusive: true,
          exact: true,
          message: def.exactLength.message
        });
        status.dirty();
      }
    }
    if (def.minLength !== null) {
      if (ctx.data.length < def.minLength.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_small,
          minimum: def.minLength.value,
          type: "array",
          inclusive: true,
          exact: false,
          message: def.minLength.message
        });
        status.dirty();
      }
    }
    if (def.maxLength !== null) {
      if (ctx.data.length > def.maxLength.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_big,
          maximum: def.maxLength.value,
          type: "array",
          inclusive: true,
          exact: false,
          message: def.maxLength.message
        });
        status.dirty();
      }
    }
    if (ctx.common.async) {
      return Promise.all([...ctx.data].map((item, i) => {
        return def.type._parseAsync(new ParseInputLazyPath(ctx, item, ctx.path, i));
      })).then((result2) => {
        return ParseStatus.mergeArray(status, result2);
      });
    }
    const result = [...ctx.data].map((item, i) => {
      return def.type._parseSync(new ParseInputLazyPath(ctx, item, ctx.path, i));
    });
    return ParseStatus.mergeArray(status, result);
  }
  get element() {
    return this._def.type;
  }
  min(minLength, message2) {
    return new _ZodArray({
      ...this._def,
      minLength: { value: minLength, message: errorUtil.toString(message2) }
    });
  }
  max(maxLength, message2) {
    return new _ZodArray({
      ...this._def,
      maxLength: { value: maxLength, message: errorUtil.toString(message2) }
    });
  }
  length(len, message2) {
    return new _ZodArray({
      ...this._def,
      exactLength: { value: len, message: errorUtil.toString(message2) }
    });
  }
  nonempty(message2) {
    return this.min(1, message2);
  }
};
ZodArray.create = (schema, params) => {
  return new ZodArray({
    type: schema,
    minLength: null,
    maxLength: null,
    exactLength: null,
    typeName: ZodFirstPartyTypeKind.ZodArray,
    ...processCreateParams(params)
  });
};
function deepPartialify(schema) {
  if (schema instanceof ZodObject) {
    const newShape = {};
    for (const key in schema.shape) {
      const fieldSchema = schema.shape[key];
      newShape[key] = ZodOptional.create(deepPartialify(fieldSchema));
    }
    return new ZodObject({
      ...schema._def,
      shape: () => newShape
    });
  } else if (schema instanceof ZodArray) {
    return new ZodArray({
      ...schema._def,
      type: deepPartialify(schema.element)
    });
  } else if (schema instanceof ZodOptional) {
    return ZodOptional.create(deepPartialify(schema.unwrap()));
  } else if (schema instanceof ZodNullable) {
    return ZodNullable.create(deepPartialify(schema.unwrap()));
  } else if (schema instanceof ZodTuple) {
    return ZodTuple.create(schema.items.map((item) => deepPartialify(item)));
  } else {
    return schema;
  }
}
var ZodObject = class _ZodObject extends ZodType {
  constructor() {
    super(...arguments);
    this._cached = null;
    this.nonstrict = this.passthrough;
    this.augment = this.extend;
  }
  _getCached() {
    if (this._cached !== null)
      return this._cached;
    const shape = this._def.shape();
    const keys = util.objectKeys(shape);
    this._cached = { shape, keys };
    return this._cached;
  }
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.object) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    const { status, ctx } = this._processInputParams(input);
    const { shape, keys: shapeKeys } = this._getCached();
    const extraKeys = [];
    if (!(this._def.catchall instanceof ZodNever && this._def.unknownKeys === "strip")) {
      for (const key in ctx.data) {
        if (!shapeKeys.includes(key)) {
          extraKeys.push(key);
        }
      }
    }
    const pairs = [];
    for (const key of shapeKeys) {
      const keyValidator = shape[key];
      const value = ctx.data[key];
      pairs.push({
        key: { status: "valid", value: key },
        value: keyValidator._parse(new ParseInputLazyPath(ctx, value, ctx.path, key)),
        alwaysSet: key in ctx.data
      });
    }
    if (this._def.catchall instanceof ZodNever) {
      const unknownKeys = this._def.unknownKeys;
      if (unknownKeys === "passthrough") {
        for (const key of extraKeys) {
          pairs.push({
            key: { status: "valid", value: key },
            value: { status: "valid", value: ctx.data[key] }
          });
        }
      } else if (unknownKeys === "strict") {
        if (extraKeys.length > 0) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.unrecognized_keys,
            keys: extraKeys
          });
          status.dirty();
        }
      } else if (unknownKeys === "strip") {
      } else {
        throw new Error(`Internal ZodObject error: invalid unknownKeys value.`);
      }
    } else {
      const catchall = this._def.catchall;
      for (const key of extraKeys) {
        const value = ctx.data[key];
        pairs.push({
          key: { status: "valid", value: key },
          value: catchall._parse(
            new ParseInputLazyPath(ctx, value, ctx.path, key)
            //, ctx.child(key), value, getParsedType(value)
          ),
          alwaysSet: key in ctx.data
        });
      }
    }
    if (ctx.common.async) {
      return Promise.resolve().then(async () => {
        const syncPairs = [];
        for (const pair of pairs) {
          const key = await pair.key;
          const value = await pair.value;
          syncPairs.push({
            key,
            value,
            alwaysSet: pair.alwaysSet
          });
        }
        return syncPairs;
      }).then((syncPairs) => {
        return ParseStatus.mergeObjectSync(status, syncPairs);
      });
    } else {
      return ParseStatus.mergeObjectSync(status, pairs);
    }
  }
  get shape() {
    return this._def.shape();
  }
  strict(message2) {
    errorUtil.errToObj;
    return new _ZodObject({
      ...this._def,
      unknownKeys: "strict",
      ...message2 !== void 0 ? {
        errorMap: (issue, ctx) => {
          const defaultError = this._def.errorMap?.(issue, ctx).message ?? ctx.defaultError;
          if (issue.code === "unrecognized_keys")
            return {
              message: errorUtil.errToObj(message2).message ?? defaultError
            };
          return {
            message: defaultError
          };
        }
      } : {}
    });
  }
  strip() {
    return new _ZodObject({
      ...this._def,
      unknownKeys: "strip"
    });
  }
  passthrough() {
    return new _ZodObject({
      ...this._def,
      unknownKeys: "passthrough"
    });
  }
  // const AugmentFactory =
  //   <Def extends ZodObjectDef>(def: Def) =>
  //   <Augmentation extends ZodRawShape>(
  //     augmentation: Augmentation
  //   ): ZodObject<
  //     extendShape<ReturnType<Def["shape"]>, Augmentation>,
  //     Def["unknownKeys"],
  //     Def["catchall"]
  //   > => {
  //     return new ZodObject({
  //       ...def,
  //       shape: () => ({
  //         ...def.shape(),
  //         ...augmentation,
  //       }),
  //     }) as any;
  //   };
  extend(augmentation) {
    return new _ZodObject({
      ...this._def,
      shape: () => ({
        ...this._def.shape(),
        ...augmentation
      })
    });
  }
  /**
   * Prior to zod@1.0.12 there was a bug in the
   * inferred type of merged objects. Please
   * upgrade if you are experiencing issues.
   */
  merge(merging) {
    const merged = new _ZodObject({
      unknownKeys: merging._def.unknownKeys,
      catchall: merging._def.catchall,
      shape: () => ({
        ...this._def.shape(),
        ...merging._def.shape()
      }),
      typeName: ZodFirstPartyTypeKind.ZodObject
    });
    return merged;
  }
  // merge<
  //   Incoming extends AnyZodObject,
  //   Augmentation extends Incoming["shape"],
  //   NewOutput extends {
  //     [k in keyof Augmentation | keyof Output]: k extends keyof Augmentation
  //       ? Augmentation[k]["_output"]
  //       : k extends keyof Output
  //       ? Output[k]
  //       : never;
  //   },
  //   NewInput extends {
  //     [k in keyof Augmentation | keyof Input]: k extends keyof Augmentation
  //       ? Augmentation[k]["_input"]
  //       : k extends keyof Input
  //       ? Input[k]
  //       : never;
  //   }
  // >(
  //   merging: Incoming
  // ): ZodObject<
  //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
  //   Incoming["_def"]["unknownKeys"],
  //   Incoming["_def"]["catchall"],
  //   NewOutput,
  //   NewInput
  // > {
  //   const merged: any = new ZodObject({
  //     unknownKeys: merging._def.unknownKeys,
  //     catchall: merging._def.catchall,
  //     shape: () =>
  //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
  //     typeName: ZodFirstPartyTypeKind.ZodObject,
  //   }) as any;
  //   return merged;
  // }
  setKey(key, schema) {
    return this.augment({ [key]: schema });
  }
  // merge<Incoming extends AnyZodObject>(
  //   merging: Incoming
  // ): //ZodObject<T & Incoming["_shape"], UnknownKeys, Catchall> = (merging) => {
  // ZodObject<
  //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
  //   Incoming["_def"]["unknownKeys"],
  //   Incoming["_def"]["catchall"]
  // > {
  //   // const mergedShape = objectUtil.mergeShapes(
  //   //   this._def.shape(),
  //   //   merging._def.shape()
  //   // );
  //   const merged: any = new ZodObject({
  //     unknownKeys: merging._def.unknownKeys,
  //     catchall: merging._def.catchall,
  //     shape: () =>
  //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
  //     typeName: ZodFirstPartyTypeKind.ZodObject,
  //   }) as any;
  //   return merged;
  // }
  catchall(index) {
    return new _ZodObject({
      ...this._def,
      catchall: index
    });
  }
  pick(mask) {
    const shape = {};
    for (const key of util.objectKeys(mask)) {
      if (mask[key] && this.shape[key]) {
        shape[key] = this.shape[key];
      }
    }
    return new _ZodObject({
      ...this._def,
      shape: () => shape
    });
  }
  omit(mask) {
    const shape = {};
    for (const key of util.objectKeys(this.shape)) {
      if (!mask[key]) {
        shape[key] = this.shape[key];
      }
    }
    return new _ZodObject({
      ...this._def,
      shape: () => shape
    });
  }
  /**
   * @deprecated
   */
  deepPartial() {
    return deepPartialify(this);
  }
  partial(mask) {
    const newShape = {};
    for (const key of util.objectKeys(this.shape)) {
      const fieldSchema = this.shape[key];
      if (mask && !mask[key]) {
        newShape[key] = fieldSchema;
      } else {
        newShape[key] = fieldSchema.optional();
      }
    }
    return new _ZodObject({
      ...this._def,
      shape: () => newShape
    });
  }
  required(mask) {
    const newShape = {};
    for (const key of util.objectKeys(this.shape)) {
      if (mask && !mask[key]) {
        newShape[key] = this.shape[key];
      } else {
        const fieldSchema = this.shape[key];
        let newField = fieldSchema;
        while (newField instanceof ZodOptional) {
          newField = newField._def.innerType;
        }
        newShape[key] = newField;
      }
    }
    return new _ZodObject({
      ...this._def,
      shape: () => newShape
    });
  }
  keyof() {
    return createZodEnum(util.objectKeys(this.shape));
  }
};
ZodObject.create = (shape, params) => {
  return new ZodObject({
    shape: () => shape,
    unknownKeys: "strip",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};
ZodObject.strictCreate = (shape, params) => {
  return new ZodObject({
    shape: () => shape,
    unknownKeys: "strict",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};
ZodObject.lazycreate = (shape, params) => {
  return new ZodObject({
    shape,
    unknownKeys: "strip",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};
var ZodUnion = class extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const options = this._def.options;
    function handleResults(results) {
      for (const result of results) {
        if (result.result.status === "valid") {
          return result.result;
        }
      }
      for (const result of results) {
        if (result.result.status === "dirty") {
          ctx.common.issues.push(...result.ctx.common.issues);
          return result.result;
        }
      }
      const unionErrors = results.map((result) => new ZodError(result.ctx.common.issues));
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union,
        unionErrors
      });
      return INVALID;
    }
    if (ctx.common.async) {
      return Promise.all(options.map(async (option) => {
        const childCtx = {
          ...ctx,
          common: {
            ...ctx.common,
            issues: []
          },
          parent: null
        };
        return {
          result: await option._parseAsync({
            data: ctx.data,
            path: ctx.path,
            parent: childCtx
          }),
          ctx: childCtx
        };
      })).then(handleResults);
    } else {
      let dirty = void 0;
      const issues = [];
      for (const option of options) {
        const childCtx = {
          ...ctx,
          common: {
            ...ctx.common,
            issues: []
          },
          parent: null
        };
        const result = option._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: childCtx
        });
        if (result.status === "valid") {
          return result;
        } else if (result.status === "dirty" && !dirty) {
          dirty = { result, ctx: childCtx };
        }
        if (childCtx.common.issues.length) {
          issues.push(childCtx.common.issues);
        }
      }
      if (dirty) {
        ctx.common.issues.push(...dirty.ctx.common.issues);
        return dirty.result;
      }
      const unionErrors = issues.map((issues2) => new ZodError(issues2));
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union,
        unionErrors
      });
      return INVALID;
    }
  }
  get options() {
    return this._def.options;
  }
};
ZodUnion.create = (types2, params) => {
  return new ZodUnion({
    options: types2,
    typeName: ZodFirstPartyTypeKind.ZodUnion,
    ...processCreateParams(params)
  });
};
var getDiscriminator = (type) => {
  if (type instanceof ZodLazy) {
    return getDiscriminator(type.schema);
  } else if (type instanceof ZodEffects) {
    return getDiscriminator(type.innerType());
  } else if (type instanceof ZodLiteral) {
    return [type.value];
  } else if (type instanceof ZodEnum) {
    return type.options;
  } else if (type instanceof ZodNativeEnum) {
    return util.objectValues(type.enum);
  } else if (type instanceof ZodDefault) {
    return getDiscriminator(type._def.innerType);
  } else if (type instanceof ZodUndefined) {
    return [void 0];
  } else if (type instanceof ZodNull) {
    return [null];
  } else if (type instanceof ZodOptional) {
    return [void 0, ...getDiscriminator(type.unwrap())];
  } else if (type instanceof ZodNullable) {
    return [null, ...getDiscriminator(type.unwrap())];
  } else if (type instanceof ZodBranded) {
    return getDiscriminator(type.unwrap());
  } else if (type instanceof ZodReadonly) {
    return getDiscriminator(type.unwrap());
  } else if (type instanceof ZodCatch) {
    return getDiscriminator(type._def.innerType);
  } else {
    return [];
  }
};
var ZodDiscriminatedUnion = class _ZodDiscriminatedUnion extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.object) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const discriminator = this.discriminator;
    const discriminatorValue = ctx.data[discriminator];
    const option = this.optionsMap.get(discriminatorValue);
    if (!option) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union_discriminator,
        options: Array.from(this.optionsMap.keys()),
        path: [discriminator]
      });
      return INVALID;
    }
    if (ctx.common.async) {
      return option._parseAsync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      });
    } else {
      return option._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      });
    }
  }
  get discriminator() {
    return this._def.discriminator;
  }
  get options() {
    return this._def.options;
  }
  get optionsMap() {
    return this._def.optionsMap;
  }
  /**
   * The constructor of the discriminated union schema. Its behaviour is very similar to that of the normal z.union() constructor.
   * However, it only allows a union of objects, all of which need to share a discriminator property. This property must
   * have a different value for each object in the union.
   * @param discriminator the name of the discriminator property
   * @param types an array of object schemas
   * @param params
   */
  static create(discriminator, options, params) {
    const optionsMap = /* @__PURE__ */ new Map();
    for (const type of options) {
      const discriminatorValues = getDiscriminator(type.shape[discriminator]);
      if (!discriminatorValues.length) {
        throw new Error(`A discriminator value for key \`${discriminator}\` could not be extracted from all schema options`);
      }
      for (const value of discriminatorValues) {
        if (optionsMap.has(value)) {
          throw new Error(`Discriminator property ${String(discriminator)} has duplicate value ${String(value)}`);
        }
        optionsMap.set(value, type);
      }
    }
    return new _ZodDiscriminatedUnion({
      typeName: ZodFirstPartyTypeKind.ZodDiscriminatedUnion,
      discriminator,
      options,
      optionsMap,
      ...processCreateParams(params)
    });
  }
};
function mergeValues(a, b) {
  const aType = getParsedType(a);
  const bType = getParsedType(b);
  if (a === b) {
    return { valid: true, data: a };
  } else if (aType === ZodParsedType.object && bType === ZodParsedType.object) {
    const bKeys = util.objectKeys(b);
    const sharedKeys = util.objectKeys(a).filter((key) => bKeys.indexOf(key) !== -1);
    const newObj = { ...a, ...b };
    for (const key of sharedKeys) {
      const sharedValue = mergeValues(a[key], b[key]);
      if (!sharedValue.valid) {
        return { valid: false };
      }
      newObj[key] = sharedValue.data;
    }
    return { valid: true, data: newObj };
  } else if (aType === ZodParsedType.array && bType === ZodParsedType.array) {
    if (a.length !== b.length) {
      return { valid: false };
    }
    const newArray = [];
    for (let index = 0; index < a.length; index++) {
      const itemA = a[index];
      const itemB = b[index];
      const sharedValue = mergeValues(itemA, itemB);
      if (!sharedValue.valid) {
        return { valid: false };
      }
      newArray.push(sharedValue.data);
    }
    return { valid: true, data: newArray };
  } else if (aType === ZodParsedType.date && bType === ZodParsedType.date && +a === +b) {
    return { valid: true, data: a };
  } else {
    return { valid: false };
  }
}
var ZodIntersection = class extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    const handleParsed = (parsedLeft, parsedRight) => {
      if (isAborted(parsedLeft) || isAborted(parsedRight)) {
        return INVALID;
      }
      const merged = mergeValues(parsedLeft.value, parsedRight.value);
      if (!merged.valid) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_intersection_types
        });
        return INVALID;
      }
      if (isDirty(parsedLeft) || isDirty(parsedRight)) {
        status.dirty();
      }
      return { status: status.value, value: merged.data };
    };
    if (ctx.common.async) {
      return Promise.all([
        this._def.left._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        }),
        this._def.right._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        })
      ]).then(([left, right]) => handleParsed(left, right));
    } else {
      return handleParsed(this._def.left._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      }), this._def.right._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      }));
    }
  }
};
ZodIntersection.create = (left, right, params) => {
  return new ZodIntersection({
    left,
    right,
    typeName: ZodFirstPartyTypeKind.ZodIntersection,
    ...processCreateParams(params)
  });
};
var ZodTuple = class _ZodTuple extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.array) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.array,
        received: ctx.parsedType
      });
      return INVALID;
    }
    if (ctx.data.length < this._def.items.length) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.too_small,
        minimum: this._def.items.length,
        inclusive: true,
        exact: false,
        type: "array"
      });
      return INVALID;
    }
    const rest = this._def.rest;
    if (!rest && ctx.data.length > this._def.items.length) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.too_big,
        maximum: this._def.items.length,
        inclusive: true,
        exact: false,
        type: "array"
      });
      status.dirty();
    }
    const items = [...ctx.data].map((item, itemIndex) => {
      const schema = this._def.items[itemIndex] || this._def.rest;
      if (!schema)
        return null;
      return schema._parse(new ParseInputLazyPath(ctx, item, ctx.path, itemIndex));
    }).filter((x) => !!x);
    if (ctx.common.async) {
      return Promise.all(items).then((results) => {
        return ParseStatus.mergeArray(status, results);
      });
    } else {
      return ParseStatus.mergeArray(status, items);
    }
  }
  get items() {
    return this._def.items;
  }
  rest(rest) {
    return new _ZodTuple({
      ...this._def,
      rest
    });
  }
};
ZodTuple.create = (schemas, params) => {
  if (!Array.isArray(schemas)) {
    throw new Error("You must pass an array of schemas to z.tuple([ ... ])");
  }
  return new ZodTuple({
    items: schemas,
    typeName: ZodFirstPartyTypeKind.ZodTuple,
    rest: null,
    ...processCreateParams(params)
  });
};
var ZodRecord = class _ZodRecord extends ZodType {
  get keySchema() {
    return this._def.keyType;
  }
  get valueSchema() {
    return this._def.valueType;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.object) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const pairs = [];
    const keyType = this._def.keyType;
    const valueType = this._def.valueType;
    for (const key in ctx.data) {
      pairs.push({
        key: keyType._parse(new ParseInputLazyPath(ctx, key, ctx.path, key)),
        value: valueType._parse(new ParseInputLazyPath(ctx, ctx.data[key], ctx.path, key)),
        alwaysSet: key in ctx.data
      });
    }
    if (ctx.common.async) {
      return ParseStatus.mergeObjectAsync(status, pairs);
    } else {
      return ParseStatus.mergeObjectSync(status, pairs);
    }
  }
  get element() {
    return this._def.valueType;
  }
  static create(first, second, third) {
    if (second instanceof ZodType) {
      return new _ZodRecord({
        keyType: first,
        valueType: second,
        typeName: ZodFirstPartyTypeKind.ZodRecord,
        ...processCreateParams(third)
      });
    }
    return new _ZodRecord({
      keyType: ZodString.create(),
      valueType: first,
      typeName: ZodFirstPartyTypeKind.ZodRecord,
      ...processCreateParams(second)
    });
  }
};
var ZodMap = class extends ZodType {
  get keySchema() {
    return this._def.keyType;
  }
  get valueSchema() {
    return this._def.valueType;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.map) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.map,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const keyType = this._def.keyType;
    const valueType = this._def.valueType;
    const pairs = [...ctx.data.entries()].map(([key, value], index) => {
      return {
        key: keyType._parse(new ParseInputLazyPath(ctx, key, ctx.path, [index, "key"])),
        value: valueType._parse(new ParseInputLazyPath(ctx, value, ctx.path, [index, "value"]))
      };
    });
    if (ctx.common.async) {
      const finalMap = /* @__PURE__ */ new Map();
      return Promise.resolve().then(async () => {
        for (const pair of pairs) {
          const key = await pair.key;
          const value = await pair.value;
          if (key.status === "aborted" || value.status === "aborted") {
            return INVALID;
          }
          if (key.status === "dirty" || value.status === "dirty") {
            status.dirty();
          }
          finalMap.set(key.value, value.value);
        }
        return { status: status.value, value: finalMap };
      });
    } else {
      const finalMap = /* @__PURE__ */ new Map();
      for (const pair of pairs) {
        const key = pair.key;
        const value = pair.value;
        if (key.status === "aborted" || value.status === "aborted") {
          return INVALID;
        }
        if (key.status === "dirty" || value.status === "dirty") {
          status.dirty();
        }
        finalMap.set(key.value, value.value);
      }
      return { status: status.value, value: finalMap };
    }
  }
};
ZodMap.create = (keyType, valueType, params) => {
  return new ZodMap({
    valueType,
    keyType,
    typeName: ZodFirstPartyTypeKind.ZodMap,
    ...processCreateParams(params)
  });
};
var ZodSet = class _ZodSet extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.set) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.set,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const def = this._def;
    if (def.minSize !== null) {
      if (ctx.data.size < def.minSize.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_small,
          minimum: def.minSize.value,
          type: "set",
          inclusive: true,
          exact: false,
          message: def.minSize.message
        });
        status.dirty();
      }
    }
    if (def.maxSize !== null) {
      if (ctx.data.size > def.maxSize.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_big,
          maximum: def.maxSize.value,
          type: "set",
          inclusive: true,
          exact: false,
          message: def.maxSize.message
        });
        status.dirty();
      }
    }
    const valueType = this._def.valueType;
    function finalizeSet(elements2) {
      const parsedSet = /* @__PURE__ */ new Set();
      for (const element of elements2) {
        if (element.status === "aborted")
          return INVALID;
        if (element.status === "dirty")
          status.dirty();
        parsedSet.add(element.value);
      }
      return { status: status.value, value: parsedSet };
    }
    const elements = [...ctx.data.values()].map((item, i) => valueType._parse(new ParseInputLazyPath(ctx, item, ctx.path, i)));
    if (ctx.common.async) {
      return Promise.all(elements).then((elements2) => finalizeSet(elements2));
    } else {
      return finalizeSet(elements);
    }
  }
  min(minSize, message2) {
    return new _ZodSet({
      ...this._def,
      minSize: { value: minSize, message: errorUtil.toString(message2) }
    });
  }
  max(maxSize, message2) {
    return new _ZodSet({
      ...this._def,
      maxSize: { value: maxSize, message: errorUtil.toString(message2) }
    });
  }
  size(size, message2) {
    return this.min(size, message2).max(size, message2);
  }
  nonempty(message2) {
    return this.min(1, message2);
  }
};
ZodSet.create = (valueType, params) => {
  return new ZodSet({
    valueType,
    minSize: null,
    maxSize: null,
    typeName: ZodFirstPartyTypeKind.ZodSet,
    ...processCreateParams(params)
  });
};
var ZodFunction = class _ZodFunction extends ZodType {
  constructor() {
    super(...arguments);
    this.validate = this.implement;
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.function) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.function,
        received: ctx.parsedType
      });
      return INVALID;
    }
    function makeArgsIssue(args, error) {
      return makeIssue({
        data: args,
        path: ctx.path,
        errorMaps: [ctx.common.contextualErrorMap, ctx.schemaErrorMap, getErrorMap(), en_default].filter((x) => !!x),
        issueData: {
          code: ZodIssueCode.invalid_arguments,
          argumentsError: error
        }
      });
    }
    function makeReturnsIssue(returns, error) {
      return makeIssue({
        data: returns,
        path: ctx.path,
        errorMaps: [ctx.common.contextualErrorMap, ctx.schemaErrorMap, getErrorMap(), en_default].filter((x) => !!x),
        issueData: {
          code: ZodIssueCode.invalid_return_type,
          returnTypeError: error
        }
      });
    }
    const params = { errorMap: ctx.common.contextualErrorMap };
    const fn = ctx.data;
    if (this._def.returns instanceof ZodPromise) {
      const me = this;
      return OK(async function(...args) {
        const error = new ZodError([]);
        const parsedArgs = await me._def.args.parseAsync(args, params).catch((e) => {
          error.addIssue(makeArgsIssue(args, e));
          throw error;
        });
        const result = await Reflect.apply(fn, this, parsedArgs);
        const parsedReturns = await me._def.returns._def.type.parseAsync(result, params).catch((e) => {
          error.addIssue(makeReturnsIssue(result, e));
          throw error;
        });
        return parsedReturns;
      });
    } else {
      const me = this;
      return OK(function(...args) {
        const parsedArgs = me._def.args.safeParse(args, params);
        if (!parsedArgs.success) {
          throw new ZodError([makeArgsIssue(args, parsedArgs.error)]);
        }
        const result = Reflect.apply(fn, this, parsedArgs.data);
        const parsedReturns = me._def.returns.safeParse(result, params);
        if (!parsedReturns.success) {
          throw new ZodError([makeReturnsIssue(result, parsedReturns.error)]);
        }
        return parsedReturns.data;
      });
    }
  }
  parameters() {
    return this._def.args;
  }
  returnType() {
    return this._def.returns;
  }
  args(...items) {
    return new _ZodFunction({
      ...this._def,
      args: ZodTuple.create(items).rest(ZodUnknown.create())
    });
  }
  returns(returnType) {
    return new _ZodFunction({
      ...this._def,
      returns: returnType
    });
  }
  implement(func) {
    const validatedFunc = this.parse(func);
    return validatedFunc;
  }
  strictImplement(func) {
    const validatedFunc = this.parse(func);
    return validatedFunc;
  }
  static create(args, returns, params) {
    return new _ZodFunction({
      args: args ? args : ZodTuple.create([]).rest(ZodUnknown.create()),
      returns: returns || ZodUnknown.create(),
      typeName: ZodFirstPartyTypeKind.ZodFunction,
      ...processCreateParams(params)
    });
  }
};
var ZodLazy = class extends ZodType {
  get schema() {
    return this._def.getter();
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const lazySchema = this._def.getter();
    return lazySchema._parse({ data: ctx.data, path: ctx.path, parent: ctx });
  }
};
ZodLazy.create = (getter, params) => {
  return new ZodLazy({
    getter,
    typeName: ZodFirstPartyTypeKind.ZodLazy,
    ...processCreateParams(params)
  });
};
var ZodLiteral = class extends ZodType {
  _parse(input) {
    if (input.data !== this._def.value) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_literal,
        expected: this._def.value
      });
      return INVALID;
    }
    return { status: "valid", value: input.data };
  }
  get value() {
    return this._def.value;
  }
};
ZodLiteral.create = (value, params) => {
  return new ZodLiteral({
    value,
    typeName: ZodFirstPartyTypeKind.ZodLiteral,
    ...processCreateParams(params)
  });
};
function createZodEnum(values, params) {
  return new ZodEnum({
    values,
    typeName: ZodFirstPartyTypeKind.ZodEnum,
    ...processCreateParams(params)
  });
}
var ZodEnum = class _ZodEnum extends ZodType {
  _parse(input) {
    if (typeof input.data !== "string") {
      const ctx = this._getOrReturnCtx(input);
      const expectedValues = this._def.values;
      addIssueToContext(ctx, {
        expected: util.joinValues(expectedValues),
        received: ctx.parsedType,
        code: ZodIssueCode.invalid_type
      });
      return INVALID;
    }
    if (!this._cache) {
      this._cache = new Set(this._def.values);
    }
    if (!this._cache.has(input.data)) {
      const ctx = this._getOrReturnCtx(input);
      const expectedValues = this._def.values;
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_enum_value,
        options: expectedValues
      });
      return INVALID;
    }
    return OK(input.data);
  }
  get options() {
    return this._def.values;
  }
  get enum() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  get Values() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  get Enum() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  extract(values, newDef = this._def) {
    return _ZodEnum.create(values, {
      ...this._def,
      ...newDef
    });
  }
  exclude(values, newDef = this._def) {
    return _ZodEnum.create(this.options.filter((opt) => !values.includes(opt)), {
      ...this._def,
      ...newDef
    });
  }
};
ZodEnum.create = createZodEnum;
var ZodNativeEnum = class extends ZodType {
  _parse(input) {
    const nativeEnumValues = util.getValidEnumValues(this._def.values);
    const ctx = this._getOrReturnCtx(input);
    if (ctx.parsedType !== ZodParsedType.string && ctx.parsedType !== ZodParsedType.number) {
      const expectedValues = util.objectValues(nativeEnumValues);
      addIssueToContext(ctx, {
        expected: util.joinValues(expectedValues),
        received: ctx.parsedType,
        code: ZodIssueCode.invalid_type
      });
      return INVALID;
    }
    if (!this._cache) {
      this._cache = new Set(util.getValidEnumValues(this._def.values));
    }
    if (!this._cache.has(input.data)) {
      const expectedValues = util.objectValues(nativeEnumValues);
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_enum_value,
        options: expectedValues
      });
      return INVALID;
    }
    return OK(input.data);
  }
  get enum() {
    return this._def.values;
  }
};
ZodNativeEnum.create = (values, params) => {
  return new ZodNativeEnum({
    values,
    typeName: ZodFirstPartyTypeKind.ZodNativeEnum,
    ...processCreateParams(params)
  });
};
var ZodPromise = class extends ZodType {
  unwrap() {
    return this._def.type;
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.promise && ctx.common.async === false) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.promise,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const promisified = ctx.parsedType === ZodParsedType.promise ? ctx.data : Promise.resolve(ctx.data);
    return OK(promisified.then((data) => {
      return this._def.type.parseAsync(data, {
        path: ctx.path,
        errorMap: ctx.common.contextualErrorMap
      });
    }));
  }
};
ZodPromise.create = (schema, params) => {
  return new ZodPromise({
    type: schema,
    typeName: ZodFirstPartyTypeKind.ZodPromise,
    ...processCreateParams(params)
  });
};
var ZodEffects = class extends ZodType {
  innerType() {
    return this._def.schema;
  }
  sourceType() {
    return this._def.schema._def.typeName === ZodFirstPartyTypeKind.ZodEffects ? this._def.schema.sourceType() : this._def.schema;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    const effect = this._def.effect || null;
    const checkCtx = {
      addIssue: (arg) => {
        addIssueToContext(ctx, arg);
        if (arg.fatal) {
          status.abort();
        } else {
          status.dirty();
        }
      },
      get path() {
        return ctx.path;
      }
    };
    checkCtx.addIssue = checkCtx.addIssue.bind(checkCtx);
    if (effect.type === "preprocess") {
      const processed = effect.transform(ctx.data, checkCtx);
      if (ctx.common.async) {
        return Promise.resolve(processed).then(async (processed2) => {
          if (status.value === "aborted")
            return INVALID;
          const result = await this._def.schema._parseAsync({
            data: processed2,
            path: ctx.path,
            parent: ctx
          });
          if (result.status === "aborted")
            return INVALID;
          if (result.status === "dirty")
            return DIRTY(result.value);
          if (status.value === "dirty")
            return DIRTY(result.value);
          return result;
        });
      } else {
        if (status.value === "aborted")
          return INVALID;
        const result = this._def.schema._parseSync({
          data: processed,
          path: ctx.path,
          parent: ctx
        });
        if (result.status === "aborted")
          return INVALID;
        if (result.status === "dirty")
          return DIRTY(result.value);
        if (status.value === "dirty")
          return DIRTY(result.value);
        return result;
      }
    }
    if (effect.type === "refinement") {
      const executeRefinement = (acc) => {
        const result = effect.refinement(acc, checkCtx);
        if (ctx.common.async) {
          return Promise.resolve(result);
        }
        if (result instanceof Promise) {
          throw new Error("Async refinement encountered during synchronous parse operation. Use .parseAsync instead.");
        }
        return acc;
      };
      if (ctx.common.async === false) {
        const inner = this._def.schema._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (inner.status === "aborted")
          return INVALID;
        if (inner.status === "dirty")
          status.dirty();
        executeRefinement(inner.value);
        return { status: status.value, value: inner.value };
      } else {
        return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((inner) => {
          if (inner.status === "aborted")
            return INVALID;
          if (inner.status === "dirty")
            status.dirty();
          return executeRefinement(inner.value).then(() => {
            return { status: status.value, value: inner.value };
          });
        });
      }
    }
    if (effect.type === "transform") {
      if (ctx.common.async === false) {
        const base = this._def.schema._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (!isValid(base))
          return INVALID;
        const result = effect.transform(base.value, checkCtx);
        if (result instanceof Promise) {
          throw new Error(`Asynchronous transform encountered during synchronous parse operation. Use .parseAsync instead.`);
        }
        return { status: status.value, value: result };
      } else {
        return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((base) => {
          if (!isValid(base))
            return INVALID;
          return Promise.resolve(effect.transform(base.value, checkCtx)).then((result) => ({
            status: status.value,
            value: result
          }));
        });
      }
    }
    util.assertNever(effect);
  }
};
ZodEffects.create = (schema, effect, params) => {
  return new ZodEffects({
    schema,
    typeName: ZodFirstPartyTypeKind.ZodEffects,
    effect,
    ...processCreateParams(params)
  });
};
ZodEffects.createWithPreprocess = (preprocess, schema, params) => {
  return new ZodEffects({
    schema,
    effect: { type: "preprocess", transform: preprocess },
    typeName: ZodFirstPartyTypeKind.ZodEffects,
    ...processCreateParams(params)
  });
};
var ZodOptional = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType === ZodParsedType.undefined) {
      return OK(void 0);
    }
    return this._def.innerType._parse(input);
  }
  unwrap() {
    return this._def.innerType;
  }
};
ZodOptional.create = (type, params) => {
  return new ZodOptional({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodOptional,
    ...processCreateParams(params)
  });
};
var ZodNullable = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType === ZodParsedType.null) {
      return OK(null);
    }
    return this._def.innerType._parse(input);
  }
  unwrap() {
    return this._def.innerType;
  }
};
ZodNullable.create = (type, params) => {
  return new ZodNullable({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodNullable,
    ...processCreateParams(params)
  });
};
var ZodDefault = class extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    let data = ctx.data;
    if (ctx.parsedType === ZodParsedType.undefined) {
      data = this._def.defaultValue();
    }
    return this._def.innerType._parse({
      data,
      path: ctx.path,
      parent: ctx
    });
  }
  removeDefault() {
    return this._def.innerType;
  }
};
ZodDefault.create = (type, params) => {
  return new ZodDefault({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodDefault,
    defaultValue: typeof params.default === "function" ? params.default : () => params.default,
    ...processCreateParams(params)
  });
};
var ZodCatch = class extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const newCtx = {
      ...ctx,
      common: {
        ...ctx.common,
        issues: []
      }
    };
    const result = this._def.innerType._parse({
      data: newCtx.data,
      path: newCtx.path,
      parent: {
        ...newCtx
      }
    });
    if (isAsync(result)) {
      return result.then((result2) => {
        return {
          status: "valid",
          value: result2.status === "valid" ? result2.value : this._def.catchValue({
            get error() {
              return new ZodError(newCtx.common.issues);
            },
            input: newCtx.data
          })
        };
      });
    } else {
      return {
        status: "valid",
        value: result.status === "valid" ? result.value : this._def.catchValue({
          get error() {
            return new ZodError(newCtx.common.issues);
          },
          input: newCtx.data
        })
      };
    }
  }
  removeCatch() {
    return this._def.innerType;
  }
};
ZodCatch.create = (type, params) => {
  return new ZodCatch({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodCatch,
    catchValue: typeof params.catch === "function" ? params.catch : () => params.catch,
    ...processCreateParams(params)
  });
};
var ZodNaN = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.nan) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.nan,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return { status: "valid", value: input.data };
  }
};
ZodNaN.create = (params) => {
  return new ZodNaN({
    typeName: ZodFirstPartyTypeKind.ZodNaN,
    ...processCreateParams(params)
  });
};
var BRAND = /* @__PURE__ */ Symbol("zod_brand");
var ZodBranded = class extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const data = ctx.data;
    return this._def.type._parse({
      data,
      path: ctx.path,
      parent: ctx
    });
  }
  unwrap() {
    return this._def.type;
  }
};
var ZodPipeline = class _ZodPipeline extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.common.async) {
      const handleAsync = async () => {
        const inResult = await this._def.in._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (inResult.status === "aborted")
          return INVALID;
        if (inResult.status === "dirty") {
          status.dirty();
          return DIRTY(inResult.value);
        } else {
          return this._def.out._parseAsync({
            data: inResult.value,
            path: ctx.path,
            parent: ctx
          });
        }
      };
      return handleAsync();
    } else {
      const inResult = this._def.in._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      });
      if (inResult.status === "aborted")
        return INVALID;
      if (inResult.status === "dirty") {
        status.dirty();
        return {
          status: "dirty",
          value: inResult.value
        };
      } else {
        return this._def.out._parseSync({
          data: inResult.value,
          path: ctx.path,
          parent: ctx
        });
      }
    }
  }
  static create(a, b) {
    return new _ZodPipeline({
      in: a,
      out: b,
      typeName: ZodFirstPartyTypeKind.ZodPipeline
    });
  }
};
var ZodReadonly = class extends ZodType {
  _parse(input) {
    const result = this._def.innerType._parse(input);
    const freeze = (data) => {
      if (isValid(data)) {
        data.value = Object.freeze(data.value);
      }
      return data;
    };
    return isAsync(result) ? result.then((data) => freeze(data)) : freeze(result);
  }
  unwrap() {
    return this._def.innerType;
  }
};
ZodReadonly.create = (type, params) => {
  return new ZodReadonly({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodReadonly,
    ...processCreateParams(params)
  });
};
function cleanParams(params, data) {
  const p = typeof params === "function" ? params(data) : typeof params === "string" ? { message: params } : params;
  const p2 = typeof p === "string" ? { message: p } : p;
  return p2;
}
function custom(check, _params = {}, fatal) {
  if (check)
    return ZodAny.create().superRefine((data, ctx) => {
      const r = check(data);
      if (r instanceof Promise) {
        return r.then((r2) => {
          if (!r2) {
            const params = cleanParams(_params, data);
            const _fatal = params.fatal ?? fatal ?? true;
            ctx.addIssue({ code: "custom", ...params, fatal: _fatal });
          }
        });
      }
      if (!r) {
        const params = cleanParams(_params, data);
        const _fatal = params.fatal ?? fatal ?? true;
        ctx.addIssue({ code: "custom", ...params, fatal: _fatal });
      }
      return;
    });
  return ZodAny.create();
}
var late = {
  object: ZodObject.lazycreate
};
var ZodFirstPartyTypeKind;
(function(ZodFirstPartyTypeKind2) {
  ZodFirstPartyTypeKind2["ZodString"] = "ZodString";
  ZodFirstPartyTypeKind2["ZodNumber"] = "ZodNumber";
  ZodFirstPartyTypeKind2["ZodNaN"] = "ZodNaN";
  ZodFirstPartyTypeKind2["ZodBigInt"] = "ZodBigInt";
  ZodFirstPartyTypeKind2["ZodBoolean"] = "ZodBoolean";
  ZodFirstPartyTypeKind2["ZodDate"] = "ZodDate";
  ZodFirstPartyTypeKind2["ZodSymbol"] = "ZodSymbol";
  ZodFirstPartyTypeKind2["ZodUndefined"] = "ZodUndefined";
  ZodFirstPartyTypeKind2["ZodNull"] = "ZodNull";
  ZodFirstPartyTypeKind2["ZodAny"] = "ZodAny";
  ZodFirstPartyTypeKind2["ZodUnknown"] = "ZodUnknown";
  ZodFirstPartyTypeKind2["ZodNever"] = "ZodNever";
  ZodFirstPartyTypeKind2["ZodVoid"] = "ZodVoid";
  ZodFirstPartyTypeKind2["ZodArray"] = "ZodArray";
  ZodFirstPartyTypeKind2["ZodObject"] = "ZodObject";
  ZodFirstPartyTypeKind2["ZodUnion"] = "ZodUnion";
  ZodFirstPartyTypeKind2["ZodDiscriminatedUnion"] = "ZodDiscriminatedUnion";
  ZodFirstPartyTypeKind2["ZodIntersection"] = "ZodIntersection";
  ZodFirstPartyTypeKind2["ZodTuple"] = "ZodTuple";
  ZodFirstPartyTypeKind2["ZodRecord"] = "ZodRecord";
  ZodFirstPartyTypeKind2["ZodMap"] = "ZodMap";
  ZodFirstPartyTypeKind2["ZodSet"] = "ZodSet";
  ZodFirstPartyTypeKind2["ZodFunction"] = "ZodFunction";
  ZodFirstPartyTypeKind2["ZodLazy"] = "ZodLazy";
  ZodFirstPartyTypeKind2["ZodLiteral"] = "ZodLiteral";
  ZodFirstPartyTypeKind2["ZodEnum"] = "ZodEnum";
  ZodFirstPartyTypeKind2["ZodEffects"] = "ZodEffects";
  ZodFirstPartyTypeKind2["ZodNativeEnum"] = "ZodNativeEnum";
  ZodFirstPartyTypeKind2["ZodOptional"] = "ZodOptional";
  ZodFirstPartyTypeKind2["ZodNullable"] = "ZodNullable";
  ZodFirstPartyTypeKind2["ZodDefault"] = "ZodDefault";
  ZodFirstPartyTypeKind2["ZodCatch"] = "ZodCatch";
  ZodFirstPartyTypeKind2["ZodPromise"] = "ZodPromise";
  ZodFirstPartyTypeKind2["ZodBranded"] = "ZodBranded";
  ZodFirstPartyTypeKind2["ZodPipeline"] = "ZodPipeline";
  ZodFirstPartyTypeKind2["ZodReadonly"] = "ZodReadonly";
})(ZodFirstPartyTypeKind || (ZodFirstPartyTypeKind = {}));
var instanceOfType = (cls, params = {
  message: `Input not instance of ${cls.name}`
}) => custom((data) => data instanceof cls, params);
var stringType = ZodString.create;
var numberType = ZodNumber.create;
var nanType = ZodNaN.create;
var bigIntType = ZodBigInt.create;
var booleanType = ZodBoolean.create;
var dateType = ZodDate.create;
var symbolType = ZodSymbol.create;
var undefinedType = ZodUndefined.create;
var nullType = ZodNull.create;
var anyType = ZodAny.create;
var unknownType = ZodUnknown.create;
var neverType = ZodNever.create;
var voidType = ZodVoid.create;
var arrayType = ZodArray.create;
var objectType = ZodObject.create;
var strictObjectType = ZodObject.strictCreate;
var unionType = ZodUnion.create;
var discriminatedUnionType = ZodDiscriminatedUnion.create;
var intersectionType = ZodIntersection.create;
var tupleType = ZodTuple.create;
var recordType = ZodRecord.create;
var mapType = ZodMap.create;
var setType = ZodSet.create;
var functionType = ZodFunction.create;
var lazyType = ZodLazy.create;
var literalType = ZodLiteral.create;
var enumType = ZodEnum.create;
var nativeEnumType = ZodNativeEnum.create;
var promiseType = ZodPromise.create;
var effectsType = ZodEffects.create;
var optionalType = ZodOptional.create;
var nullableType = ZodNullable.create;
var preprocessType = ZodEffects.createWithPreprocess;
var pipelineType = ZodPipeline.create;
var ostring = () => stringType().optional();
var onumber = () => numberType().optional();
var oboolean = () => booleanType().optional();
var coerce = {
  string: ((arg) => ZodString.create({ ...arg, coerce: true })),
  number: ((arg) => ZodNumber.create({ ...arg, coerce: true })),
  boolean: ((arg) => ZodBoolean.create({
    ...arg,
    coerce: true
  })),
  bigint: ((arg) => ZodBigInt.create({ ...arg, coerce: true })),
  date: ((arg) => ZodDate.create({ ...arg, coerce: true }))
};
var NEVER = INVALID;

// ../../packages/domain-finance/src/errors.ts
function createFinanceDomainError(code, message2, context) {
  const error = new Error(message2);
  Object.defineProperty(error, "name", { value: "FinanceDomainError", enumerable: true });
  Object.defineProperty(error, "code", { value: code, enumerable: true });
  Object.defineProperty(error, "context", { value: context, enumerable: true });
  return error;
}
function raiseFinanceDomainError(code, message2, context) {
  throw createFinanceDomainError(code, message2, context);
}

// ../../packages/domain-finance/src/money.ts
var EOF_MONEY_SCALE = 2;
var ERH_MONEY_SCALE = 10;
var eofMoney = {
  scale: EOF_MONEY_SCALE,
  roundingMode: "HALF_UP",
  parse: parseEofMoney,
  format: formatEofMoney,
  add,
  sub,
  mulByRatio: mulByRatioEof,
  applyDecimalFactor: applyDecimalFactorEof,
  percentage: percentageEof,
  mulScaled: mulScaledEof,
  divScaled: divScaledEof
};
var erhMoney = {
  scale: ERH_MONEY_SCALE,
  roundingMode: "TRUNCATE",
  parse: parseErhMoney,
  format: formatErhMoney,
  add,
  sub,
  mulByRatio: mulByRatioErh,
  applyDecimalFactor: applyDecimalFactorErh,
  percentage: percentageErh,
  mulScaled: mulScaledErh,
  divScaled: divScaledErh
};
function parse(value, scale, mode) {
  return parseDecimalToUnits(value, {
    scale,
    roundingMode: mode,
    maximumFractionDigits: null,
    invalidCode: "decimal_invalid"
  });
}
function format(units, scale) {
  return formatScaledUnits(units, scale);
}
function add(left, right) {
  return left + right;
}
function sub(left, right) {
  return left - right;
}
function roundRatioHalfUp(numerator, denominator) {
  assertPositiveDenominator(denominator);
  const sign = numerator < 0n ? -1n : 1n;
  const absoluteNumerator = numerator < 0n ? -numerator : numerator;
  return sign * ((absoluteNumerator + denominator / 2n) / denominator);
}
function mulByRatio(units, numerator, denominator, mode) {
  assertPositiveDenominator(denominator);
  return roundQuotient(units * numerator, denominator, mode);
}
function applyDecimalFactor(units, factorText, mode) {
  const factor = parseDecimalFactor(factorText, 12, "decimal_invalid");
  return mulByRatio(units, factor.units, factor.scale, mode);
}
function percentage(units, percentageText, mode) {
  const factor = parseDecimalFactor(percentageText, 12, "decimal_invalid");
  return mulByRatio(units, factor.units, factor.scale * 100n, mode);
}
function mulScaled(left, right, scale, mode) {
  return mulByRatio(left, right, scaleFactor(scale), mode);
}
function divScaled(left, right, scale, mode) {
  if (right === 0n) {
    raiseFinanceDomainError("money_ratio_invalid", "Scaled division denominator must not be zero.", {
      left: left.toString(),
      right: right.toString(),
      scale: String(scale)
    });
  }
  const scaleMultiplier = scaleFactor(scale);
  if (right < 0n) {
    return roundQuotient(-(left * scaleMultiplier), -right, mode);
  }
  return roundQuotient(left * scaleMultiplier, right, mode);
}
function formatScaledUnits(units, scale) {
  if (!Number.isSafeInteger(scale) || scale < 0) {
    raiseFinanceDomainError("decimal_scale_invalid", "Decimal format scale must be a non-negative safe integer.", {
      scale: String(scale)
    });
  }
  if (scale === 0) {
    return units.toString();
  }
  const negative = units < 0n;
  const absoluteText = (negative ? -units : units).toString().padStart(scale + 1, "0");
  const wholeText = absoluteText.slice(0, absoluteText.length - scale);
  const fractionText = absoluteText.slice(absoluteText.length - scale);
  return `${negative ? "-" : ""}${wholeText}.${fractionText}`;
}
function parseEofMoney(value) {
  return parseDecimalToUnits(value, {
    scale: EOF_MONEY_SCALE,
    roundingMode: "HALF_UP",
    maximumFractionDigits: 12,
    invalidCode: "decimal_invalid"
  });
}
function parseErhMoney(value) {
  return parseDecimalToUnits(value, {
    scale: ERH_MONEY_SCALE,
    roundingMode: "TRUNCATE",
    maximumFractionDigits: null,
    invalidCode: "decimal_invalid"
  });
}
function formatEofMoney(units) {
  return formatScaledUnits(units, EOF_MONEY_SCALE);
}
function formatErhMoney(units) {
  return formatScaledUnits(units, ERH_MONEY_SCALE);
}
function mulByRatioEof(units, numerator, denominator) {
  return mulByRatio(units, numerator, denominator, "HALF_UP");
}
function mulByRatioErh(units, numerator, denominator) {
  return mulByRatio(units, numerator, denominator, "TRUNCATE");
}
function applyDecimalFactorEof(units, factor) {
  return applyDecimalFactor(units, factor, "HALF_UP");
}
function applyDecimalFactorErh(units, factor) {
  return applyDecimalFactor(units, factor, "TRUNCATE");
}
function percentageEof(units, percentageText) {
  return percentage(units, percentageText, "HALF_UP");
}
function percentageErh(units, percentageText) {
  return percentage(units, percentageText, "TRUNCATE");
}
function mulScaledEof(left, right) {
  return mulScaled(left, right, EOF_MONEY_SCALE, "HALF_UP");
}
function mulScaledErh(left, right) {
  return mulScaled(left, right, ERH_MONEY_SCALE, "TRUNCATE");
}
function divScaledEof(left, right) {
  return divScaled(left, right, EOF_MONEY_SCALE, "HALF_UP");
}
function divScaledErh(left, right) {
  return divScaled(left, right, ERH_MONEY_SCALE, "TRUNCATE");
}
function parseDecimalToUnits(value, options) {
  const parsed = parseDecimalText(value, options.invalidCode);
  if (options.maximumFractionDigits !== null && parsed.fractionText.length > options.maximumFractionDigits) {
    raiseFinanceDomainError("decimal_scale_invalid", "Decimal value has more fractional digits than this boundary allows.", {
      decimalValue: value,
      maximumFractionDigits: String(options.maximumFractionDigits),
      actualFractionDigits: String(parsed.fractionText.length)
    });
  }
  assertScale(options.scale);
  if (parsed.fractionText.length <= options.scale) {
    const paddedFraction = parsed.fractionText.padEnd(options.scale, "0");
    return parsed.sign * BigInt(`${parsed.wholeText}${paddedFraction}`);
  }
  const rawUnits = parsed.sign * BigInt(`${parsed.wholeText}${parsed.fractionText}`);
  const excessScale = parsed.fractionText.length - options.scale;
  return roundQuotient(rawUnits, scaleFactor(excessScale), options.roundingMode);
}
function parseDecimalFactor(value, maximumFractionDigits, invalidCode) {
  const parsed = parseDecimalText(value, invalidCode);
  if (parsed.fractionText.length > maximumFractionDigits) {
    raiseFinanceDomainError("decimal_scale_invalid", "Decimal factor has more fractional digits than this boundary allows.", {
      decimalValue: value,
      maximumFractionDigits: String(maximumFractionDigits),
      actualFractionDigits: String(parsed.fractionText.length)
    });
  }
  const units = parsed.sign * BigInt(`${parsed.wholeText}${parsed.fractionText}`);
  const denominator = parsed.fractionText.length === 0 ? 1n : scaleFactor(parsed.fractionText.length);
  return {
    units,
    scale: denominator,
    normalized: parsed.normalized
  };
}
function parseDecimalText(value, invalidCode) {
  if (typeof value !== "string") {
    raiseFinanceDomainError(invalidCode, "Decimal value must be provided as a string.", {
      valueType: typeof value
    });
  }
  const sanitized = value.replaceAll(",", "");
  const match2 = /^([+-]?)(\d+)(?:\.(\d+))?$/.exec(sanitized);
  if (match2 === null) {
    raiseFinanceDomainError(invalidCode, "Decimal value must be a plain decimal string.", {
      decimalValue: value
    });
  }
  const signText = match2[1] ?? "";
  const wholeText = match2[2] ?? "";
  const fractionText = match2[3] ?? "";
  const sign = signText === "-" ? -1n : 1n;
  const normalized = `${signText === "-" ? "-" : ""}${wholeText}${fractionText.length === 0 ? "" : `.${fractionText}`}`;
  return {
    sign,
    wholeText,
    fractionText,
    normalized
  };
}
function roundQuotient(numerator, denominator, mode) {
  assertPositiveDenominator(denominator);
  if (mode === "HALF_UP") {
    return roundRatioHalfUp(numerator, denominator);
  }
  if (mode === "TRUNCATE") {
    const sign = numerator < 0n ? -1n : 1n;
    const absoluteNumerator = numerator < 0n ? -numerator : numerator;
    return sign * (absoluteNumerator / denominator);
  }
  raiseFinanceDomainError("money_ratio_invalid", "Unknown money rounding mode.", {
    mode
  });
}
function assertPositiveDenominator(denominator) {
  if (denominator <= 0n) {
    raiseFinanceDomainError("money_ratio_invalid", "Ratio denominator must be greater than zero.", {
      denominator: denominator.toString()
    });
  }
}
function assertScale(scale) {
  if (!Number.isSafeInteger(scale) || scale < 0) {
    raiseFinanceDomainError("decimal_scale_invalid", "Money scale must be a non-negative safe integer.", {
      scale: String(scale)
    });
  }
}
function scaleFactor(scale) {
  assertScale(scale);
  return 10n ** BigInt(scale);
}

// ../../packages/domain-finance/src/schemas.ts
var todoMessage = "TODO(domain-finance): replace Zod placeholder after schema approval.";
var moneyAmountSchema = external_exports.custom((input) => {
  throw new Error(todoMessage);
});
var basisPointShareSchema = external_exports.custom((input) => {
  throw new Error(todoMessage);
});
var ledgerTransactionSchema = external_exports.custom((input) => {
  throw new Error(todoMessage);
});
var expenseSchema = external_exports.custom((input) => {
  throw new Error(todoMessage);
});
var allocationLineSchema = external_exports.custom((input) => {
  throw new Error(todoMessage);
});
var reconciliationResultSchema = external_exports.custom((input) => {
  throw new Error(todoMessage);
});

// ../../packages/domain-distribution/src/allocation.ts
var PERCENTAGE_SCALE = 6;
var PERCENTAGE_ONE_HUNDRED_UNITS = 100000000n;
function buildAllocationPlan(earning, rules, costState) {
  const split = splitRoyaltyShares(earning, rules);
  if ("suspense" in split) {
    return split;
  }
  const appliedByTerm = buildAppliedByTerm(costState.expenseApplications);
  const parsedCostTerms = costState.costTerms.map(parseCostTerm);
  const allocations = [];
  const expenseApplications = [];
  const costTermStatusUpdates = /* @__PURE__ */ new Map();
  const grossAmountUnits = parseErhAmount(earning.grossAmount);
  const referenceDate = resolveReferenceDate(earning);
  for (const share of split) {
    const missingFxCurrency = findMissingFxCurrency(share, parsedCostTerms, appliedByTerm, costState.fxRates, earning.currency, referenceDate);
    if (missingFxCurrency !== null) {
      return {
        suspense: {
          earningId: earning.id,
          amount: formatErhAmount(grossAmountUnits),
          currency: earning.currency,
          reasonCode: "missing_fx_rate",
          message: `Missing recoupment FX rate from ${missingFxCurrency} to ${earning.currency} for ${referenceDate}.`
        }
      };
    }
    const recoupment = applyRecoupmentForShare(earning, share, parsedCostTerms, appliedByTerm);
    for (const application of recoupment.expenseApplications) {
      expenseApplications.push(application);
    }
    for (const update of recoupment.costTermStatusUpdates) {
      costTermStatusUpdates.set(update.id, update);
    }
    allocations.push({
      earningId: earning.id,
      calculationRunId: earning.calculationRunId,
      payeeId: share.rule.payeeId,
      contractId: share.rule.contractId,
      trackId: earning.trackId,
      royaltyRuleId: share.rule.royaltyRuleId,
      artistId: share.rule.artistId,
      role: share.rule.role,
      grossAmount: formatErhAmount(grossAmountUnits),
      originalGrossAmount: formatErhAmount(grossAmountUnits),
      fxRate: "1.0000000000",
      grossShare: formatErhAmount(share.grossShareUnits),
      recoupmentApplied: formatErhAmount(recoupment.recoupmentAppliedUnits),
      netPayable: formatErhAmount(recoupment.netPayableUnits),
      splitPercentage: formatPercentage(share.rule.percentageUnits),
      currency: earning.currency,
      originalCurrency: earning.currency,
      status: "preview"
    });
  }
  return {
    allocations,
    expenseApplications,
    costTermStatusUpdates: [...costTermStatusUpdates.values()]
  };
}
function splitRoyaltyShares(earning, rules) {
  const orderedRules = rules.map(parseRoyaltyRule).sort(compareRuleById);
  const percentageTotal = orderedRules.reduce((sum, rule) => sum + rule.percentageUnits, 0n);
  if (percentageTotal !== PERCENTAGE_ONE_HUNDRED_UNITS) {
    return {
      suspense: {
        earningId: earning.id,
        amount: formatErhAmount(parseErhAmount(earning.grossAmount)),
        currency: earning.currency,
        reasonCode: "invalid_split",
        message: `Royalty split must equal 100.000000, got ${formatPercentage(percentageTotal)}.`
      }
    };
  }
  const grossAmountUnits = parseErhAmount(earning.grossAmount);
  const shareUnits = splitRemainderLastScale6Percentages(grossAmountUnits, orderedRules.map((rule) => rule.percentageUnits));
  return orderedRules.map((rule, index) => ({
    rule,
    grossShareUnits: requireShareUnit(shareUnits, index, rule.royaltyRuleId)
  }));
}
function applyRecoupmentForShare(earning, share, costTerms, appliedByTerm) {
  if (share.rule.role === "label" || share.rule.contractId === null) {
    return emptyRecoupment(share.grossShareUnits);
  }
  const eligibleTerms = findEligibleSameCurrencyCostTerms(share.rule.contractId, share.rule.payeeId, earning.currency, costTerms);
  const recoupableRemaining = sumRemainingCostTerms(eligibleTerms, appliedByTerm);
  if (recoupableRemaining <= 0n) {
    return emptyRecoupment(share.grossShareUnits);
  }
  const recoupmentAppliedUnits = minUnits(recoupableRemaining, share.grossShareUnits);
  const netPayableUnits = erhMoney.sub(share.grossShareUnits, recoupmentAppliedUnits);
  if (recoupmentAppliedUnits <= 0n) {
    return {
      recoupmentAppliedUnits,
      netPayableUnits,
      expenseApplications: [],
      costTermStatusUpdates: []
    };
  }
  return distributeRecoupment(earning, share.rule.payeeId, eligibleTerms, appliedByTerm, recoupmentAppliedUnits, netPayableUnits);
}
function distributeRecoupment(earning, payeeId, terms, appliedByTerm, recoupmentAppliedUnits, netPayableUnits) {
  const expenseApplications = [];
  const costTermStatusUpdates = [];
  let remainingToApply = recoupmentAppliedUnits;
  for (const term of [...terms].sort(compareCostTermByFifo)) {
    if (remainingToApply <= 0n) {
      break;
    }
    const termRemaining = remainingForTerm(term, appliedByTerm);
    if (termRemaining <= 0n) {
      continue;
    }
    const chunk = minUnits(remainingToApply, termRemaining);
    const previousApplied = appliedByTerm.get(term.id) ?? 0n;
    const nextApplied = erhMoney.add(previousApplied, chunk);
    appliedByTerm.set(term.id, nextApplied);
    remainingToApply = erhMoney.sub(remainingToApply, chunk);
    expenseApplications.push({
      costTermId: term.id,
      payeeId,
      amountApplied: formatErhAmount(chunk),
      currency: earning.currency,
      calculationRunId: earning.calculationRunId
    });
    costTermStatusUpdates.push({
      id: term.id,
      status: nextApplied >= term.amountUnits ? "recovered" : "partially_recovered"
    });
  }
  return {
    recoupmentAppliedUnits,
    netPayableUnits,
    expenseApplications,
    costTermStatusUpdates
  };
}
function findMissingFxCurrency(share, costTerms, appliedByTerm, fxRates, earningCurrency, referenceDate) {
  if (share.rule.role === "label" || share.rule.contractId === null) {
    return null;
  }
  const foreignTerms = costTerms.filter(
    (term) => term.contractId === share.rule.contractId && term.recoupable && isOpenForFxGate(term.status) && term.currency !== earningCurrency && payeeScopeMatches(term.payeeId, share.rule.payeeId) && remainingForTerm(term, appliedByTerm) > 0n
  );
  const missingTerm = foreignTerms.find((term) => !hasFxRate(fxRates, term.currency, earningCurrency, referenceDate));
  return missingTerm?.currency ?? null;
}
function findEligibleSameCurrencyCostTerms(contractId, payeeId, currency, costTerms) {
  return costTerms.filter(
    (term) => term.contractId === contractId && term.recoupable && term.status !== "deleted" && term.status !== "non_recoverable" && term.currency === currency && payeeScopeMatches(term.payeeId, payeeId)
  );
}
function sumRemainingCostTerms(terms, appliedByTerm) {
  return terms.reduce((sum, term) => {
    const remaining = remainingForTerm(term, appliedByTerm);
    return remaining > 0n ? erhMoney.add(sum, remaining) : sum;
  }, 0n);
}
function remainingForTerm(term, appliedByTerm) {
  return erhMoney.sub(term.amountUnits, appliedByTerm.get(term.id) ?? 0n);
}
function splitRemainderLastScale6Percentages(totalUnits, percentageUnits) {
  const parts = [];
  let allocated = 0n;
  for (let index = 0; index < percentageUnits.length - 1; index += 1) {
    const part = erhMoney.mulByRatio(totalUnits, requirePercentageUnit(percentageUnits, index), PERCENTAGE_ONE_HUNDRED_UNITS);
    parts.push(part);
    allocated = erhMoney.add(allocated, part);
  }
  parts.push(erhMoney.sub(totalUnits, allocated));
  return parts;
}
function buildAppliedByTerm(expenseApplications) {
  const appliedByTerm = /* @__PURE__ */ new Map();
  for (const application of expenseApplications) {
    const current = appliedByTerm.get(application.costTermId) ?? 0n;
    appliedByTerm.set(application.costTermId, erhMoney.add(current, parseErhAmount(application.amountApplied)));
  }
  return appliedByTerm;
}
function parseRoyaltyRule(rule) {
  return {
    contractId: rule.contractId,
    royaltyRuleId: rule.royaltyRuleId,
    payeeId: rule.payeeId,
    artistId: rule.artistId,
    role: rule.role,
    percentageUnits: parsePercentage(rule.percentage)
  };
}
function parseCostTerm(term) {
  return {
    id: term.id,
    contractId: term.contractId,
    payeeId: term.payeeId,
    amountUnits: parseErhAmount(term.amount),
    currency: term.currency,
    recoupable: term.recoupable,
    status: term.status,
    expenseDate: term.expenseDate
  };
}
function parseErhAmount(value) {
  return erhMoney.parse(value);
}
function formatErhAmount(value) {
  return erhMoney.format(value);
}
function parsePercentage(value) {
  return parse(value, PERCENTAGE_SCALE, "TRUNCATE");
}
function formatPercentage(value) {
  return format(value, PERCENTAGE_SCALE);
}
function resolveReferenceDate(earning) {
  return earning.saleDate ?? earning.periodEnd ?? earning.periodStart ?? earning.today;
}
function payeeScopeMatches(termPayeeId, sharePayeeId) {
  return termPayeeId === null || termPayeeId === "0" || termPayeeId === sharePayeeId;
}
function hasFxRate(fxRates, fromCurrency, toCurrency, referenceDate) {
  return fxRates.some((rate) => rate.fromCurrency === fromCurrency && rate.toCurrency === toCurrency && rate.effectiveDate === referenceDate);
}
function isOpenForFxGate(status) {
  return status !== "deleted" && status !== "recovered" && status !== "non_recoverable" && status !== "satisfied" && status !== "cancelled";
}
function compareRuleById(left, right) {
  return left.royaltyRuleId.localeCompare(right.royaltyRuleId);
}
function compareCostTermByFifo(left, right) {
  const dateOrder = left.expenseDate.localeCompare(right.expenseDate);
  return dateOrder === 0 ? left.id.localeCompare(right.id) : dateOrder;
}
function minUnits(left, right) {
  return left <= right ? left : right;
}
function requirePercentageUnit(percentageUnits, index) {
  const unit = percentageUnits[index];
  if (unit === void 0) {
    throw new Error(`Missing royalty split percentage at index ${index}.`);
  }
  return unit;
}
function requireShareUnit(shareUnits, index, royaltyRuleId) {
  const unit = shareUnits[index];
  if (unit === void 0) {
    throw new Error(`Missing royalty share for rule ${royaltyRuleId}.`);
  }
  return unit;
}
function emptyRecoupment(grossShareUnits) {
  return {
    recoupmentAppliedUnits: 0n,
    netPayableUnits: grossShareUnits,
    expenseApplications: [],
    costTermStatusUpdates: []
  };
}

// ../../packages/domain-distribution/src/statements.ts
function computeCarry(opening, periodNet) {
  const openingUnits = parseErhAmount2(opening);
  const periodNetUnits = parseErhAmount2(periodNet);
  const availableUnits = erhMoney.add(openingUnits, periodNetUnits);
  const amountDueUnits = availableUnits > 0n ? availableUnits : 0n;
  const closingUnits = availableUnits < 0n ? availableUnits : 0n;
  return {
    opening: formatErhAmount2(openingUnits),
    periodNet: formatErhAmount2(periodNetUnits),
    available: formatErhAmount2(availableUnits),
    amountDue: formatErhAmount2(amountDueUnits),
    closing: formatErhAmount2(closingUnits)
  };
}
function buildStatementPlan(payee, period, currency, allocations, lastClosing, version2) {
  const periodAllocations = allocations.filter((allocation) => allocation.payeeId === payee.id && allocation.currency === currency);
  const totals = sumAllocations(currency, periodAllocations);
  const carry = computeCarry(lastClosing, formatErhAmount2(totals.netPayableUnits));
  return {
    statement: {
      payeeId: payee.id,
      periodStart: period.start,
      periodEnd: period.end,
      currency,
      grossTotal: formatErhAmount2(totals.grossTotalUnits),
      recoupmentTotal: formatErhAmount2(totals.recoupmentTotalUnits),
      netPayable: formatErhAmount2(totals.netPayableUnits),
      amountDue: carry.amountDue,
      version: version2,
      status: "generated"
    },
    lines: periodAllocations.map((allocation) => ({
      earningAllocationId: allocation.id,
      trackId: allocation.trackId,
      grossShare: formatErhAmount2(parseErhAmount2(allocation.grossShare)),
      recoupmentApplied: formatErhAmount2(parseErhAmount2(allocation.recoupmentApplied)),
      netPayable: formatErhAmount2(parseErhAmount2(allocation.netPayable)),
      quantity: allocation.quantity,
      currency
    })),
    balanceLedgerRow: {
      payeeId: payee.id,
      statementId: null,
      currency,
      openingBalance: carry.opening,
      periodNet: carry.periodNet,
      closingBalance: carry.closing,
      movementType: "statement"
    }
  };
}
function buildVoidPlan(statement, ledgerRow) {
  const reversalNetUnits = -parseErhAmount2(ledgerRow.periodNet);
  return {
    reversalLedgerRow: {
      payeeId: ledgerRow.payeeId,
      statementId: statement.id,
      currency: ledgerRow.currency,
      openingBalance: formatErhAmount2(parseErhAmount2(ledgerRow.closingBalance)),
      periodNet: formatErhAmount2(reversalNetUnits),
      closingBalance: formatErhAmount2(parseErhAmount2(ledgerRow.openingBalance)),
      movementType: "void_reversal"
    },
    statementStatusUpdate: {
      id: statement.id,
      status: "void"
    }
  };
}
function computeStatementBalance(statement, paymentLinks) {
  const paymentUnits = sumPaymentsForStatement(statement.id, statement.currency, paymentLinks);
  const amountDueUnits = parseErhAmount2(statement.amountDue);
  const balanceUnits = erhMoney.sub(amountDueUnits, paymentUnits);
  return {
    statementId: statement.id,
    currency: statement.currency,
    amountDue: formatErhAmount2(amountDueUnits),
    paymentsApplied: formatErhAmount2(paymentUnits),
    statementBalance: formatErhAmount2(balanceUnits)
  };
}
function computeStatementGroupTotals(statements, paymentLinks) {
  const totals = /* @__PURE__ */ new Map();
  for (const statement of statements) {
    const balance = computeStatementBalance(statement, paymentLinks);
    const current = totals.get(balance.currency) ?? 0n;
    totals.set(balance.currency, erhMoney.add(current, parseErhAmount2(balance.statementBalance)));
  }
  return [...totals.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([currency, units]) => ({
    currency,
    statementBalance: formatErhAmount2(units)
  }));
}
function sumAllocations(currency, allocations) {
  const accumulator = {
    currency,
    grossTotalUnits: 0n,
    recoupmentTotalUnits: 0n,
    netPayableUnits: 0n
  };
  for (const allocation of allocations) {
    accumulator.grossTotalUnits = erhMoney.add(accumulator.grossTotalUnits, parseErhAmount2(allocation.grossShare));
    accumulator.recoupmentTotalUnits = erhMoney.add(accumulator.recoupmentTotalUnits, parseErhAmount2(allocation.recoupmentApplied));
    accumulator.netPayableUnits = erhMoney.add(accumulator.netPayableUnits, parseErhAmount2(allocation.netPayable));
  }
  return accumulator;
}
function sumPaymentsForStatement(statementId, currency, paymentLinks) {
  return paymentLinks.filter((link) => link.statementId === statementId && link.currency === currency).reduce((sum, link) => erhMoney.add(sum, parseErhAmount2(link.amountApplied)), 0n);
}
function parseErhAmount2(value) {
  return erhMoney.parse(value);
}
function formatErhAmount2(value) {
  return erhMoney.format(value);
}

// ../../packages/domain-distribution/src/reads.ts
function readAllocationList(dataset, filters) {
  const resolved = resolveDataset(dataset);
  const rows = dataset.earningAllocations.filter((allocation) => filters.calculationRunId === null || allocation.calculationRunId === filters.calculationRunId).filter((allocation) => filters.payeeId === null || allocation.payeeId === filters.payeeId).filter((allocation) => filters.status === null || allocation.status === filters.status).map((allocation) => toAllocationReadRow(resolved, allocation));
  return {
    rows,
    totals: totalsByCurrency(
      rows.map((row) => ({
        currency: row.currency,
        amount: row.netPayable,
        grossShare: row.grossShare,
        recoupmentApplied: row.recoupmentApplied
      }))
    ).map((total) => ({
      currency: total.currency,
      grossShare: total.grossShare,
      recoupmentApplied: total.recoupmentApplied,
      netPayable: total.amount
    }))
  };
}
function readSuspense(dataset, filters) {
  const resolved = resolveDataset(dataset);
  const rows = dataset.suspenseItems.filter((item) => matchesSuspenseStatus(item, filters.status)).filter((item) => filters.reasonCode === null || item.reasonCode === filters.reasonCode).map((item) => toSuspenseReadRow(resolved, item));
  return {
    rows,
    groups: groupSuspenseRows(rows)
  };
}
function readStatementSummaries(dataset, filters) {
  const resolved = resolveDataset(dataset);
  const rows = dataset.statements.filter((statement) => filters.period === null || statement.periodStart.startsWith(filters.period) || statement.periodEnd.startsWith(filters.period)).filter((statement) => filters.payeeId === null || statement.payeeId === filters.payeeId).filter((statement) => filters.status === null || statement.status === filters.status).map((statement) => toStatementReadRow(dataset, resolved, statement));
  return {
    rows,
    totals: statementTotalsByCurrency(rows)
  };
}
function resolveDataset(dataset) {
  return {
    importBatchesById: new Map(dataset.importBatches.map((batch) => [batch.id, batch])),
    payeesById: new Map(dataset.payees.map((payee) => [payee.id, payee])),
    paymentsById: new Map(dataset.payments.map((payment) => [payment.id, payment])),
    tracksById: new Map(dataset.tracks.map((track) => [track.id, track])),
    earningsById: new Map(dataset.normalizedEarnings.map((earning) => [earning.id, earning]))
  };
}
function toAllocationReadRow(resolved, allocation) {
  const payee = requirePayee(resolved, allocation.payeeId);
  const track = allocation.trackId === null ? null : resolved.tracksById.get(allocation.trackId) ?? null;
  return {
    id: allocation.id,
    earningId: allocation.earningId,
    calculationRunId: allocation.calculationRunId,
    payeeId: allocation.payeeId,
    payeeName: payee.name,
    contractId: allocation.contractId,
    trackId: allocation.trackId,
    trackTitle: track?.title ?? null,
    grossAmount: formatErhAmount3(parseErhAmount3(allocation.grossAmount)),
    grossShare: formatErhAmount3(parseErhAmount3(allocation.grossShare)),
    recoupmentApplied: formatErhAmount3(parseErhAmount3(allocation.recoupmentApplied)),
    netPayable: formatErhAmount3(parseErhAmount3(allocation.netPayable)),
    splitPercentage: allocation.splitPercentage,
    currency: allocation.currency,
    status: allocation.status
  };
}
function toSuspenseReadRow(resolved, item) {
  const earning = item.earningId === null ? null : resolved.earningsById.get(item.earningId) ?? null;
  return {
    id: item.id,
    earningId: item.earningId,
    sourceReference: earning?.isrc ?? earning?.upc ?? item.id,
    amount: formatErhAmount3(parseErhAmount3(item.amount)),
    currency: item.currency,
    reasonCode: item.reasonCode,
    exactFixPath: fixPathForSuspenseReason(item.reasonCode),
    status: item.resolved ? "resolved" : "open",
    createdAt: item.createdAt
  };
}
function toStatementReadRow(dataset, resolved, statement) {
  const payee = requirePayee(resolved, statement.payeeId);
  const paymentLinks = statementPaymentInputs(dataset, resolved, statement.id, statement.currency);
  const balance = computeStatementBalance(
    {
      id: statement.id,
      currency: statement.currency,
      amountDue: statement.amountDue
    },
    paymentLinks
  );
  return {
    id: statement.id,
    payeeId: statement.payeeId,
    payeeName: payee.name,
    calculationRunId: statement.calculationRunId,
    periodStart: statement.periodStart,
    periodEnd: statement.periodEnd,
    currency: statement.currency,
    grossTotal: formatErhAmount3(parseErhAmount3(statement.grossTotal)),
    recoupmentTotal: formatErhAmount3(parseErhAmount3(statement.recoupmentTotal)),
    netPayable: formatErhAmount3(parseErhAmount3(statement.netPayable)),
    amountDue: balance.amountDue,
    paymentsApplied: balance.paymentsApplied,
    statementBalance: balance.statementBalance,
    lineCount: dataset.statementLines.filter((line) => line.statementId === statement.id).length,
    version: statement.version,
    status: statement.status
  };
}
function statementPaymentInputs(dataset, resolved, statementId, currency) {
  return dataset.statementPaymentLinks.filter((link) => link.statementId === statementId).map((link) => {
    const payment = requirePayment(resolved, link.paymentId);
    return {
      statementId,
      amountApplied: payment.status === "void" ? "0.0000000000" : link.amountApplied,
      currency: payment.currency
    };
  }).filter((link) => link.currency === currency);
}
function totalsByCurrency(rows) {
  const totals = /* @__PURE__ */ new Map();
  for (const row of rows) {
    const current = totals.get(row.currency) ?? { amountUnits: 0n, grossShareUnits: 0n, recoupmentAppliedUnits: 0n };
    current.amountUnits = erhMoney.add(current.amountUnits, parseErhAmount3(row.amount));
    current.grossShareUnits = erhMoney.add(current.grossShareUnits, parseErhAmount3(row.grossShare));
    current.recoupmentAppliedUnits = erhMoney.add(current.recoupmentAppliedUnits, parseErhAmount3(row.recoupmentApplied));
    totals.set(row.currency, current);
  }
  return [...totals.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([currency, total]) => ({
    currency,
    amount: formatErhAmount3(total.amountUnits),
    grossShare: formatErhAmount3(total.grossShareUnits),
    recoupmentApplied: formatErhAmount3(total.recoupmentAppliedUnits)
  }));
}
function groupSuspenseRows(rows) {
  const groups = /* @__PURE__ */ new Map();
  for (const row of rows) {
    const current = groups.get(row.reasonCode) ?? { count: 0, exactFixPath: row.exactFixPath, rows: [] };
    current.count += 1;
    current.rows.push(row);
    groups.set(row.reasonCode, current);
  }
  return [...groups.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([reasonCode, group]) => ({
    reasonCode,
    exactFixPath: group.exactFixPath,
    count: group.count,
    totals: suspenseTotalsByCurrency(group.rows)
  }));
}
function suspenseTotalsByCurrency(rows) {
  const totals = /* @__PURE__ */ new Map();
  for (const row of rows) {
    const current = totals.get(row.currency) ?? 0n;
    totals.set(row.currency, erhMoney.add(current, parseErhAmount3(row.amount)));
  }
  return [...totals.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([currency, amountUnits]) => ({
    currency,
    amount: formatErhAmount3(amountUnits)
  }));
}
function statementTotalsByCurrency(rows) {
  const totals = /* @__PURE__ */ new Map();
  for (const row of rows) {
    const current = totals.get(row.currency) ?? {
      grossTotalUnits: 0n,
      recoupmentTotalUnits: 0n,
      netPayableUnits: 0n,
      amountDueUnits: 0n,
      statementBalanceUnits: 0n
    };
    current.grossTotalUnits = erhMoney.add(current.grossTotalUnits, parseErhAmount3(row.grossTotal));
    current.recoupmentTotalUnits = erhMoney.add(current.recoupmentTotalUnits, parseErhAmount3(row.recoupmentTotal));
    current.netPayableUnits = erhMoney.add(current.netPayableUnits, parseErhAmount3(row.netPayable));
    current.amountDueUnits = erhMoney.add(current.amountDueUnits, parseErhAmount3(row.amountDue));
    current.statementBalanceUnits = erhMoney.add(current.statementBalanceUnits, parseErhAmount3(row.statementBalance));
    totals.set(row.currency, current);
  }
  return [...totals.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([currency, total]) => ({
    currency,
    grossTotal: formatErhAmount3(total.grossTotalUnits),
    recoupmentTotal: formatErhAmount3(total.recoupmentTotalUnits),
    netPayable: formatErhAmount3(total.netPayableUnits),
    amountDue: formatErhAmount3(total.amountDueUnits),
    statementBalance: formatErhAmount3(total.statementBalanceUnits)
  }));
}
function matchesSuspenseStatus(item, status) {
  if (status === null) {
    return true;
  }
  if (status === "resolved") {
    return item.resolved;
  }
  return !item.resolved;
}
function fixPathForSuspenseReason(reasonCode) {
  if (reasonCode === "invalid_split" || reasonCode === "missing_split") {
    return "contracts";
  }
  if (reasonCode === "unmapped_track") {
    return "mapping";
  }
  if (reasonCode === "import_retry") {
    return "imports";
  }
  return "catalog";
}
function requirePayee(resolved, payeeId) {
  const payee = resolved.payeesById.get(payeeId);
  if (payee === void 0) {
    throw new Error(`Distribution payee not found: ${payeeId}`);
  }
  return payee;
}
function requirePayment(resolved, paymentId) {
  const payment = resolved.paymentsById.get(paymentId);
  if (payment === void 0) {
    throw new Error(`Distribution payment not found: ${paymentId}`);
  }
  return payment;
}
function parseErhAmount3(value) {
  return erhMoney.parse(value);
}
function formatErhAmount3(value) {
  return erhMoney.format(value);
}

// ../../packages/domain-office/src/pl.ts
function readGlobalPnl(dataset, filters) {
  const transactions = filterLedgerTransactions(dataset.transactions, filters);
  return {
    ...formatAccumulator(sumTransactions(transactions), "global_ledger"),
    view: "global_ledger"
  };
}
function readDepartmentPnl(dataset, departmentId, filters) {
  const resolved = resolveDataset2(dataset);
  const department = requireDepartment(resolved, departmentId);
  const transactions = filterAllocationInputs(dataset, filters, {
    departmentId,
    projectId: null,
    partnerId: null
  });
  return {
    ...formatAccumulator(sumTransactionInputs(transactions), "department_allocated"),
    department: toDepartmentResponse(department),
    view: "department_allocated"
  };
}
function readProjectPnl(dataset, projectId, filters) {
  const resolved = resolveDataset2(dataset);
  const project = requireProject(resolved, projectId);
  const accumulator = filters.departmentId === null ? sumTransactions(filterLedgerTransactions(dataset.transactions, filters).filter((transaction) => transaction.projectId === projectId)) : sumTransactionInputs(filterAllocationInputs(dataset, filters, { departmentId: filters.departmentId, projectId, partnerId: null }));
  const budgets = sumProjectBudgets(dataset.projectBudgetLines.filter((line) => line.projectId === projectId));
  const view = filters.departmentId === null ? "project_ledger" : "project_department_allocated";
  return {
    ...formatAccumulator(accumulator, view),
    project: toProjectResponse(project),
    budget_income: formatMinor(budgets.incomeMinor),
    budget_expenses: formatMinor(budgets.expenseMinor),
    view
  };
}
function readPartnerPnl(dataset, partnerId, filters) {
  const resolved = resolveDataset2(dataset);
  const partner = requirePartner(resolved, partnerId);
  const accumulator = filters.departmentId === null ? sumTransactions(filterLedgerTransactions(dataset.transactions, filters).filter((transaction) => transaction.partnerId === partnerId)) : sumTransactionInputs(filterAllocationInputs(dataset, filters, { departmentId: filters.departmentId, projectId: null, partnerId }));
  const view = filters.departmentId === null ? "partner_ledger" : "partner_department_allocated";
  return {
    ...formatAccumulator(accumulator, view),
    partner: toPartnerResponse(partner),
    view
  };
}
function readPnlByCategory(dataset, filters) {
  const resolved = resolveDataset2(dataset);
  const groups = /* @__PURE__ */ new Map();
  for (const transaction of filterLedgerTransactions(dataset.transactions, filters)) {
    if (transaction.categoryId === null) {
      continue;
    }
    const category = resolved.categoriesById.get(transaction.categoryId);
    if (category === void 0 || category.divisionId === null) {
      continue;
    }
    addTransactionToGroup(groups, category.id, transaction, transaction.amountMinor);
  }
  return [...groups.entries()].flatMap(([categoryId, accumulator]) => {
    const category = requireCategory(resolved, categoryId);
    if (category.divisionId === null) {
      return [];
    }
    const division = requireDivision(resolved, category.divisionId);
    const department = requireDepartment(resolved, division.departmentId);
    const totals = formatAccumulator(freezeAccumulator(accumulator), "global_ledger");
    return [{
      category_id: category.id,
      category_name: category.name,
      category_type: category.type,
      division_id: division.id,
      division_name: division.name,
      department_id: department.id,
      department_name: department.name,
      income: totals.income,
      expense: totals.expense,
      profit: totals.profit,
      tx_count: totals.tx_count
    }];
  });
}
function readPnlByDivision(dataset, filters) {
  const resolved = resolveDataset2(dataset);
  const groups = /* @__PURE__ */ new Map();
  for (const transaction of filterLedgerTransactions(dataset.transactions, filters)) {
    if (transaction.categoryId === null) {
      continue;
    }
    const category = resolved.categoriesById.get(transaction.categoryId);
    if (category === void 0 || category.divisionId === null) {
      continue;
    }
    addTransactionToGroup(groups, category.divisionId, transaction, transaction.amountMinor);
  }
  return [...groups.entries()].map(([divisionId, accumulator]) => {
    const division = requireDivision(resolved, divisionId);
    const department = requireDepartment(resolved, division.departmentId);
    const totals = formatAccumulator(freezeAccumulator(accumulator), "global_ledger");
    return {
      division_id: division.id,
      division_name: division.name,
      department_id: department.id,
      department_name: department.name,
      income: totals.income,
      expense: totals.expense,
      profit: totals.profit,
      tx_count: totals.tx_count
    };
  });
}
function readPnlByDepartment(dataset, filters) {
  const resolved = resolveDataset2(dataset);
  const groups = /* @__PURE__ */ new Map();
  for (const input of filterAllocationInputs(dataset, filters, { departmentId: filters.departmentId, projectId: null, partnerId: null })) {
    if (input.allocation.departmentId === null) {
      continue;
    }
    addTransactionToGroup(groups, input.allocation.departmentId, input.transaction, input.allocation.amountMinor);
  }
  return [...groups.entries()].map(([departmentId, accumulator]) => {
    const department = requireDepartment(resolved, departmentId);
    const totals = formatAccumulator(freezeAccumulator(accumulator), "department_allocated");
    return {
      department_id: department.id,
      department_name: department.name,
      department_type: department.type,
      income: totals.income,
      expense: totals.expense,
      profit: totals.profit,
      tx_count: totals.tx_count
    };
  });
}
function readMonthlyPnl(dataset, filters) {
  const groups = /* @__PURE__ */ new Map();
  if (filters.departmentId === null) {
    for (const transaction of filterLedgerTransactions(dataset.transactions, filters)) {
      addTransactionToGroup(groups, toMonth(transaction.transactionDate), transaction, transaction.amountMinor);
    }
  } else {
    for (const input of filterAllocationInputs(dataset, filters, { departmentId: filters.departmentId, projectId: null, partnerId: null })) {
      addTransactionToGroup(groups, toMonth(input.transaction.transactionDate), input.transaction, input.allocation.amountMinor);
    }
  }
  return [...groups.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([month, accumulator]) => {
    const totals = formatAccumulator(freezeAccumulator(accumulator), "global_ledger");
    return {
      month,
      income: totals.income,
      expense: totals.expense,
      profit: totals.profit
    };
  });
}
function filterLedgerTransactions(transactions, filters) {
  return transactions.filter((transaction) => isBaseIncluded(transaction) && isInDateRange(transaction, filters));
}
function filterAllocationInputs(dataset, filters, entityFilter) {
  const transactionsById = new Map(dataset.transactions.map((transaction) => [transaction.id, transaction]));
  const inputs = [];
  for (const allocation of dataset.financialAllocations) {
    if (entityFilter.departmentId !== null && allocation.departmentId !== entityFilter.departmentId) {
      continue;
    }
    const transaction = transactionsById.get(allocation.transactionId);
    if (transaction === void 0 || !isBaseIncluded(transaction) || !isInDateRange(transaction, filters)) {
      continue;
    }
    if (entityFilter.projectId !== null && transaction.projectId !== entityFilter.projectId) {
      continue;
    }
    if (entityFilter.partnerId !== null && transaction.partnerId !== entityFilter.partnerId) {
      continue;
    }
    inputs.push({ transaction, amountMinor: allocation.amountMinor, allocation });
  }
  return inputs;
}
function isBaseIncluded(transaction) {
  return transaction.status === "validated" && transaction.isActive && isFxValid(transaction);
}
function isFxValid(transaction) {
  if (transaction.originalCurrency === null || transaction.originalCurrency === "" || transaction.originalCurrency === "MUR") {
    return true;
  }
  return transaction.exchangeRateE10 !== null;
}
function isInDateRange(transaction, filters) {
  const date = transaction.transactionDate.slice(0, 10);
  if (filters.dateFrom !== null && date < filters.dateFrom) {
    return false;
  }
  return !(filters.dateTo !== null && date > filters.dateTo);
}
function sumTransactions(transactions) {
  return sumTransactionInputs(transactions.map((transaction) => ({ transaction, amountMinor: transaction.amountMinor })));
}
function sumTransactionInputs(inputs) {
  const accumulator = createAccumulator();
  for (const input of inputs) {
    addToAccumulator(accumulator, input.transaction, input.amountMinor);
  }
  return freezeAccumulator(accumulator);
}
function sumProjectBudgets(lines) {
  let incomeMinor = 0n;
  let expenseMinor = 0n;
  for (const line of lines) {
    if (line.type === "income") {
      incomeMinor += line.plannedAmountMinor;
    } else {
      expenseMinor += line.plannedAmountMinor;
    }
  }
  return { incomeMinor, expenseMinor };
}
function createAccumulator() {
  return {
    incomeMinor: 0n,
    expenseMinor: 0n,
    transactionIds: /* @__PURE__ */ new Set()
  };
}
function addTransactionToGroup(groups, groupId, transaction, amountMinor) {
  const accumulator = groups.get(groupId) ?? createAccumulator();
  addToAccumulator(accumulator, transaction, amountMinor);
  groups.set(groupId, accumulator);
}
function addToAccumulator(accumulator, transaction, amountMinor) {
  if (transaction.type === "income") {
    accumulator.incomeMinor += amountMinor;
  } else {
    accumulator.expenseMinor += amountMinor;
  }
  accumulator.transactionIds.add(transaction.id);
}
function freezeAccumulator(accumulator) {
  return {
    incomeMinor: accumulator.incomeMinor,
    expenseMinor: accumulator.expenseMinor,
    transactionIds: new Set(accumulator.transactionIds)
  };
}
function formatAccumulator(accumulator, view) {
  return {
    income: formatMinor(accumulator.incomeMinor),
    expense: formatMinor(accumulator.expenseMinor),
    profit: formatMinor(accumulator.incomeMinor - accumulator.expenseMinor),
    tx_count: accumulator.transactionIds.size,
    currency: "MUR",
    view
  };
}
function formatMinor(value) {
  return eofMoney.format(value);
}
function resolveDataset2(dataset) {
  return {
    departmentsById: new Map(dataset.departments.map((department) => [department.id, department])),
    divisionsById: new Map(dataset.divisions.map((division) => [division.id, division])),
    categoriesById: new Map(dataset.categories.map((category) => [category.id, category])),
    partnersById: new Map(dataset.partners.map((partner) => [partner.id, partner])),
    projectsById: new Map(dataset.projects.map((project) => [project.id, project])),
    transactionsById: new Map(dataset.transactions.map((transaction) => [transaction.id, transaction]))
  };
}
function requireDepartment(resolved, departmentId) {
  const department = resolved.departmentsById.get(departmentId);
  if (department === void 0) {
    throw new Error(`Office P&L department not found: ${departmentId}`);
  }
  return department;
}
function requireDivision(resolved, divisionId) {
  const division = resolved.divisionsById.get(divisionId);
  if (division === void 0) {
    throw new Error(`Office P&L division not found: ${divisionId}`);
  }
  return division;
}
function requireCategory(resolved, categoryId) {
  const category = resolved.categoriesById.get(categoryId);
  if (category === void 0) {
    throw new Error(`Office P&L category not found: ${categoryId}`);
  }
  return category;
}
function requireProject(resolved, projectId) {
  const project = resolved.projectsById.get(projectId);
  if (project === void 0) {
    throw new Error(`Office P&L project not found: ${projectId}`);
  }
  return project;
}
function requirePartner(resolved, partnerId) {
  const partner = resolved.partnersById.get(partnerId);
  if (partner === void 0) {
    throw new Error(`Office P&L partner not found: ${partnerId}`);
  }
  return partner;
}
function toDepartmentResponse(department) {
  return {
    id: department.id,
    name: department.name,
    color: department.color,
    type: department.type
  };
}
function toProjectResponse(project) {
  return {
    id: project.id,
    name: project.name,
    status: project.status,
    state: project.state
  };
}
function toPartnerResponse(partner) {
  return {
    id: partner.id,
    name: partner.name,
    type: partner.type
  };
}
function toMonth(timestamp) {
  return timestamp.slice(0, 7);
}

// ../../packages/domain-office/src/analytics.ts
function readOfficeDashboardFull(dataset, period, filters, runwayWindowMonths) {
  const monthly = readMonthlyPnl(dataset, filters);
  return {
    period,
    pnl: readGlobalPnl(dataset, filters),
    byDepartment: readPnlByDepartment(dataset, filters),
    monthly,
    bankQuality: readOfficeBankQuality(dataset, period),
    cashRunway: readOfficeCashRunway(dataset, period, monthly, runwayWindowMonths),
    cashflow: readOfficeCashflowProjection(dataset, filters.dateFrom, filters.dateTo, null)
  };
}
function readOfficeBankQuality(dataset, period) {
  const lines = dataset.bankStatementLines.filter((line) => line.occurredOn.startsWith(period));
  const matchedLineIds = new Set(
    dataset.bankReconciliationMatches.filter((match2) => match2.status === "matched").map((match2) => match2.bankStatementLineId)
  );
  const matchedCount = lines.filter((line) => line.reconciliationStatus === "matched" || matchedLineIds.has(line.id)).length;
  const totalCount = lines.length;
  const matchedRateBp = totalCount === 0 ? 0 : toBasisPointValue(roundRatioHalfUp(BigInt(matchedCount) * 10000n, BigInt(totalCount)));
  const periodImports = dataset.bankImportBatches.filter((batch) => batch.status === "confirmed" && batchIntersectsPeriod(batch, period));
  return {
    period,
    matchedRateBp,
    unmatchedLineCount: lines.filter((line) => line.reconciliationStatus === "unmatched" && !matchedLineIds.has(line.id)).length,
    duplicateCandidateCount: lines.filter((line) => line.isDuplicateCandidate).length,
    missingReferenceCount: lines.filter((line) => line.reference === null || line.reference.trim() === "").length,
    staleImportCount: dataset.bankImportBatches.filter((batch) => batch.status === "confirmed" && isStaleImport(batch, period)).length,
    lastImportAt: latestTimestamp(periodImports.map((batch) => batch.importedAt))
  };
}
function readOfficeCashRunway(dataset, period, monthlyRows, runwayWindowMonths) {
  const cashBalanceUnits = sumCurrentCashMur(dataset.bankAccounts);
  const selectedRows = runwayWindowMonths.map((month) => requireMonthlyRow(monthlyRows, month));
  const burnUnits = selectedRows.map((row) => monthlyBurnUnits(row));
  const totalBurnUnits = burnUnits.reduce((sum, value) => eofMoney.add(sum, value), 0n);
  const averageBurnUnits = selectedRows.length === 0 ? 0n : roundRatioHalfUp(totalBurnUnits, BigInt(selectedRows.length));
  const runwayMonths = averageBurnUnits === 0n ? null : formatRatio(roundRatioHalfUp(cashBalanceUnits * 100n, averageBurnUnits), 2);
  return {
    period,
    cashBalanceMur: eofMoney.format(cashBalanceUnits),
    averageMonthlyBurnMur: eofMoney.format(averageBurnUnits),
    runwayMonths,
    monthsUsed: selectedRows.map((row) => row.month)
  };
}
function readOfficeCashflowProjection(dataset, dateFrom, dateTo, accountId) {
  const groups = /* @__PURE__ */ new Map();
  for (const row of dataset.cashflowProjectionRows) {
    if (accountId !== null && row.accountId !== accountId) {
      continue;
    }
    if (!isMonthInRange(row.periodMonth, dateFrom, dateTo)) {
      continue;
    }
    if (row.currency !== "MUR") {
      throw new Error(`Office cashflow projection row ${row.id} is not MUR.`);
    }
    const current = groups.get(row.periodMonth) ?? { inflowMinor: 0n, outflowMinor: 0n, closingMinor: 0n };
    current.inflowMinor = eofMoney.add(current.inflowMinor, row.expectedInflowMinor);
    current.outflowMinor = eofMoney.add(current.outflowMinor, row.expectedOutflowMinor);
    current.closingMinor = eofMoney.add(current.closingMinor, row.expectedClosingBalanceMinor);
    groups.set(row.periodMonth, current);
  }
  return [...groups.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([period, accumulator]) => ({
    period,
    inflowMur: eofMoney.format(accumulator.inflowMinor),
    outflowMur: eofMoney.format(accumulator.outflowMinor),
    closingMur: eofMoney.format(accumulator.closingMinor)
  }));
}
function sumCurrentCashMur(accounts) {
  let total = 0n;
  for (const account of accounts) {
    if (!account.isActive) {
      continue;
    }
    total = eofMoney.add(total, accountBalanceMurUnits(account));
  }
  return total;
}
function accountBalanceMurUnits(account) {
  if (account.currency === "MUR") {
    return account.currentBalanceMinor;
  }
  if (account.currentBalanceMurMinor === null) {
    throw new Error(`Office bank account ${account.id} needs an audited MUR balance for runway analytics.`);
  }
  return account.currentBalanceMurMinor;
}
function requireMonthlyRow(rows, month) {
  const row = rows.find((candidate) => candidate.month === month);
  if (row === void 0) {
    throw new Error(`Office monthly P&L row not found for runway month ${month}.`);
  }
  return row;
}
function monthlyBurnUnits(row) {
  const incomeUnits = eofMoney.parse(row.income);
  const expenseUnits = eofMoney.parse(row.expense);
  const netBurnUnits = eofMoney.sub(expenseUnits, incomeUnits);
  return netBurnUnits > 0n ? netBurnUnits : 0n;
}
function batchIntersectsPeriod(batch, period) {
  if (batch.periodStart === null || batch.periodEnd === null) {
    return batch.importedAt !== null && batch.importedAt.startsWith(period);
  }
  return batch.periodStart <= `${period}-31` && batch.periodEnd >= `${period}-01`;
}
function isStaleImport(batch, period) {
  if (batch.periodEnd === null) {
    return false;
  }
  return batch.periodEnd < `${period}-01`;
}
function latestTimestamp(values) {
  const timestamps = values.filter((value) => value !== null).sort((left, right) => right.localeCompare(left));
  return timestamps[0] ?? null;
}
function isMonthInRange(month, dateFrom, dateTo) {
  if (dateFrom !== null && month < dateFrom.slice(0, 7)) {
    return false;
  }
  return !(dateTo !== null && month > dateTo.slice(0, 7));
}
function formatRatio(units, scale) {
  return format(units, scale);
}
function toBasisPointValue(value) {
  if (value < 0n || value > 10000n) {
    throw new Error(`Basis-point result is out of range: ${value.toString()}`);
  }
  return parseInt(value.toString(), 10);
}

// src/persistence.ts
import { createHash, randomUUID } from "node:crypto";

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.3_pg@8.22.0/node_modules/drizzle-orm/node-postgres/driver.js
import pg2 from "pg";

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.3_pg@8.22.0/node_modules/drizzle-orm/selection-proxy.js
var SelectionProxyHandler = class _SelectionProxyHandler {
  static [entityKind] = "SelectionProxyHandler";
  config;
  constructor(config) {
    this.config = { ...config };
  }
  get(subquery, prop) {
    if (prop === "_") {
      return {
        ...subquery["_"],
        selectedFields: new Proxy(
          subquery._.selectedFields,
          this
        )
      };
    }
    if (prop === ViewBaseConfig) {
      return {
        ...subquery[ViewBaseConfig],
        selectedFields: new Proxy(
          subquery[ViewBaseConfig].selectedFields,
          this
        )
      };
    }
    if (typeof prop === "symbol") {
      return subquery[prop];
    }
    const columns = is(subquery, Subquery) ? subquery._.selectedFields : is(subquery, View) ? subquery[ViewBaseConfig].selectedFields : subquery;
    const value = columns[prop];
    if (is(value, SQL.Aliased)) {
      if (this.config.sqlAliasedBehavior === "sql" && !value.isSelectionField) {
        return value.sql;
      }
      const newValue = value.clone();
      newValue.isSelectionField = true;
      return newValue;
    }
    if (is(value, SQL)) {
      if (this.config.sqlBehavior === "sql") {
        return value;
      }
      throw new Error(
        `You tried to reference "${prop}" field from a subquery, which is a raw SQL field, but it doesn't have an alias declared. Please add an alias to the field using ".as('alias')" method.`
      );
    }
    if (is(value, Column)) {
      if (this.config.alias) {
        return new Proxy(
          value,
          new ColumnAliasProxyHandler(
            new Proxy(
              value.table,
              new TableAliasProxyHandler(this.config.alias, this.config.replaceOriginalName ?? false)
            )
          )
        );
      }
      return value;
    }
    if (typeof value !== "object" || value === null) {
      return value;
    }
    return new Proxy(value, new _SelectionProxyHandler(this.config));
  }
};

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.3_pg@8.22.0/node_modules/drizzle-orm/casing.js
function toSnakeCase(input) {
  const words = input.replace(/['\u2019]/g, "").match(/[\da-z]+|[A-Z]+(?![a-z])|[A-Z][\da-z]+/g) ?? [];
  return words.map((word) => word.toLowerCase()).join("_");
}
function toCamelCase(input) {
  const words = input.replace(/['\u2019]/g, "").match(/[\da-z]+|[A-Z]+(?![a-z])|[A-Z][\da-z]+/g) ?? [];
  return words.reduce((acc, word, i) => {
    const formattedWord = i === 0 ? word.toLowerCase() : `${word[0].toUpperCase()}${word.slice(1)}`;
    return acc + formattedWord;
  }, "");
}
function noopCase(input) {
  return input;
}
var CasingCache = class {
  static [entityKind] = "CasingCache";
  /** @internal */
  cache = {};
  cachedTables = {};
  convert;
  constructor(casing) {
    this.convert = casing === "snake_case" ? toSnakeCase : casing === "camelCase" ? toCamelCase : noopCase;
  }
  getColumnCasing(column) {
    if (!column.keyAsName) return column.name;
    const schema = column.table[Table.Symbol.Schema] ?? "public";
    const tableName = column.table[Table.Symbol.OriginalName];
    const key = `${schema}.${tableName}.${column.name}`;
    if (!this.cache[key]) {
      this.cacheTable(column.table);
    }
    return this.cache[key];
  }
  cacheTable(table) {
    const schema = table[Table.Symbol.Schema] ?? "public";
    const tableName = table[Table.Symbol.OriginalName];
    const tableKey = `${schema}.${tableName}`;
    if (!this.cachedTables[tableKey]) {
      for (const column of Object.values(table[Table.Symbol.Columns])) {
        const columnKey = `${tableKey}.${column.name}`;
        this.cache[columnKey] = this.convert(column.name);
      }
      this.cachedTables[tableKey] = true;
    }
  }
  clearCache() {
    this.cache = {};
    this.cachedTables = {};
  }
};

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.3_pg@8.22.0/node_modules/drizzle-orm/pg-core/view-base.js
var PgViewBase = class extends View {
  static [entityKind] = "PgViewBase";
};

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.3_pg@8.22.0/node_modules/drizzle-orm/pg-core/dialect.js
var PgDialect = class {
  static [entityKind] = "PgDialect";
  /** @internal */
  casing;
  constructor(config) {
    this.casing = new CasingCache(config?.casing);
  }
  async migrate(migrations, session, config) {
    const migrationsTable = typeof config === "string" ? "__drizzle_migrations" : config.migrationsTable ?? "__drizzle_migrations";
    const migrationsSchema = typeof config === "string" ? "drizzle" : config.migrationsSchema ?? "drizzle";
    const migrationTableCreate = sql`
			CREATE TABLE IF NOT EXISTS ${sql.identifier(migrationsSchema)}.${sql.identifier(migrationsTable)} (
				id SERIAL PRIMARY KEY,
				hash text NOT NULL,
				created_at bigint
			)
		`;
    await session.execute(sql`CREATE SCHEMA IF NOT EXISTS ${sql.identifier(migrationsSchema)}`);
    await session.execute(migrationTableCreate);
    const dbMigrations = await session.all(
      sql`select id, hash, created_at from ${sql.identifier(migrationsSchema)}.${sql.identifier(migrationsTable)} order by created_at desc limit 1`
    );
    const lastDbMigration = dbMigrations[0];
    await session.transaction(async (tx) => {
      for await (const migration of migrations) {
        if (!lastDbMigration || Number(lastDbMigration.created_at) < migration.folderMillis) {
          for (const stmt of migration.sql) {
            await tx.execute(sql.raw(stmt));
          }
          await tx.execute(
            sql`insert into ${sql.identifier(migrationsSchema)}.${sql.identifier(migrationsTable)} ("hash", "created_at") values(${migration.hash}, ${migration.folderMillis})`
          );
        }
      }
    });
  }
  escapeName(name) {
    return `"${name.replace(/"/g, '""')}"`;
  }
  escapeParam(num) {
    return `$${num + 1}`;
  }
  escapeString(str) {
    return `'${str.replace(/'/g, "''")}'`;
  }
  buildWithCTE(queries) {
    if (!queries?.length) return void 0;
    const withSqlChunks = [sql`with `];
    for (const [i, w] of queries.entries()) {
      withSqlChunks.push(sql`${sql.identifier(w._.alias)} as (${w._.sql})`);
      if (i < queries.length - 1) {
        withSqlChunks.push(sql`, `);
      }
    }
    withSqlChunks.push(sql` `);
    return sql.join(withSqlChunks);
  }
  buildDeleteQuery({ table, where, returning, withList }) {
    const withSql = this.buildWithCTE(withList);
    const returningSql = returning ? sql` returning ${this.buildSelection(returning, { isSingleTable: true })}` : void 0;
    const whereSql = where ? sql` where ${where}` : void 0;
    return sql`${withSql}delete from ${table}${whereSql}${returningSql}`;
  }
  buildUpdateSet(table, set) {
    const tableColumns = table[Table.Symbol.Columns];
    const columnNames = Object.keys(tableColumns).filter(
      (colName) => set[colName] !== void 0 || tableColumns[colName]?.onUpdateFn !== void 0
    );
    const setSize = columnNames.length;
    return sql.join(columnNames.flatMap((colName, i) => {
      const col = tableColumns[colName];
      const onUpdateFnResult = col.onUpdateFn?.();
      const value = set[colName] ?? (is(onUpdateFnResult, SQL) ? onUpdateFnResult : sql.param(onUpdateFnResult, col));
      const res = sql`${sql.identifier(this.casing.getColumnCasing(col))} = ${value}`;
      if (i < setSize - 1) {
        return [res, sql.raw(", ")];
      }
      return [res];
    }));
  }
  buildUpdateQuery({ table, set, where, returning, withList, from, joins }) {
    const withSql = this.buildWithCTE(withList);
    const tableName = table[PgTable.Symbol.Name];
    const tableSchema = table[PgTable.Symbol.Schema];
    const origTableName = table[PgTable.Symbol.OriginalName];
    const alias = tableName === origTableName ? void 0 : tableName;
    const tableSql = sql`${tableSchema ? sql`${sql.identifier(tableSchema)}.` : void 0}${sql.identifier(origTableName)}${alias && sql` ${sql.identifier(alias)}`}`;
    const setSql = this.buildUpdateSet(table, set);
    const fromSql = from && sql.join([sql.raw(" from "), this.buildFromTable(from)]);
    const joinsSql = this.buildJoins(joins);
    const returningSql = returning ? sql` returning ${this.buildSelection(returning, { isSingleTable: !from })}` : void 0;
    const whereSql = where ? sql` where ${where}` : void 0;
    return sql`${withSql}update ${tableSql} set ${setSql}${fromSql}${joinsSql}${whereSql}${returningSql}`;
  }
  /**
   * Builds selection SQL with provided fields/expressions
   *
   * Examples:
   *
   * `select <selection> from`
   *
   * `insert ... returning <selection>`
   *
   * If `isSingleTable` is true, then columns won't be prefixed with table name
   */
  buildSelection(fields, { isSingleTable = false } = {}) {
    const columnsLen = fields.length;
    const chunks = fields.flatMap(({ field }, i) => {
      const chunk = [];
      if (is(field, SQL.Aliased) && field.isSelectionField) {
        chunk.push(sql.identifier(field.fieldAlias));
      } else if (is(field, SQL.Aliased) || is(field, SQL)) {
        const query = is(field, SQL.Aliased) ? field.sql : field;
        if (isSingleTable) {
          chunk.push(
            new SQL(
              query.queryChunks.map((c) => {
                if (is(c, PgColumn)) {
                  return sql.identifier(this.casing.getColumnCasing(c));
                }
                return c;
              })
            )
          );
        } else {
          chunk.push(query);
        }
        if (is(field, SQL.Aliased)) {
          chunk.push(sql` as ${sql.identifier(field.fieldAlias)}`);
        }
      } else if (is(field, Column)) {
        if (isSingleTable) {
          chunk.push(sql.identifier(this.casing.getColumnCasing(field)));
        } else {
          chunk.push(field);
        }
      } else if (is(field, Subquery)) {
        const entries = Object.entries(field._.selectedFields);
        if (entries.length === 1) {
          const entry = entries[0][1];
          const fieldDecoder = is(entry, SQL) ? entry.decoder : is(entry, Column) ? { mapFromDriverValue: (v) => entry.mapFromDriverValue(v) } : entry.sql.decoder;
          if (fieldDecoder) {
            field._.sql.decoder = fieldDecoder;
          }
        }
        chunk.push(field);
      }
      if (i < columnsLen - 1) {
        chunk.push(sql`, `);
      }
      return chunk;
    });
    return sql.join(chunks);
  }
  buildJoins(joins) {
    if (!joins || joins.length === 0) {
      return void 0;
    }
    const joinsArray = [];
    for (const [index, joinMeta] of joins.entries()) {
      if (index === 0) {
        joinsArray.push(sql` `);
      }
      const table = joinMeta.table;
      const lateralSql = joinMeta.lateral ? sql` lateral` : void 0;
      const onSql = joinMeta.on ? sql` on ${joinMeta.on}` : void 0;
      if (is(table, PgTable)) {
        const tableName = table[PgTable.Symbol.Name];
        const tableSchema = table[PgTable.Symbol.Schema];
        const origTableName = table[PgTable.Symbol.OriginalName];
        const alias = tableName === origTableName ? void 0 : joinMeta.alias;
        joinsArray.push(
          sql`${sql.raw(joinMeta.joinType)} join${lateralSql} ${tableSchema ? sql`${sql.identifier(tableSchema)}.` : void 0}${sql.identifier(origTableName)}${alias && sql` ${sql.identifier(alias)}`}${onSql}`
        );
      } else if (is(table, View)) {
        const viewName = table[ViewBaseConfig].name;
        const viewSchema = table[ViewBaseConfig].schema;
        const origViewName = table[ViewBaseConfig].originalName;
        const alias = viewName === origViewName ? void 0 : joinMeta.alias;
        joinsArray.push(
          sql`${sql.raw(joinMeta.joinType)} join${lateralSql} ${viewSchema ? sql`${sql.identifier(viewSchema)}.` : void 0}${sql.identifier(origViewName)}${alias && sql` ${sql.identifier(alias)}`}${onSql}`
        );
      } else {
        joinsArray.push(
          sql`${sql.raw(joinMeta.joinType)} join${lateralSql} ${table}${onSql}`
        );
      }
      if (index < joins.length - 1) {
        joinsArray.push(sql` `);
      }
    }
    return sql.join(joinsArray);
  }
  buildFromTable(table) {
    if (is(table, Table) && table[Table.Symbol.IsAlias]) {
      let fullName = sql`${sql.identifier(table[Table.Symbol.OriginalName])}`;
      if (table[Table.Symbol.Schema]) {
        fullName = sql`${sql.identifier(table[Table.Symbol.Schema])}.${fullName}`;
      }
      return sql`${fullName} ${sql.identifier(table[Table.Symbol.Name])}`;
    }
    return table;
  }
  buildSelectQuery({
    withList,
    fields,
    fieldsFlat,
    where,
    having,
    table,
    joins,
    orderBy,
    groupBy,
    limit,
    offset,
    lockingClause,
    distinct,
    setOperators
  }) {
    const fieldsList = fieldsFlat ?? orderSelectedFields(fields);
    for (const f of fieldsList) {
      if (is(f.field, Column) && getTableName(f.field.table) !== (is(table, Subquery) ? table._.alias : is(table, PgViewBase) ? table[ViewBaseConfig].name : is(table, SQL) ? void 0 : getTableName(table)) && !((table2) => joins?.some(
        ({ alias }) => alias === (table2[Table.Symbol.IsAlias] ? getTableName(table2) : table2[Table.Symbol.BaseName])
      ))(f.field.table)) {
        const tableName = getTableName(f.field.table);
        throw new Error(
          `Your "${f.path.join("->")}" field references a column "${tableName}"."${f.field.name}", but the table "${tableName}" is not part of the query! Did you forget to join it?`
        );
      }
    }
    const isSingleTable = !joins || joins.length === 0;
    const withSql = this.buildWithCTE(withList);
    let distinctSql;
    if (distinct) {
      distinctSql = distinct === true ? sql` distinct` : sql` distinct on (${sql.join(distinct.on, sql`, `)})`;
    }
    const selection = this.buildSelection(fieldsList, { isSingleTable });
    const tableSql = this.buildFromTable(table);
    const joinsSql = this.buildJoins(joins);
    const whereSql = where ? sql` where ${where}` : void 0;
    const havingSql = having ? sql` having ${having}` : void 0;
    let orderBySql;
    if (orderBy && orderBy.length > 0) {
      orderBySql = sql` order by ${sql.join(orderBy, sql`, `)}`;
    }
    let groupBySql;
    if (groupBy && groupBy.length > 0) {
      groupBySql = sql` group by ${sql.join(groupBy, sql`, `)}`;
    }
    const limitSql = typeof limit === "object" || typeof limit === "number" && limit >= 0 ? sql` limit ${limit}` : void 0;
    const offsetSql = offset ? sql` offset ${offset}` : void 0;
    const lockingClauseSql = sql.empty();
    if (lockingClause) {
      const clauseSql = sql` for ${sql.raw(lockingClause.strength)}`;
      if (lockingClause.config.of) {
        clauseSql.append(
          sql` of ${sql.join(
            Array.isArray(lockingClause.config.of) ? lockingClause.config.of : [lockingClause.config.of],
            sql`, `
          )}`
        );
      }
      if (lockingClause.config.noWait) {
        clauseSql.append(sql` nowait`);
      } else if (lockingClause.config.skipLocked) {
        clauseSql.append(sql` skip locked`);
      }
      lockingClauseSql.append(clauseSql);
    }
    const finalQuery = sql`${withSql}select${distinctSql} ${selection} from ${tableSql}${joinsSql}${whereSql}${groupBySql}${havingSql}${orderBySql}${limitSql}${offsetSql}${lockingClauseSql}`;
    if (setOperators.length > 0) {
      return this.buildSetOperations(finalQuery, setOperators);
    }
    return finalQuery;
  }
  buildSetOperations(leftSelect, setOperators) {
    const [setOperator, ...rest] = setOperators;
    if (!setOperator) {
      throw new Error("Cannot pass undefined values to any set operator");
    }
    if (rest.length === 0) {
      return this.buildSetOperationQuery({ leftSelect, setOperator });
    }
    return this.buildSetOperations(
      this.buildSetOperationQuery({ leftSelect, setOperator }),
      rest
    );
  }
  buildSetOperationQuery({
    leftSelect,
    setOperator: { type, isAll, rightSelect, limit, orderBy, offset }
  }) {
    const leftChunk = sql`(${leftSelect.getSQL()}) `;
    const rightChunk = sql`(${rightSelect.getSQL()})`;
    let orderBySql;
    if (orderBy && orderBy.length > 0) {
      const orderByValues = [];
      for (const singleOrderBy of orderBy) {
        if (is(singleOrderBy, PgColumn)) {
          orderByValues.push(sql.identifier(singleOrderBy.name));
        } else if (is(singleOrderBy, SQL)) {
          for (let i = 0; i < singleOrderBy.queryChunks.length; i++) {
            const chunk = singleOrderBy.queryChunks[i];
            if (is(chunk, PgColumn)) {
              singleOrderBy.queryChunks[i] = sql.identifier(chunk.name);
            }
          }
          orderByValues.push(sql`${singleOrderBy}`);
        } else {
          orderByValues.push(sql`${singleOrderBy}`);
        }
      }
      orderBySql = sql` order by ${sql.join(orderByValues, sql`, `)} `;
    }
    const limitSql = typeof limit === "object" || typeof limit === "number" && limit >= 0 ? sql` limit ${limit}` : void 0;
    const operatorChunk = sql.raw(`${type} ${isAll ? "all " : ""}`);
    const offsetSql = offset ? sql` offset ${offset}` : void 0;
    return sql`${leftChunk}${operatorChunk}${rightChunk}${orderBySql}${limitSql}${offsetSql}`;
  }
  buildInsertQuery({ table, values: valuesOrSelect, onConflict, returning, withList, select, overridingSystemValue_ }) {
    const valuesSqlList = [];
    const columns = table[Table.Symbol.Columns];
    const colEntries = Object.entries(columns).filter(([_, col]) => !col.shouldDisableInsert());
    const insertOrder = colEntries.map(
      ([, column]) => sql.identifier(this.casing.getColumnCasing(column))
    );
    if (select) {
      const select2 = valuesOrSelect;
      if (is(select2, SQL)) {
        valuesSqlList.push(select2);
      } else {
        valuesSqlList.push(select2.getSQL());
      }
    } else {
      const values = valuesOrSelect;
      valuesSqlList.push(sql.raw("values "));
      for (const [valueIndex, value] of values.entries()) {
        const valueList = [];
        for (const [fieldName, col] of colEntries) {
          const colValue = value[fieldName];
          if (colValue === void 0 || is(colValue, Param) && colValue.value === void 0) {
            if (col.defaultFn !== void 0) {
              const defaultFnResult = col.defaultFn();
              const defaultValue = is(defaultFnResult, SQL) ? defaultFnResult : sql.param(defaultFnResult, col);
              valueList.push(defaultValue);
            } else if (!col.default && col.onUpdateFn !== void 0) {
              const onUpdateFnResult = col.onUpdateFn();
              const newValue = is(onUpdateFnResult, SQL) ? onUpdateFnResult : sql.param(onUpdateFnResult, col);
              valueList.push(newValue);
            } else {
              valueList.push(sql`default`);
            }
          } else {
            valueList.push(colValue);
          }
        }
        valuesSqlList.push(valueList);
        if (valueIndex < values.length - 1) {
          valuesSqlList.push(sql`, `);
        }
      }
    }
    const withSql = this.buildWithCTE(withList);
    const valuesSql = sql.join(valuesSqlList);
    const returningSql = returning ? sql` returning ${this.buildSelection(returning, { isSingleTable: true })}` : void 0;
    const onConflictSql = onConflict ? sql` on conflict ${onConflict}` : void 0;
    const overridingSql = overridingSystemValue_ === true ? sql`overriding system value ` : void 0;
    return sql`${withSql}insert into ${table} ${insertOrder} ${overridingSql}${valuesSql}${onConflictSql}${returningSql}`;
  }
  buildRefreshMaterializedViewQuery({ view, concurrently, withNoData }) {
    const concurrentlySql = concurrently ? sql` concurrently` : void 0;
    const withNoDataSql = withNoData ? sql` with no data` : void 0;
    return sql`refresh materialized view${concurrentlySql} ${view}${withNoDataSql}`;
  }
  prepareTyping(encoder2) {
    if (is(encoder2, PgJsonb) || is(encoder2, PgJson)) {
      return "json";
    } else if (is(encoder2, PgNumeric)) {
      return "decimal";
    } else if (is(encoder2, PgTime)) {
      return "time";
    } else if (is(encoder2, PgTimestamp) || is(encoder2, PgTimestampString)) {
      return "timestamp";
    } else if (is(encoder2, PgDate) || is(encoder2, PgDateString)) {
      return "date";
    } else if (is(encoder2, PgUUID)) {
      return "uuid";
    } else {
      return "none";
    }
  }
  sqlToQuery(sql2, invokeSource) {
    return sql2.toQuery({
      casing: this.casing,
      escapeName: this.escapeName,
      escapeParam: this.escapeParam,
      escapeString: this.escapeString,
      prepareTyping: this.prepareTyping,
      invokeSource
    });
  }
  // buildRelationalQueryWithPK({
  // 	fullSchema,
  // 	schema,
  // 	tableNamesMap,
  // 	table,
  // 	tableConfig,
  // 	queryConfig: config,
  // 	tableAlias,
  // 	isRoot = false,
  // 	joinOn,
  // }: {
  // 	fullSchema: Record<string, unknown>;
  // 	schema: TablesRelationalConfig;
  // 	tableNamesMap: Record<string, string>;
  // 	table: PgTable;
  // 	tableConfig: TableRelationalConfig;
  // 	queryConfig: true | DBQueryConfig<'many', true>;
  // 	tableAlias: string;
  // 	isRoot?: boolean;
  // 	joinOn?: SQL;
  // }): BuildRelationalQueryResult<PgTable, PgColumn> {
  // 	// For { "<relation>": true }, return a table with selection of all columns
  // 	if (config === true) {
  // 		const selectionEntries = Object.entries(tableConfig.columns);
  // 		const selection: BuildRelationalQueryResult<PgTable, PgColumn>['selection'] = selectionEntries.map((
  // 			[key, value],
  // 		) => ({
  // 			dbKey: value.name,
  // 			tsKey: key,
  // 			field: value as PgColumn,
  // 			relationTableTsKey: undefined,
  // 			isJson: false,
  // 			selection: [],
  // 		}));
  // 		return {
  // 			tableTsKey: tableConfig.tsName,
  // 			sql: table,
  // 			selection,
  // 		};
  // 	}
  // 	// let selection: BuildRelationalQueryResult<PgTable, PgColumn>['selection'] = [];
  // 	// let selectionForBuild = selection;
  // 	const aliasedColumns = Object.fromEntries(
  // 		Object.entries(tableConfig.columns).map(([key, value]) => [key, aliasedTableColumn(value, tableAlias)]),
  // 	);
  // 	const aliasedRelations = Object.fromEntries(
  // 		Object.entries(tableConfig.relations).map(([key, value]) => [key, aliasedRelation(value, tableAlias)]),
  // 	);
  // 	const aliasedFields = Object.assign({}, aliasedColumns, aliasedRelations);
  // 	let where, hasUserDefinedWhere;
  // 	if (config.where) {
  // 		const whereSql = typeof config.where === 'function' ? config.where(aliasedFields, operators) : config.where;
  // 		where = whereSql && mapColumnsInSQLToAlias(whereSql, tableAlias);
  // 		hasUserDefinedWhere = !!where;
  // 	}
  // 	where = and(joinOn, where);
  // 	// const fieldsSelection: { tsKey: string; value: PgColumn | SQL.Aliased; isExtra?: boolean }[] = [];
  // 	let joins: Join[] = [];
  // 	let selectedColumns: string[] = [];
  // 	// Figure out which columns to select
  // 	if (config.columns) {
  // 		let isIncludeMode = false;
  // 		for (const [field, value] of Object.entries(config.columns)) {
  // 			if (value === undefined) {
  // 				continue;
  // 			}
  // 			if (field in tableConfig.columns) {
  // 				if (!isIncludeMode && value === true) {
  // 					isIncludeMode = true;
  // 				}
  // 				selectedColumns.push(field);
  // 			}
  // 		}
  // 		if (selectedColumns.length > 0) {
  // 			selectedColumns = isIncludeMode
  // 				? selectedColumns.filter((c) => config.columns?.[c] === true)
  // 				: Object.keys(tableConfig.columns).filter((key) => !selectedColumns.includes(key));
  // 		}
  // 	} else {
  // 		// Select all columns if selection is not specified
  // 		selectedColumns = Object.keys(tableConfig.columns);
  // 	}
  // 	// for (const field of selectedColumns) {
  // 	// 	const column = tableConfig.columns[field]! as PgColumn;
  // 	// 	fieldsSelection.push({ tsKey: field, value: column });
  // 	// }
  // 	let initiallySelectedRelations: {
  // 		tsKey: string;
  // 		queryConfig: true | DBQueryConfig<'many', false>;
  // 		relation: Relation;
  // 	}[] = [];
  // 	// let selectedRelations: BuildRelationalQueryResult<PgTable, PgColumn>['selection'] = [];
  // 	// Figure out which relations to select
  // 	if (config.with) {
  // 		initiallySelectedRelations = Object.entries(config.with)
  // 			.filter((entry): entry is [typeof entry[0], NonNullable<typeof entry[1]>] => !!entry[1])
  // 			.map(([tsKey, queryConfig]) => ({ tsKey, queryConfig, relation: tableConfig.relations[tsKey]! }));
  // 	}
  // 	const manyRelations = initiallySelectedRelations.filter((r) =>
  // 		is(r.relation, Many)
  // 		&& (schema[tableNamesMap[r.relation.referencedTable[Table.Symbol.Name]]!]?.primaryKey.length ?? 0) > 0
  // 	);
  // 	// If this is the last Many relation (or there are no Many relations), we are on the innermost subquery level
  // 	const isInnermostQuery = manyRelations.length < 2;
  // 	const selectedExtras: {
  // 		tsKey: string;
  // 		value: SQL.Aliased;
  // 	}[] = [];
  // 	// Figure out which extras to select
  // 	if (isInnermostQuery && config.extras) {
  // 		const extras = typeof config.extras === 'function'
  // 			? config.extras(aliasedFields, { sql })
  // 			: config.extras;
  // 		for (const [tsKey, value] of Object.entries(extras)) {
  // 			selectedExtras.push({
  // 				tsKey,
  // 				value: mapColumnsInAliasedSQLToAlias(value, tableAlias),
  // 			});
  // 		}
  // 	}
  // 	// Transform `fieldsSelection` into `selection`
  // 	// `fieldsSelection` shouldn't be used after this point
  // 	// for (const { tsKey, value, isExtra } of fieldsSelection) {
  // 	// 	selection.push({
  // 	// 		dbKey: is(value, SQL.Aliased) ? value.fieldAlias : tableConfig.columns[tsKey]!.name,
  // 	// 		tsKey,
  // 	// 		field: is(value, Column) ? aliasedTableColumn(value, tableAlias) : value,
  // 	// 		relationTableTsKey: undefined,
  // 	// 		isJson: false,
  // 	// 		isExtra,
  // 	// 		selection: [],
  // 	// 	});
  // 	// }
  // 	let orderByOrig = typeof config.orderBy === 'function'
  // 		? config.orderBy(aliasedFields, orderByOperators)
  // 		: config.orderBy ?? [];
  // 	if (!Array.isArray(orderByOrig)) {
  // 		orderByOrig = [orderByOrig];
  // 	}
  // 	const orderBy = orderByOrig.map((orderByValue) => {
  // 		if (is(orderByValue, Column)) {
  // 			return aliasedTableColumn(orderByValue, tableAlias) as PgColumn;
  // 		}
  // 		return mapColumnsInSQLToAlias(orderByValue, tableAlias);
  // 	});
  // 	const limit = isInnermostQuery ? config.limit : undefined;
  // 	const offset = isInnermostQuery ? config.offset : undefined;
  // 	// For non-root queries without additional config except columns, return a table with selection
  // 	if (
  // 		!isRoot
  // 		&& initiallySelectedRelations.length === 0
  // 		&& selectedExtras.length === 0
  // 		&& !where
  // 		&& orderBy.length === 0
  // 		&& limit === undefined
  // 		&& offset === undefined
  // 	) {
  // 		return {
  // 			tableTsKey: tableConfig.tsName,
  // 			sql: table,
  // 			selection: selectedColumns.map((key) => ({
  // 				dbKey: tableConfig.columns[key]!.name,
  // 				tsKey: key,
  // 				field: tableConfig.columns[key] as PgColumn,
  // 				relationTableTsKey: undefined,
  // 				isJson: false,
  // 				selection: [],
  // 			})),
  // 		};
  // 	}
  // 	const selectedRelationsWithoutPK:
  // 	// Process all relations without primary keys, because they need to be joined differently and will all be on the same query level
  // 	for (
  // 		const {
  // 			tsKey: selectedRelationTsKey,
  // 			queryConfig: selectedRelationConfigValue,
  // 			relation,
  // 		} of initiallySelectedRelations
  // 	) {
  // 		const normalizedRelation = normalizeRelation(schema, tableNamesMap, relation);
  // 		const relationTableName = relation.referencedTable[Table.Symbol.Name];
  // 		const relationTableTsName = tableNamesMap[relationTableName]!;
  // 		const relationTable = schema[relationTableTsName]!;
  // 		if (relationTable.primaryKey.length > 0) {
  // 			continue;
  // 		}
  // 		const relationTableAlias = `${tableAlias}_${selectedRelationTsKey}`;
  // 		const joinOn = and(
  // 			...normalizedRelation.fields.map((field, i) =>
  // 				eq(
  // 					aliasedTableColumn(normalizedRelation.references[i]!, relationTableAlias),
  // 					aliasedTableColumn(field, tableAlias),
  // 				)
  // 			),
  // 		);
  // 		const builtRelation = this.buildRelationalQueryWithoutPK({
  // 			fullSchema,
  // 			schema,
  // 			tableNamesMap,
  // 			table: fullSchema[relationTableTsName] as PgTable,
  // 			tableConfig: schema[relationTableTsName]!,
  // 			queryConfig: selectedRelationConfigValue,
  // 			tableAlias: relationTableAlias,
  // 			joinOn,
  // 			nestedQueryRelation: relation,
  // 		});
  // 		const field = sql`${sql.identifier(relationTableAlias)}.${sql.identifier('data')}`.as(selectedRelationTsKey);
  // 		joins.push({
  // 			on: sql`true`,
  // 			table: new Subquery(builtRelation.sql as SQL, {}, relationTableAlias),
  // 			alias: relationTableAlias,
  // 			joinType: 'left',
  // 			lateral: true,
  // 		});
  // 		selectedRelations.push({
  // 			dbKey: selectedRelationTsKey,
  // 			tsKey: selectedRelationTsKey,
  // 			field,
  // 			relationTableTsKey: relationTableTsName,
  // 			isJson: true,
  // 			selection: builtRelation.selection,
  // 		});
  // 	}
  // 	const oneRelations = initiallySelectedRelations.filter((r): r is typeof r & { relation: One } =>
  // 		is(r.relation, One)
  // 	);
  // 	// Process all One relations with PKs, because they can all be joined on the same level
  // 	for (
  // 		const {
  // 			tsKey: selectedRelationTsKey,
  // 			queryConfig: selectedRelationConfigValue,
  // 			relation,
  // 		} of oneRelations
  // 	) {
  // 		const normalizedRelation = normalizeRelation(schema, tableNamesMap, relation);
  // 		const relationTableName = relation.referencedTable[Table.Symbol.Name];
  // 		const relationTableTsName = tableNamesMap[relationTableName]!;
  // 		const relationTableAlias = `${tableAlias}_${selectedRelationTsKey}`;
  // 		const relationTable = schema[relationTableTsName]!;
  // 		if (relationTable.primaryKey.length === 0) {
  // 			continue;
  // 		}
  // 		const joinOn = and(
  // 			...normalizedRelation.fields.map((field, i) =>
  // 				eq(
  // 					aliasedTableColumn(normalizedRelation.references[i]!, relationTableAlias),
  // 					aliasedTableColumn(field, tableAlias),
  // 				)
  // 			),
  // 		);
  // 		const builtRelation = this.buildRelationalQueryWithPK({
  // 			fullSchema,
  // 			schema,
  // 			tableNamesMap,
  // 			table: fullSchema[relationTableTsName] as PgTable,
  // 			tableConfig: schema[relationTableTsName]!,
  // 			queryConfig: selectedRelationConfigValue,
  // 			tableAlias: relationTableAlias,
  // 			joinOn,
  // 		});
  // 		const field = sql`case when ${sql.identifier(relationTableAlias)} is null then null else json_build_array(${
  // 			sql.join(
  // 				builtRelation.selection.map(({ field }) =>
  // 					is(field, SQL.Aliased)
  // 						? sql`${sql.identifier(relationTableAlias)}.${sql.identifier(field.fieldAlias)}`
  // 						: is(field, Column)
  // 						? aliasedTableColumn(field, relationTableAlias)
  // 						: field
  // 				),
  // 				sql`, `,
  // 			)
  // 		}) end`.as(selectedRelationTsKey);
  // 		const isLateralJoin = is(builtRelation.sql, SQL);
  // 		joins.push({
  // 			on: isLateralJoin ? sql`true` : joinOn,
  // 			table: is(builtRelation.sql, SQL)
  // 				? new Subquery(builtRelation.sql, {}, relationTableAlias)
  // 				: aliasedTable(builtRelation.sql, relationTableAlias),
  // 			alias: relationTableAlias,
  // 			joinType: 'left',
  // 			lateral: is(builtRelation.sql, SQL),
  // 		});
  // 		selectedRelations.push({
  // 			dbKey: selectedRelationTsKey,
  // 			tsKey: selectedRelationTsKey,
  // 			field,
  // 			relationTableTsKey: relationTableTsName,
  // 			isJson: true,
  // 			selection: builtRelation.selection,
  // 		});
  // 	}
  // 	let distinct: PgSelectConfig['distinct'];
  // 	let tableFrom: PgTable | Subquery = table;
  // 	// Process first Many relation - each one requires a nested subquery
  // 	const manyRelation = manyRelations[0];
  // 	if (manyRelation) {
  // 		const {
  // 			tsKey: selectedRelationTsKey,
  // 			queryConfig: selectedRelationQueryConfig,
  // 			relation,
  // 		} = manyRelation;
  // 		distinct = {
  // 			on: tableConfig.primaryKey.map((c) => aliasedTableColumn(c as PgColumn, tableAlias)),
  // 		};
  // 		const normalizedRelation = normalizeRelation(schema, tableNamesMap, relation);
  // 		const relationTableName = relation.referencedTable[Table.Symbol.Name];
  // 		const relationTableTsName = tableNamesMap[relationTableName]!;
  // 		const relationTableAlias = `${tableAlias}_${selectedRelationTsKey}`;
  // 		const joinOn = and(
  // 			...normalizedRelation.fields.map((field, i) =>
  // 				eq(
  // 					aliasedTableColumn(normalizedRelation.references[i]!, relationTableAlias),
  // 					aliasedTableColumn(field, tableAlias),
  // 				)
  // 			),
  // 		);
  // 		const builtRelationJoin = this.buildRelationalQueryWithPK({
  // 			fullSchema,
  // 			schema,
  // 			tableNamesMap,
  // 			table: fullSchema[relationTableTsName] as PgTable,
  // 			tableConfig: schema[relationTableTsName]!,
  // 			queryConfig: selectedRelationQueryConfig,
  // 			tableAlias: relationTableAlias,
  // 			joinOn,
  // 		});
  // 		const builtRelationSelectionField = sql`case when ${
  // 			sql.identifier(relationTableAlias)
  // 		} is null then '[]' else json_agg(json_build_array(${
  // 			sql.join(
  // 				builtRelationJoin.selection.map(({ field }) =>
  // 					is(field, SQL.Aliased)
  // 						? sql`${sql.identifier(relationTableAlias)}.${sql.identifier(field.fieldAlias)}`
  // 						: is(field, Column)
  // 						? aliasedTableColumn(field, relationTableAlias)
  // 						: field
  // 				),
  // 				sql`, `,
  // 			)
  // 		})) over (partition by ${sql.join(distinct.on, sql`, `)}) end`.as(selectedRelationTsKey);
  // 		const isLateralJoin = is(builtRelationJoin.sql, SQL);
  // 		joins.push({
  // 			on: isLateralJoin ? sql`true` : joinOn,
  // 			table: isLateralJoin
  // 				? new Subquery(builtRelationJoin.sql as SQL, {}, relationTableAlias)
  // 				: aliasedTable(builtRelationJoin.sql as PgTable, relationTableAlias),
  // 			alias: relationTableAlias,
  // 			joinType: 'left',
  // 			lateral: isLateralJoin,
  // 		});
  // 		// Build the "from" subquery with the remaining Many relations
  // 		const builtTableFrom = this.buildRelationalQueryWithPK({
  // 			fullSchema,
  // 			schema,
  // 			tableNamesMap,
  // 			table,
  // 			tableConfig,
  // 			queryConfig: {
  // 				...config,
  // 				where: undefined,
  // 				orderBy: undefined,
  // 				limit: undefined,
  // 				offset: undefined,
  // 				with: manyRelations.slice(1).reduce<NonNullable<typeof config['with']>>(
  // 					(result, { tsKey, queryConfig: configValue }) => {
  // 						result[tsKey] = configValue;
  // 						return result;
  // 					},
  // 					{},
  // 				),
  // 			},
  // 			tableAlias,
  // 		});
  // 		selectedRelations.push({
  // 			dbKey: selectedRelationTsKey,
  // 			tsKey: selectedRelationTsKey,
  // 			field: builtRelationSelectionField,
  // 			relationTableTsKey: relationTableTsName,
  // 			isJson: true,
  // 			selection: builtRelationJoin.selection,
  // 		});
  // 		// selection = builtTableFrom.selection.map((item) =>
  // 		// 	is(item.field, SQL.Aliased)
  // 		// 		? { ...item, field: sql`${sql.identifier(tableAlias)}.${sql.identifier(item.field.fieldAlias)}` }
  // 		// 		: item
  // 		// );
  // 		// selectionForBuild = [{
  // 		// 	dbKey: '*',
  // 		// 	tsKey: '*',
  // 		// 	field: sql`${sql.identifier(tableAlias)}.*`,
  // 		// 	selection: [],
  // 		// 	isJson: false,
  // 		// 	relationTableTsKey: undefined,
  // 		// }];
  // 		// const newSelectionItem: (typeof selection)[number] = {
  // 		// 	dbKey: selectedRelationTsKey,
  // 		// 	tsKey: selectedRelationTsKey,
  // 		// 	field,
  // 		// 	relationTableTsKey: relationTableTsName,
  // 		// 	isJson: true,
  // 		// 	selection: builtRelationJoin.selection,
  // 		// };
  // 		// selection.push(newSelectionItem);
  // 		// selectionForBuild.push(newSelectionItem);
  // 		tableFrom = is(builtTableFrom.sql, PgTable)
  // 			? builtTableFrom.sql
  // 			: new Subquery(builtTableFrom.sql, {}, tableAlias);
  // 	}
  // 	if (selectedColumns.length === 0 && selectedRelations.length === 0 && selectedExtras.length === 0) {
  // 		throw new DrizzleError(`No fields selected for table "${tableConfig.tsName}" ("${tableAlias}")`);
  // 	}
  // 	let selection: BuildRelationalQueryResult<PgTable, PgColumn>['selection'];
  // 	function prepareSelectedColumns() {
  // 		return selectedColumns.map((key) => ({
  // 			dbKey: tableConfig.columns[key]!.name,
  // 			tsKey: key,
  // 			field: tableConfig.columns[key] as PgColumn,
  // 			relationTableTsKey: undefined,
  // 			isJson: false,
  // 			selection: [],
  // 		}));
  // 	}
  // 	function prepareSelectedExtras() {
  // 		return selectedExtras.map((item) => ({
  // 			dbKey: item.value.fieldAlias,
  // 			tsKey: item.tsKey,
  // 			field: item.value,
  // 			relationTableTsKey: undefined,
  // 			isJson: false,
  // 			selection: [],
  // 		}));
  // 	}
  // 	if (isRoot) {
  // 		selection = [
  // 			...prepareSelectedColumns(),
  // 			...prepareSelectedExtras(),
  // 		];
  // 	}
  // 	if (hasUserDefinedWhere || orderBy.length > 0) {
  // 		tableFrom = new Subquery(
  // 			this.buildSelectQuery({
  // 				table: is(tableFrom, PgTable) ? aliasedTable(tableFrom, tableAlias) : tableFrom,
  // 				fields: {},
  // 				fieldsFlat: selectionForBuild.map(({ field }) => ({
  // 					path: [],
  // 					field: is(field, Column) ? aliasedTableColumn(field, tableAlias) : field,
  // 				})),
  // 				joins,
  // 				distinct,
  // 			}),
  // 			{},
  // 			tableAlias,
  // 		);
  // 		selectionForBuild = selection.map((item) =>
  // 			is(item.field, SQL.Aliased)
  // 				? { ...item, field: sql`${sql.identifier(tableAlias)}.${sql.identifier(item.field.fieldAlias)}` }
  // 				: item
  // 		);
  // 		joins = [];
  // 		distinct = undefined;
  // 	}
  // 	const result = this.buildSelectQuery({
  // 		table: is(tableFrom, PgTable) ? aliasedTable(tableFrom, tableAlias) : tableFrom,
  // 		fields: {},
  // 		fieldsFlat: selectionForBuild.map(({ field }) => ({
  // 			path: [],
  // 			field: is(field, Column) ? aliasedTableColumn(field, tableAlias) : field,
  // 		})),
  // 		where,
  // 		limit,
  // 		offset,
  // 		joins,
  // 		orderBy,
  // 		distinct,
  // 	});
  // 	return {
  // 		tableTsKey: tableConfig.tsName,
  // 		sql: result,
  // 		selection,
  // 	};
  // }
  buildRelationalQueryWithoutPK({
    fullSchema,
    schema,
    tableNamesMap,
    table,
    tableConfig,
    queryConfig: config,
    tableAlias,
    nestedQueryRelation,
    joinOn
  }) {
    let selection = [];
    let limit, offset, orderBy = [], where;
    const joins = [];
    if (config === true) {
      const selectionEntries = Object.entries(tableConfig.columns);
      selection = selectionEntries.map(([key, value]) => ({
        dbKey: value.name,
        tsKey: key,
        field: aliasedTableColumn(value, tableAlias),
        relationTableTsKey: void 0,
        isJson: false,
        selection: []
      }));
    } else {
      const aliasedColumns = Object.fromEntries(
        Object.entries(tableConfig.columns).map(([key, value]) => [key, aliasedTableColumn(value, tableAlias)])
      );
      if (config.where) {
        const whereSql = typeof config.where === "function" ? config.where(aliasedColumns, getOperators()) : config.where;
        where = whereSql && mapColumnsInSQLToAlias(whereSql, tableAlias);
      }
      const fieldsSelection = [];
      let selectedColumns = [];
      if (config.columns) {
        let isIncludeMode = false;
        for (const [field, value] of Object.entries(config.columns)) {
          if (value === void 0) {
            continue;
          }
          if (field in tableConfig.columns) {
            if (!isIncludeMode && value === true) {
              isIncludeMode = true;
            }
            selectedColumns.push(field);
          }
        }
        if (selectedColumns.length > 0) {
          selectedColumns = isIncludeMode ? selectedColumns.filter((c) => config.columns?.[c] === true) : Object.keys(tableConfig.columns).filter((key) => !selectedColumns.includes(key));
        }
      } else {
        selectedColumns = Object.keys(tableConfig.columns);
      }
      for (const field of selectedColumns) {
        const column = tableConfig.columns[field];
        fieldsSelection.push({ tsKey: field, value: column });
      }
      let selectedRelations = [];
      if (config.with) {
        selectedRelations = Object.entries(config.with).filter((entry) => !!entry[1]).map(([tsKey, queryConfig]) => ({ tsKey, queryConfig, relation: tableConfig.relations[tsKey] }));
      }
      let extras;
      if (config.extras) {
        extras = typeof config.extras === "function" ? config.extras(aliasedColumns, { sql }) : config.extras;
        for (const [tsKey, value] of Object.entries(extras)) {
          fieldsSelection.push({
            tsKey,
            value: mapColumnsInAliasedSQLToAlias(value, tableAlias)
          });
        }
      }
      for (const { tsKey, value } of fieldsSelection) {
        selection.push({
          dbKey: is(value, SQL.Aliased) ? value.fieldAlias : tableConfig.columns[tsKey].name,
          tsKey,
          field: is(value, Column) ? aliasedTableColumn(value, tableAlias) : value,
          relationTableTsKey: void 0,
          isJson: false,
          selection: []
        });
      }
      let orderByOrig = typeof config.orderBy === "function" ? config.orderBy(aliasedColumns, getOrderByOperators()) : config.orderBy ?? [];
      if (!Array.isArray(orderByOrig)) {
        orderByOrig = [orderByOrig];
      }
      orderBy = orderByOrig.map((orderByValue) => {
        if (is(orderByValue, Column)) {
          return aliasedTableColumn(orderByValue, tableAlias);
        }
        return mapColumnsInSQLToAlias(orderByValue, tableAlias);
      });
      limit = config.limit;
      offset = config.offset;
      for (const {
        tsKey: selectedRelationTsKey,
        queryConfig: selectedRelationConfigValue,
        relation
      } of selectedRelations) {
        const normalizedRelation = normalizeRelation(schema, tableNamesMap, relation);
        const relationTableName = getTableUniqueName(relation.referencedTable);
        const relationTableTsName = tableNamesMap[relationTableName];
        const relationTableAlias = `${tableAlias}_${selectedRelationTsKey}`;
        const joinOn2 = and(
          ...normalizedRelation.fields.map(
            (field2, i) => eq(
              aliasedTableColumn(normalizedRelation.references[i], relationTableAlias),
              aliasedTableColumn(field2, tableAlias)
            )
          )
        );
        const builtRelation = this.buildRelationalQueryWithoutPK({
          fullSchema,
          schema,
          tableNamesMap,
          table: fullSchema[relationTableTsName],
          tableConfig: schema[relationTableTsName],
          queryConfig: is(relation, One) ? selectedRelationConfigValue === true ? { limit: 1 } : { ...selectedRelationConfigValue, limit: 1 } : selectedRelationConfigValue,
          tableAlias: relationTableAlias,
          joinOn: joinOn2,
          nestedQueryRelation: relation
        });
        const field = sql`${sql.identifier(relationTableAlias)}.${sql.identifier("data")}`.as(selectedRelationTsKey);
        joins.push({
          on: sql`true`,
          table: new Subquery(builtRelation.sql, {}, relationTableAlias),
          alias: relationTableAlias,
          joinType: "left",
          lateral: true
        });
        selection.push({
          dbKey: selectedRelationTsKey,
          tsKey: selectedRelationTsKey,
          field,
          relationTableTsKey: relationTableTsName,
          isJson: true,
          selection: builtRelation.selection
        });
      }
    }
    if (selection.length === 0) {
      throw new DrizzleError({ message: `No fields selected for table "${tableConfig.tsName}" ("${tableAlias}")` });
    }
    let result;
    where = and(joinOn, where);
    if (nestedQueryRelation) {
      let field = sql`json_build_array(${sql.join(
        selection.map(
          ({ field: field2, tsKey, isJson }) => isJson ? sql`${sql.identifier(`${tableAlias}_${tsKey}`)}.${sql.identifier("data")}` : is(field2, SQL.Aliased) ? field2.sql : field2
        ),
        sql`, `
      )})`;
      if (is(nestedQueryRelation, Many)) {
        field = sql`coalesce(json_agg(${field}${orderBy.length > 0 ? sql` order by ${sql.join(orderBy, sql`, `)}` : void 0}), '[]'::json)`;
      }
      const nestedSelection = [{
        dbKey: "data",
        tsKey: "data",
        field: field.as("data"),
        isJson: true,
        relationTableTsKey: tableConfig.tsName,
        selection
      }];
      const needsSubquery = limit !== void 0 || offset !== void 0 || orderBy.length > 0;
      if (needsSubquery) {
        result = this.buildSelectQuery({
          table: aliasedTable(table, tableAlias),
          fields: {},
          fieldsFlat: [{
            path: [],
            field: sql.raw("*")
          }],
          where,
          limit,
          offset,
          orderBy,
          setOperators: []
        });
        where = void 0;
        limit = void 0;
        offset = void 0;
        orderBy = [];
      } else {
        result = aliasedTable(table, tableAlias);
      }
      result = this.buildSelectQuery({
        table: is(result, PgTable) ? result : new Subquery(result, {}, tableAlias),
        fields: {},
        fieldsFlat: nestedSelection.map(({ field: field2 }) => ({
          path: [],
          field: is(field2, Column) ? aliasedTableColumn(field2, tableAlias) : field2
        })),
        joins,
        where,
        limit,
        offset,
        orderBy,
        setOperators: []
      });
    } else {
      result = this.buildSelectQuery({
        table: aliasedTable(table, tableAlias),
        fields: {},
        fieldsFlat: selection.map(({ field }) => ({
          path: [],
          field: is(field, Column) ? aliasedTableColumn(field, tableAlias) : field
        })),
        joins,
        where,
        limit,
        offset,
        orderBy,
        setOperators: []
      });
    }
    return {
      tableTsKey: tableConfig.tsName,
      sql: result,
      selection
    };
  }
};

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.3_pg@8.22.0/node_modules/drizzle-orm/query-builders/query-builder.js
var TypedQueryBuilder = class {
  static [entityKind] = "TypedQueryBuilder";
  /** @internal */
  getSelectedFields() {
    return this._.selectedFields;
  }
};

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.3_pg@8.22.0/node_modules/drizzle-orm/pg-core/query-builders/select.js
var PgSelectBuilder = class {
  static [entityKind] = "PgSelectBuilder";
  fields;
  session;
  dialect;
  withList = [];
  distinct;
  constructor(config) {
    this.fields = config.fields;
    this.session = config.session;
    this.dialect = config.dialect;
    if (config.withList) {
      this.withList = config.withList;
    }
    this.distinct = config.distinct;
  }
  authToken;
  /** @internal */
  setToken(token) {
    this.authToken = token;
    return this;
  }
  /**
   * Specify the table, subquery, or other target that you're
   * building a select query against.
   *
   * {@link https://www.postgresql.org/docs/current/sql-select.html#SQL-FROM | Postgres from documentation}
   */
  from(source) {
    const isPartialSelect = !!this.fields;
    const src = source;
    let fields;
    if (this.fields) {
      fields = this.fields;
    } else if (is(src, Subquery)) {
      fields = Object.fromEntries(
        Object.keys(src._.selectedFields).map((key) => [key, src[key]])
      );
    } else if (is(src, PgViewBase)) {
      fields = src[ViewBaseConfig].selectedFields;
    } else if (is(src, SQL)) {
      fields = {};
    } else {
      fields = getTableColumns(src);
    }
    return new PgSelectBase({
      table: src,
      fields,
      isPartialSelect,
      session: this.session,
      dialect: this.dialect,
      withList: this.withList,
      distinct: this.distinct
    }).setToken(this.authToken);
  }
};
var PgSelectQueryBuilderBase = class extends TypedQueryBuilder {
  static [entityKind] = "PgSelectQueryBuilder";
  _;
  config;
  joinsNotNullableMap;
  tableName;
  isPartialSelect;
  session;
  dialect;
  cacheConfig = void 0;
  usedTables = /* @__PURE__ */ new Set();
  constructor({ table, fields, isPartialSelect, session, dialect, withList, distinct }) {
    super();
    this.config = {
      withList,
      table,
      fields: { ...fields },
      distinct,
      setOperators: []
    };
    this.isPartialSelect = isPartialSelect;
    this.session = session;
    this.dialect = dialect;
    this._ = {
      selectedFields: fields,
      config: this.config
    };
    this.tableName = getTableLikeName(table);
    this.joinsNotNullableMap = typeof this.tableName === "string" ? { [this.tableName]: true } : {};
    for (const item of extractUsedTable(table)) this.usedTables.add(item);
  }
  /** @internal */
  getUsedTables() {
    return [...this.usedTables];
  }
  createJoin(joinType, lateral) {
    return (table, on) => {
      const baseTableName = this.tableName;
      const tableName = getTableLikeName(table);
      for (const item of extractUsedTable(table)) this.usedTables.add(item);
      if (typeof tableName === "string" && this.config.joins?.some((join) => join.alias === tableName)) {
        throw new Error(`Alias "${tableName}" is already used in this query`);
      }
      if (!this.isPartialSelect) {
        if (Object.keys(this.joinsNotNullableMap).length === 1 && typeof baseTableName === "string") {
          this.config.fields = {
            [baseTableName]: this.config.fields
          };
        }
        if (typeof tableName === "string" && !is(table, SQL)) {
          const selection = is(table, Subquery) ? table._.selectedFields : is(table, View) ? table[ViewBaseConfig].selectedFields : table[Table.Symbol.Columns];
          this.config.fields[tableName] = selection;
        }
      }
      if (typeof on === "function") {
        on = on(
          new Proxy(
            this.config.fields,
            new SelectionProxyHandler({ sqlAliasedBehavior: "sql", sqlBehavior: "sql" })
          )
        );
      }
      if (!this.config.joins) {
        this.config.joins = [];
      }
      this.config.joins.push({ on, table, joinType, alias: tableName, lateral });
      if (typeof tableName === "string") {
        switch (joinType) {
          case "left": {
            this.joinsNotNullableMap[tableName] = false;
            break;
          }
          case "right": {
            this.joinsNotNullableMap = Object.fromEntries(
              Object.entries(this.joinsNotNullableMap).map(([key]) => [key, false])
            );
            this.joinsNotNullableMap[tableName] = true;
            break;
          }
          case "cross":
          case "inner": {
            this.joinsNotNullableMap[tableName] = true;
            break;
          }
          case "full": {
            this.joinsNotNullableMap = Object.fromEntries(
              Object.entries(this.joinsNotNullableMap).map(([key]) => [key, false])
            );
            this.joinsNotNullableMap[tableName] = false;
            break;
          }
        }
      }
      return this;
    };
  }
  /**
   * Executes a `left join` operation by adding another table to the current query.
   *
   * Calling this method associates each row of the table with the corresponding row from the joined table, if a match is found. If no matching row exists, it sets all columns of the joined table to null.
   *
   * See docs: {@link https://orm.drizzle.team/docs/joins#left-join}
   *
   * @param table the table to join.
   * @param on the `on` clause.
   *
   * @example
   *
   * ```ts
   * // Select all users and their pets
   * const usersWithPets: { user: User; pets: Pet | null; }[] = await db.select()
   *   .from(users)
   *   .leftJoin(pets, eq(users.id, pets.ownerId))
   *
   * // Select userId and petId
   * const usersIdsAndPetIds: { userId: number; petId: number | null; }[] = await db.select({
   *   userId: users.id,
   *   petId: pets.id,
   * })
   *   .from(users)
   *   .leftJoin(pets, eq(users.id, pets.ownerId))
   * ```
   */
  leftJoin = this.createJoin("left", false);
  /**
   * Executes a `left join lateral` operation by adding subquery to the current query.
   *
   * A `lateral` join allows the right-hand expression to refer to columns from the left-hand side.
   *
   * Calling this method associates each row of the table with the corresponding row from the joined table, if a match is found. If no matching row exists, it sets all columns of the joined table to null.
   *
   * See docs: {@link https://orm.drizzle.team/docs/joins#left-join-lateral}
   *
   * @param table the subquery to join.
   * @param on the `on` clause.
   */
  leftJoinLateral = this.createJoin("left", true);
  /**
   * Executes a `right join` operation by adding another table to the current query.
   *
   * Calling this method associates each row of the joined table with the corresponding row from the main table, if a match is found. If no matching row exists, it sets all columns of the main table to null.
   *
   * See docs: {@link https://orm.drizzle.team/docs/joins#right-join}
   *
   * @param table the table to join.
   * @param on the `on` clause.
   *
   * @example
   *
   * ```ts
   * // Select all users and their pets
   * const usersWithPets: { user: User | null; pets: Pet; }[] = await db.select()
   *   .from(users)
   *   .rightJoin(pets, eq(users.id, pets.ownerId))
   *
   * // Select userId and petId
   * const usersIdsAndPetIds: { userId: number | null; petId: number; }[] = await db.select({
   *   userId: users.id,
   *   petId: pets.id,
   * })
   *   .from(users)
   *   .rightJoin(pets, eq(users.id, pets.ownerId))
   * ```
   */
  rightJoin = this.createJoin("right", false);
  /**
   * Executes an `inner join` operation, creating a new table by combining rows from two tables that have matching values.
   *
   * Calling this method retrieves rows that have corresponding entries in both joined tables. Rows without matching entries in either table are excluded, resulting in a table that includes only matching pairs.
   *
   * See docs: {@link https://orm.drizzle.team/docs/joins#inner-join}
   *
   * @param table the table to join.
   * @param on the `on` clause.
   *
   * @example
   *
   * ```ts
   * // Select all users and their pets
   * const usersWithPets: { user: User; pets: Pet; }[] = await db.select()
   *   .from(users)
   *   .innerJoin(pets, eq(users.id, pets.ownerId))
   *
   * // Select userId and petId
   * const usersIdsAndPetIds: { userId: number; petId: number; }[] = await db.select({
   *   userId: users.id,
   *   petId: pets.id,
   * })
   *   .from(users)
   *   .innerJoin(pets, eq(users.id, pets.ownerId))
   * ```
   */
  innerJoin = this.createJoin("inner", false);
  /**
   * Executes an `inner join lateral` operation, creating a new table by combining rows from two queries that have matching values.
   *
   * A `lateral` join allows the right-hand expression to refer to columns from the left-hand side.
   *
   * Calling this method retrieves rows that have corresponding entries in both joined tables. Rows without matching entries in either table are excluded, resulting in a table that includes only matching pairs.
   *
   * See docs: {@link https://orm.drizzle.team/docs/joins#inner-join-lateral}
   *
   * @param table the subquery to join.
   * @param on the `on` clause.
   */
  innerJoinLateral = this.createJoin("inner", true);
  /**
   * Executes a `full join` operation by combining rows from two tables into a new table.
   *
   * Calling this method retrieves all rows from both main and joined tables, merging rows with matching values and filling in `null` for non-matching columns.
   *
   * See docs: {@link https://orm.drizzle.team/docs/joins#full-join}
   *
   * @param table the table to join.
   * @param on the `on` clause.
   *
   * @example
   *
   * ```ts
   * // Select all users and their pets
   * const usersWithPets: { user: User | null; pets: Pet | null; }[] = await db.select()
   *   .from(users)
   *   .fullJoin(pets, eq(users.id, pets.ownerId))
   *
   * // Select userId and petId
   * const usersIdsAndPetIds: { userId: number | null; petId: number | null; }[] = await db.select({
   *   userId: users.id,
   *   petId: pets.id,
   * })
   *   .from(users)
   *   .fullJoin(pets, eq(users.id, pets.ownerId))
   * ```
   */
  fullJoin = this.createJoin("full", false);
  /**
   * Executes a `cross join` operation by combining rows from two tables into a new table.
   *
   * Calling this method retrieves all rows from both main and joined tables, merging all rows from each table.
   *
   * See docs: {@link https://orm.drizzle.team/docs/joins#cross-join}
   *
   * @param table the table to join.
   *
   * @example
   *
   * ```ts
   * // Select all users, each user with every pet
   * const usersWithPets: { user: User; pets: Pet; }[] = await db.select()
   *   .from(users)
   *   .crossJoin(pets)
   *
   * // Select userId and petId
   * const usersIdsAndPetIds: { userId: number; petId: number; }[] = await db.select({
   *   userId: users.id,
   *   petId: pets.id,
   * })
   *   .from(users)
   *   .crossJoin(pets)
   * ```
   */
  crossJoin = this.createJoin("cross", false);
  /**
   * Executes a `cross join lateral` operation by combining rows from two queries into a new table.
   *
   * A `lateral` join allows the right-hand expression to refer to columns from the left-hand side.
   *
   * Calling this method retrieves all rows from both main and joined queries, merging all rows from each query.
   *
   * See docs: {@link https://orm.drizzle.team/docs/joins#cross-join-lateral}
   *
   * @param table the query to join.
   */
  crossJoinLateral = this.createJoin("cross", true);
  createSetOperator(type, isAll) {
    return (rightSelection) => {
      const rightSelect = typeof rightSelection === "function" ? rightSelection(getPgSetOperators()) : rightSelection;
      if (!haveSameKeys(this.getSelectedFields(), rightSelect.getSelectedFields())) {
        throw new Error(
          "Set operator error (union / intersect / except): selected fields are not the same or are in a different order"
        );
      }
      this.config.setOperators.push({ type, isAll, rightSelect });
      return this;
    };
  }
  /**
   * Adds `union` set operator to the query.
   *
   * Calling this method will combine the result sets of the `select` statements and remove any duplicate rows that appear across them.
   *
   * See docs: {@link https://orm.drizzle.team/docs/set-operations#union}
   *
   * @example
   *
   * ```ts
   * // Select all unique names from customers and users tables
   * await db.select({ name: users.name })
   *   .from(users)
   *   .union(
   *     db.select({ name: customers.name }).from(customers)
   *   );
   * // or
   * import { union } from 'drizzle-orm/pg-core'
   *
   * await union(
   *   db.select({ name: users.name }).from(users),
   *   db.select({ name: customers.name }).from(customers)
   * );
   * ```
   */
  union = this.createSetOperator("union", false);
  /**
   * Adds `union all` set operator to the query.
   *
   * Calling this method will combine the result-set of the `select` statements and keep all duplicate rows that appear across them.
   *
   * See docs: {@link https://orm.drizzle.team/docs/set-operations#union-all}
   *
   * @example
   *
   * ```ts
   * // Select all transaction ids from both online and in-store sales
   * await db.select({ transaction: onlineSales.transactionId })
   *   .from(onlineSales)
   *   .unionAll(
   *     db.select({ transaction: inStoreSales.transactionId }).from(inStoreSales)
   *   );
   * // or
   * import { unionAll } from 'drizzle-orm/pg-core'
   *
   * await unionAll(
   *   db.select({ transaction: onlineSales.transactionId }).from(onlineSales),
   *   db.select({ transaction: inStoreSales.transactionId }).from(inStoreSales)
   * );
   * ```
   */
  unionAll = this.createSetOperator("union", true);
  /**
   * Adds `intersect` set operator to the query.
   *
   * Calling this method will retain only the rows that are present in both result sets and eliminate duplicates.
   *
   * See docs: {@link https://orm.drizzle.team/docs/set-operations#intersect}
   *
   * @example
   *
   * ```ts
   * // Select course names that are offered in both departments A and B
   * await db.select({ courseName: depA.courseName })
   *   .from(depA)
   *   .intersect(
   *     db.select({ courseName: depB.courseName }).from(depB)
   *   );
   * // or
   * import { intersect } from 'drizzle-orm/pg-core'
   *
   * await intersect(
   *   db.select({ courseName: depA.courseName }).from(depA),
   *   db.select({ courseName: depB.courseName }).from(depB)
   * );
   * ```
   */
  intersect = this.createSetOperator("intersect", false);
  /**
   * Adds `intersect all` set operator to the query.
   *
   * Calling this method will retain only the rows that are present in both result sets including all duplicates.
   *
   * See docs: {@link https://orm.drizzle.team/docs/set-operations#intersect-all}
   *
   * @example
   *
   * ```ts
   * // Select all products and quantities that are ordered by both regular and VIP customers
   * await db.select({
   *   productId: regularCustomerOrders.productId,
   *   quantityOrdered: regularCustomerOrders.quantityOrdered
   * })
   * .from(regularCustomerOrders)
   * .intersectAll(
   *   db.select({
   *     productId: vipCustomerOrders.productId,
   *     quantityOrdered: vipCustomerOrders.quantityOrdered
   *   })
   *   .from(vipCustomerOrders)
   * );
   * // or
   * import { intersectAll } from 'drizzle-orm/pg-core'
   *
   * await intersectAll(
   *   db.select({
   *     productId: regularCustomerOrders.productId,
   *     quantityOrdered: regularCustomerOrders.quantityOrdered
   *   })
   *   .from(regularCustomerOrders),
   *   db.select({
   *     productId: vipCustomerOrders.productId,
   *     quantityOrdered: vipCustomerOrders.quantityOrdered
   *   })
   *   .from(vipCustomerOrders)
   * );
   * ```
   */
  intersectAll = this.createSetOperator("intersect", true);
  /**
   * Adds `except` set operator to the query.
   *
   * Calling this method will retrieve all unique rows from the left query, except for the rows that are present in the result set of the right query.
   *
   * See docs: {@link https://orm.drizzle.team/docs/set-operations#except}
   *
   * @example
   *
   * ```ts
   * // Select all courses offered in department A but not in department B
   * await db.select({ courseName: depA.courseName })
   *   .from(depA)
   *   .except(
   *     db.select({ courseName: depB.courseName }).from(depB)
   *   );
   * // or
   * import { except } from 'drizzle-orm/pg-core'
   *
   * await except(
   *   db.select({ courseName: depA.courseName }).from(depA),
   *   db.select({ courseName: depB.courseName }).from(depB)
   * );
   * ```
   */
  except = this.createSetOperator("except", false);
  /**
   * Adds `except all` set operator to the query.
   *
   * Calling this method will retrieve all rows from the left query, except for the rows that are present in the result set of the right query.
   *
   * See docs: {@link https://orm.drizzle.team/docs/set-operations#except-all}
   *
   * @example
   *
   * ```ts
   * // Select all products that are ordered by regular customers but not by VIP customers
   * await db.select({
   *   productId: regularCustomerOrders.productId,
   *   quantityOrdered: regularCustomerOrders.quantityOrdered,
   * })
   * .from(regularCustomerOrders)
   * .exceptAll(
   *   db.select({
   *     productId: vipCustomerOrders.productId,
   *     quantityOrdered: vipCustomerOrders.quantityOrdered,
   *   })
   *   .from(vipCustomerOrders)
   * );
   * // or
   * import { exceptAll } from 'drizzle-orm/pg-core'
   *
   * await exceptAll(
   *   db.select({
   *     productId: regularCustomerOrders.productId,
   *     quantityOrdered: regularCustomerOrders.quantityOrdered
   *   })
   *   .from(regularCustomerOrders),
   *   db.select({
   *     productId: vipCustomerOrders.productId,
   *     quantityOrdered: vipCustomerOrders.quantityOrdered
   *   })
   *   .from(vipCustomerOrders)
   * );
   * ```
   */
  exceptAll = this.createSetOperator("except", true);
  /** @internal */
  addSetOperators(setOperators) {
    this.config.setOperators.push(...setOperators);
    return this;
  }
  /**
   * Adds a `where` clause to the query.
   *
   * Calling this method will select only those rows that fulfill a specified condition.
   *
   * See docs: {@link https://orm.drizzle.team/docs/select#filtering}
   *
   * @param where the `where` clause.
   *
   * @example
   * You can use conditional operators and `sql function` to filter the rows to be selected.
   *
   * ```ts
   * // Select all cars with green color
   * await db.select().from(cars).where(eq(cars.color, 'green'));
   * // or
   * await db.select().from(cars).where(sql`${cars.color} = 'green'`)
   * ```
   *
   * You can logically combine conditional operators with `and()` and `or()` operators:
   *
   * ```ts
   * // Select all BMW cars with a green color
   * await db.select().from(cars).where(and(eq(cars.color, 'green'), eq(cars.brand, 'BMW')));
   *
   * // Select all cars with the green or blue color
   * await db.select().from(cars).where(or(eq(cars.color, 'green'), eq(cars.color, 'blue')));
   * ```
   */
  where(where) {
    if (typeof where === "function") {
      where = where(
        new Proxy(
          this.config.fields,
          new SelectionProxyHandler({ sqlAliasedBehavior: "sql", sqlBehavior: "sql" })
        )
      );
    }
    this.config.where = where;
    return this;
  }
  /**
   * Adds a `having` clause to the query.
   *
   * Calling this method will select only those rows that fulfill a specified condition. It is typically used with aggregate functions to filter the aggregated data based on a specified condition.
   *
   * See docs: {@link https://orm.drizzle.team/docs/select#aggregations}
   *
   * @param having the `having` clause.
   *
   * @example
   *
   * ```ts
   * // Select all brands with more than one car
   * await db.select({
   * 	brand: cars.brand,
   * 	count: sql<number>`cast(count(${cars.id}) as int)`,
   * })
   *   .from(cars)
   *   .groupBy(cars.brand)
   *   .having(({ count }) => gt(count, 1));
   * ```
   */
  having(having) {
    if (typeof having === "function") {
      having = having(
        new Proxy(
          this.config.fields,
          new SelectionProxyHandler({ sqlAliasedBehavior: "sql", sqlBehavior: "sql" })
        )
      );
    }
    this.config.having = having;
    return this;
  }
  groupBy(...columns) {
    if (typeof columns[0] === "function") {
      const groupBy = columns[0](
        new Proxy(
          this.config.fields,
          new SelectionProxyHandler({ sqlAliasedBehavior: "alias", sqlBehavior: "sql" })
        )
      );
      this.config.groupBy = Array.isArray(groupBy) ? groupBy : [groupBy];
    } else {
      this.config.groupBy = columns;
    }
    return this;
  }
  orderBy(...columns) {
    if (typeof columns[0] === "function") {
      const orderBy = columns[0](
        new Proxy(
          this.config.fields,
          new SelectionProxyHandler({ sqlAliasedBehavior: "alias", sqlBehavior: "sql" })
        )
      );
      const orderByArray = Array.isArray(orderBy) ? orderBy : [orderBy];
      if (this.config.setOperators.length > 0) {
        this.config.setOperators.at(-1).orderBy = orderByArray;
      } else {
        this.config.orderBy = orderByArray;
      }
    } else {
      const orderByArray = columns;
      if (this.config.setOperators.length > 0) {
        this.config.setOperators.at(-1).orderBy = orderByArray;
      } else {
        this.config.orderBy = orderByArray;
      }
    }
    return this;
  }
  /**
   * Adds a `limit` clause to the query.
   *
   * Calling this method will set the maximum number of rows that will be returned by this query.
   *
   * See docs: {@link https://orm.drizzle.team/docs/select#limit--offset}
   *
   * @param limit the `limit` clause.
   *
   * @example
   *
   * ```ts
   * // Get the first 10 people from this query.
   * await db.select().from(people).limit(10);
   * ```
   */
  limit(limit) {
    if (this.config.setOperators.length > 0) {
      this.config.setOperators.at(-1).limit = limit;
    } else {
      this.config.limit = limit;
    }
    return this;
  }
  /**
   * Adds an `offset` clause to the query.
   *
   * Calling this method will skip a number of rows when returning results from this query.
   *
   * See docs: {@link https://orm.drizzle.team/docs/select#limit--offset}
   *
   * @param offset the `offset` clause.
   *
   * @example
   *
   * ```ts
   * // Get the 10th-20th people from this query.
   * await db.select().from(people).offset(10).limit(10);
   * ```
   */
  offset(offset) {
    if (this.config.setOperators.length > 0) {
      this.config.setOperators.at(-1).offset = offset;
    } else {
      this.config.offset = offset;
    }
    return this;
  }
  /**
   * Adds a `for` clause to the query.
   *
   * Calling this method will specify a lock strength for this query that controls how strictly it acquires exclusive access to the rows being queried.
   *
   * See docs: {@link https://www.postgresql.org/docs/current/sql-select.html#SQL-FOR-UPDATE-SHARE}
   *
   * @param strength the lock strength.
   * @param config the lock configuration.
   */
  for(strength, config = {}) {
    this.config.lockingClause = { strength, config };
    return this;
  }
  /** @internal */
  getSQL() {
    return this.dialect.buildSelectQuery(this.config);
  }
  toSQL() {
    const { typings: _typings, ...rest } = this.dialect.sqlToQuery(this.getSQL());
    return rest;
  }
  as(alias) {
    const usedTables = [];
    usedTables.push(...extractUsedTable(this.config.table));
    if (this.config.joins) {
      for (const it of this.config.joins) usedTables.push(...extractUsedTable(it.table));
    }
    return new Proxy(
      new Subquery(this.getSQL(), this.config.fields, alias, false, [...new Set(usedTables)]),
      new SelectionProxyHandler({ alias, sqlAliasedBehavior: "alias", sqlBehavior: "error" })
    );
  }
  /** @internal */
  getSelectedFields() {
    return new Proxy(
      this.config.fields,
      new SelectionProxyHandler({ alias: this.tableName, sqlAliasedBehavior: "alias", sqlBehavior: "error" })
    );
  }
  $dynamic() {
    return this;
  }
  $withCache(config) {
    this.cacheConfig = config === void 0 ? { config: {}, enable: true, autoInvalidate: true } : config === false ? { enable: false } : { enable: true, autoInvalidate: true, ...config };
    return this;
  }
};
var PgSelectBase = class extends PgSelectQueryBuilderBase {
  static [entityKind] = "PgSelect";
  /** @internal */
  _prepare(name) {
    const { session, config, dialect, joinsNotNullableMap, authToken, cacheConfig, usedTables } = this;
    if (!session) {
      throw new Error("Cannot execute a query on a query builder. Please use a database instance instead.");
    }
    const { fields } = config;
    return tracer.startActiveSpan("drizzle.prepareQuery", () => {
      const fieldsList = orderSelectedFields(fields);
      const query = session.prepareQuery(dialect.sqlToQuery(this.getSQL()), fieldsList, name, true, void 0, {
        type: "select",
        tables: [...usedTables]
      }, cacheConfig);
      query.joinsNotNullableMap = joinsNotNullableMap;
      return query.setToken(authToken);
    });
  }
  /**
   * Create a prepared statement for this query. This allows
   * the database to remember this query for the given session
   * and call it by name, rather than specifying the full query.
   *
   * {@link https://www.postgresql.org/docs/current/sql-prepare.html | Postgres prepare documentation}
   */
  prepare(name) {
    return this._prepare(name);
  }
  authToken;
  /** @internal */
  setToken(token) {
    this.authToken = token;
    return this;
  }
  execute = (placeholderValues) => {
    return tracer.startActiveSpan("drizzle.operation", () => {
      return this._prepare().execute(placeholderValues, this.authToken);
    });
  };
};
applyMixins(PgSelectBase, [QueryPromise]);
function createSetOperator(type, isAll) {
  return (leftSelect, rightSelect, ...restSelects) => {
    const setOperators = [rightSelect, ...restSelects].map((select) => ({
      type,
      isAll,
      rightSelect: select
    }));
    for (const setOperator of setOperators) {
      if (!haveSameKeys(leftSelect.getSelectedFields(), setOperator.rightSelect.getSelectedFields())) {
        throw new Error(
          "Set operator error (union / intersect / except): selected fields are not the same or are in a different order"
        );
      }
    }
    return leftSelect.addSetOperators(setOperators);
  };
}
var getPgSetOperators = () => ({
  union,
  unionAll,
  intersect,
  intersectAll,
  except,
  exceptAll
});
var union = createSetOperator("union", false);
var unionAll = createSetOperator("union", true);
var intersect = createSetOperator("intersect", false);
var intersectAll = createSetOperator("intersect", true);
var except = createSetOperator("except", false);
var exceptAll = createSetOperator("except", true);

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.3_pg@8.22.0/node_modules/drizzle-orm/pg-core/query-builders/query-builder.js
var QueryBuilder = class {
  static [entityKind] = "PgQueryBuilder";
  dialect;
  dialectConfig;
  constructor(dialect) {
    this.dialect = is(dialect, PgDialect) ? dialect : void 0;
    this.dialectConfig = is(dialect, PgDialect) ? void 0 : dialect;
  }
  $with = (alias, selection) => {
    const queryBuilder = this;
    const as = (qb) => {
      if (typeof qb === "function") {
        qb = qb(queryBuilder);
      }
      return new Proxy(
        new WithSubquery(
          qb.getSQL(),
          selection ?? ("getSelectedFields" in qb ? qb.getSelectedFields() ?? {} : {}),
          alias,
          true
        ),
        new SelectionProxyHandler({ alias, sqlAliasedBehavior: "alias", sqlBehavior: "error" })
      );
    };
    return { as };
  };
  with(...queries) {
    const self = this;
    function select(fields) {
      return new PgSelectBuilder({
        fields: fields ?? void 0,
        session: void 0,
        dialect: self.getDialect(),
        withList: queries
      });
    }
    function selectDistinct(fields) {
      return new PgSelectBuilder({
        fields: fields ?? void 0,
        session: void 0,
        dialect: self.getDialect(),
        distinct: true
      });
    }
    function selectDistinctOn(on, fields) {
      return new PgSelectBuilder({
        fields: fields ?? void 0,
        session: void 0,
        dialect: self.getDialect(),
        distinct: { on }
      });
    }
    return { select, selectDistinct, selectDistinctOn };
  }
  select(fields) {
    return new PgSelectBuilder({
      fields: fields ?? void 0,
      session: void 0,
      dialect: this.getDialect()
    });
  }
  selectDistinct(fields) {
    return new PgSelectBuilder({
      fields: fields ?? void 0,
      session: void 0,
      dialect: this.getDialect(),
      distinct: true
    });
  }
  selectDistinctOn(on, fields) {
    return new PgSelectBuilder({
      fields: fields ?? void 0,
      session: void 0,
      dialect: this.getDialect(),
      distinct: { on }
    });
  }
  // Lazy load dialect to avoid circular dependency
  getDialect() {
    if (!this.dialect) {
      this.dialect = new PgDialect(this.dialectConfig);
    }
    return this.dialect;
  }
};

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.3_pg@8.22.0/node_modules/drizzle-orm/pg-core/utils.js
function extractUsedTable(table) {
  if (is(table, PgTable)) {
    return [table[Schema] ? `${table[Schema]}.${table[Table.Symbol.BaseName]}` : table[Table.Symbol.BaseName]];
  }
  if (is(table, Subquery)) {
    return table._.usedTables ?? [];
  }
  if (is(table, SQL)) {
    return table.usedTables ?? [];
  }
  return [];
}

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.3_pg@8.22.0/node_modules/drizzle-orm/pg-core/query-builders/delete.js
var PgDeleteBase = class extends QueryPromise {
  constructor(table, session, dialect, withList) {
    super();
    this.session = session;
    this.dialect = dialect;
    this.config = { table, withList };
  }
  static [entityKind] = "PgDelete";
  config;
  cacheConfig;
  /**
   * Adds a `where` clause to the query.
   *
   * Calling this method will delete only those rows that fulfill a specified condition.
   *
   * See docs: {@link https://orm.drizzle.team/docs/delete}
   *
   * @param where the `where` clause.
   *
   * @example
   * You can use conditional operators and `sql function` to filter the rows to be deleted.
   *
   * ```ts
   * // Delete all cars with green color
   * await db.delete(cars).where(eq(cars.color, 'green'));
   * // or
   * await db.delete(cars).where(sql`${cars.color} = 'green'`)
   * ```
   *
   * You can logically combine conditional operators with `and()` and `or()` operators:
   *
   * ```ts
   * // Delete all BMW cars with a green color
   * await db.delete(cars).where(and(eq(cars.color, 'green'), eq(cars.brand, 'BMW')));
   *
   * // Delete all cars with the green or blue color
   * await db.delete(cars).where(or(eq(cars.color, 'green'), eq(cars.color, 'blue')));
   * ```
   */
  where(where) {
    this.config.where = where;
    return this;
  }
  returning(fields = this.config.table[Table.Symbol.Columns]) {
    this.config.returningFields = fields;
    this.config.returning = orderSelectedFields(fields);
    return this;
  }
  /** @internal */
  getSQL() {
    return this.dialect.buildDeleteQuery(this.config);
  }
  toSQL() {
    const { typings: _typings, ...rest } = this.dialect.sqlToQuery(this.getSQL());
    return rest;
  }
  /** @internal */
  _prepare(name) {
    return tracer.startActiveSpan("drizzle.prepareQuery", () => {
      return this.session.prepareQuery(this.dialect.sqlToQuery(this.getSQL()), this.config.returning, name, true, void 0, {
        type: "delete",
        tables: extractUsedTable(this.config.table)
      }, this.cacheConfig);
    });
  }
  prepare(name) {
    return this._prepare(name);
  }
  authToken;
  /** @internal */
  setToken(token) {
    this.authToken = token;
    return this;
  }
  execute = (placeholderValues) => {
    return tracer.startActiveSpan("drizzle.operation", () => {
      return this._prepare().execute(placeholderValues, this.authToken);
    });
  };
  /** @internal */
  getSelectedFields() {
    return this.config.returningFields ? new Proxy(
      this.config.returningFields,
      new SelectionProxyHandler({
        alias: getTableName(this.config.table),
        sqlAliasedBehavior: "alias",
        sqlBehavior: "error"
      })
    ) : void 0;
  }
  $dynamic() {
    return this;
  }
};

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.3_pg@8.22.0/node_modules/drizzle-orm/pg-core/query-builders/insert.js
var PgInsertBuilder = class {
  constructor(table, session, dialect, withList, overridingSystemValue_) {
    this.table = table;
    this.session = session;
    this.dialect = dialect;
    this.withList = withList;
    this.overridingSystemValue_ = overridingSystemValue_;
  }
  static [entityKind] = "PgInsertBuilder";
  authToken;
  /** @internal */
  setToken(token) {
    this.authToken = token;
    return this;
  }
  overridingSystemValue() {
    this.overridingSystemValue_ = true;
    return this;
  }
  values(values) {
    values = Array.isArray(values) ? values : [values];
    if (values.length === 0) {
      throw new Error("values() must be called with at least one value");
    }
    const mappedValues = values.map((entry) => {
      const result = {};
      const cols = this.table[Table.Symbol.Columns];
      for (const colKey of Object.keys(entry)) {
        const colValue = entry[colKey];
        result[colKey] = is(colValue, SQL) ? colValue : new Param(colValue, cols[colKey]);
      }
      return result;
    });
    return new PgInsertBase(
      this.table,
      mappedValues,
      this.session,
      this.dialect,
      this.withList,
      false,
      this.overridingSystemValue_
    ).setToken(this.authToken);
  }
  select(selectQuery) {
    const select = typeof selectQuery === "function" ? selectQuery(new QueryBuilder()) : selectQuery;
    if (!is(select, SQL) && !haveSameKeys(this.table[Columns], select._.selectedFields)) {
      throw new Error(
        "Insert select error: selected fields are not the same or are in a different order compared to the table definition"
      );
    }
    return new PgInsertBase(this.table, select, this.session, this.dialect, this.withList, true);
  }
};
var PgInsertBase = class extends QueryPromise {
  constructor(table, values, session, dialect, withList, select, overridingSystemValue_) {
    super();
    this.session = session;
    this.dialect = dialect;
    this.config = { table, values, withList, select, overridingSystemValue_ };
  }
  static [entityKind] = "PgInsert";
  config;
  cacheConfig;
  returning(fields = this.config.table[Table.Symbol.Columns]) {
    this.config.returningFields = fields;
    this.config.returning = orderSelectedFields(fields);
    return this;
  }
  /**
   * Adds an `on conflict do nothing` clause to the query.
   *
   * Calling this method simply avoids inserting a row as its alternative action.
   *
   * See docs: {@link https://orm.drizzle.team/docs/insert#on-conflict-do-nothing}
   *
   * @param config The `target` and `where` clauses.
   *
   * @example
   * ```ts
   * // Insert one row and cancel the insert if there's a conflict
   * await db.insert(cars)
   *   .values({ id: 1, brand: 'BMW' })
   *   .onConflictDoNothing();
   *
   * // Explicitly specify conflict target
   * await db.insert(cars)
   *   .values({ id: 1, brand: 'BMW' })
   *   .onConflictDoNothing({ target: cars.id });
   * ```
   */
  onConflictDoNothing(config = {}) {
    if (config.target === void 0) {
      this.config.onConflict = sql`do nothing`;
    } else {
      let targetColumn = "";
      targetColumn = Array.isArray(config.target) ? config.target.map((it) => this.dialect.escapeName(this.dialect.casing.getColumnCasing(it))).join(",") : this.dialect.escapeName(this.dialect.casing.getColumnCasing(config.target));
      const whereSql = config.where ? sql` where ${config.where}` : void 0;
      this.config.onConflict = sql`(${sql.raw(targetColumn)})${whereSql} do nothing`;
    }
    return this;
  }
  /**
   * Adds an `on conflict do update` clause to the query.
   *
   * Calling this method will update the existing row that conflicts with the row proposed for insertion as its alternative action.
   *
   * See docs: {@link https://orm.drizzle.team/docs/insert#upserts-and-conflicts}
   *
   * @param config The `target`, `set` and `where` clauses.
   *
   * @example
   * ```ts
   * // Update the row if there's a conflict
   * await db.insert(cars)
   *   .values({ id: 1, brand: 'BMW' })
   *   .onConflictDoUpdate({
   *     target: cars.id,
   *     set: { brand: 'Porsche' }
   *   });
   *
   * // Upsert with 'where' clause
   * await db.insert(cars)
   *   .values({ id: 1, brand: 'BMW' })
   *   .onConflictDoUpdate({
   *     target: cars.id,
   *     set: { brand: 'newBMW' },
   *     targetWhere: sql`${cars.createdAt} > '2023-01-01'::date`,
   *   });
   * ```
   */
  onConflictDoUpdate(config) {
    if (config.where && (config.targetWhere || config.setWhere)) {
      throw new Error(
        'You cannot use both "where" and "targetWhere"/"setWhere" at the same time - "where" is deprecated, use "targetWhere" or "setWhere" instead.'
      );
    }
    const whereSql = config.where ? sql` where ${config.where}` : void 0;
    const targetWhereSql = config.targetWhere ? sql` where ${config.targetWhere}` : void 0;
    const setWhereSql = config.setWhere ? sql` where ${config.setWhere}` : void 0;
    const setSql = this.dialect.buildUpdateSet(this.config.table, mapUpdateSet(this.config.table, config.set));
    let targetColumn = "";
    targetColumn = Array.isArray(config.target) ? config.target.map((it) => this.dialect.escapeName(this.dialect.casing.getColumnCasing(it))).join(",") : this.dialect.escapeName(this.dialect.casing.getColumnCasing(config.target));
    this.config.onConflict = sql`(${sql.raw(targetColumn)})${targetWhereSql} do update set ${setSql}${whereSql}${setWhereSql}`;
    return this;
  }
  /** @internal */
  getSQL() {
    return this.dialect.buildInsertQuery(this.config);
  }
  toSQL() {
    const { typings: _typings, ...rest } = this.dialect.sqlToQuery(this.getSQL());
    return rest;
  }
  /** @internal */
  _prepare(name) {
    return tracer.startActiveSpan("drizzle.prepareQuery", () => {
      return this.session.prepareQuery(this.dialect.sqlToQuery(this.getSQL()), this.config.returning, name, true, void 0, {
        type: "insert",
        tables: extractUsedTable(this.config.table)
      }, this.cacheConfig);
    });
  }
  prepare(name) {
    return this._prepare(name);
  }
  authToken;
  /** @internal */
  setToken(token) {
    this.authToken = token;
    return this;
  }
  execute = (placeholderValues) => {
    return tracer.startActiveSpan("drizzle.operation", () => {
      return this._prepare().execute(placeholderValues, this.authToken);
    });
  };
  /** @internal */
  getSelectedFields() {
    return this.config.returningFields ? new Proxy(
      this.config.returningFields,
      new SelectionProxyHandler({
        alias: getTableName(this.config.table),
        sqlAliasedBehavior: "alias",
        sqlBehavior: "error"
      })
    ) : void 0;
  }
  $dynamic() {
    return this;
  }
};

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.3_pg@8.22.0/node_modules/drizzle-orm/pg-core/query-builders/refresh-materialized-view.js
var PgRefreshMaterializedView = class extends QueryPromise {
  constructor(view, session, dialect) {
    super();
    this.session = session;
    this.dialect = dialect;
    this.config = { view };
  }
  static [entityKind] = "PgRefreshMaterializedView";
  config;
  concurrently() {
    if (this.config.withNoData !== void 0) {
      throw new Error("Cannot use concurrently and withNoData together");
    }
    this.config.concurrently = true;
    return this;
  }
  withNoData() {
    if (this.config.concurrently !== void 0) {
      throw new Error("Cannot use concurrently and withNoData together");
    }
    this.config.withNoData = true;
    return this;
  }
  /** @internal */
  getSQL() {
    return this.dialect.buildRefreshMaterializedViewQuery(this.config);
  }
  toSQL() {
    const { typings: _typings, ...rest } = this.dialect.sqlToQuery(this.getSQL());
    return rest;
  }
  /** @internal */
  _prepare(name) {
    return tracer.startActiveSpan("drizzle.prepareQuery", () => {
      return this.session.prepareQuery(this.dialect.sqlToQuery(this.getSQL()), void 0, name, true);
    });
  }
  prepare(name) {
    return this._prepare(name);
  }
  authToken;
  /** @internal */
  setToken(token) {
    this.authToken = token;
    return this;
  }
  execute = (placeholderValues) => {
    return tracer.startActiveSpan("drizzle.operation", () => {
      return this._prepare().execute(placeholderValues, this.authToken);
    });
  };
};

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.3_pg@8.22.0/node_modules/drizzle-orm/pg-core/query-builders/update.js
var PgUpdateBuilder = class {
  constructor(table, session, dialect, withList) {
    this.table = table;
    this.session = session;
    this.dialect = dialect;
    this.withList = withList;
  }
  static [entityKind] = "PgUpdateBuilder";
  authToken;
  setToken(token) {
    this.authToken = token;
    return this;
  }
  set(values) {
    return new PgUpdateBase(
      this.table,
      mapUpdateSet(this.table, values),
      this.session,
      this.dialect,
      this.withList
    ).setToken(this.authToken);
  }
};
var PgUpdateBase = class extends QueryPromise {
  constructor(table, set, session, dialect, withList) {
    super();
    this.session = session;
    this.dialect = dialect;
    this.config = { set, table, withList, joins: [] };
    this.tableName = getTableLikeName(table);
    this.joinsNotNullableMap = typeof this.tableName === "string" ? { [this.tableName]: true } : {};
  }
  static [entityKind] = "PgUpdate";
  config;
  tableName;
  joinsNotNullableMap;
  cacheConfig;
  from(source) {
    const src = source;
    const tableName = getTableLikeName(src);
    if (typeof tableName === "string") {
      this.joinsNotNullableMap[tableName] = true;
    }
    this.config.from = src;
    return this;
  }
  getTableLikeFields(table) {
    if (is(table, PgTable)) {
      return table[Table.Symbol.Columns];
    } else if (is(table, Subquery)) {
      return table._.selectedFields;
    }
    return table[ViewBaseConfig].selectedFields;
  }
  createJoin(joinType) {
    return (table, on) => {
      const tableName = getTableLikeName(table);
      if (typeof tableName === "string" && this.config.joins.some((join) => join.alias === tableName)) {
        throw new Error(`Alias "${tableName}" is already used in this query`);
      }
      if (typeof on === "function") {
        const from = this.config.from && !is(this.config.from, SQL) ? this.getTableLikeFields(this.config.from) : void 0;
        on = on(
          new Proxy(
            this.config.table[Table.Symbol.Columns],
            new SelectionProxyHandler({ sqlAliasedBehavior: "sql", sqlBehavior: "sql" })
          ),
          from && new Proxy(
            from,
            new SelectionProxyHandler({ sqlAliasedBehavior: "sql", sqlBehavior: "sql" })
          )
        );
      }
      this.config.joins.push({ on, table, joinType, alias: tableName });
      if (typeof tableName === "string") {
        switch (joinType) {
          case "left": {
            this.joinsNotNullableMap[tableName] = false;
            break;
          }
          case "right": {
            this.joinsNotNullableMap = Object.fromEntries(
              Object.entries(this.joinsNotNullableMap).map(([key]) => [key, false])
            );
            this.joinsNotNullableMap[tableName] = true;
            break;
          }
          case "inner": {
            this.joinsNotNullableMap[tableName] = true;
            break;
          }
          case "full": {
            this.joinsNotNullableMap = Object.fromEntries(
              Object.entries(this.joinsNotNullableMap).map(([key]) => [key, false])
            );
            this.joinsNotNullableMap[tableName] = false;
            break;
          }
        }
      }
      return this;
    };
  }
  leftJoin = this.createJoin("left");
  rightJoin = this.createJoin("right");
  innerJoin = this.createJoin("inner");
  fullJoin = this.createJoin("full");
  /**
   * Adds a 'where' clause to the query.
   *
   * Calling this method will update only those rows that fulfill a specified condition.
   *
   * See docs: {@link https://orm.drizzle.team/docs/update}
   *
   * @param where the 'where' clause.
   *
   * @example
   * You can use conditional operators and `sql function` to filter the rows to be updated.
   *
   * ```ts
   * // Update all cars with green color
   * await db.update(cars).set({ color: 'red' })
   *   .where(eq(cars.color, 'green'));
   * // or
   * await db.update(cars).set({ color: 'red' })
   *   .where(sql`${cars.color} = 'green'`)
   * ```
   *
   * You can logically combine conditional operators with `and()` and `or()` operators:
   *
   * ```ts
   * // Update all BMW cars with a green color
   * await db.update(cars).set({ color: 'red' })
   *   .where(and(eq(cars.color, 'green'), eq(cars.brand, 'BMW')));
   *
   * // Update all cars with the green or blue color
   * await db.update(cars).set({ color: 'red' })
   *   .where(or(eq(cars.color, 'green'), eq(cars.color, 'blue')));
   * ```
   */
  where(where) {
    this.config.where = where;
    return this;
  }
  returning(fields) {
    if (!fields) {
      fields = Object.assign({}, this.config.table[Table.Symbol.Columns]);
      if (this.config.from) {
        const tableName = getTableLikeName(this.config.from);
        if (typeof tableName === "string" && this.config.from && !is(this.config.from, SQL)) {
          const fromFields = this.getTableLikeFields(this.config.from);
          fields[tableName] = fromFields;
        }
        for (const join of this.config.joins) {
          const tableName2 = getTableLikeName(join.table);
          if (typeof tableName2 === "string" && !is(join.table, SQL)) {
            const fromFields = this.getTableLikeFields(join.table);
            fields[tableName2] = fromFields;
          }
        }
      }
    }
    this.config.returningFields = fields;
    this.config.returning = orderSelectedFields(fields);
    return this;
  }
  /** @internal */
  getSQL() {
    return this.dialect.buildUpdateQuery(this.config);
  }
  toSQL() {
    const { typings: _typings, ...rest } = this.dialect.sqlToQuery(this.getSQL());
    return rest;
  }
  /** @internal */
  _prepare(name) {
    const query = this.session.prepareQuery(this.dialect.sqlToQuery(this.getSQL()), this.config.returning, name, true, void 0, {
      type: "insert",
      tables: extractUsedTable(this.config.table)
    }, this.cacheConfig);
    query.joinsNotNullableMap = this.joinsNotNullableMap;
    return query;
  }
  prepare(name) {
    return this._prepare(name);
  }
  authToken;
  /** @internal */
  setToken(token) {
    this.authToken = token;
    return this;
  }
  execute = (placeholderValues) => {
    return this._prepare().execute(placeholderValues, this.authToken);
  };
  /** @internal */
  getSelectedFields() {
    return this.config.returningFields ? new Proxy(
      this.config.returningFields,
      new SelectionProxyHandler({
        alias: getTableName(this.config.table),
        sqlAliasedBehavior: "alias",
        sqlBehavior: "error"
      })
    ) : void 0;
  }
  $dynamic() {
    return this;
  }
};

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.3_pg@8.22.0/node_modules/drizzle-orm/pg-core/query-builders/count.js
var PgCountBuilder = class _PgCountBuilder extends SQL {
  constructor(params) {
    super(_PgCountBuilder.buildEmbeddedCount(params.source, params.filters).queryChunks);
    this.params = params;
    this.mapWith(Number);
    this.session = params.session;
    this.sql = _PgCountBuilder.buildCount(
      params.source,
      params.filters
    );
  }
  sql;
  token;
  static [entityKind] = "PgCountBuilder";
  [Symbol.toStringTag] = "PgCountBuilder";
  session;
  static buildEmbeddedCount(source, filters) {
    return sql`(select count(*) from ${source}${sql.raw(" where ").if(filters)}${filters})`;
  }
  static buildCount(source, filters) {
    return sql`select count(*) as count from ${source}${sql.raw(" where ").if(filters)}${filters};`;
  }
  /** @intrnal */
  setToken(token) {
    this.token = token;
    return this;
  }
  then(onfulfilled, onrejected) {
    return Promise.resolve(this.session.count(this.sql, this.token)).then(
      onfulfilled,
      onrejected
    );
  }
  catch(onRejected) {
    return this.then(void 0, onRejected);
  }
  finally(onFinally) {
    return this.then(
      (value) => {
        onFinally?.();
        return value;
      },
      (reason) => {
        onFinally?.();
        throw reason;
      }
    );
  }
};

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.3_pg@8.22.0/node_modules/drizzle-orm/pg-core/query-builders/query.js
var RelationalQueryBuilder = class {
  constructor(fullSchema, schema, tableNamesMap, table, tableConfig, dialect, session) {
    this.fullSchema = fullSchema;
    this.schema = schema;
    this.tableNamesMap = tableNamesMap;
    this.table = table;
    this.tableConfig = tableConfig;
    this.dialect = dialect;
    this.session = session;
  }
  static [entityKind] = "PgRelationalQueryBuilder";
  findMany(config) {
    return new PgRelationalQuery(
      this.fullSchema,
      this.schema,
      this.tableNamesMap,
      this.table,
      this.tableConfig,
      this.dialect,
      this.session,
      config ? config : {},
      "many"
    );
  }
  findFirst(config) {
    return new PgRelationalQuery(
      this.fullSchema,
      this.schema,
      this.tableNamesMap,
      this.table,
      this.tableConfig,
      this.dialect,
      this.session,
      config ? { ...config, limit: 1 } : { limit: 1 },
      "first"
    );
  }
};
var PgRelationalQuery = class extends QueryPromise {
  constructor(fullSchema, schema, tableNamesMap, table, tableConfig, dialect, session, config, mode) {
    super();
    this.fullSchema = fullSchema;
    this.schema = schema;
    this.tableNamesMap = tableNamesMap;
    this.table = table;
    this.tableConfig = tableConfig;
    this.dialect = dialect;
    this.session = session;
    this.config = config;
    this.mode = mode;
  }
  static [entityKind] = "PgRelationalQuery";
  /** @internal */
  _prepare(name) {
    return tracer.startActiveSpan("drizzle.prepareQuery", () => {
      const { query, builtQuery } = this._toSQL();
      return this.session.prepareQuery(
        builtQuery,
        void 0,
        name,
        true,
        (rawRows, mapColumnValue) => {
          const rows = rawRows.map(
            (row) => mapRelationalRow(this.schema, this.tableConfig, row, query.selection, mapColumnValue)
          );
          if (this.mode === "first") {
            return rows[0];
          }
          return rows;
        }
      );
    });
  }
  prepare(name) {
    return this._prepare(name);
  }
  _getQuery() {
    return this.dialect.buildRelationalQueryWithoutPK({
      fullSchema: this.fullSchema,
      schema: this.schema,
      tableNamesMap: this.tableNamesMap,
      table: this.table,
      tableConfig: this.tableConfig,
      queryConfig: this.config,
      tableAlias: this.tableConfig.tsName
    });
  }
  /** @internal */
  getSQL() {
    return this._getQuery().sql;
  }
  _toSQL() {
    const query = this._getQuery();
    const builtQuery = this.dialect.sqlToQuery(query.sql);
    return { query, builtQuery };
  }
  toSQL() {
    return this._toSQL().builtQuery;
  }
  authToken;
  /** @internal */
  setToken(token) {
    this.authToken = token;
    return this;
  }
  execute() {
    return tracer.startActiveSpan("drizzle.operation", () => {
      return this._prepare().execute(void 0, this.authToken);
    });
  }
};

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.3_pg@8.22.0/node_modules/drizzle-orm/pg-core/query-builders/raw.js
var PgRaw = class extends QueryPromise {
  constructor(execute, sql2, query, mapBatchResult) {
    super();
    this.execute = execute;
    this.sql = sql2;
    this.query = query;
    this.mapBatchResult = mapBatchResult;
  }
  static [entityKind] = "PgRaw";
  /** @internal */
  getSQL() {
    return this.sql;
  }
  getQuery() {
    return this.query;
  }
  mapResult(result, isFromBatch) {
    return isFromBatch ? this.mapBatchResult(result) : result;
  }
  _prepare() {
    return this;
  }
  /** @internal */
  isResponseInArrayMode() {
    return false;
  }
};

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.3_pg@8.22.0/node_modules/drizzle-orm/pg-core/db.js
var PgDatabase = class {
  constructor(dialect, session, schema) {
    this.dialect = dialect;
    this.session = session;
    this._ = schema ? {
      schema: schema.schema,
      fullSchema: schema.fullSchema,
      tableNamesMap: schema.tableNamesMap,
      session
    } : {
      schema: void 0,
      fullSchema: {},
      tableNamesMap: {},
      session
    };
    this.query = {};
    if (this._.schema) {
      for (const [tableName, columns] of Object.entries(this._.schema)) {
        this.query[tableName] = new RelationalQueryBuilder(
          schema.fullSchema,
          this._.schema,
          this._.tableNamesMap,
          schema.fullSchema[tableName],
          columns,
          dialect,
          session
        );
      }
    }
    this.$cache = { invalidate: async (_params) => {
    } };
  }
  static [entityKind] = "PgDatabase";
  query;
  /**
   * Creates a subquery that defines a temporary named result set as a CTE.
   *
   * It is useful for breaking down complex queries into simpler parts and for reusing the result set in subsequent parts of the query.
   *
   * See docs: {@link https://orm.drizzle.team/docs/select#with-clause}
   *
   * @param alias The alias for the subquery.
   *
   * Failure to provide an alias will result in a DrizzleTypeError, preventing the subquery from being referenced in other queries.
   *
   * @example
   *
   * ```ts
   * // Create a subquery with alias 'sq' and use it in the select query
   * const sq = db.$with('sq').as(db.select().from(users).where(eq(users.id, 42)));
   *
   * const result = await db.with(sq).select().from(sq);
   * ```
   *
   * To select arbitrary SQL values as fields in a CTE and reference them in other CTEs or in the main query, you need to add aliases to them:
   *
   * ```ts
   * // Select an arbitrary SQL value as a field in a CTE and reference it in the main query
   * const sq = db.$with('sq').as(db.select({
   *   name: sql<string>`upper(${users.name})`.as('name'),
   * })
   * .from(users));
   *
   * const result = await db.with(sq).select({ name: sq.name }).from(sq);
   * ```
   */
  $with = (alias, selection) => {
    const self = this;
    const as = (qb) => {
      if (typeof qb === "function") {
        qb = qb(new QueryBuilder(self.dialect));
      }
      return new Proxy(
        new WithSubquery(
          qb.getSQL(),
          selection ?? ("getSelectedFields" in qb ? qb.getSelectedFields() ?? {} : {}),
          alias,
          true
        ),
        new SelectionProxyHandler({ alias, sqlAliasedBehavior: "alias", sqlBehavior: "error" })
      );
    };
    return { as };
  };
  $count(source, filters) {
    return new PgCountBuilder({ source, filters, session: this.session });
  }
  $cache;
  /**
   * Incorporates a previously defined CTE (using `$with`) into the main query.
   *
   * This method allows the main query to reference a temporary named result set.
   *
   * See docs: {@link https://orm.drizzle.team/docs/select#with-clause}
   *
   * @param queries The CTEs to incorporate into the main query.
   *
   * @example
   *
   * ```ts
   * // Define a subquery 'sq' as a CTE using $with
   * const sq = db.$with('sq').as(db.select().from(users).where(eq(users.id, 42)));
   *
   * // Incorporate the CTE 'sq' into the main query and select from it
   * const result = await db.with(sq).select().from(sq);
   * ```
   */
  with(...queries) {
    const self = this;
    function select(fields) {
      return new PgSelectBuilder({
        fields: fields ?? void 0,
        session: self.session,
        dialect: self.dialect,
        withList: queries
      });
    }
    function selectDistinct(fields) {
      return new PgSelectBuilder({
        fields: fields ?? void 0,
        session: self.session,
        dialect: self.dialect,
        withList: queries,
        distinct: true
      });
    }
    function selectDistinctOn(on, fields) {
      return new PgSelectBuilder({
        fields: fields ?? void 0,
        session: self.session,
        dialect: self.dialect,
        withList: queries,
        distinct: { on }
      });
    }
    function update(table) {
      return new PgUpdateBuilder(table, self.session, self.dialect, queries);
    }
    function insert(table) {
      return new PgInsertBuilder(table, self.session, self.dialect, queries);
    }
    function delete_(table) {
      return new PgDeleteBase(table, self.session, self.dialect, queries);
    }
    return { select, selectDistinct, selectDistinctOn, update, insert, delete: delete_ };
  }
  select(fields) {
    return new PgSelectBuilder({
      fields: fields ?? void 0,
      session: this.session,
      dialect: this.dialect
    });
  }
  selectDistinct(fields) {
    return new PgSelectBuilder({
      fields: fields ?? void 0,
      session: this.session,
      dialect: this.dialect,
      distinct: true
    });
  }
  selectDistinctOn(on, fields) {
    return new PgSelectBuilder({
      fields: fields ?? void 0,
      session: this.session,
      dialect: this.dialect,
      distinct: { on }
    });
  }
  /**
   * Creates an update query.
   *
   * Calling this method without `.where()` clause will update all rows in a table. The `.where()` clause specifies which rows should be updated.
   *
   * Use `.set()` method to specify which values to update.
   *
   * See docs: {@link https://orm.drizzle.team/docs/update}
   *
   * @param table The table to update.
   *
   * @example
   *
   * ```ts
   * // Update all rows in the 'cars' table
   * await db.update(cars).set({ color: 'red' });
   *
   * // Update rows with filters and conditions
   * await db.update(cars).set({ color: 'red' }).where(eq(cars.brand, 'BMW'));
   *
   * // Update with returning clause
   * const updatedCar: Car[] = await db.update(cars)
   *   .set({ color: 'red' })
   *   .where(eq(cars.id, 1))
   *   .returning();
   * ```
   */
  update(table) {
    return new PgUpdateBuilder(table, this.session, this.dialect);
  }
  /**
   * Creates an insert query.
   *
   * Calling this method will create new rows in a table. Use `.values()` method to specify which values to insert.
   *
   * See docs: {@link https://orm.drizzle.team/docs/insert}
   *
   * @param table The table to insert into.
   *
   * @example
   *
   * ```ts
   * // Insert one row
   * await db.insert(cars).values({ brand: 'BMW' });
   *
   * // Insert multiple rows
   * await db.insert(cars).values([{ brand: 'BMW' }, { brand: 'Porsche' }]);
   *
   * // Insert with returning clause
   * const insertedCar: Car[] = await db.insert(cars)
   *   .values({ brand: 'BMW' })
   *   .returning();
   * ```
   */
  insert(table) {
    return new PgInsertBuilder(table, this.session, this.dialect);
  }
  /**
   * Creates a delete query.
   *
   * Calling this method without `.where()` clause will delete all rows in a table. The `.where()` clause specifies which rows should be deleted.
   *
   * See docs: {@link https://orm.drizzle.team/docs/delete}
   *
   * @param table The table to delete from.
   *
   * @example
   *
   * ```ts
   * // Delete all rows in the 'cars' table
   * await db.delete(cars);
   *
   * // Delete rows with filters and conditions
   * await db.delete(cars).where(eq(cars.color, 'green'));
   *
   * // Delete with returning clause
   * const deletedCar: Car[] = await db.delete(cars)
   *   .where(eq(cars.id, 1))
   *   .returning();
   * ```
   */
  delete(table) {
    return new PgDeleteBase(table, this.session, this.dialect);
  }
  refreshMaterializedView(view) {
    return new PgRefreshMaterializedView(view, this.session, this.dialect);
  }
  authToken;
  execute(query) {
    const sequel = typeof query === "string" ? sql.raw(query) : query.getSQL();
    const builtQuery = this.dialect.sqlToQuery(sequel);
    const prepared = this.session.prepareQuery(
      builtQuery,
      void 0,
      void 0,
      false
    );
    return new PgRaw(
      () => prepared.execute(void 0, this.authToken),
      sequel,
      builtQuery,
      (result) => prepared.mapResult(result, true)
    );
  }
  transaction(transaction, config) {
    return this.session.transaction(transaction, config);
  }
};

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.3_pg@8.22.0/node_modules/drizzle-orm/node-postgres/session.js
import pg from "pg";

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.3_pg@8.22.0/node_modules/drizzle-orm/cache/core/cache.js
var Cache = class {
  static [entityKind] = "Cache";
};
var NoopCache = class extends Cache {
  strategy() {
    return "all";
  }
  static [entityKind] = "NoopCache";
  async get(_key) {
    return void 0;
  }
  async put(_hashedQuery, _response, _tables, _config) {
  }
  async onMutate(_params) {
  }
};
async function hashQuery(sql2, params) {
  const dataToHash = `${sql2}-${JSON.stringify(params)}`;
  const encoder2 = new TextEncoder();
  const data = encoder2.encode(dataToHash);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = [...new Uint8Array(hashBuffer)];
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  return hashHex;
}

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.3_pg@8.22.0/node_modules/drizzle-orm/pg-core/session.js
var PgPreparedQuery = class {
  constructor(query, cache2, queryMetadata, cacheConfig) {
    this.query = query;
    this.cache = cache2;
    this.queryMetadata = queryMetadata;
    this.cacheConfig = cacheConfig;
    if (cache2 && cache2.strategy() === "all" && cacheConfig === void 0) {
      this.cacheConfig = { enable: true, autoInvalidate: true };
    }
    if (!this.cacheConfig?.enable) {
      this.cacheConfig = void 0;
    }
  }
  authToken;
  getQuery() {
    return this.query;
  }
  mapResult(response, _isFromBatch) {
    return response;
  }
  /** @internal */
  setToken(token) {
    this.authToken = token;
    return this;
  }
  static [entityKind] = "PgPreparedQuery";
  /** @internal */
  joinsNotNullableMap;
  /** @internal */
  async queryWithCache(queryString, params, query) {
    if (this.cache === void 0 || is(this.cache, NoopCache) || this.queryMetadata === void 0) {
      try {
        return await query();
      } catch (e) {
        throw new DrizzleQueryError(queryString, params, e);
      }
    }
    if (this.cacheConfig && !this.cacheConfig.enable) {
      try {
        return await query();
      } catch (e) {
        throw new DrizzleQueryError(queryString, params, e);
      }
    }
    if ((this.queryMetadata.type === "insert" || this.queryMetadata.type === "update" || this.queryMetadata.type === "delete") && this.queryMetadata.tables.length > 0) {
      try {
        const [res] = await Promise.all([
          query(),
          this.cache.onMutate({ tables: this.queryMetadata.tables })
        ]);
        return res;
      } catch (e) {
        throw new DrizzleQueryError(queryString, params, e);
      }
    }
    if (!this.cacheConfig) {
      try {
        return await query();
      } catch (e) {
        throw new DrizzleQueryError(queryString, params, e);
      }
    }
    if (this.queryMetadata.type === "select") {
      const fromCache = await this.cache.get(
        this.cacheConfig.tag ?? await hashQuery(queryString, params),
        this.queryMetadata.tables,
        this.cacheConfig.tag !== void 0,
        this.cacheConfig.autoInvalidate
      );
      if (fromCache === void 0) {
        let result;
        try {
          result = await query();
        } catch (e) {
          throw new DrizzleQueryError(queryString, params, e);
        }
        await this.cache.put(
          this.cacheConfig.tag ?? await hashQuery(queryString, params),
          result,
          // make sure we send tables that were used in a query only if user wants to invalidate it on each write
          this.cacheConfig.autoInvalidate ? this.queryMetadata.tables : [],
          this.cacheConfig.tag !== void 0,
          this.cacheConfig.config
        );
        return result;
      }
      return fromCache;
    }
    try {
      return await query();
    } catch (e) {
      throw new DrizzleQueryError(queryString, params, e);
    }
  }
};
var PgSession = class {
  constructor(dialect) {
    this.dialect = dialect;
  }
  static [entityKind] = "PgSession";
  /** @internal */
  execute(query, token) {
    return tracer.startActiveSpan("drizzle.operation", () => {
      const prepared = tracer.startActiveSpan("drizzle.prepareQuery", () => {
        return this.prepareQuery(
          this.dialect.sqlToQuery(query),
          void 0,
          void 0,
          false
        );
      });
      return prepared.setToken(token).execute(void 0, token);
    });
  }
  all(query) {
    return this.prepareQuery(
      this.dialect.sqlToQuery(query),
      void 0,
      void 0,
      false
    ).all();
  }
  /** @internal */
  async count(sql2, token) {
    const res = await this.execute(sql2, token);
    return Number(
      res[0]["count"]
    );
  }
};
var PgTransaction = class extends PgDatabase {
  constructor(dialect, session, schema, nestedIndex = 0) {
    super(dialect, session, schema);
    this.schema = schema;
    this.nestedIndex = nestedIndex;
  }
  static [entityKind] = "PgTransaction";
  rollback() {
    throw new TransactionRollbackError();
  }
  /** @internal */
  getTransactionConfigSQL(config) {
    const chunks = [];
    if (config.isolationLevel) {
      chunks.push(`isolation level ${config.isolationLevel}`);
    }
    if (config.accessMode) {
      chunks.push(config.accessMode);
    }
    if (typeof config.deferrable === "boolean") {
      chunks.push(config.deferrable ? "deferrable" : "not deferrable");
    }
    return sql.raw(chunks.join(" "));
  }
  setTransaction(config) {
    return this.session.execute(sql`set transaction ${this.getTransactionConfigSQL(config)}`);
  }
};

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.3_pg@8.22.0/node_modules/drizzle-orm/node-postgres/session.js
var { Pool, types } = pg;
var NodePgPreparedQuery = class extends PgPreparedQuery {
  constructor(client, queryString, params, logger, cache2, queryMetadata, cacheConfig, fields, name, _isResponseInArrayMode, customResultMapper) {
    super({ sql: queryString, params }, cache2, queryMetadata, cacheConfig);
    this.client = client;
    this.queryString = queryString;
    this.params = params;
    this.logger = logger;
    this.fields = fields;
    this._isResponseInArrayMode = _isResponseInArrayMode;
    this.customResultMapper = customResultMapper;
    this.rawQueryConfig = {
      name,
      text: queryString,
      types: {
        // @ts-ignore
        getTypeParser: (typeId, format2) => {
          if (typeId === types.builtins.TIMESTAMPTZ) {
            return (val) => val;
          }
          if (typeId === types.builtins.TIMESTAMP) {
            return (val) => val;
          }
          if (typeId === types.builtins.DATE) {
            return (val) => val;
          }
          if (typeId === types.builtins.INTERVAL) {
            return (val) => val;
          }
          if (typeId === 1231) {
            return (val) => val;
          }
          if (typeId === 1115) {
            return (val) => val;
          }
          if (typeId === 1185) {
            return (val) => val;
          }
          if (typeId === 1187) {
            return (val) => val;
          }
          if (typeId === 1182) {
            return (val) => val;
          }
          return types.getTypeParser(typeId, format2);
        }
      }
    };
    this.queryConfig = {
      name,
      text: queryString,
      rowMode: "array",
      types: {
        // @ts-ignore
        getTypeParser: (typeId, format2) => {
          if (typeId === types.builtins.TIMESTAMPTZ) {
            return (val) => val;
          }
          if (typeId === types.builtins.TIMESTAMP) {
            return (val) => val;
          }
          if (typeId === types.builtins.DATE) {
            return (val) => val;
          }
          if (typeId === types.builtins.INTERVAL) {
            return (val) => val;
          }
          if (typeId === 1231) {
            return (val) => val;
          }
          if (typeId === 1115) {
            return (val) => val;
          }
          if (typeId === 1185) {
            return (val) => val;
          }
          if (typeId === 1187) {
            return (val) => val;
          }
          if (typeId === 1182) {
            return (val) => val;
          }
          return types.getTypeParser(typeId, format2);
        }
      }
    };
  }
  static [entityKind] = "NodePgPreparedQuery";
  rawQueryConfig;
  queryConfig;
  async execute(placeholderValues = {}) {
    return tracer.startActiveSpan("drizzle.execute", async () => {
      const params = fillPlaceholders(this.params, placeholderValues);
      this.logger.logQuery(this.rawQueryConfig.text, params);
      const { fields, rawQueryConfig: rawQuery, client, queryConfig: query, joinsNotNullableMap, customResultMapper } = this;
      if (!fields && !customResultMapper) {
        return tracer.startActiveSpan("drizzle.driver.execute", async (span) => {
          span?.setAttributes({
            "drizzle.query.name": rawQuery.name,
            "drizzle.query.text": rawQuery.text,
            "drizzle.query.params": JSON.stringify(params)
          });
          return this.queryWithCache(rawQuery.text, params, async () => {
            return await client.query(rawQuery, params);
          });
        });
      }
      const result = await tracer.startActiveSpan("drizzle.driver.execute", (span) => {
        span?.setAttributes({
          "drizzle.query.name": query.name,
          "drizzle.query.text": query.text,
          "drizzle.query.params": JSON.stringify(params)
        });
        return this.queryWithCache(query.text, params, async () => {
          return await client.query(query, params);
        });
      });
      return tracer.startActiveSpan("drizzle.mapResponse", () => {
        return customResultMapper ? customResultMapper(result.rows) : result.rows.map((row) => mapResultRow(fields, row, joinsNotNullableMap));
      });
    });
  }
  all(placeholderValues = {}) {
    return tracer.startActiveSpan("drizzle.execute", () => {
      const params = fillPlaceholders(this.params, placeholderValues);
      this.logger.logQuery(this.rawQueryConfig.text, params);
      return tracer.startActiveSpan("drizzle.driver.execute", (span) => {
        span?.setAttributes({
          "drizzle.query.name": this.rawQueryConfig.name,
          "drizzle.query.text": this.rawQueryConfig.text,
          "drizzle.query.params": JSON.stringify(params)
        });
        return this.queryWithCache(this.rawQueryConfig.text, params, async () => {
          return this.client.query(this.rawQueryConfig, params);
        }).then((result) => result.rows);
      });
    });
  }
  /** @internal */
  isResponseInArrayMode() {
    return this._isResponseInArrayMode;
  }
};
var NodePgSession = class _NodePgSession extends PgSession {
  constructor(client, dialect, schema, options = {}) {
    super(dialect);
    this.client = client;
    this.schema = schema;
    this.options = options;
    this.logger = options.logger ?? new NoopLogger();
    this.cache = options.cache ?? new NoopCache();
  }
  static [entityKind] = "NodePgSession";
  logger;
  cache;
  prepareQuery(query, fields, name, isResponseInArrayMode, customResultMapper, queryMetadata, cacheConfig) {
    return new NodePgPreparedQuery(
      this.client,
      query.sql,
      query.params,
      this.logger,
      this.cache,
      queryMetadata,
      cacheConfig,
      fields,
      name,
      isResponseInArrayMode,
      customResultMapper
    );
  }
  async transaction(transaction, config) {
    const isPool = this.client instanceof Pool || Object.getPrototypeOf(this.client).constructor.name.includes("Pool");
    const session = isPool ? new _NodePgSession(await this.client.connect(), this.dialect, this.schema, this.options) : this;
    const tx = new NodePgTransaction(this.dialect, session, this.schema);
    await tx.execute(sql`begin${config ? sql` ${tx.getTransactionConfigSQL(config)}` : void 0}`);
    try {
      const result = await transaction(tx);
      await tx.execute(sql`commit`);
      return result;
    } catch (error) {
      await tx.execute(sql`rollback`);
      throw error;
    } finally {
      if (isPool) session.client.release();
    }
  }
  async count(sql2) {
    const res = await this.execute(sql2);
    return Number(
      res["rows"][0]["count"]
    );
  }
};
var NodePgTransaction = class _NodePgTransaction extends PgTransaction {
  static [entityKind] = "NodePgTransaction";
  async transaction(transaction) {
    const savepointName = `sp${this.nestedIndex + 1}`;
    const tx = new _NodePgTransaction(
      this.dialect,
      this.session,
      this.schema,
      this.nestedIndex + 1
    );
    await tx.execute(sql.raw(`savepoint ${savepointName}`));
    try {
      const result = await transaction(tx);
      await tx.execute(sql.raw(`release savepoint ${savepointName}`));
      return result;
    } catch (err) {
      await tx.execute(sql.raw(`rollback to savepoint ${savepointName}`));
      throw err;
    }
  }
};

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.3_pg@8.22.0/node_modules/drizzle-orm/node-postgres/driver.js
var NodePgDriver = class {
  constructor(client, dialect, options = {}) {
    this.client = client;
    this.dialect = dialect;
    this.options = options;
  }
  static [entityKind] = "NodePgDriver";
  createSession(schema) {
    return new NodePgSession(this.client, this.dialect, schema, {
      logger: this.options.logger,
      cache: this.options.cache
    });
  }
};
var NodePgDatabase = class extends PgDatabase {
  static [entityKind] = "NodePgDatabase";
};
function construct(client, config = {}) {
  const dialect = new PgDialect({ casing: config.casing });
  let logger;
  if (config.logger === true) {
    logger = new DefaultLogger();
  } else if (config.logger !== false) {
    logger = config.logger;
  }
  let schema;
  if (config.schema) {
    const tablesConfig = extractTablesRelationalConfig(
      config.schema,
      createTableRelationsHelpers
    );
    schema = {
      fullSchema: config.schema,
      schema: tablesConfig.tables,
      tableNamesMap: tablesConfig.tableNamesMap
    };
  }
  const driver = new NodePgDriver(client, dialect, { logger, cache: config.cache });
  const session = driver.createSession(schema);
  const db = new NodePgDatabase(dialect, session, schema);
  db.$client = client;
  db.$cache = config.cache;
  if (db.$cache) {
    db.$cache["invalidate"] = config.cache?.onMutate;
  }
  return db;
}
function drizzle(...params) {
  if (typeof params[0] === "string") {
    const instance = new pg2.Pool({
      connectionString: params[0]
    });
    return construct(instance, params[1]);
  }
  if (isConfig(params[0])) {
    const { connection, client, ...drizzleConfig } = params[0];
    if (client) return construct(client, drizzleConfig);
    const instance = typeof connection === "string" ? new pg2.Pool({
      connectionString: connection
    }) : new pg2.Pool(connection);
    return construct(instance, drizzleConfig);
  }
  return construct(params[0], params[1]);
}
((drizzle2) => {
  function mock(config) {
    return construct({}, config);
  }
  drizzle2.mock = mock;
})(drizzle || (drizzle = {}));

// src/persistence.ts
var SENSITIVE_ACTIONS = /* @__PURE__ */ new Set([
  "distribution_allocations_preview",
  "distribution_allocations_run",
  "distribution_allocations_unpost",
  "distribution_contract_expense_create",
  "distribution_contract_expense_update",
  "distribution_contract_rules_update",
  "distribution_contract_upsert",
  "distribution_fx_rates_save",
  "distribution_identity_link",
  "distribution_import_confirm",
  "distribution_import_preview",
  "distribution_import_reverse",
  "distribution_mapping_apply_rules",
  "distribution_payment_record",
  "distribution_payment_reconcile",
  "distribution_payment_update",
  "distribution_payee_upsert",
  "distribution_release_upsert",
  "distribution_statement_generate",
  "distribution_statement_void",
  "distribution_suspense_resolve",
  "distribution_track_upsert",
  "office_bank_import_confirm",
  "office_bank_import_preview",
  "office_bank_import_reverse",
  "office_partner_payee_link",
  "office_partner_payee_unlink",
  "office_reconciliation_approve"
]);
var ALLOWED_MUTATING_ACTIONS = /* @__PURE__ */ new Set([
  ...SENSITIVE_ACTIONS,
  "office_partner_create",
  "office_partner_update",
  "office_plan_comptable_create",
  "office_plan_comptable_update",
  "office_transaction_create",
  "office_transaction_update"
]);
var OFFICE_BOT_ACTIONS = /* @__PURE__ */ new Set([
  "office_bank_import_preview",
  "office_bank_import_confirm",
  "office_transaction_create",
  "office_transaction_update"
]);
var DISTRIBUTION_BOT_ACTIONS = /* @__PURE__ */ new Set([
  "distribution_contract_expense_create",
  "distribution_contract_expense_update",
  "distribution_contract_rules_update",
  "distribution_contract_upsert",
  "distribution_mapping_apply_rules",
  "distribution_payment_record",
  "distribution_payment_reconcile",
  "distribution_payment_update",
  "distribution_payee_upsert",
  "distribution_release_upsert",
  "distribution_statement_generate",
  "distribution_suspense_resolve",
  "distribution_track_upsert"
]);
function createPostgresPersistenceRuntime(pool, env) {
  const database = drizzle(pool);
  return createDrizzlePersistenceRuntime(database, env);
}
function createDrizzlePersistenceRuntime(database, env) {
  const state = createInitialPersistenceState();
  return {
    writesEnabled: isWritesEnabled(env),
    withTx: async (callback) => database.transaction(async (executor) => callback({ kind: "postgres", executor })),
    storeDistributionImportPreview: (preview) => {
      state.distributionPreviews.set(preview.previewId, preview);
    },
    getDistributionImportPreview: (previewId) => state.distributionPreviews.get(previewId) ?? null,
    storeOfficeBankImportPreview: (preview) => {
      state.officeBankPreviews.set(preview.previewId, preview);
    },
    getOfficeBankImportPreview: (previewId) => state.officeBankPreviews.get(previewId) ?? null
  };
}
function requirePermissionForWorkspace(actor, action, workspaceId) {
  if (actor === void 0) {
    throwPersistenceHttpError(401, "auth_required", "A verified Supabase user is required for this action.", [`action=${action}`]);
  }
  if (!ALLOWED_MUTATING_ACTIONS.has(action)) {
    throwPersistenceHttpError(403, "permission_action_unknown", "The action has no explicit permission rule.", [
      `action=${action}`,
      `actorRole=${actor.role}`
    ]);
  }
  if (actor.role === "bot_office" || actor.role === "bot_distribution") {
    requireBotPermission(actor, action, workspaceId);
    return actor;
  }
  if (SENSITIVE_ACTIONS.has(action) && actor.role !== "administrator") {
    throwPersistenceHttpError(403, "permission_denied", "Administrator permission is required for this action.", [
      `action=${action}`,
      `actorRole=${actor.role}`,
      `actorUserId=${actor.userId}`
    ]);
  }
  return actor;
}
function isBotApiUser(actor) {
  return actor.role === "bot_office" || actor.role === "bot_distribution";
}
function requireBotPermission(actor, action, workspaceId) {
  const allowedActions = actor.role === "bot_office" ? OFFICE_BOT_ACTIONS : DISTRIBUTION_BOT_ACTIONS;
  if (!allowedActions.has(action)) {
    throwPersistenceHttpError(403, "bot_permission_denied", "The bot role is not allowed to perform this action.", [
      `action=${action}`,
      `actorRole=${actor.role}`,
      `actorUserId=${actor.userId}`
    ]);
  }
  if (actor.workspaceId === null) {
    throwPersistenceHttpError(403, "bot_workspace_missing", "The bot token must carry an explicit workspace id.", [
      `action=${action}`,
      `actorRole=${actor.role}`,
      `actorUserId=${actor.userId}`
    ]);
  }
  if (workspaceId === null) {
    throwPersistenceHttpError(403, "bot_workspace_required", "Bot writes must include an explicit workspace id.", [
      `action=${action}`,
      `actorRole=${actor.role}`,
      `actorWorkspaceId=${actor.workspaceId}`
    ]);
  }
  if (workspaceId !== actor.workspaceId) {
    throwPersistenceHttpError(403, "bot_workspace_denied", "The bot role cannot write outside its assigned workspace.", [
      `action=${action}`,
      `actorRole=${actor.role}`,
      `actorWorkspaceId=${actor.workspaceId}`,
      `requestWorkspaceId=${workspaceId}`
    ]);
  }
}
function workspaceIdFromRequestBody(requestBody) {
  if (typeof requestBody !== "object" || requestBody === null || Array.isArray(requestBody)) {
    return null;
  }
  const workspaceId = requestBody["workspaceId"];
  if (typeof workspaceId !== "string") {
    return null;
  }
  const trimmedWorkspaceId = workspaceId.trim();
  return trimmedWorkspaceId.length === 0 ? null : trimmedWorkspaceId;
}
async function runIdempotentMutation(input) {
  requirePermissionForWorkspace(input.actor, input.action, workspaceIdFromRequestBody(input.requestBody));
  const requestHash = hashRequestBody(input.requestBody);
  return input.runtime.withTx(async (tx) => {
    const idempotency = await beginIdempotent(tx, {
      key: input.idempotencyKey,
      route: input.route,
      requestHash
    });
    if (idempotency.status === "replay") {
      return {
        status: statusForStoredResponse(idempotency.responseJson),
        body: idempotency.responseJson
      };
    }
    if (!input.runtime.writesEnabled) {
      const disabledBody = disabledWriteBody(input.action);
      await completeIdempotent(tx, input.idempotencyKey, disabledBody);
      return {
        status: 501,
        body: disabledBody
      };
    }
    const response = await input.write(tx, input.idempotencyKey);
    if (response.auditEventId === null) {
      throwPersistenceHttpError(500, "audit_event_missing", "Mutation completed without an audit event.", [
        `action=${input.action}`,
        `route=${input.route}`,
        `idempotencyKey=${input.idempotencyKey}`
      ]);
    }
    await completeIdempotent(tx, input.idempotencyKey, response);
    return {
      status: 200,
      body: response
    };
  });
}
async function runDisabledMutation(input) {
  requirePermissionForWorkspace(input.actor, input.action, workspaceIdFromRequestBody(input.requestBody));
  const requestHash = hashRequestBody(input.requestBody);
  return input.runtime.withTx(async (tx) => {
    const idempotency = await beginIdempotent(tx, {
      key: input.idempotencyKey,
      route: input.route,
      requestHash
    });
    if (idempotency.status === "replay") {
      return {
        status: statusForStoredResponse(idempotency.responseJson),
        body: idempotency.responseJson
      };
    }
    const response = disabledWriteBody(input.action);
    await completeIdempotent(tx, input.idempotencyKey, response);
    return {
      status: 501,
      body: response
    };
  });
}
async function appendAuditEvent(tx, input) {
  if (tx.kind === "memory") {
    const auditEventId2 = `audit_${randomUUID()}`;
    tx.state.auditEvents.push({
      id: auditEventId2,
      actorUserId: input.actor.userId,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      before: input.before,
      after: input.after,
      idempotencyKey: input.idempotencyKey
    });
    return auditEventId2;
  }
  const auditEventId = randomUUID();
  await tx.executor.execute(sql`
    insert into audit_logs (
      id,
      entity_type,
      entity_id,
      action,
      actor_user_id,
      before,
      after,
      metadata
    )
    values (
      ${auditEventId},
      ${input.targetType},
      ${input.targetId},
      ${input.action},
      ${input.actor.userId},
      ${JSON.stringify(input.before)}::jsonb,
      ${JSON.stringify(input.after)}::jsonb,
      ${JSON.stringify({
    actorEmail: input.actor.email,
    actorRole: input.actor.role,
    idempotencyKey: input.idempotencyKey
  })}::jsonb
    )
  `);
  return auditEventId;
}
async function persistDistributionImportConfirmation(tx, input) {
  if (tx.kind === "memory") {
    return;
  }
  await tx.executor.execute(sql`
    insert into import_batches (
      id,
      source,
      file_name,
      status,
      imported_at,
      metadata
    )
    values (
      ${input.batchId},
      ${input.source},
      ${input.fileName},
      ${input.status},
      ${input.importedAtIso},
      ${JSON.stringify(input.metadata)}::jsonb
    )
  `);
  const accepted = new Set(input.acceptedRowIds);
  const rejected = new Set(input.rejectedRowIds);
  for (const row of input.rows) {
    const rawImportRowId = randomUUID();
    await tx.executor.execute(sql`
      insert into raw_import_rows (
        id,
        batch_id,
        row_number,
        raw_data
      )
      values (
        ${rawImportRowId},
        ${input.batchId},
        ${row.rowNumber},
        ${JSON.stringify(row.rawData)}::jsonb
      )
    `);
    await tx.executor.execute(sql`
      insert into import_issues (
        id,
        batch_id,
        raw_import_row_id,
        severity,
        code,
        message,
        metadata
      )
      values (
        ${randomUUID()},
        ${input.batchId},
        ${rawImportRowId},
        'warning',
        'runtime_parser_missing',
        'Structured preview rows were persisted as raw import rows; no runtime distribution parser is enabled in services/api yet.',
        ${JSON.stringify({
      operatorDecision: accepted.has(row.id) ? "accepted" : rejected.has(row.id) ? "rejected" : "unselected",
      previewRowId: row.id
    })}::jsonb
      )
    `);
  }
}
async function persistOfficeBankImportConfirmation(tx, input) {
  if (tx.kind === "memory") {
    return;
  }
  await tx.executor.execute(sql`
    insert into office_bank_import_batches (
      id,
      workspace_id,
      source,
      file_name,
      checksum,
      account_id,
      period_start,
      period_end,
      currency,
      accepted_row_count,
      rejected_row_count,
      duplicate_row_count,
      idempotency_fingerprint,
      status,
      imported_at,
      metadata
    )
    values (
      ${input.batchId},
      ${input.workspaceId},
      ${input.source},
      ${input.fileName},
      ${input.checksum},
      ${input.accountId},
      ${input.periodStart},
      ${input.periodEnd},
      ${input.currency},
      ${input.acceptedRowCount},
      ${input.rejectedRowCount},
      ${input.duplicateRowCount},
      ${input.idempotencyFingerprint},
      ${input.status},
      ${input.importedAtIso},
      ${JSON.stringify(input.metadata)}::jsonb
    )
  `);
  for (const line of input.lines) {
    await tx.executor.execute(sql`
      insert into office_bank_statement_lines (
        id,
        import_batch_id,
        account_id,
        occurred_on,
        value_on,
        description,
        reference,
        direction,
        amount_minor,
        balance_minor,
        currency,
        amount_mur_minor,
        balance_mur_minor,
        is_duplicate_candidate,
        raw_data
      )
      values (
        ${line.id},
        ${input.batchId},
        ${line.accountId},
        ${line.occurredOn},
        ${line.valueOn},
        ${line.description},
        ${line.reference},
        ${line.direction},
        ${String(line.amountMinor)},
        ${line.balanceMinor === null ? null : String(line.balanceMinor)},
        ${line.currency},
        ${String(line.amountMurMinor)},
        ${line.balanceMurMinor === null ? null : String(line.balanceMurMinor)},
        ${line.isDuplicateCandidate},
        ${JSON.stringify(line.rawData)}::jsonb
      )
    `);
  }
}
async function acquireAdvisoryLock(tx, lockKey) {
  if (tx.kind === "memory") {
    return;
  }
  const rows = rowsFromQueryResult(await tx.executor.execute(sql`
    select pg_try_advisory_xact_lock(hashtext(${lockKey})) as locked
  `));
  const locked = rows[0]?.locked;
  if (locked !== true) {
    throwPersistenceHttpError(409, "write_lock_unavailable", "Another write is already running for this lock key.", [`lockKey=${lockKey}`]);
  }
}
async function persistDistributionAllocationRun(tx, input) {
  if (tx.kind === "memory") {
    return;
  }
  await tx.executor.execute(sql`
    insert into calculation_runs (
      id,
      batch_id,
      status,
      reconciliation_json,
      started_at,
      finished_at
    )
    values (
      ${input.runId},
      ${input.batchId},
      'calculated',
      ${JSON.stringify(input.metadata)}::jsonb,
      ${input.startedAtIso},
      ${input.finishedAtIso}
    )
  `);
  for (const allocation of input.allocations) {
    await tx.executor.execute(sql`
      insert into earning_allocations (
        id,
        earning_id,
        calculation_run_id,
        payee_id,
        contract_id,
        track_id,
        gross_amount,
        original_gross_amount,
        fx_rate,
        gross_share,
        recoupment_applied,
        net_payable,
        split_percentage,
        currency,
        original_currency,
        status
      )
      values (
        ${allocation.id},
        ${allocation.earningId},
        ${input.runId},
        ${allocation.payeeId},
        ${allocation.contractId},
        ${allocation.trackId},
        ${allocation.grossAmount},
        ${allocation.originalGrossAmount},
        ${allocation.fxRate},
        ${allocation.grossShare},
        ${allocation.recoupmentApplied},
        ${allocation.netPayable},
        ${allocation.splitPercentage},
        ${allocation.currency},
        ${allocation.originalCurrency},
        'calculated'
      )
    `);
  }
  for (const application of input.expenseApplications) {
    await tx.executor.execute(sql`
      insert into expense_applications (
        id,
        cost_term_id,
        payee_id,
        calculation_run_id,
        amount_applied,
        currency
      )
      values (
        ${randomUUID()},
        ${application.costTermId},
        ${application.payeeId},
        ${input.runId},
        ${application.amountApplied},
        ${application.currency}
      )
    `);
  }
  for (const update of input.costTermStatusUpdates) {
    await tx.executor.execute(sql`
      update contract_cost_terms
      set status = ${update.status}, updated_at = now()
      where id = ${update.id}
    `);
  }
  for (const suspense of input.suspenseItems) {
    await tx.executor.execute(sql`
      insert into suspense_items (
        id,
        earning_id,
        amount,
        currency,
        reason_code
      )
      values (
        ${randomUUID()},
        ${suspense.earningId},
        ${suspense.amount},
        ${suspense.currency},
        ${suspense.reasonCode}
      )
    `);
  }
}
async function persistDistributionStatements(tx, input) {
  if (tx.kind === "memory") {
    return;
  }
  for (const plan of input.statements) {
    const insertedRows = rowsFromQueryResult(await tx.executor.execute(sql`
      insert into statements (
        id,
        payee_id,
        period_start,
        period_end,
        currency,
        gross_total,
        recoupment_total,
        net_payable,
        amount_due,
        version,
        status
      )
      values (
        ${plan.statementId},
        ${plan.statement.payeeId},
        ${plan.statement.periodStart},
        ${plan.statement.periodEnd},
        ${plan.statement.currency},
        ${plan.statement.grossTotal},
        ${plan.statement.recoupmentTotal},
        ${plan.statement.netPayable},
        ${plan.statement.amountDue},
        ${plan.statement.version},
        'generated'
      )
      on conflict (payee_id, period_start, period_end, currency, version) do nothing
      returning id
    `));
    if (insertedRows.length !== 1) {
      throwPersistenceHttpError(409, "statement_generation_conflict", "A statement already exists for this payee, period, currency, and version.", [
        `payeeId=${plan.statement.payeeId}`,
        `periodStart=${plan.statement.periodStart}`,
        `periodEnd=${plan.statement.periodEnd}`,
        `currency=${plan.statement.currency}`,
        `version=${String(plan.statement.version)}`
      ]);
    }
    for (const line of plan.lines) {
      await tx.executor.execute(sql`
        insert into statement_lines (
          id,
          statement_id,
          earning_allocation_id,
          track_id,
          gross_share,
          recoupment_applied,
          net_payable,
          quantity,
          currency
        )
        values (
          ${randomUUID()},
          ${plan.statementId},
          ${line.earningAllocationId},
          ${line.trackId},
          ${line.grossShare},
          ${line.recoupmentApplied},
          ${line.netPayable},
          ${line.quantity},
          ${line.currency}
        )
      `);
    }
    await tx.executor.execute(sql`
      insert into payee_balances (
        id,
        payee_id,
        statement_id,
        currency,
        opening_balance,
        period_net,
        closing_balance,
        movement_type
      )
      values (
        ${randomUUID()},
        ${plan.balanceLedgerRow.payeeId},
        ${plan.statementId},
        ${plan.balanceLedgerRow.currency},
        ${plan.balanceLedgerRow.openingBalance},
        ${plan.balanceLedgerRow.periodNet},
        ${plan.balanceLedgerRow.closingBalance},
        ${plan.balanceLedgerRow.movementType}
      )
    `);
  }
}
async function persistDistributionStatementVoid(tx, input) {
  if (tx.kind === "memory") {
    return;
  }
  await tx.executor.execute(sql`
    update statements
    set status = ${input.status}, updated_at = now()
    where id = ${input.statementId}
  `);
  await tx.executor.execute(sql`
    insert into payee_balances (
      id,
      payee_id,
      statement_id,
      currency,
      opening_balance,
      period_net,
      closing_balance,
      movement_type
    )
    values (
      ${randomUUID()},
      ${input.reversalLedgerRow.payeeId},
      ${input.statementId},
      ${input.reversalLedgerRow.currency},
      ${input.reversalLedgerRow.openingBalance},
      ${input.reversalLedgerRow.periodNet},
      ${input.reversalLedgerRow.closingBalance},
      ${input.reversalLedgerRow.movementType}
    )
  `);
}
async function persistDistributionPaymentRecord(tx, input) {
  if (tx.kind === "memory") {
    return;
  }
  await tx.executor.execute(sql`
    insert into payments (
      id,
      payee_id,
      amount,
      currency,
      status,
      paid_at,
      reference
    )
    values (
      ${input.paymentId},
      ${input.payeeId},
      ${input.amount},
      ${input.currency},
      'recorded',
      ${input.paidAt},
      ${input.reference}
    )
  `);
  await tx.executor.execute(sql`
    insert into statement_payment_links (
      id,
      statement_id,
      payment_id,
      amount_applied
    )
    values (
      ${input.statementPaymentLinkId},
      ${input.statementId},
      ${input.paymentId},
      ${input.amount}
    )
  `);
}
async function persistDistributionPaymentUpdate(tx, input) {
  if (tx.kind === "memory") {
    return;
  }
  await tx.executor.execute(sql`
    update payments
    set
      amount = ${input.amount},
      currency = ${input.currency},
      status = 'edited',
      reference = ${input.reference},
      updated_at = now()
    where id = ${input.paymentId}
  `);
  await tx.executor.execute(sql`
    update statement_payment_links
    set amount_applied = ${input.amount}
    where payment_id = ${input.paymentId}
  `);
}
async function persistDistributionPaymentReconcile(tx, input) {
  if (tx.kind === "memory") {
    return;
  }
  await tx.executor.execute(sql`
    update payments
    set
      status = 'reconciled',
      updated_at = ${input.reconciledAt}
    where id = ${input.paymentId}
  `);
  await tx.executor.execute(sql`
    insert into statement_payment_links (
      id,
      statement_id,
      payment_id,
      amount_applied
    )
    values (
      ${input.statementPaymentLinkId},
      ${input.statementId},
      ${input.paymentId},
      ${input.amountApplied}
    )
    on conflict (statement_id, payment_id) do update
    set amount_applied = excluded.amount_applied
  `);
}
async function persistDistributionRoyaltyRules(tx, input) {
  if (tx.kind === "memory") {
    return;
  }
  await tx.executor.execute(sql`
    update royalty_rules
    set status = 'archived', updated_at = now()
    where contract_id = ${input.contractId}
      and status <> 'archived'
  `);
  for (const rule of input.rules) {
    await tx.executor.execute(sql`
      insert into royalty_rules (
        id,
        contract_id,
        payee_id,
        percentage,
        scope_type,
        scope_id,
        priority,
        effective_from,
        effective_to,
        recoupable,
        status
      )
      values (
        ${rule.id},
        ${rule.contractId},
        ${rule.payeeId},
        ${rule.percentage},
        ${rule.scopeType},
        ${rule.scopeId},
        ${rule.priority},
        ${rule.effectiveFrom},
        ${rule.effectiveTo},
        true,
        ${rule.status}
      )
    `);
  }
}
async function persistDistributionFxRates(tx, input) {
  if (tx.kind === "memory") {
    return;
  }
  for (const rate of input.rates) {
    await tx.executor.execute(sql`
      insert into fx_rates (
        id,
        from_currency,
        to_currency,
        effective_date,
        rate
      )
      values (
        ${randomUUID()},
        ${rate.fromCurrency},
        ${rate.toCurrency},
        ${rate.effectiveDate},
        ${rate.rate}
      )
      on conflict (from_currency, to_currency, effective_date) do update
      set rate = excluded.rate
    `);
  }
}
async function persistIdentityLink(tx, input) {
  if (tx.kind === "memory") {
    return;
  }
  await tx.executor.execute(sql`
    update identity_link
    set status = 'archived', updated_at = now()
    where status <> 'archived'
      and (payee_id = ${input.payeeId} or office_partner_id = ${input.officePartnerId})
      and not (payee_id = ${input.payeeId} and office_partner_id = ${input.officePartnerId})
  `);
  await tx.executor.execute(sql`
    insert into identity_link (
      id,
      payee_id,
      office_partner_id,
      confidence,
      status
    )
    values (
      ${input.id},
      ${input.payeeId},
      ${input.officePartnerId},
      ${input.confidence},
      ${input.status}
    )
    on conflict (payee_id, office_partner_id) do update
    set
      confidence = excluded.confidence,
      status = excluded.status,
      updated_at = now()
  `);
}
async function markDistributionImportBatchVoid(tx, batchId) {
  if (tx.kind === "memory") {
    return {
      previousStatus: "unknown",
      nextStatus: "void"
    };
  }
  const beforeRows = rowsFromQueryResult(await tx.executor.execute(sql`
    select status
    from import_batches
    where id = ${batchId}
  `));
  const previousStatus = stringField(beforeRows[0], "status");
  await tx.executor.execute(sql`
    update import_batches
    set status = 'void', updated_at = now()
    where id = ${batchId}
  `);
  return {
    previousStatus,
    nextStatus: "void"
  };
}
async function markOfficeBankImportBatchVoid(tx, batchId) {
  if (tx.kind === "memory") {
    return {
      previousStatus: "unknown",
      nextStatus: "void"
    };
  }
  const beforeRows = rowsFromQueryResult(await tx.executor.execute(sql`
    select status
    from office_bank_import_batches
    where id = ${batchId}
  `));
  const previousStatus = stringField(beforeRows[0], "status");
  await tx.executor.execute(sql`
    update office_bank_import_batches
    set status = 'void', updated_at = now()
    where id = ${batchId}
  `);
  return {
    previousStatus,
    nextStatus: "void"
  };
}
function hashRequestBody(body) {
  return createHash("sha256").update(canonicalJson(body)).digest("hex");
}
function disabledWriteBody(action) {
  return {
    error: "action_not_enabled_yet",
    message: `This action (${action}) is currently not enabled yet.`,
    action
  };
}
function isApiPersistenceHttpError(error) {
  return error instanceof Error && typeof error.status === "number" && typeof error.code === "string" && Array.isArray(error.context);
}
function isWritesEnabled(env) {
  const value = env.WRITES_ENABLED;
  return value === "1" || value === "true";
}
async function beginIdempotent(tx, input) {
  if (tx.kind === "memory") {
    const existing2 = tx.state.idempotency.get(input.key);
    if (existing2 !== void 0) {
      return beginResultFromExisting(existing2, input);
    }
    tx.state.idempotency.set(input.key, {
      key: input.key,
      route: input.route,
      requestHash: input.requestHash,
      responseJson: null
    });
    return { status: "started" };
  }
  const insertedRows = rowsFromQueryResult(await tx.executor.execute(sql`
    insert into api_idempotency_keys (
      key,
      route,
      request_hash,
      response_json
    )
    values (
      ${input.key},
      ${input.route},
      ${input.requestHash},
      null
    )
    on conflict (key) do nothing
    returning key
  `));
  if (insertedRows.length === 1) {
    return { status: "started" };
  }
  const existingRows = rowsFromQueryResult(await tx.executor.execute(sql`
    select key, route, request_hash, response_json
    from api_idempotency_keys
    where key = ${input.key}
  `));
  const existing = idempotencyRowFromPg(existingRows[0], input.key);
  return beginResultFromExisting(existing, input);
}
async function completeIdempotent(tx, key, responseJson) {
  if (tx.kind === "memory") {
    const existing = tx.state.idempotency.get(key);
    if (existing === void 0) {
      throwPersistenceHttpError(500, "idempotency_state_missing", "Idempotency state disappeared before completion.", [`key=${key}`]);
    }
    tx.state.idempotency.set(key, {
      ...existing,
      responseJson
    });
    return;
  }
  await tx.executor.execute(sql`
    update api_idempotency_keys
    set response_json = ${JSON.stringify(responseJson)}::jsonb
    where key = ${key}
  `);
}
function beginResultFromExisting(existing, input) {
  if (existing.route !== input.route || existing.requestHash !== input.requestHash) {
    throwPersistenceHttpError(409, "idempotency_key_conflict", "Idempotency-Key was already used with a different request.", [
      `key=${input.key}`,
      `existingRoute=${existing.route}`,
      `route=${input.route}`
    ]);
  }
  if (existing.responseJson === null) {
    throwPersistenceHttpError(409, "idempotency_key_in_progress", "Idempotency-Key is already in progress.", [
      `key=${input.key}`,
      `route=${input.route}`
    ]);
  }
  return {
    status: "replay",
    responseJson: existing.responseJson
  };
}
function idempotencyRowFromPg(row, key) {
  if (row === void 0) {
    throwPersistenceHttpError(500, "idempotency_state_missing", "Idempotency row could not be read after conflict.", [`key=${key}`]);
  }
  return {
    key: stringField(row, "key"),
    route: stringField(row, "route"),
    requestHash: stringField(row, "request_hash"),
    responseJson: jsonRecordOrNull(row.response_json)
  };
}
function statusForStoredResponse(response) {
  return response.error === "action_not_enabled_yet" ? 501 : 200;
}
function throwPersistenceHttpError(status, code, message2, context) {
  const error = new Error(message2);
  Object.defineProperties(error, {
    status: { value: status, enumerable: true },
    code: { value: code, enumerable: true },
    context: { value: context, enumerable: true }
  });
  error.name = "ApiPersistenceHttpError";
  throw error;
}
function createInitialPersistenceState() {
  return {
    memory: {
      idempotency: /* @__PURE__ */ new Map(),
      auditEvents: []
    },
    distributionPreviews: /* @__PURE__ */ new Map(),
    officeBankPreviews: /* @__PURE__ */ new Map()
  };
}
function rowsFromQueryResult(result) {
  if (typeof result === "object" && result !== null && Array.isArray(result.rows)) {
    return result.rows;
  }
  if (Array.isArray(result)) {
    return result.filter((row) => typeof row === "object" && row !== null);
  }
  return [];
}
function stringField(row, key) {
  if (row === void 0) {
    return "unknown";
  }
  const value = row[key];
  return typeof value === "string" ? value : "unknown";
}
function jsonRecordOrNull(value) {
  if (value === null || value === void 0) {
    return null;
  }
  if (typeof value === "object" && !Array.isArray(value)) {
    return value;
  }
  throwPersistenceHttpError(500, "idempotency_response_invalid", "Stored idempotency response is not a JSON object.", []);
}
function canonicalJson(value) {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  }
  const objectValue = value;
  const entries = Object.keys(objectValue).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(objectValue[key])}`);
  return `{${entries.join(",")}}`;
}

// src/index.ts
var DEFAULT_WORKSPACE_ID = "eeee-mu";
var isoDatePattern = /^\d{4}-\d{2}-\d{2}$/u;
var isoDateTimePattern = /^\d{4}-\d{2}-\d{2}T/u;
var currencyCodePattern = /^[A-Z]{3}$/u;
var moneyStringPattern = /^-?\d+(?:\.\d+)?$/u;
var nullableStringSchema = external_exports.string().min(1).nullable();
var workspaceBodySchema = external_exports.object({ workspaceId: external_exports.string().min(1) });
var workspacePassthroughSchema = workspaceBodySchema.passthrough();
var officeTransactionWriteSchema = workspaceBodySchema.extend({
  occurredOn: external_exports.string().regex(isoDatePattern),
  accountId: external_exports.string().min(1),
  categoryId: nullableStringSchema,
  projectId: nullableStringSchema,
  description: external_exports.string().min(1),
  amountMicro: external_exports.string().regex(moneyStringPattern),
  currency: external_exports.string().regex(currencyCodePattern)
});
var officePlanComptableWriteSchema = workspaceBodySchema.extend({
  parentId: nullableStringSchema,
  kind: external_exports.enum(["department", "division", "category"]),
  code: external_exports.string().min(1),
  label: external_exports.string().min(1),
  active: external_exports.boolean(),
  type: external_exports.enum(["income", "expense"]).nullable()
});
var officeReconciliationApproveSchema = workspaceBodySchema.extend({
  reconciliationIds: external_exports.array(external_exports.string().min(1)).min(1),
  approvedAt: external_exports.string().regex(isoDateTimePattern)
});
var officePartnerWriteSchema = workspaceBodySchema.extend({
  name: external_exports.string().min(1),
  email: nullableStringSchema,
  phone: nullableStringSchema,
  address: nullableStringSchema,
  taxId: nullableStringSchema,
  notes: nullableStringSchema,
  active: external_exports.boolean()
});
var officePartnerPayeeUnlinkSchema = workspaceBodySchema.extend({
  payeeId: external_exports.null()
});
var distributionMappingApplyRulesSchema = workspaceBodySchema.extend({
  batchId: external_exports.string().min(1),
  rowIds: external_exports.array(external_exports.string().min(1)).min(1)
});
var distributionContractExpenseRecordSchema = workspaceBodySchema.extend({
  contractId: external_exports.string().min(1),
  payeeId: external_exports.string().min(1),
  incurredOn: external_exports.string().regex(isoDatePattern),
  label: external_exports.string().min(1),
  amountMicro: external_exports.string().regex(moneyStringPattern),
  currency: external_exports.string().regex(currencyCodePattern)
});
var allocationRunUnpostSchema = workspaceBodySchema.extend({
  reason: external_exports.string().min(1),
  lockToken: external_exports.string().min(1)
});
var suspenseResolveSchema = workspaceBodySchema.extend({
  suspenseId: external_exports.string().min(1),
  resolution: external_exports.enum(["map_to_release", "map_to_track", "hold"]),
  targetId: nullableStringSchema,
  note: external_exports.string().min(1)
});
var ApiRouteError = class extends Error {
  status;
  code;
  context;
  constructor(status, code, message2, context) {
    super(message2);
    this.name = "ApiRouteError";
    this.status = status;
    this.code = code;
    this.context = context;
  }
};
function createApiService(dependencies) {
  const app = new Hono2();
  app.use(
    "*",
    cors({
      origin: [
        "https://app.eeee.mu",
        "http://localhost:5173",
        "http://127.0.0.1:5173"
      ],
      allowMethods: ["GET", "POST", "PATCH", "OPTIONS"],
      allowHeaders: ["Content-Type", "Authorization", "Idempotency-Key"]
    })
  );
  app.onError((error, context) => {
    if (error instanceof ApiRouteError) {
      return context.json(createErrorPayload(error.code, error.message, error.context), error.status);
    }
    if (isApiPersistenceHttpError(error)) {
      return context.json(createErrorPayload(error.code, error.message, error.context), error.status);
    }
    return context.json(
      createErrorPayload("api_internal_error", "The API route failed while handling the request.", [
        `errorName=${error.name}`,
        `message=${error.message}`
      ]),
      500
    );
  });
  app.notFound(
    (context) => context.json(
      createErrorPayload("route_not_found", "The requested eHQ API route does not exist.", [
        `method=${context.req.method}`,
        `path=${context.req.path}`
      ]),
      404
    )
  );
  app.get("/healthz", async (context) => {
    const database = dependencies.health === null ? { status: "ok", database: "fixture" } : await dependencies.health();
    return context.json({
      status: "ok",
      generatedAt: dependencies.nowIso(),
      database
    });
  });
  const authMiddleware = createSupabaseAuthMiddleware(dependencies.auth);
  app.get("/auth/me", authMiddleware, (context) => {
    const authUser = context.get("authUser");
    return context.json({
      userId: authUser.userId,
      email: authUser.email,
      role: authUser.role,
      workspaceId: authUser.workspaceId
    });
  });
  app.use("/eof/v1/*", async (context, next) => {
    if (context.req.method === "OPTIONS") {
      await next();
      return;
    }
    return authMiddleware(context, next);
  });
  app.use("/erh/v1/*", async (context, next) => {
    if (context.req.method === "OPTIONS") {
      await next();
      return;
    }
    return authMiddleware(context, next);
  });
  registerOfficeRoutes(app, dependencies);
  registerDistributionRoutes(app, dependencies);
  return app;
}
function registerOfficeRoutes(app, dependencies) {
  app.get("/eof/v1/dashboard", (context) => {
    const period = requireCompatQuery(context, ["period", "month"], "period");
    const workspaceId = resolveWorkspaceId(context);
    const filters = filtersForPeriod(period, null);
    const monthlyRows = readMonthlyPnl(dependencies.fixtures.office, filters);
    const runwayWindowMonths = filterRunwayWindowMonths(monthlyRows, ["2026-02"]);
    const dashboard = readOfficeDashboardFull(dependencies.fixtures.office, period, filters, runwayWindowMonths);
    const recentImports = dependencies.fixtures.office.bankImportBatches.filter((batch) => batch.workspaceId === workspaceId);
    const response = {
      period,
      cashBalanceMicro: dashboard.cashRunway.cashBalanceMur,
      receivablesMicro: dashboard.pnl.income,
      payablesMicro: dashboard.pnl.expense,
      unreconciledTransactionCount: dashboard.bankQuality.unmatchedLineCount,
      lastAuditEventId: dependencies.fixtures.officeAuditLog[0]?.id ?? null,
      recentImports: recentImports.map((batch) => ({
        id: batch.id,
        source: batch.source,
        fileName: `${batch.source}-${batch.id}.csv`,
        importedAt: batch.importedAt ?? dependencies.nowIso(),
        periodLabel: formatPeriodLabel(batch.periodStart, batch.periodEnd),
        acceptedRowCount: batch.acceptedRowCount,
        rejectedRowCount: batch.rejectedRowCount,
        duplicateRowCount: batch.duplicateRowCount,
        status: batch.status === "void" ? "failed" : batch.status
      }))
    };
    return context.json(response);
  });
  app.get("/eof/v1/pl/global", (context) => {
    const period = requireCompatQuery(context, ["period", "month"], "period");
    resolveWorkspaceId(context);
    const response = toOfficeGlobalPnl(dependencies.fixtures.office, period);
    return context.json(response);
  });
  app.get("/eof/v1/pl/department/:departmentId", (context) => {
    const period = requireCompatQuery(context, ["period", "month"], "period");
    resolveWorkspaceId(context);
    const departmentId = context.req.param("departmentId");
    const response = toOfficeDepartmentPnl(dependencies.fixtures.office, departmentId, period);
    return context.json(response);
  });
  app.get("/eof/v1/pl/division", (context) => {
    const period = requireCompatQuery(context, ["period", "month"], "period");
    resolveWorkspaceId(context);
    const divisions = readPnlByDivision(dependencies.fixtures.office, filtersForPeriod(period, null)).map(toApiDivisionPnl);
    return context.json(pageItems(context, divisions));
  });
  app.get("/eof/v1/transactions", (context) => {
    resolveWorkspaceId(context);
    const transactions = dependencies.fixtures.office.transactions.map((transaction) => toOfficeTransaction(dependencies.fixtures.office, transaction)).filter((transaction) => matchesOfficeTransactionQuery(context, transaction));
    return context.json(pageItems(context, transactions));
  });
  app.post("/eof/v1/transactions", async (context) => {
    return officeTransactionCreateResponse(context, dependencies);
  });
  app.patch("/eof/v1/transactions/:transactionId", async (context) => {
    return officeTransactionUpdateResponse(context, dependencies);
  });
  app.get("/eof/v1/plan-comptable", (context) => {
    resolveWorkspaceId(context);
    const includeInactive = queryBoolean(context, "includeInactive", "include_inactive");
    return context.json(toPlanComptableNodes(dependencies.fixtures.office, includeInactive));
  });
  app.post("/eof/v1/plan-comptable", async (context) => {
    return officePlanComptableCreateResponse(context, dependencies);
  });
  app.patch("/eof/v1/plan-comptable/:nodeId", async (context) => {
    return officePlanComptableUpdateResponse(context, dependencies);
  });
  app.post("/eof/v1/bank-import/preview", async (context) => {
    return officeBankImportPreviewResponse(context, dependencies);
  });
  app.post("/eof/v1/bank-import/confirm", async (context) => {
    return officeBankImportConfirmResponse(context, dependencies);
  });
  app.post("/eof/v1/bank-import/batches/:batchId/reverse", async (context) => {
    return officeBankImportReverseResponse(context, dependencies);
  });
  app.get("/eof/v1/reconciliations", (context) => {
    resolveWorkspaceId(context);
    return context.json(pageItems(context, toReconciliationCandidates(dependencies.fixtures.office).filter((candidate) => matchesReconciliationQuery(context, candidate))));
  });
  app.post("/eof/v1/reconciliations/approve", async (context) => {
    return officeReconciliationApproveResponse(context, dependencies);
  });
  app.get("/eof/v1/cashflow", (context) => {
    const from = requireCompatQuery(context, ["from", "fromDate"], "from");
    const to = requireCompatQuery(context, ["to", "toDate"], "to");
    resolveWorkspaceId(context);
    const accountId = nullableQuery(context, "accountId");
    const buckets = readOfficeCashflowProjection(dependencies.fixtures.office, from, to, accountId);
    return context.json(toCashflowBuckets(buckets));
  });
  app.get("/eof/v1/audit-log", (context) => {
    resolveWorkspaceId(context);
    return context.json(pageItems(context, dependencies.fixtures.officeAuditLog.filter((entry) => matchesAuditQuery(context, entry))));
  });
  app.get("/eof/v1/partners", (context) => {
    const period = requireCompatQuery(context, ["period", "month"], "period");
    const facet = requirePartnerFacet(context);
    resolveWorkspaceId(context);
    const partners = dependencies.fixtures.office.partners.map((partner) => toPartnerListItem(dependencies.fixtures, partner, period)).filter((partner) => hasFacetActivity(partner, facet));
    return context.json(pageItems(context, partners));
  });
  app.get("/eof/v1/partners/:partnerId", (context) => {
    resolveWorkspaceId(context);
    const partner = requirePartner2(dependencies.fixtures.office, context.req.param("partnerId"));
    return context.json({
      id: partner.id,
      name: partner.name,
      status: partner.isActive ? "active" : "inactive",
      email: null,
      phone: null,
      address: null,
      taxId: null,
      notes: null
    });
  });
  app.get("/eof/v1/pl/partner/:partnerId", (context) => {
    const period = requireCompatQuery(context, ["period", "month"], "period");
    resolveWorkspaceId(context);
    const partner = requirePartner2(dependencies.fixtures.office, context.req.param("partnerId"));
    const response = toPartnerDetail(dependencies.fixtures, partner, period);
    return context.json(response);
  });
  app.get("/eof/v1/classification/suggestions/:partnerId", (context) => {
    resolveWorkspaceId(context);
    return context.json(dependencies.fixtures.officeClassificationSuggestions[context.req.param("partnerId")] ?? []);
  });
  app.get("/eof/v1/partners/:partnerId/payee-link", (context) => {
    resolveWorkspaceId(context);
    const partner = requirePartner2(dependencies.fixtures.office, context.req.param("partnerId"));
    return context.json(toPartnerPayeeLink(dependencies.fixtures, partner));
  });
  app.post("/eof/v1/partners", async (context) => {
    return officePartnerCreateResponse(context, dependencies);
  });
  app.patch("/eof/v1/partners/:partnerId", async (context) => {
    return officePartnerUpdateResponse(context, dependencies);
  });
  app.post("/eof/v1/partners/:partnerId/payee-link", async (context) => {
    return officePartnerPayeeLinkResponse(context, dependencies);
  });
  app.patch("/eof/v1/partners/:partnerId/payee-link", async (context) => {
    return officePartnerPayeeUnlinkResponse(context, dependencies);
  });
  app.get("/eof/v1/bank/accounts", (context) => {
    const workspaceId = resolveWorkspaceId(context);
    const limit = requirePositiveInteger(context, optionalCompatQuery(context, ["limit"]), "limit");
    const accounts = dependencies.fixtures.office.bankAccounts.filter((account) => account.workspaceId === workspaceId).map((account) => toApiBankAccountSummary(account));
    const page = pageItems(context, accounts);
    return context.json(page);
  });
  app.get("/eof/v1/bank/raw", (context) => {
    const workspaceId = resolveWorkspaceId(context);
    const period = optionalCompatQuery(context, ["period", "month"]);
    const accountId = optionalCompatQuery(context, ["accountId", "account_id"]);
    const batches = buildBatchWorkspaceLookup(dependencies.fixtures.office.bankImportBatches);
    const lines = dependencies.fixtures.office.bankStatementLines.map((line) => toApiBankRawLine(line, batches)).filter((line) => line.workspaceId === workspaceId).filter((line) => period === null || line.occurredOn.startsWith(period)).filter((line) => accountId === null || line.accountId === accountId);
    return context.json(pageItems(context, lines));
  });
  app.get("/eof/v1/projects", (context) => {
    resolveWorkspaceId(context);
    const status = nullableQuery(context, "status");
    const projects = dependencies.fixtures.office.projects.map((project) => toProjectSummary(dependencies.fixtures.office, project, "2026-02")).filter((project) => status === null || project.status === status);
    return context.json(pageItems(context, projects));
  });
  app.get("/eof/v1/projects/:projectId/coherence-violations", (context) => {
    resolveWorkspaceId(context);
    const violations = dependencies.fixtures.officeProjectViolations[context.req.param("projectId")] ?? [];
    return context.json(pageItems(context, violations));
  });
  app.get("/eof/v1/pl/project/:projectId", (context) => {
    const period = requireCompatQuery(context, ["period", "month"], "period");
    resolveWorkspaceId(context);
    return context.json(toProjectPnl(dependencies.fixtures.office, context.req.param("projectId"), period));
  });
  app.get("/eof/v1/integrity/check-all", (context) => {
    resolveWorkspaceId(context);
    return context.json(toOfficeIntegrity(dependencies.fixtures.office, dependencies.nowIso()));
  });
  app.get("/eof/v1/analytics/bank-quality", (context) => {
    const period = requireCompatQuery(context, ["period", "month"], "period");
    resolveWorkspaceId(context);
    const result = readOfficeBankQuality(dependencies.fixtures.office, period);
    const response = {
      period: result.period,
      matchedRateBp: result.matchedRateBp,
      unmatchedLineCount: result.unmatchedLineCount,
      duplicateCandidateCount: result.duplicateCandidateCount,
      missingReferenceCount: result.missingReferenceCount,
      staleImportCount: result.staleImportCount,
      lastImportAt: result.lastImportAt
    };
    return context.json(response);
  });
  app.get("/eof/v1/vat", (context) => {
    const period = requireCompatQuery(context, ["period", "month"], "period");
    resolveWorkspaceId(context);
    return context.json(toOfficeVatReport(dependencies.fixtures.office, period));
  });
}
function filterRunwayWindowMonths(monthlyRows, runwayWindowMonths) {
  const availableMonths = new Set(monthlyRows.map((row) => row.month));
  return runwayWindowMonths.filter((month) => availableMonths.has(month));
}
function registerDistributionRoutes(app, dependencies) {
  app.get("/erh/v1/dashboard", (context) => {
    const period = requireQuery(context, "period");
    requireQuery(context, "workspaceId");
    return context.json(toDistributionDashboard(dependencies.fixtures.distribution, period));
  });
  app.get("/erh/v1/imports/batches", (context) => {
    requireQuery(context, "workspaceId");
    const source = nullableQuery(context, "source");
    const status = nullableQuery(context, "status");
    const batches = dependencies.fixtures.distribution.importBatches.map((batch) => toDistributionImportBatch(dependencies.fixtures.distribution, batch.id)).filter((batch) => source === null || batch.source === source).filter((batch) => status === null || batch.status === status);
    return context.json(pageItems(context, batches));
  });
  app.post("/erh/v1/imports/preview", async (context) => {
    return distributionImportPreviewResponse(context, dependencies);
  });
  app.post("/erh/v1/imports/confirm", async (context) => {
    return distributionImportConfirmResponse(context, dependencies);
  });
  app.post("/erh/v1/imports/batches/:batchId/reverse", async (context) => {
    return distributionImportReverseResponse(context, dependencies);
  });
  app.get("/erh/v1/mapping/rows", (context) => {
    requireQuery(context, "workspaceId");
    const batchId = nullableQuery(context, "batchId");
    const status = nullableQuery(context, "status");
    const rows = dependencies.fixtures.distributionMappingRows.filter((row) => batchId === null || row.batchId === batchId).filter((row) => status === null || row.status === status);
    return context.json(pageItems(context, rows));
  });
  app.post("/erh/v1/mapping/apply-rules", async (context) => {
    return distributionMappingApplyRulesResponse(context, dependencies);
  });
  app.get("/erh/v1/contracts", (context) => {
    requireQuery(context, "workspaceId");
    const payeeId = nullableQuery(context, "payeeId");
    const status = nullableQuery(context, "status");
    const contracts = dependencies.fixtures.distributionContracts.filter((contract) => payeeId === null || contract.payeeId === payeeId).filter((contract) => status === null || contract.status === status);
    return context.json(pageItems(context, contracts));
  });
  app.post("/erh/v1/contracts", async (context) => {
    return disabledWorkspaceWriteResponse(context, dependencies, "distribution_contract_upsert");
  });
  app.get("/erh/v1/contracts/:contractId", (context) => {
    requireQuery(context, "workspaceId");
    const contractId = context.req.param("contractId");
    const contract = dependencies.fixtures.distributionContracts.find((candidate) => candidate.id === contractId);
    if (contract === void 0) {
      throw new ApiRouteError(404, "distribution_contract_not_found", "Distribution contract was not found.", [
        `contractId=${contractId}`
      ]);
    }
    const expenses = dependencies.fixtures.distributionContractExpenses.filter((expense) => expense.contractId === contractId);
    return context.json({
      contract,
      expenses: pageItems(context, expenses)
    });
  });
  app.get("/erh/v1/contracts/:contractId/expenses", (context) => {
    requireQuery(context, "workspaceId");
    const status = nullableQuery(context, "status");
    const contractId = context.req.param("contractId");
    const expenses = dependencies.fixtures.distributionContractExpenses.filter((expense) => expense.contractId === contractId).filter((expense) => status === null || expense.status === status);
    return context.json(pageItems(context, expenses));
  });
  app.post("/erh/v1/contracts/:contractId/expenses", async (context) => {
    return distributionContractExpenseCreateResponse(context, dependencies);
  });
  app.patch("/erh/v1/contracts/:contractId/expenses/:expenseId", async (context) => {
    return disabledWorkspaceWriteResponse(context, dependencies, "distribution_contract_expense_update");
  });
  app.post("/erh/v1/contracts/:contractId/rules", async (context) => {
    return distributionContractRulesUpdateResponse(context, dependencies);
  });
  app.get("/erh/v1/payees", (context) => {
    requireQuery(context, "workspaceId");
    const status = nullableQuery(context, "status");
    const payees = dependencies.fixtures.distribution.payees.map((payee) => ({
      id: payee.id,
      displayName: payee.name,
      email: null,
      status: payee.isActive ? "active" : "inactive",
      defaultCurrency: payee.preferredCurrency
    })).filter((payee) => status === null || payee.status === status);
    return context.json(pageItems(context, payees));
  });
  app.get("/erh/v1/payees/:payeeId", (context) => {
    requireQuery(context, "workspaceId");
    const payeeId = context.req.param("payeeId");
    const payee = dependencies.fixtures.distribution.payees.find((candidate) => candidate.id === payeeId);
    if (payee === void 0) {
      throw new ApiRouteError(404, "distribution_payee_not_found", "Distribution payee was not found.", [`payeeId=${payeeId}`]);
    }
    return context.json({
      id: payee.id,
      displayName: payee.name,
      email: null,
      status: payee.isActive ? "active" : "inactive",
      defaultCurrency: payee.preferredCurrency
    });
  });
  app.post("/erh/v1/payees", async (context) => {
    return disabledWorkspaceWriteResponse(context, dependencies, "distribution_payee_upsert");
  });
  app.get("/erh/v1/releases", (context) => {
    requireQuery(context, "workspaceId");
    const releases = toReleaseSummaries(dependencies.fixtures.distribution);
    return context.json(pageItems(context, releases));
  });
  app.post("/erh/v1/releases", async (context) => {
    return disabledWorkspaceWriteResponse(context, dependencies, "distribution_release_upsert");
  });
  app.get("/erh/v1/tracks", (context) => {
    requireQuery(context, "workspaceId");
    const releaseId = nullableQuery(context, "releaseId");
    const tracks = dependencies.fixtures.distribution.tracks.filter((track) => releaseId === null || track.releaseId === releaseId).map((track) => ({
      id: track.id,
      releaseId: track.releaseId,
      title: track.title,
      artistName: "Kaya",
      isrc: track.isrc,
      status: "released",
      splitStatus: "balanced",
      contributorCount: 1
    }));
    return context.json(pageItems(context, tracks));
  });
  app.post("/erh/v1/tracks", async (context) => {
    return disabledWorkspaceWriteResponse(context, dependencies, "distribution_track_upsert");
  });
  app.get("/erh/v1/ping", (_context) => {
    return _context.json({ ok: true });
  });
  app.get("/erh/v1/allocations", (context) => {
    resolveWorkspaceId(context);
    const calculationRunId = nullableQuery(context, "runId");
    const payeeId = nullableQuery(context, "payeeId");
    const status = toAllocationStatusFilter(nullableQuery(context, "status"));
    const allocations = readAllocationList(dependencies.fixtures.distribution, {
      calculationRunId,
      payeeId,
      status
    });
    return context.json(pageItems(context, allocations.rows));
  });
  app.get("/erh/v1/allocations-by-currency", (context) => {
    resolveWorkspaceId(context);
    const payeeId = nullableQuery(context, "payeeId");
    const status = toAllocationStatusFilter(nullableQuery(context, "status"));
    const allocations = readAllocationList(dependencies.fixtures.distribution, {
      calculationRunId: null,
      payeeId,
      status
    });
    return context.json(pageItems(context, allocations.totals));
  });
  app.get("/erh/v1/allocations/runs", (context) => {
    requireQuery(context, "workspaceId");
    const status = nullableQuery(context, "status");
    const runs = dependencies.fixtures.distribution.calculationRuns.map((run) => toAllocationRunSummary(dependencies.fixtures.distribution, run)).filter((run) => status === null || run.status === status);
    return context.json(pageItems(context, runs));
  });
  app.get("/erh/v1/allocations/runs/:runId", (context) => {
    requireQuery(context, "workspaceId");
    const runId = context.req.param("runId");
    const run = dependencies.fixtures.distribution.calculationRuns.find((candidate) => candidate.id === runId);
    if (run === void 0) {
      throw new ApiRouteError(404, "allocation_run_not_found", "Allocation run fixture was not found.", [`runId=${runId}`]);
    }
    return context.json(toAllocationRunSummary(dependencies.fixtures.distribution, run));
  });
  app.post("/erh/v1/allocations/runs/preview", async (context) => {
    return distributionAllocationPreviewResponse(context, dependencies);
  });
  app.post("/erh/v1/allocations/runs", async (context) => {
    return distributionAllocationRunResponse(context, dependencies);
  });
  app.post("/erh/v1/allocations/runs/:runId/unpost", async (context) => {
    return distributionAllocationUnpostResponse(context, dependencies);
  });
  app.get("/erh/v1/suspense", (context) => {
    requireQuery(context, "workspaceId");
    const period = nullableQuery(context, "period");
    const status = nullableQuery(context, "status");
    const suspense = readSuspense(dependencies.fixtures.distribution, {
      status: toDomainSuspenseStatus(status),
      reasonCode: null
    }).rows.map((row) => toApiSuspenseItem(row, period));
    return context.json(pageItems(context, suspense));
  });
  app.post("/erh/v1/suspense/:suspenseId/resolve", async (context) => {
    return distributionSuspenseResolveResponse(context, dependencies);
  });
  app.get("/erh/v1/statements", (context) => {
    requireQuery(context, "workspaceId");
    const period = nullableQuery(context, "period");
    const payeeId = nullableQuery(context, "payeeId");
    const status = nullableQuery(context, "status");
    const statements = readStatementSummaries(dependencies.fixtures.distribution, {
      period,
      payeeId,
      status: null
    }).rows.map(toApiStatementSummary).filter((statement) => status === null || statement.status === status);
    return context.json(pageItems(context, statements));
  });
  app.get("/erh/v1/statements/:statementId/print", (context) => {
    requireQuery(context, "workspaceId");
    const statementId = context.req.param("statementId");
    const statement = dependencies.fixtures.distribution.statements.find((candidate) => candidate.id === statementId);
    if (statement === void 0) {
      throw new ApiRouteError(404, "distribution_statement_not_found", "Distribution statement was not found.", [
        `statementId=${statementId}`
      ]);
    }
    const payee = dependencies.fixtures.distribution.payees.find((candidate) => candidate.id === statement.payeeId);
    const lines = dependencies.fixtures.distribution.statementLines.filter((line) => line.statementId === statement.id);
    return context.json({
      statement: {
        id: statement.id,
        periodStart: statement.periodStart,
        periodEnd: statement.periodEnd,
        payeeId: statement.payeeId,
        payeeName: payee?.name ?? statement.payeeId,
        currency: statement.currency,
        grossTotal: statement.grossTotal,
        recoupmentTotal: statement.recoupmentTotal,
        netPayable: statement.netPayable,
        amountDue: statement.amountDue,
        status: statement.status,
        version: statement.version
      },
      lines: lines.map((line) => ({
        id: line.id,
        trackId: line.trackId,
        grossShare: line.grossShare,
        recoupmentApplied: line.recoupmentApplied,
        netPayable: line.netPayable,
        quantity: line.quantity,
        currency: line.currency
      }))
    });
  });
  app.post("/erh/v1/statements/generate", async (context) => {
    return distributionStatementGenerateResponse(context, dependencies);
  });
  app.post("/erh/v1/statements/:statementId/void", async (context) => {
    return distributionStatementVoidResponse(context, dependencies);
  });
  app.get("/erh/v1/payments", (context) => {
    requireQuery(context, "workspaceId");
    const payeeId = nullableQuery(context, "payeeId");
    const status = nullableQuery(context, "status");
    const payments = toPaymentSummaries(dependencies.fixtures.distribution).filter((payment) => payeeId === null || payment.payeeId === payeeId).filter((payment) => status === null || payment.status === status);
    return context.json(pageItems(context, payments));
  });
  app.post("/erh/v1/payments", async (context) => {
    return distributionPaymentRecordResponse(context, dependencies);
  });
  app.patch("/erh/v1/payments/:paymentId", async (context) => {
    return distributionPaymentUpdateResponse(context, dependencies);
  });
  app.post("/erh/v1/payments/:paymentId/reconcile", async (context) => {
    return distributionPaymentReconcileResponse(context, dependencies);
  });
  app.get("/erh/v1/revenue", (context) => {
    requireQuery(context, "workspaceId");
    const groupBy = nullableQuery(context, "groupBy") ?? "payee";
    const rows = toRevenueRows(dependencies.fixtures.distribution, groupBy);
    return context.json(pageItems(context, rows));
  });
  app.get("/erh/v1/fx-rates", (context) => {
    resolveWorkspaceId(context);
    const fromCurrency = nullableQuery(context, "fromCurrency");
    const toCurrency = nullableQuery(context, "toCurrency");
    const effectiveDate = nullableQuery(context, "effectiveDate");
    const rates = dependencies.fixtures.distributionFxRates.filter((rate) => fromCurrency === null || rate.fromCurrency === fromCurrency).filter((rate) => toCurrency === null || rate.toCurrency === toCurrency).filter((rate) => effectiveDate === null || rate.effectiveDate === effectiveDate);
    return context.json(pageItems(context, rates));
  });
  app.post("/erh/v1/fx-rates", async (context) => {
    return distributionFxRatesSaveResponse(context, dependencies);
  });
  app.get("/erh/v1/payees/:payeeId/partner-link", (context) => {
    resolveWorkspaceId(context);
    const payeeId = context.req.param("payeeId");
    const payee = requireDistributionPayee(dependencies.fixtures.distribution, payeeId);
    return context.json(toDistributionPayeePartnerLink(dependencies.fixtures, payee));
  });
  app.post("/erh/v1/payees/:payeeId/partner-link", async (context) => {
    return distributionPayeePartnerLinkResponse(context, dependencies);
  });
  app.get("/erh/v1/financial-reconciliation", (context) => {
    requireQuery(context, "workspaceId");
    return context.json(toDistributionReconciliation(dependencies.fixtures));
  });
  app.get("/erh/v1/aliases", (context) => {
    requireQuery(context, "workspaceId");
    return context.json(pageItems(context, toDistributionAliases(dependencies.fixtures)));
  });
  app.get("/erh/v1/duplicates", (context) => {
    requireQuery(context, "workspaceId");
    return context.json(pageItems(context, toDistributionDuplicates(dependencies.fixtures)));
  });
  app.get("/erh/v1/audit-log", (context) => {
    requireQuery(context, "workspaceId");
    return context.json(pageItems(context, toDistributionAuditLog(dependencies.fixtures)));
  });
  app.get("/erh/v1/settings", (context) => {
    requireQuery(context, "workspaceId");
    assertNonBotRouteAccess(context, "distribution_settings_read");
    return context.json(toDistributionSettings(context, dependencies.fixtures, dependencies.persistence.writesEnabled));
  });
}
function createErrorPayload(code, message2, context) {
  return {
    error: {
      code,
      message: message2,
      context
    }
  };
}
function requireQuery(context, key) {
  const value = context.req.query(key);
  if (value === void 0 || value.trim().length === 0) {
    throw new ApiRouteError(400, "query_required", "A required query parameter is missing.", [
      `path=${context.req.path}`,
      `key=${key}`
    ]);
  }
  return value;
}
function assertNonBotRouteAccess(context, action) {
  const authUser = context.get("authUser");
  if (!isBotApiUser(authUser)) {
    return;
  }
  throw new ApiRouteError(403, "bot_route_denied", "Bot roles cannot access settings, maintenance, or unrestricted administrative routes.", [
    `action=${action}`,
    `path=${context.req.path}`,
    `actorRole=${authUser.role}`,
    `actorUserId=${authUser.userId}`
  ]);
}
function requirePathParam(context, key) {
  const value = context.req.param(key);
  if (value === void 0 || value.trim().length === 0) {
    throw new ApiRouteError(400, "path_param_required", "A required path parameter is missing.", [
      `path=${context.req.path}`,
      `key=${key}`
    ]);
  }
  return value;
}
function nullableQuery(context, key) {
  const value = context.req.query(key);
  if (value === void 0 || value.trim().length === 0) {
    return null;
  }
  return value;
}
function queryBoolean(context, key, legacyKey) {
  const aliases = legacyKey === void 0 ? [key] : [key, legacyKey];
  const value = optionalCompatQuery(context, aliases);
  if (value === null) {
    return false;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "true" || normalized === "1" || normalized === "on" || normalized === "yes") {
    return true;
  }
  if (normalized === "false" || normalized === "0" || normalized === "off" || normalized === "no") {
    return false;
  }
  throw new ApiRouteError(400, "query_boolean_invalid", "Boolean query parameter is invalid.", [
    `path=${context.req.path}`,
    `key=${key}`,
    `value=${value}`
  ]);
}
function requireCompatQuery(context, keys, keyForError) {
  const resolved = optionalCompatQuery(context, keys);
  if (resolved === null) {
    throw new ApiRouteError(400, "query_required", "A required query parameter is missing.", [
      `path=${context.req.path}`,
      `key=${keyForError}`,
      `aliases=${keys.join(",")}`
    ]);
  }
  return resolved;
}
function optionalCompatQuery(context, keys) {
  for (const key of keys) {
    const value = context.req.query(key);
    if (value !== void 0 && value.trim().length > 0) {
      return value;
    }
  }
  return null;
}
function resolveWorkspaceId(context) {
  return optionalCompatQuery(context, ["workspaceId", "workspace_id"]) ?? DEFAULT_WORKSPACE_ID;
}
function requirePositiveInteger(context, value, key) {
  if (value === null) {
    throw new ApiRouteError(400, "query_integer_invalid", "Query integer parameter is required.", [
      `path=${context.req.path}`,
      `key=${key}`
    ]);
  }
  return parsePositiveInteger(value, key);
}
function requireIdempotencyKey(context) {
  const value = context.req.header("Idempotency-Key");
  if (value === void 0 || value.trim().length === 0) {
    throw new ApiRouteError(400, "idempotency_key_required", "Write routes require a non-empty Idempotency-Key header.", [
      `method=${context.req.method}`,
      `path=${context.req.path}`
    ]);
  }
  return value;
}
async function readJsonBody(context) {
  try {
    return await context.req.json();
  } catch (error) {
    throw new ApiRouteError(400, "json_body_invalid", "Request body must be valid JSON.", [
      `path=${context.req.path}`,
      `error=${error instanceof Error ? error.message : "unknown"}`
    ]);
  }
}
async function readZodBody(context, schema) {
  const body = await readJsonBody(context);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new ApiRouteError(400, "body_schema_invalid", "Request body failed validation.", [
      `path=${context.req.path}`,
      `issues=${parsed.error.issues.map((issue) => `${issue.path.join(".")}:${issue.message}`).join("; ")}`
    ]);
  }
  return parsed.data;
}
async function officeTransactionCreateResponse(context, dependencies) {
  const request = await readZodBody(context, officeTransactionWriteSchema);
  const amountMinor = normalizeEofAmountField(context, request.amountMicro, "amountMicro");
  const transactionId = randomUUID2();
  const transactionType = officeTransactionType(dependencies.fixtures.office, request.categoryId, request.amountMicro);
  const transactionStatus = request.categoryId === null ? "draft" : "validated";
  const idempotencyKey = requireIdempotencyKey(context);
  const actor = context.get("authUser");
  const result = await runIdempotentMutation({
    runtime: dependencies.persistence,
    actor,
    action: "office_transaction_create",
    route: context.req.path,
    idempotencyKey,
    requestBody: request,
    write: async (tx, resolvedIdempotencyKey) => {
      await persistOfficeTransactionUpsert(tx, {
        id: transactionId,
        request,
        amountMinor,
        transactionType,
        transactionStatus,
        actorUserId: actor.userId,
        isUpdate: false
      });
      const auditEventId = await appendAuditEvent(tx, {
        actor,
        action: "office_transaction_create",
        targetType: "office_transaction",
        targetId: transactionId,
        before: {},
        after: {
          transactionId,
          request,
          transactionType,
          transactionStatus,
          amountMinor: amountMinor.toString()
        },
        idempotencyKey: resolvedIdempotencyKey
      });
      upsertOfficeTransactionFixture(dependencies.fixtures, transactionFromOfficeRequest(transactionId, request, amountMinor, transactionType, transactionStatus));
      return mutationReceipt(transactionId, auditEventId);
    }
  });
  return context.json(result.body, result.status);
}
async function officeTransactionUpdateResponse(context, dependencies) {
  const transactionId = requirePathParam(context, "transactionId");
  const request = await readZodBody(context, officeTransactionWriteSchema);
  const before = requireOfficeTransaction(dependencies.fixtures.office, transactionId);
  const amountMinor = normalizeEofAmountField(context, request.amountMicro, "amountMicro");
  const transactionType = officeTransactionType(dependencies.fixtures.office, request.categoryId, request.amountMicro);
  const transactionStatus = request.categoryId === null ? "draft" : "validated";
  const idempotencyKey = requireIdempotencyKey(context);
  const actor = context.get("authUser");
  const result = await runIdempotentMutation({
    runtime: dependencies.persistence,
    actor,
    action: "office_transaction_update",
    route: context.req.path,
    idempotencyKey,
    requestBody: request,
    write: async (tx, resolvedIdempotencyKey) => {
      await acquireAdvisoryLock(tx, `office:transaction:${transactionId}`);
      await persistOfficeTransactionUpsert(tx, {
        id: transactionId,
        request,
        amountMinor,
        transactionType,
        transactionStatus,
        actorUserId: actor.userId,
        isUpdate: true
      });
      const after = transactionFromOfficeRequest(transactionId, request, amountMinor, transactionType, transactionStatus);
      const auditEventId = await appendAuditEvent(tx, {
        actor,
        action: "office_transaction_update",
        targetType: "office_transaction",
        targetId: transactionId,
        before: { transaction: officeTransactionAuditSnapshot(before) },
        after: { transaction: officeTransactionAuditSnapshot(after) },
        idempotencyKey: resolvedIdempotencyKey
      });
      upsertOfficeTransactionFixture(dependencies.fixtures, after);
      return mutationReceipt(transactionId, auditEventId);
    }
  });
  return context.json(result.body, result.status);
}
async function officePlanComptableCreateResponse(context, dependencies) {
  const request = await readZodBody(context, officePlanComptableWriteSchema);
  assertPlanComptableRequest(context, dependencies.fixtures.office, request);
  const nodeId = randomUUID2();
  const idempotencyKey = requireIdempotencyKey(context);
  const actor = context.get("authUser");
  const result = await runIdempotentMutation({
    runtime: dependencies.persistence,
    actor,
    action: "office_plan_comptable_create",
    route: context.req.path,
    idempotencyKey,
    requestBody: request,
    write: async (tx, resolvedIdempotencyKey) => {
      await persistOfficePlanComptableCreate(tx, nodeId, request);
      const auditEventId = await appendAuditEvent(tx, {
        actor,
        action: "office_plan_comptable_create",
        targetType: "office_chart_node",
        targetId: nodeId,
        before: {},
        after: { nodeId, request },
        idempotencyKey: resolvedIdempotencyKey
      });
      upsertOfficePlanComptableFixture(dependencies.fixtures, nodeId, request);
      return mutationReceipt(nodeId, auditEventId);
    }
  });
  return context.json(result.body, result.status);
}
async function officePlanComptableUpdateResponse(context, dependencies) {
  const nodeId = requirePathParam(context, "nodeId");
  const request = await readZodBody(context, officePlanComptableWriteSchema);
  const before = requirePlanComptableNode(dependencies.fixtures.office, nodeId);
  assertPlanComptableRequest(context, dependencies.fixtures.office, request);
  const idempotencyKey = requireIdempotencyKey(context);
  const actor = context.get("authUser");
  const result = await runIdempotentMutation({
    runtime: dependencies.persistence,
    actor,
    action: "office_plan_comptable_update",
    route: context.req.path,
    idempotencyKey,
    requestBody: request,
    write: async (tx, resolvedIdempotencyKey) => {
      await acquireAdvisoryLock(tx, `office:plan-comptable:${nodeId}`);
      await persistOfficePlanComptableUpdate(tx, nodeId, request);
      const auditEventId = await appendAuditEvent(tx, {
        actor,
        action: "office_plan_comptable_update",
        targetType: "office_chart_node",
        targetId: nodeId,
        before: { node: before },
        after: { nodeId, request },
        idempotencyKey: resolvedIdempotencyKey
      });
      upsertOfficePlanComptableFixture(dependencies.fixtures, nodeId, request);
      return mutationReceipt(nodeId, auditEventId);
    }
  });
  return context.json(result.body, result.status);
}
async function officeReconciliationApproveResponse(context, dependencies) {
  const request = await readZodBody(context, officeReconciliationApproveSchema);
  const candidates = request.reconciliationIds.map((id) => requireReconciliationCandidate(dependencies.fixtures.office, id));
  const primaryReconciliationId = request.reconciliationIds[0];
  if (primaryReconciliationId === void 0) {
    throw new ApiRouteError(400, "body_field_required", "At least one reconciliation id is required.", [`path=${context.req.path}`]);
  }
  const idempotencyKey = requireIdempotencyKey(context);
  const actor = context.get("authUser");
  const result = await runIdempotentMutation({
    runtime: dependencies.persistence,
    actor,
    action: "office_reconciliation_approve",
    route: context.req.path,
    idempotencyKey,
    requestBody: request,
    write: async (tx, resolvedIdempotencyKey) => {
      await acquireAdvisoryLock(tx, `office:reconciliation:${request.reconciliationIds.join(":")}`);
      await persistOfficeReconciliationApproval(tx, request, actor.userId, candidates);
      const auditEventId = await appendAuditEvent(tx, {
        actor,
        action: "office_reconciliation_approve",
        targetType: "office_reconciliation_match",
        targetId: primaryReconciliationId,
        before: { candidates },
        after: { status: "matched", reconciliationIds: request.reconciliationIds, approvedAt: request.approvedAt },
        idempotencyKey: resolvedIdempotencyKey
      });
      approveReconciliationFixture(dependencies.fixtures, candidates, request.approvedAt, actor.userId);
      return mutationReceipt(primaryReconciliationId, auditEventId);
    }
  });
  return context.json(result.body, result.status);
}
async function officePartnerCreateResponse(context, dependencies) {
  const request = await readZodBody(context, officePartnerWriteSchema);
  const partnerId = randomUUID2();
  const idempotencyKey = requireIdempotencyKey(context);
  const actor = context.get("authUser");
  const result = await runIdempotentMutation({
    runtime: dependencies.persistence,
    actor,
    action: "office_partner_create",
    route: context.req.path,
    idempotencyKey,
    requestBody: request,
    write: async (tx, resolvedIdempotencyKey) => {
      await persistOfficePartnerUpsert(tx, partnerId, request, false);
      const auditEventId = await appendAuditEvent(tx, {
        actor,
        action: "office_partner_create",
        targetType: "office_partner",
        targetId: partnerId,
        before: {},
        after: { partnerId, request },
        idempotencyKey: resolvedIdempotencyKey
      });
      upsertOfficePartnerFixture(dependencies.fixtures, partnerId, request);
      return mutationReceipt(partnerId, auditEventId);
    }
  });
  return context.json(result.body, result.status);
}
async function officePartnerUpdateResponse(context, dependencies) {
  const partnerId = requirePathParam(context, "partnerId");
  const request = await readZodBody(context, officePartnerWriteSchema);
  const before = requirePartner2(dependencies.fixtures.office, partnerId);
  const idempotencyKey = requireIdempotencyKey(context);
  const actor = context.get("authUser");
  const result = await runIdempotentMutation({
    runtime: dependencies.persistence,
    actor,
    action: "office_partner_update",
    route: context.req.path,
    idempotencyKey,
    requestBody: request,
    write: async (tx, resolvedIdempotencyKey) => {
      await acquireAdvisoryLock(tx, `office:partner:${partnerId}`);
      await persistOfficePartnerUpsert(tx, partnerId, request, true);
      const auditEventId = await appendAuditEvent(tx, {
        actor,
        action: "office_partner_update",
        targetType: "office_partner",
        targetId: partnerId,
        before: { partner: before },
        after: { partnerId, request },
        idempotencyKey: resolvedIdempotencyKey
      });
      upsertOfficePartnerFixture(dependencies.fixtures, partnerId, request);
      return mutationReceipt(partnerId, auditEventId);
    }
  });
  return context.json(result.body, result.status);
}
async function officePartnerPayeeUnlinkResponse(context, dependencies) {
  const partnerId = requirePathParam(context, "partnerId");
  const request = await readZodBody(context, officePartnerPayeeUnlinkSchema);
  const before = toPartnerPayeeLink(dependencies.fixtures, requirePartner2(dependencies.fixtures.office, partnerId));
  const idempotencyKey = requireIdempotencyKey(context);
  const actor = context.get("authUser");
  const result = await runIdempotentMutation({
    runtime: dependencies.persistence,
    actor,
    action: "office_partner_payee_unlink",
    route: context.req.path,
    idempotencyKey,
    requestBody: request,
    write: async (tx, resolvedIdempotencyKey) => {
      await acquireAdvisoryLock(tx, `identity-link:office:${partnerId}`);
      await persistOfficePartnerPayeeUnlink(tx, partnerId);
      const auditEventId = await appendAuditEvent(tx, {
        actor,
        action: "office_partner_payee_unlink",
        targetType: "identity_link",
        targetId: partnerId,
        before: { link: before },
        after: { partnerId, payeeId: null, status: "inactive" },
        idempotencyKey: resolvedIdempotencyKey
      });
      unlinkOfficePartnerPayeeFixture(dependencies.fixtures, partnerId);
      return mutationReceipt(partnerId, auditEventId);
    }
  });
  return context.json(result.body, result.status);
}
async function distributionMappingApplyRulesResponse(context, dependencies) {
  const request = await readZodBody(context, distributionMappingApplyRulesSchema);
  const rows = request.rowIds.map((rowId) => requireDistributionMappingRow(dependencies.fixtures, rowId));
  const idempotencyKey = requireIdempotencyKey(context);
  const actor = context.get("authUser");
  const result = await runIdempotentMutation({
    runtime: dependencies.persistence,
    actor,
    action: "distribution_mapping_apply_rules",
    route: context.req.path,
    idempotencyKey,
    requestBody: request,
    write: async (tx, resolvedIdempotencyKey) => {
      await acquireAdvisoryLock(tx, `distribution:mapping:${request.batchId}`);
      await persistDistributionMappingApplyRules(tx, rows);
      const auditEventId = await appendAuditEvent(tx, {
        actor,
        action: "distribution_mapping_apply_rules",
        targetType: "distribution_mapping_batch",
        targetId: request.batchId,
        before: { rows },
        after: { rowIds: request.rowIds, status: "mapped" },
        idempotencyKey: resolvedIdempotencyKey
      });
      applyDistributionMappingFixture(dependencies.fixtures, request.rowIds);
      return mutationReceipt(request.batchId, auditEventId);
    }
  });
  return context.json(result.body, result.status);
}
async function distributionContractExpenseCreateResponse(context, dependencies) {
  const contractId = requirePathParam(context, "contractId");
  const request = await readZodBody(context, distributionContractExpenseRecordSchema);
  if (request.contractId !== contractId) {
    throw new ApiRouteError(400, "body_path_mismatch", "Contract expense body must match the route contract id.", [
      `pathContractId=${contractId}`,
      `bodyContractId=${request.contractId}`
    ]);
  }
  requireDistributionContract(dependencies, contractId);
  requireDistributionPayee(dependencies.fixtures.distribution, request.payeeId);
  const amount = normalizeErhAmountField(context, request.amountMicro, "amountMicro");
  const expenseId = randomUUID2();
  const idempotencyKey = requireIdempotencyKey(context);
  const actor = context.get("authUser");
  const result = await runIdempotentMutation({
    runtime: dependencies.persistence,
    actor,
    action: "distribution_contract_expense_create",
    route: context.req.path,
    idempotencyKey,
    requestBody: request,
    write: async (tx, resolvedIdempotencyKey) => {
      await acquireAdvisoryLock(tx, `distribution:contract:${contractId}:expenses`);
      await persistDistributionContractExpenseCreate(tx, expenseId, { ...request, amountMicro: amount });
      const auditEventId = await appendAuditEvent(tx, {
        actor,
        action: "distribution_contract_expense_create",
        targetType: "contract_cost_term",
        targetId: expenseId,
        before: {},
        after: { expenseId, request: { ...request, amountMicro: amount } },
        idempotencyKey: resolvedIdempotencyKey
      });
      appendDistributionContractExpenseFixture(dependencies.fixtures, expenseId, { ...request, amountMicro: amount });
      return mutationReceipt(expenseId, auditEventId);
    }
  });
  return context.json(result.body, result.status);
}
async function disabledWorkspaceWriteResponse(context, dependencies, action) {
  const request = await readZodBody(context, workspacePassthroughSchema);
  const idempotencyKey = requireIdempotencyKey(context);
  const actor = context.get("authUser");
  const result = await runDisabledMutation({
    runtime: dependencies.persistence,
    actor,
    action,
    route: context.req.path,
    idempotencyKey,
    requestBody: request
  });
  return context.json(result.body, result.status);
}
async function distributionAllocationUnpostResponse(context, dependencies) {
  const runId = requirePathParam(context, "runId");
  const request = await readZodBody(context, allocationRunUnpostSchema);
  const run = requireDistributionAllocationRun(dependencies.fixtures.distribution, runId);
  const allocations = dependencies.fixtures.distribution.earningAllocations.filter((allocation) => allocation.calculationRunId === runId);
  const idempotencyKey = requireIdempotencyKey(context);
  const actor = context.get("authUser");
  const result = await runIdempotentMutation({
    runtime: dependencies.persistence,
    actor,
    action: "distribution_allocations_unpost",
    route: context.req.path,
    idempotencyKey,
    requestBody: request,
    write: async (tx, resolvedIdempotencyKey) => {
      await acquireAdvisoryLock(tx, `distribution:allocation:${runId}`);
      await persistDistributionAllocationUnpost(tx, runId);
      const auditEventId = await appendAuditEvent(tx, {
        actor,
        action: "distribution_allocations_unpost",
        targetType: "calculation_run",
        targetId: runId,
        before: { run, allocationCount: allocations.length },
        after: { status: "excluded", reason: request.reason, lockToken: request.lockToken },
        idempotencyKey: resolvedIdempotencyKey
      });
      unpostDistributionAllocationFixture(dependencies.fixtures, runId);
      return {
        runId,
        status: "completed",
        lockKey: `distribution:allocation:${runId}`,
        auditEventId
      };
    }
  });
  return context.json(result.body, result.status);
}
async function distributionSuspenseResolveResponse(context, dependencies) {
  const suspenseId = requirePathParam(context, "suspenseId");
  const request = await readZodBody(context, suspenseResolveSchema);
  if (request.suspenseId !== suspenseId) {
    throw new ApiRouteError(400, "body_path_mismatch", "Suspense body must match the route suspense id.", [
      `pathSuspenseId=${suspenseId}`,
      `bodySuspenseId=${request.suspenseId}`
    ]);
  }
  const suspense = requireDistributionSuspenseItem(dependencies.fixtures.distribution, suspenseId);
  const idempotencyKey = requireIdempotencyKey(context);
  const actor = context.get("authUser");
  const result = await runIdempotentMutation({
    runtime: dependencies.persistence,
    actor,
    action: "distribution_suspense_resolve",
    route: context.req.path,
    idempotencyKey,
    requestBody: request,
    write: async (tx, resolvedIdempotencyKey) => {
      await acquireAdvisoryLock(tx, `distribution:suspense:${suspenseId}`);
      await persistDistributionSuspenseResolve(tx, suspenseId, dependencies.nowIso());
      const auditEventId = await appendAuditEvent(tx, {
        actor,
        action: "distribution_suspense_resolve",
        targetType: "suspense_item",
        targetId: suspenseId,
        before: { suspense },
        after: { resolution: request.resolution, targetId: request.targetId, note: request.note },
        idempotencyKey: resolvedIdempotencyKey
      });
      resolveDistributionSuspenseFixture(dependencies.fixtures, suspenseId, dependencies.nowIso());
      return mutationReceipt(suspenseId, auditEventId);
    }
  });
  return context.json(result.body, result.status);
}
function mutationReceipt(id, auditEventId) {
  return {
    id,
    status: "completed",
    auditEventId
  };
}
function normalizeEofAmountField(context, value, field) {
  try {
    return eofMoney.parse(value);
  } catch (error) {
    throw new ApiRouteError(400, "body_field_invalid", "A body field must be a valid scale-2 office money string.", [
      `path=${context.req.path}`,
      `field=${field}`,
      `error=${error instanceof Error ? error.message : "unknown"}`
    ]);
  }
}
function officeTransactionType(dataset, categoryId, amount) {
  void amount;
  if (categoryId === null) {
    return "expense";
  }
  return resolveCategoryPath(dataset, categoryId).category.type;
}
function requireOfficeTransaction(dataset, transactionId) {
  const transaction = dataset.transactions.find((candidate) => candidate.id === transactionId);
  if (transaction === void 0) {
    throw new ApiRouteError(404, "office_transaction_not_found", "Office transaction was not found.", [`transactionId=${transactionId}`]);
  }
  return transaction;
}
function transactionFromOfficeRequest(id, request, amountMinor, transactionType, transactionStatus) {
  return {
    id,
    transactionDate: `${request.occurredOn}T00:00:00.000Z`,
    type: transactionType,
    status: transactionStatus,
    isActive: true,
    description: request.description.trim(),
    categoryId: request.categoryId,
    partnerId: null,
    projectId: request.projectId,
    amountMinor,
    originalCurrency: request.currency === "MUR" ? null : request.currency,
    exchangeRateE10: null
  };
}
function officeTransactionAuditSnapshot(transaction) {
  return {
    id: transaction.id,
    transactionDate: transaction.transactionDate,
    type: transaction.type,
    status: transaction.status,
    isActive: transaction.isActive,
    description: transaction.description,
    categoryId: transaction.categoryId,
    partnerId: transaction.partnerId,
    projectId: transaction.projectId,
    amountMinor: transaction.amountMinor.toString(),
    originalCurrency: transaction.originalCurrency,
    exchangeRateE10: transaction.exchangeRateE10 === null ? null : transaction.exchangeRateE10.toString()
  };
}
function upsertOfficeTransactionFixture(fixtures, transaction) {
  const mutableOffice = fixtures.office;
  const exists2 = fixtures.office.transactions.some((candidate) => candidate.id === transaction.id);
  mutableOffice.transactions = exists2 ? fixtures.office.transactions.map((candidate) => candidate.id === transaction.id ? transaction : candidate) : [transaction, ...fixtures.office.transactions];
}
async function persistOfficeTransactionUpsert(tx, input) {
  if (tx.kind === "memory") {
    return;
  }
  const occurredAt = `${input.request.occurredOn}T00:00:00.000Z`;
  if (input.isUpdate) {
    await tx.executor.execute(sql`
      update transactions
      set
        transaction_date = ${occurredAt},
        type = ${input.transactionType},
        status = ${input.transactionStatus},
        description = ${input.request.description.trim()},
        category_id = ${input.request.categoryId},
        project_id = ${input.request.projectId},
        amount_minor = ${input.amountMinor.toString()},
        original_amount_minor = ${input.amountMinor.toString()},
        original_currency = ${input.request.currency === "MUR" ? null : input.request.currency},
        approved_by_user_id = ${input.transactionStatus === "validated" ? input.actorUserId : null},
        approved_at = ${input.transactionStatus === "validated" ? (/* @__PURE__ */ new Date()).toISOString() : null},
        updated_at = now()
      where id = ${input.id}
    `);
    return;
  }
  await tx.executor.execute(sql`
    insert into transactions (
      id,
      transaction_date,
      type,
      status,
      is_active,
      description,
      category_id,
      project_id,
      amount_minor,
      original_amount_minor,
      original_currency,
      source,
      created_by_user_id,
      approved_by_user_id,
      approved_at
    )
    values (
      ${input.id},
      ${occurredAt},
      ${input.transactionType},
      ${input.transactionStatus},
      true,
      ${input.request.description.trim()},
      ${input.request.categoryId},
      ${input.request.projectId},
      ${input.amountMinor.toString()},
      ${input.amountMinor.toString()},
      ${input.request.currency === "MUR" ? null : input.request.currency},
      'manual',
      ${input.actorUserId},
      ${input.transactionStatus === "validated" ? input.actorUserId : null},
      ${input.transactionStatus === "validated" ? (/* @__PURE__ */ new Date()).toISOString() : null}
    )
  `);
}
function assertPlanComptableRequest(context, dataset, request) {
  if (request.kind === "department") {
    if (request.parentId !== null) {
      throw new ApiRouteError(400, "body_field_invalid", "Department nodes cannot have a parentId.", [`path=${context.req.path}`, "field=parentId"]);
    }
    return;
  }
  if (request.parentId === null) {
    throw new ApiRouteError(400, "body_field_required", "Division and category nodes require a parentId.", [`path=${context.req.path}`, "field=parentId"]);
  }
  if (request.kind === "division") {
    requireDepartment2(dataset, request.parentId);
    return;
  }
  requireDivision2(dataset, request.parentId);
  if (request.type === null) {
    throw new ApiRouteError(400, "body_field_required", "Category nodes require an income or expense type.", [`path=${context.req.path}`, "field=type"]);
  }
}
function requireDivision2(dataset, divisionId) {
  const division = dataset.divisions.find((candidate) => candidate.id === divisionId);
  if (division === void 0) {
    throw new ApiRouteError(404, "division_not_found", "Office division was not found.", [`divisionId=${divisionId}`]);
  }
  return division;
}
function requirePlanComptableNode(dataset, nodeId) {
  const node = toPlanComptableNodes(dataset, true).find((candidate) => candidate.id === nodeId);
  if (node === void 0) {
    throw new ApiRouteError(404, "office_plan_node_not_found", "Office chart node was not found.", [`nodeId=${nodeId}`]);
  }
  return node;
}
async function persistOfficePlanComptableCreate(tx, nodeId, request) {
  if (tx.kind === "memory") {
    return;
  }
  const slug = slugify(request.code, request.label);
  if (request.kind === "department") {
    await tx.executor.execute(sql`
      insert into departments (id, name, slug, type, is_active)
      values (${nodeId}, ${request.label.trim()}, ${slug}, ${request.type ?? "mixed"}, ${request.active})
    `);
    return;
  }
  if (request.kind === "division") {
    await tx.executor.execute(sql`
      insert into divisions (id, department_id, name, slug, is_active)
      values (${nodeId}, ${request.parentId}, ${request.label.trim()}, ${slug}, ${request.active})
    `);
    return;
  }
  await tx.executor.execute(sql`
    insert into categories (id, name, type, division_id, is_active)
    values (${nodeId}, ${request.label.trim()}, ${request.type}, ${request.parentId}, ${request.active})
  `);
}
async function persistOfficePlanComptableUpdate(tx, nodeId, request) {
  if (tx.kind === "memory") {
    return;
  }
  const slug = slugify(request.code, request.label);
  if (request.kind === "department") {
    await tx.executor.execute(sql`
      update departments
      set name = ${request.label.trim()}, slug = ${slug}, type = ${request.type ?? "mixed"}, is_active = ${request.active}
      where id = ${nodeId}
    `);
    return;
  }
  if (request.kind === "division") {
    await tx.executor.execute(sql`
      update divisions
      set department_id = ${request.parentId}, name = ${request.label.trim()}, slug = ${slug}, is_active = ${request.active}
      where id = ${nodeId}
    `);
    return;
  }
  await tx.executor.execute(sql`
    update categories
    set name = ${request.label.trim()}, type = ${request.type}, division_id = ${request.parentId}, is_active = ${request.active}
    where id = ${nodeId}
  `);
}
function upsertOfficePlanComptableFixture(fixtures, nodeId, request) {
  const mutableOffice = fixtures.office;
  if (request.kind === "department") {
    const department = { id: nodeId, name: request.label.trim(), type: request.type ?? "mixed", color: null, isActive: request.active };
    mutableOffice.departments = upsertById(fixtures.office.departments, department);
    return;
  }
  if (request.kind === "division") {
    const division = { id: nodeId, departmentId: request.parentId ?? "", name: request.label.trim(), isActive: request.active };
    mutableOffice.divisions = upsertById(fixtures.office.divisions, division);
    return;
  }
  const category = { id: nodeId, divisionId: request.parentId, name: request.label.trim(), type: request.type ?? "expense", isActive: request.active };
  mutableOffice.categories = upsertById(fixtures.office.categories, category);
}
function slugify(code, label) {
  return `${code}-${label}`.toLowerCase().replace(/[^a-z0-9]+/gu, "-").replace(/^-|-$/gu, "");
}
function requireReconciliationCandidate(dataset, reconciliationId) {
  const candidate = toReconciliationCandidates(dataset).find((item) => item.id === reconciliationId);
  if (candidate === void 0) {
    throw new ApiRouteError(404, "office_reconciliation_not_found", "Office reconciliation candidate was not found.", [
      `reconciliationId=${reconciliationId}`
    ]);
  }
  return candidate;
}
async function persistOfficeReconciliationApproval(tx, request, actorUserId, candidates) {
  if (tx.kind === "memory") {
    return;
  }
  for (const candidate of candidates) {
    if (candidate.id.startsWith("recon_")) {
      await tx.executor.execute(sql`
        insert into office_bank_reconciliation_matches (
          id,
          bank_statement_line_id,
          transaction_id,
          confidence_bp,
          status,
          approved_by_user_id,
          approved_at
        )
        values (
          ${randomUUID2()},
          ${candidate.statementLineId},
          ${candidate.transactionId},
          ${candidate.confidenceBp},
          'matched',
          ${actorUserId},
          ${request.approvedAt}
        )
        on conflict (bank_statement_line_id, transaction_id) do update
        set status = 'matched', approved_by_user_id = excluded.approved_by_user_id, approved_at = excluded.approved_at, updated_at = now()
      `);
    } else {
      await tx.executor.execute(sql`
        update office_bank_reconciliation_matches
        set status = 'matched', approved_by_user_id = ${actorUserId}, approved_at = ${request.approvedAt}, updated_at = now()
        where id = ${candidate.id}
      `);
    }
    await tx.executor.execute(sql`
      update office_bank_statement_lines
      set reconciliation_status = 'matched', matched_transaction_id = ${candidate.transactionId}
      where id = ${candidate.statementLineId}
    `);
    await tx.executor.execute(sql`
      update transactions
      set status = 'validated', is_fully_reconciled = true, approved_by_user_id = ${actorUserId}, approved_at = ${request.approvedAt}, updated_at = now()
      where id = ${candidate.transactionId}
    `);
  }
}
function approveReconciliationFixture(fixtures, candidates, approvedAt, actorUserId) {
  const mutableOffice = fixtures.office;
  mutableOffice.bankStatementLines = fixtures.office.bankStatementLines.map((line) => {
    const candidate = candidates.find((item) => item.statementLineId === line.id);
    if (candidate === void 0) {
      return line;
    }
    return { ...line, reconciliationStatus: "matched", matchedTransactionId: candidate.transactionId };
  });
  mutableOffice.transactions = fixtures.office.transactions.map(
    (transaction) => candidates.some((candidate) => candidate.transactionId === transaction.id) ? { ...transaction, status: "validated" } : transaction
  );
  mutableOffice.bankReconciliationMatches = [
    ...fixtures.office.bankReconciliationMatches.filter((match2) => !candidates.some((candidate) => candidate.id === match2.id)),
    ...candidates.map((candidate) => ({
      id: candidate.id.startsWith("recon_") ? randomUUID2() : candidate.id,
      bankStatementLineId: candidate.statementLineId,
      transactionId: candidate.transactionId,
      confidenceBp: candidate.confidenceBp,
      status: "matched",
      approvedByUserId: actorUserId,
      approvedAt
    }))
  ];
}
async function persistOfficePartnerUpsert(tx, partnerId, request, isUpdate) {
  if (tx.kind === "memory") {
    return;
  }
  if (isUpdate) {
    await tx.executor.execute(sql`
      update partners
      set
        name = ${request.name.trim()},
        email = ${request.email},
        phone = ${request.phone},
        address = ${request.address},
        tax_id = ${request.taxId},
        notes = ${request.notes},
        is_active = ${request.active}
      where id = ${partnerId}
    `);
    return;
  }
  await tx.executor.execute(sql`
    insert into partners (id, name, type, email, phone, address, tax_id, notes, is_active)
    values (${partnerId}, ${request.name.trim()}, 'both', ${request.email}, ${request.phone}, ${request.address}, ${request.taxId}, ${request.notes}, ${request.active})
  `);
}
function upsertOfficePartnerFixture(fixtures, partnerId, request) {
  const mutableOffice = fixtures.office;
  const existing = fixtures.office.partners.find((partner2) => partner2.id === partnerId);
  const partner = {
    id: partnerId,
    name: request.name.trim(),
    type: existing?.type ?? "both",
    isActive: request.active
  };
  mutableOffice.partners = upsertById(fixtures.office.partners, partner);
}
async function persistOfficePartnerPayeeUnlink(tx, partnerId) {
  if (tx.kind === "memory") {
    return;
  }
  await tx.executor.execute(sql`
    update identity_link
    set status = 'archived', updated_at = now()
    where office_partner_id = ${partnerId}
      and status <> 'archived'
  `);
}
function unlinkOfficePartnerPayeeFixture(fixtures, partnerId) {
  const mutableFixtures = fixtures;
  const entries = Object.entries(fixtures.officePartnerPayeeLinks).filter(([id]) => id !== partnerId);
  mutableFixtures.officePartnerPayeeLinks = Object.fromEntries(entries);
}
function requireDistributionMappingRow(fixtures, rowId) {
  const row = fixtures.distributionMappingRows.find((candidate) => candidate.id === rowId);
  if (row === void 0) {
    throw new ApiRouteError(404, "distribution_mapping_row_not_found", "Distribution mapping row was not found.", [`rowId=${rowId}`]);
  }
  if (row.suggestedTrackId === null) {
    throw new ApiRouteError(422, "distribution_mapping_target_missing", "Mapping row cannot be applied without a suggested track.", [`rowId=${rowId}`]);
  }
  return row;
}
async function persistDistributionMappingApplyRules(tx, rows) {
  if (tx.kind === "memory") {
    return;
  }
  for (const row of rows) {
    await tx.executor.execute(sql`
      update normalized_earnings
      set mapping_status = 'matched', calculation_status = 'pending', updated_at = now()
      where id = ${row.id}
    `);
    await tx.executor.execute(sql`
      with updated as (
        update earning_track_matches
        set confidence = ${(row.confidenceBp / 100).toFixed(6)}, status = 'matched'
        where earning_id = ${row.id} and track_id = ${row.suggestedTrackId}
        returning id
      )
      insert into earning_track_matches (id, earning_id, track_id, confidence, status)
      select ${randomUUID2()}, ${row.id}, ${row.suggestedTrackId}, ${(row.confidenceBp / 100).toFixed(6)}, 'matched'
      where not exists (select 1 from updated)
    `);
  }
}
function applyDistributionMappingFixture(fixtures, rowIds) {
  const mutableFixtures = fixtures;
  mutableFixtures.distributionMappingRows = fixtures.distributionMappingRows.map(
    (row) => rowIds.includes(row.id) ? { ...row, status: "mapped" } : row
  );
  const mutableDistribution = fixtures.distribution;
  mutableDistribution.normalizedEarnings = fixtures.distribution.normalizedEarnings.map(
    (earning) => rowIds.includes(earning.id) ? { ...earning, mappingStatus: "matched", calculationStatus: "pending" } : earning
  );
}
async function persistDistributionContractExpenseCreate(tx, expenseId, request) {
  if (tx.kind === "memory") {
    return;
  }
  await tx.executor.execute(sql`
    insert into contract_cost_terms (
      id,
      contract_id,
      payee_id,
      amount,
      currency,
      recoupable,
      recovery_method,
      status,
      scope_type,
      scope_id
    )
    values (
      ${expenseId},
      ${request.contractId},
      ${request.payeeId},
      ${request.amountMicro},
      ${request.currency},
      true,
      'statement_recoupment',
      'open',
      'operator_expense',
      ${request.incurredOn}
    )
  `);
}
function appendDistributionContractExpenseFixture(fixtures, expenseId, request) {
  const expense = {
    id: expenseId,
    contractId: request.contractId,
    payeeId: request.payeeId,
    incurredOn: request.incurredOn,
    label: request.label.trim(),
    originalAmountMicro: request.amountMicro,
    openAmountMicro: request.amountMicro,
    currency: request.currency,
    status: "open"
  };
  const mutableFixtures = fixtures;
  mutableFixtures.distributionContractExpenses = [expense, ...fixtures.distributionContractExpenses];
  mutableFixtures.distributionCostTerms = [
    {
      id: expenseId,
      contractId: request.contractId,
      payeeId: request.payeeId,
      amount: request.amountMicro,
      currency: request.currency,
      recoupable: true,
      status: "open",
      expenseDate: request.incurredOn
    },
    ...fixtures.distributionCostTerms
  ];
}
function requireDistributionAllocationRun(dataset, runId) {
  const run = dataset.calculationRuns.find((candidate) => candidate.id === runId);
  if (run === void 0) {
    throw new ApiRouteError(404, "allocation_run_not_found", "Distribution allocation run was not found.", [`runId=${runId}`]);
  }
  return run;
}
async function persistDistributionAllocationUnpost(tx, runId) {
  if (tx.kind === "memory") {
    return;
  }
  await tx.executor.execute(sql`
    update calculation_runs
    set status = 'excluded', finished_at = now()
    where id = ${runId}
  `);
  await tx.executor.execute(sql`
    update earning_allocations
    set status = 'void'
    where calculation_run_id = ${runId}
  `);
}
function unpostDistributionAllocationFixture(fixtures, runId) {
  const mutableDistribution = fixtures.distribution;
  mutableDistribution.calculationRuns = fixtures.distribution.calculationRuns.map(
    (run) => run.id === runId ? { ...run, status: "excluded", finishedAt: run.finishedAt ?? (/* @__PURE__ */ new Date()).toISOString() } : run
  );
  mutableDistribution.earningAllocations = fixtures.distribution.earningAllocations.map(
    (allocation) => allocation.calculationRunId === runId ? { ...allocation, status: "void" } : allocation
  );
}
function requireDistributionSuspenseItem(dataset, suspenseId) {
  const suspense = dataset.suspenseItems.find((candidate) => candidate.id === suspenseId);
  if (suspense === void 0) {
    throw new ApiRouteError(404, "distribution_suspense_not_found", "Distribution suspense item was not found.", [`suspenseId=${suspenseId}`]);
  }
  return suspense;
}
async function persistDistributionSuspenseResolve(tx, suspenseId, resolvedAt) {
  if (tx.kind === "memory") {
    return;
  }
  await tx.executor.execute(sql`
    update suspense_items
    set resolved = true, resolved_at = ${resolvedAt}
    where id = ${suspenseId}
  `);
}
function resolveDistributionSuspenseFixture(fixtures, suspenseId, resolvedAt) {
  const mutableDistribution = fixtures.distribution;
  mutableDistribution.suspenseItems = fixtures.distribution.suspenseItems.map(
    (suspense) => suspense.id === suspenseId ? { ...suspense, resolved: true, resolvedAt } : suspense
  );
}
function upsertById(items, item) {
  const exists2 = items.some((candidate) => candidate.id === item.id);
  if (!exists2) {
    return [item, ...items];
  }
  return items.map((candidate) => candidate.id === item.id ? item : candidate);
}
async function distributionAllocationPreviewResponse(context, dependencies) {
  const request = await readJsonBody(context);
  assertAllocationRunPreviewRequest(context, request);
  requirePermissionForWorkspace(context.get("authUser"), "distribution_allocations_preview", request.workspaceId);
  const runId = previewIdFor("allocation-run", `${request.period}:${request.lockKey}`);
  const plan = buildAllocationExecutionPlan(dependencies, request.period, request.lockKey, runId);
  return context.json(toAllocationRunPlanResponse(plan, null));
}
async function distributionAllocationRunResponse(context, dependencies) {
  const request = await readJsonBody(context);
  assertAllocationRunStartRequest(context, request);
  const idempotencyKey = requireIdempotencyKey(context);
  const actor = context.get("authUser");
  const result = await runIdempotentMutation({
    runtime: dependencies.persistence,
    actor,
    action: "distribution_allocations_run",
    route: context.req.path,
    idempotencyKey,
    requestBody: request,
    write: async (tx, resolvedIdempotencyKey) => {
      await acquireAdvisoryLock(tx, request.lockKey);
      const runId = randomUUID2();
      const plan = buildAllocationExecutionPlan(dependencies, request.period, request.lockKey, runId);
      const persistedAllocations = plan.allocations.map((allocation) => ({
        id: randomUUID2(),
        ...allocation
      }));
      const startedAtIso = dependencies.nowIso();
      const finishedAtIso = dependencies.nowIso();
      const persistInput = {
        runId,
        batchId: plan.batchId,
        startedAtIso,
        finishedAtIso,
        allocations: persistedAllocations,
        expenseApplications: plan.expenseApplications,
        costTermStatusUpdates: plan.costTermStatusUpdates,
        suspenseItems: plan.suspenseItems,
        metadata: {
          workspaceId: request.workspaceId,
          period: request.period,
          lockKey: request.lockKey,
          cadence: request.cadence,
          earningCount: plan.pendingEarnings.length,
          allocationCount: plan.allocations.length,
          suspenseCount: plan.suspenseItems.length
        }
      };
      await persistDistributionAllocationRun(tx, persistInput);
      const auditEventId = await appendAuditEvent(tx, {
        actor,
        action: "distribution_allocations_run",
        targetType: "calculation_run",
        targetId: runId,
        before: {},
        after: {
          period: request.period,
          lockKey: request.lockKey,
          earningCount: plan.pendingEarnings.length,
          allocationCount: plan.allocations.length,
          expenseApplicationCount: plan.expenseApplications.length,
          costTermUpdateCount: plan.costTermStatusUpdates.length,
          suspenseCount: plan.suspenseItems.length
        },
        idempotencyKey: resolvedIdempotencyKey
      });
      appendAllocationRunFixture(dependencies.fixtures, persistInput);
      return toAllocationRunPlanResponse(plan, auditEventId);
    }
  });
  return context.json(result.body, result.status);
}
async function distributionStatementGenerateResponse(context, dependencies) {
  const request = await readJsonBody(context);
  assertStatementGenerateRequest(context, request);
  const idempotencyKey = requireIdempotencyKey(context);
  const actor = context.get("authUser");
  const result = await runIdempotentMutation({
    runtime: dependencies.persistence,
    actor,
    action: "distribution_statement_generate",
    route: context.req.path,
    idempotencyKey,
    requestBody: request,
    write: async (tx, resolvedIdempotencyKey) => {
      await acquireAdvisoryLock(tx, request.lockKey);
      const runId = randomUUID2();
      const plan = buildStatementGenerateExecutionPlan(dependencies, request, runId);
      for (const statementPlan of plan.statementPlans) {
        await acquireAdvisoryLock(tx, statementLockKey(statementPlan.statement.payeeId, statementPlan.statement.periodStart, statementPlan.statement.currency));
      }
      await persistDistributionStatements(tx, {
        statements: plan.statementPlans
      });
      const auditEventId = await appendAuditEvent(tx, {
        actor,
        action: "distribution_statement_generate",
        targetType: "statement_generation_run",
        targetId: runId,
        before: {},
        after: {
          workspaceId: request.workspaceId,
          period: request.period,
          payeeIds: request.payeeIds,
          statementCount: plan.statementPlans.length,
          lineCount: statementLineCount(plan.statementPlans),
          balanceLedgerRowCount: plan.statementPlans.length
        },
        idempotencyKey: resolvedIdempotencyKey
      });
      appendStatementGenerateFixture(dependencies.fixtures, plan, dependencies.nowIso());
      return toStatementGenerateResponse(plan, auditEventId);
    }
  });
  return context.json(result.body, result.status);
}
async function distributionStatementVoidResponse(context, dependencies) {
  const body = await readOptionalJsonBody(context);
  const idempotencyKey = requireIdempotencyKey(context);
  const statementId = requirePathParam(context, "statementId");
  const actor = context.get("authUser");
  const result = await runIdempotentMutation({
    runtime: dependencies.persistence,
    actor,
    action: "distribution_statement_void",
    route: context.req.path,
    idempotencyKey,
    requestBody: body,
    write: async (tx, resolvedIdempotencyKey) => {
      const statement = requireStatementForVoid(dependencies, statementId);
      const ledgerRow = requireStatementLedgerRow(dependencies, statementId);
      await acquireAdvisoryLock(tx, `distribution:statement:void:${statementId}`);
      const voidPlan = buildVoidPlan({ id: statement.id, status: statement.status }, ledgerRow);
      const persistInput = {
        statementId,
        status: voidPlan.statementStatusUpdate.status,
        reversalLedgerRow: voidPlan.reversalLedgerRow
      };
      await persistDistributionStatementVoid(tx, persistInput);
      const auditEventId = await appendAuditEvent(tx, {
        actor,
        action: "distribution_statement_void",
        targetType: "statement",
        targetId: statementId,
        before: {
          status: statement.status,
          ledgerRow
        },
        after: {
          status: "void",
          reversalLedgerRow: voidPlan.reversalLedgerRow
        },
        idempotencyKey: resolvedIdempotencyKey
      });
      appendStatementVoidFixture(dependencies.fixtures, persistInput, dependencies.nowIso());
      return {
        id: statementId,
        status: "completed",
        auditEventId,
        reversalLedgerRowCount: 1,
        reversal: voidPlan.reversalLedgerRow
      };
    }
  });
  return context.json(result.body, result.status);
}
async function distributionPaymentRecordResponse(context, dependencies) {
  const request = await readJsonBody(context);
  assertPaymentRecordRequest(context, request);
  const amount = normalizeErhAmountField(context, request.amountMicro, "amountMicro");
  const idempotencyKey = requireIdempotencyKey(context);
  const actor = context.get("authUser");
  const result = await runIdempotentMutation({
    runtime: dependencies.persistence,
    actor,
    action: "distribution_payment_record",
    route: context.req.path,
    idempotencyKey,
    requestBody: request,
    write: async (tx, resolvedIdempotencyKey) => {
      const statement = requireDistributionStatement(dependencies.fixtures.distribution, request.statementId);
      assertPaymentMatchesStatement(context, request.payeeId, request.currency, statement);
      const paymentId = randomUUID2();
      const statementPaymentLinkId = randomUUID2();
      const persistInput = {
        paymentId,
        statementPaymentLinkId,
        statementId: request.statementId,
        payeeId: request.payeeId,
        amount,
        currency: request.currency,
        paidAt: request.paidAt,
        reference: request.reference.trim()
      };
      await persistDistributionPaymentRecord(tx, persistInput);
      const patch = paymentRecordFixturePatch(persistInput);
      const projected = distributionDatasetWithPaymentPatch(dependencies.fixtures.distribution, patch);
      const balances = computePaymentBalances(projected, request.statementId);
      const auditEventId = await appendAuditEvent(tx, {
        actor,
        action: "distribution_payment_record",
        targetType: "payment",
        targetId: paymentId,
        before: {},
        after: {
          payment: patch.payment,
          statementPaymentLink: patch.link,
          statementBalance: balances.statementBalance,
          groupTotals: balances.groupTotals,
          note: "Payment record only; no external money movement is triggered."
        },
        idempotencyKey: resolvedIdempotencyKey
      });
      applyDistributionPaymentPatchFixture(dependencies.fixtures, patch);
      return paymentMutationResponse(paymentId, request.statementId, amount, request.currency, "recorded", balances, auditEventId);
    }
  });
  return context.json(result.body, result.status);
}
async function distributionPaymentUpdateResponse(context, dependencies) {
  const paymentId = requirePathParam(context, "paymentId");
  const request = await readJsonBody(context);
  assertPaymentUpdateRequest(context, request);
  const amount = normalizeErhAmountField(context, request.amountMicro, "amountMicro");
  const idempotencyKey = requireIdempotencyKey(context);
  const actor = context.get("authUser");
  const result = await runIdempotentMutation({
    runtime: dependencies.persistence,
    actor,
    action: "distribution_payment_update",
    route: context.req.path,
    idempotencyKey,
    requestBody: request,
    write: async (tx, resolvedIdempotencyKey) => {
      const payment = requireDistributionPayment(dependencies.fixtures.distribution, paymentId);
      const link = requireDistributionPaymentLink(dependencies.fixtures.distribution, paymentId);
      const statement = requireDistributionStatement(dependencies.fixtures.distribution, link.statementId);
      assertPaymentIsMutable(context, payment);
      assertPaymentMatchesStatement(context, payment.payeeId, request.currency, statement);
      const persistInput = {
        paymentId,
        amount,
        currency: request.currency,
        reference: request.reference.trim()
      };
      await persistDistributionPaymentUpdate(tx, persistInput);
      const patch = paymentUpdateFixturePatch(payment, link, persistInput);
      const projected = distributionDatasetWithPaymentPatch(dependencies.fixtures.distribution, patch);
      const balances = computePaymentBalances(projected, link.statementId);
      const auditEventId = await appendAuditEvent(tx, {
        actor,
        action: "distribution_payment_update",
        targetType: "payment",
        targetId: paymentId,
        before: {
          payment,
          statementPaymentLink: link,
          statementBalance: computePaymentBalances(dependencies.fixtures.distribution, link.statementId).statementBalance
        },
        after: {
          payment: patch.payment,
          statementPaymentLink: patch.link,
          statementBalance: balances.statementBalance,
          groupTotals: balances.groupTotals,
          note: "Payment record update only; no external money movement is triggered."
        },
        idempotencyKey: resolvedIdempotencyKey
      });
      applyDistributionPaymentPatchFixture(dependencies.fixtures, patch);
      return paymentMutationResponse(paymentId, link.statementId, amount, request.currency, "edited", balances, auditEventId);
    }
  });
  return context.json(result.body, result.status);
}
async function distributionPaymentReconcileResponse(context, dependencies) {
  const paymentId = requirePathParam(context, "paymentId");
  const request = await readJsonBody(context);
  assertPaymentReconcileRequest(context, request);
  const idempotencyKey = requireIdempotencyKey(context);
  const actor = context.get("authUser");
  const result = await runIdempotentMutation({
    runtime: dependencies.persistence,
    actor,
    action: "distribution_payment_reconcile",
    route: context.req.path,
    idempotencyKey,
    requestBody: request,
    write: async (tx, resolvedIdempotencyKey) => {
      const payment = requireDistributionPayment(dependencies.fixtures.distribution, paymentId);
      const link = requireDistributionPaymentLink(dependencies.fixtures.distribution, paymentId);
      const statement = requireDistributionStatement(dependencies.fixtures.distribution, link.statementId);
      assertPaymentIsMutable(context, payment);
      assertPaymentMatchesStatement(context, payment.payeeId, payment.currency, statement);
      const persistInput = {
        paymentId,
        statementPaymentLinkId: link.id,
        statementId: link.statementId,
        amountApplied: payment.amount,
        bankTransactionId: request.bankTransactionId,
        reconciledAt: request.reconciledAt
      };
      await persistDistributionPaymentReconcile(tx, persistInput);
      const patch = paymentReconcileFixturePatch(payment, link, persistInput);
      const projected = distributionDatasetWithPaymentPatch(dependencies.fixtures.distribution, patch);
      const balances = computePaymentBalances(projected, link.statementId);
      const auditEventId = await appendAuditEvent(tx, {
        actor,
        action: "distribution_payment_reconcile",
        targetType: "payment",
        targetId: paymentId,
        before: {
          payment,
          statementPaymentLink: link,
          statementBalance: computePaymentBalances(dependencies.fixtures.distribution, link.statementId).statementBalance
        },
        after: {
          payment: patch.payment,
          statementPaymentLink: patch.link,
          bankTransactionId: request.bankTransactionId,
          reconciledAt: request.reconciledAt,
          statementBalance: balances.statementBalance,
          groupTotals: balances.groupTotals,
          note: "Payment reconciliation only; no external money movement is triggered."
        },
        idempotencyKey: resolvedIdempotencyKey
      });
      applyDistributionPaymentPatchFixture(dependencies.fixtures, patch);
      return paymentMutationResponse(paymentId, link.statementId, payment.amount, payment.currency, "reconciled", balances, auditEventId);
    }
  });
  return context.json(result.body, result.status);
}
async function distributionContractRulesUpdateResponse(context, dependencies) {
  const contractId = requirePathParam(context, "contractId");
  const request = await readJsonBody(context);
  assertContractRoyaltyRulesUpdateRequest(context, request);
  requireDistributionContract(dependencies, contractId);
  const persistedRules = persistedRoyaltyRulesFromRequest(contractId, request.rules);
  const totalPercentage = assertRoyaltySplitTotalsOneHundred(context, persistedRules);
  const idempotencyKey = requireIdempotencyKey(context);
  const actor = context.get("authUser");
  const result = await runIdempotentMutation({
    runtime: dependencies.persistence,
    actor,
    action: "distribution_contract_rules_update",
    route: context.req.path,
    idempotencyKey,
    requestBody: request,
    write: async (tx, resolvedIdempotencyKey) => {
      const beforeRules = dependencies.fixtures.distributionRoyaltyRules.filter((rule) => rule.contractId === contractId);
      const persistInput = {
        contractId,
        rules: persistedRules
      };
      await persistDistributionRoyaltyRules(tx, persistInput);
      const afterRules = apiRoyaltyRulesFromPersistedRules(persistedRules);
      const auditEventId = await appendAuditEvent(tx, {
        actor,
        action: "distribution_contract_rules_update",
        targetType: "contract",
        targetId: contractId,
        before: {
          royaltyRules: beforeRules
        },
        after: {
          royaltyRules: afterRules,
          totalPercentage
        },
        idempotencyKey: resolvedIdempotencyKey
      });
      applyDistributionRoyaltyRulesFixture(dependencies.fixtures, contractId, afterRules);
      return {
        id: contractId,
        status: "completed",
        auditEventId,
        contractId,
        ruleCount: afterRules.length,
        totalPercentage,
        rules: afterRules
      };
    }
  });
  return context.json(result.body, result.status);
}
async function distributionFxRatesSaveResponse(context, dependencies) {
  const request = await readJsonBody(context);
  assertFxRatesSaveRequest(context, request);
  const rates = fxRatesFromRequest(request.rates);
  const idempotencyKey = requireIdempotencyKey(context);
  const actor = context.get("authUser");
  const result = await runIdempotentMutation({
    runtime: dependencies.persistence,
    actor,
    action: "distribution_fx_rates_save",
    route: context.req.path,
    idempotencyKey,
    requestBody: request,
    write: async (tx, resolvedIdempotencyKey) => {
      const beforeRates = distributionFxRateMatches(dependencies.fixtures.distributionFxRates, rates);
      const persistInput = {
        rates
      };
      await persistDistributionFxRates(tx, persistInput);
      const auditEventId = await appendAuditEvent(tx, {
        actor,
        action: "distribution_fx_rates_save",
        targetType: "fx_rates",
        targetId: fxRatesAuditTargetId(rates),
        before: {
          rates: beforeRates
        },
        after: {
          rates
        },
        idempotencyKey: resolvedIdempotencyKey
      });
      applyDistributionFxRatesFixture(dependencies.fixtures, rates);
      return {
        id: fxRatesAuditTargetId(rates),
        status: "completed",
        auditEventId,
        rateCount: rates.length,
        rates
      };
    }
  });
  return context.json(result.body, result.status);
}
async function officePartnerPayeeLinkResponse(context, dependencies) {
  const partnerId = requirePathParam(context, "partnerId");
  const request = await readJsonBody(context);
  assertOfficePartnerPayeeLinkRequest(context, request);
  const partner = requirePartner2(dependencies.fixtures.office, partnerId);
  const payeeId = requireLinkedPayeeId(context, request.payeeId);
  const payee = requireDistributionPayee(dependencies.fixtures.distribution, payeeId);
  return identityLinkResponse(context, dependencies, {
    action: "office_partner_payee_link",
    route: context.req.path,
    partner,
    payee,
    requestBody: request
  });
}
async function distributionPayeePartnerLinkResponse(context, dependencies) {
  const payeeId = requirePathParam(context, "payeeId");
  const request = await readJsonBody(context);
  assertDistributionPayeePartnerLinkRequest(context, request);
  const payee = requireDistributionPayee(dependencies.fixtures.distribution, payeeId);
  const partner = requirePartner2(dependencies.fixtures.office, request.officePartnerId);
  return identityLinkResponse(context, dependencies, {
    action: "distribution_identity_link",
    route: context.req.path,
    partner,
    payee,
    requestBody: request
  });
}
async function identityLinkResponse(context, dependencies, input) {
  const idempotencyKey = requireIdempotencyKey(context);
  const actor = context.get("authUser");
  const result = await runIdempotentMutation({
    runtime: dependencies.persistence,
    actor,
    action: input.action,
    route: input.route,
    idempotencyKey,
    requestBody: input.requestBody,
    write: async (tx, resolvedIdempotencyKey) => {
      const beforeOfficeLink = toPartnerPayeeLink(dependencies.fixtures, input.partner);
      const beforeDistributionLink = toDistributionPayeePartnerLink(dependencies.fixtures, input.payee);
      const persistInput = {
        id: randomUUID2(),
        payeeId: input.payee.id,
        officePartnerId: input.partner.id,
        confidence: "100.000000",
        status: "linked"
      };
      await persistIdentityLink(tx, persistInput);
      const officeLink = identityOfficeLink(input.partner, input.payee, persistInput.confidence);
      applyIdentityLinkFixture(dependencies.fixtures, officeLink);
      const distributionLink = toDistributionPayeePartnerLink(dependencies.fixtures, input.payee);
      const auditEventId = await appendAuditEvent(tx, {
        actor,
        action: input.action,
        targetType: "identity_link",
        targetId: identityLinkTargetId(input.partner.id, input.payee.id),
        before: {
          officeLink: beforeOfficeLink,
          distributionLink: beforeDistributionLink
        },
        after: {
          officeLink,
          distributionLink
        },
        idempotencyKey: resolvedIdempotencyKey
      });
      return {
        id: identityLinkTargetId(input.partner.id, input.payee.id),
        status: "completed",
        auditEventId,
        officePartnerId: input.partner.id,
        payeeId: input.payee.id,
        officeLink,
        distributionLink
      };
    }
  });
  return context.json(result.body, result.status);
}
async function distributionImportPreviewResponse(context, dependencies) {
  const request = await readJsonBody(context);
  assertDistributionImportPreviewRequest(context, request);
  requirePermissionForWorkspace(context.get("authUser"), "distribution_import_preview", request.workspaceId);
  const previewRows = previewRowsFromRecords(request.rows);
  const idempotencyFingerprint = `${request.source}:${request.checksum}:${hashRequestBody(request.rows)}`;
  const previewId = previewIdFor("distribution", idempotencyFingerprint);
  const preview = {
    previewId,
    workspaceId: request.workspaceId,
    source: request.source,
    fileName: request.fileName,
    checksum: request.checksum,
    idempotencyFingerprint,
    rows: previewRows,
    createdAtIso: dependencies.nowIso()
  };
  dependencies.persistence.storeDistributionImportPreview(preview);
  const currencyCodes = currencyCodesFromRows(request.rows, request.source === "kontor" ? "EUR" : "USD");
  const response = {
    previewId,
    source: request.source,
    statementReference: `preview:${request.checksum}`,
    accountReference: request.source,
    acceptedRowCount: previewRows.length,
    rejectedRowCount: 0,
    unmappedRowCount: previewRows.length,
    payableMicro: erhMoney.format(0n),
    currencyCodes,
    joinKeys: joinKeysFromRows(request.rows),
    idempotencyFingerprint,
    warnings: [
      "Distribution runtime parsers are not enabled in services/api yet; confirm will persist raw rows and import issues without fabricating normalized earnings."
    ]
  };
  return context.json(response);
}
async function distributionImportConfirmResponse(context, dependencies) {
  const request = await readJsonBody(context);
  assertDistributionImportConfirmRequest(context, request);
  const idempotencyKey = requireIdempotencyKey(context);
  const actor = context.get("authUser");
  const result = await runIdempotentMutation({
    runtime: dependencies.persistence,
    actor,
    action: "distribution_import_confirm",
    route: context.req.path,
    idempotencyKey,
    requestBody: request,
    write: async (tx, resolvedIdempotencyKey) => {
      const preview = requireDistributionPreview(context, dependencies, request.previewId, request.workspaceId);
      const batchId = randomUUID2();
      const importedAtIso = dependencies.nowIso();
      await persistDistributionImportConfirmation(tx, {
        batchId,
        source: preview.source,
        fileName: preview.fileName,
        status: "failed",
        importedAtIso,
        rows: preview.rows,
        acceptedRowIds: request.acceptedRowIds,
        rejectedRowIds: request.rejectedRowIds,
        metadata: {
          workspaceId: request.workspaceId,
          previewId: request.previewId,
          checksum: preview.checksum,
          acceptedRowIds: request.acceptedRowIds,
          rejectedRowIds: request.rejectedRowIds,
          normalizedRowCount: 0,
          parserStatus: "runtime_parser_missing"
        }
      });
      const auditEventId = await appendAuditEvent(tx, {
        actor,
        action: "distribution_import_confirm",
        targetType: "import_batch",
        targetId: batchId,
        before: {},
        after: {
          previewId: request.previewId,
          rawRowCount: preview.rows.length,
          normalizedRowCount: 0,
          issueCount: preview.rows.length,
          status: "failed"
        },
        idempotencyKey: resolvedIdempotencyKey
      });
      appendDistributionImportFixture(dependencies.fixtures, {
        id: batchId,
        source: preview.source,
        fileName: preview.fileName,
        status: "failed",
        importedAt: importedAtIso
      });
      return {
        id: batchId,
        status: "completed",
        auditEventId,
        importedRoyaltyEventCount: 0,
        rawRowCount: preview.rows.length,
        normalizedRowCount: 0,
        issueCount: preview.rows.length
      };
    }
  });
  return context.json(result.body, result.status);
}
async function distributionImportReverseResponse(context, dependencies) {
  const body = await readOptionalJsonBody(context);
  const idempotencyKey = requireIdempotencyKey(context);
  const batchId = requirePathParam(context, "batchId");
  const actor = context.get("authUser");
  const result = await runIdempotentMutation({
    runtime: dependencies.persistence,
    actor,
    action: "distribution_import_reverse",
    route: context.req.path,
    idempotencyKey,
    requestBody: body,
    write: async (tx, resolvedIdempotencyKey) => {
      const statusChange = await markDistributionImportBatchVoid(tx, batchId);
      const auditEventId = await appendAuditEvent(tx, {
        actor,
        action: "distribution_import_reverse",
        targetType: "import_batch",
        targetId: batchId,
        before: { status: statusChange.previousStatus },
        after: { status: statusChange.nextStatus },
        idempotencyKey: resolvedIdempotencyKey
      });
      markDistributionImportFixtureVoid(dependencies.fixtures, batchId);
      return {
        id: batchId,
        status: "completed",
        auditEventId
      };
    }
  });
  return context.json(result.body, result.status);
}
async function officeBankImportPreviewResponse(context, dependencies) {
  const request = await readJsonBody(context);
  assertOfficeBankImportPreviewRequest(context, request);
  requirePermissionForWorkspace(context.get("authUser"), "office_bank_import_preview", request.workspaceId);
  const previewRows = previewRowsFromRecords(request.rows);
  const parsedRows = previewRows.map((row) => parseOfficeBankPreviewRow(row, request.workspaceId, dependencies.fixtures.office.bankAccounts)).filter((row) => row.line !== null);
  const idempotencyFingerprint = `${request.source}:${request.checksum}:${hashRequestBody(request.rows)}`;
  const previewId = previewIdFor("office-bank", idempotencyFingerprint);
  const preview = {
    previewId,
    workspaceId: request.workspaceId,
    source: request.source,
    fileName: request.fileName,
    checksum: request.checksum,
    idempotencyFingerprint,
    rows: previewRows,
    createdAtIso: dependencies.nowIso()
  };
  dependencies.persistence.storeOfficeBankImportPreview(preview);
  const dateRange = officeDateRange(parsedRows.map((row) => row.line.occurredOn));
  const response = {
    previewId,
    source: request.source,
    detectedFormat: `${request.source}_structured_json`,
    accountReference: parsedRows[0]?.line.accountId ?? null,
    periodLabel: dateRange.label,
    currencyCodes: parsedRows.length === 0 ? currencyCodesFromRows(request.rows, "MUR") : uniqueStrings(parsedRows.map((row) => row.line.currency)),
    openingBalanceMicro: null,
    closingBalanceMicro: null,
    idempotencyFingerprint,
    acceptedRowCount: parsedRows.length,
    rejectedRowCount: previewRows.length - parsedRows.length,
    duplicateRowCount: 0,
    parsingNotes: [
      "Preview accepts structured JSON rows only; raw PDF/XLS parsing is not implemented in services/api."
    ],
    warnings: parsedRows.length === previewRows.length ? [] : ["Some rows could not be converted into bank statement lines and will remain in batch metadata instead of being fabricated."]
  };
  return context.json(response);
}
async function officeBankImportConfirmResponse(context, dependencies) {
  const request = await readJsonBody(context);
  assertOfficeBankImportConfirmRequest(context, request);
  const idempotencyKey = requireIdempotencyKey(context);
  const actor = context.get("authUser");
  const result = await runIdempotentMutation({
    runtime: dependencies.persistence,
    actor,
    action: "office_bank_import_confirm",
    route: context.req.path,
    idempotencyKey,
    requestBody: request,
    write: async (tx, resolvedIdempotencyKey) => {
      const preview = requireOfficeBankPreview(context, dependencies, request.previewId, request.workspaceId);
      const acceptedRowIds = new Set(request.acceptedRowIds);
      const parsedRows = preview.rows.filter((row) => acceptedRowIds.has(row.id)).map((row) => parseOfficeBankPreviewRow(row, request.workspaceId, dependencies.fixtures.office.bankAccounts));
      const lines = parsedRows.map((row) => row.line).filter((line) => line !== null);
      const batchId = randomUUID2();
      const importedAtIso = dependencies.nowIso();
      const dateRange = officeDateRange(lines.map((line) => line.occurredOn));
      const batchStatus = lines.length === 0 ? "failed" : "confirmed";
      await persistOfficeBankImportConfirmation(tx, {
        batchId,
        workspaceId: request.workspaceId,
        source: preview.source,
        fileName: preview.fileName,
        checksum: preview.checksum,
        accountId: lines[0]?.accountId ?? null,
        periodStart: dateRange.start,
        periodEnd: dateRange.end,
        currency: lines[0]?.currency ?? null,
        acceptedRowCount: lines.length,
        rejectedRowCount: preview.rows.length - lines.length,
        duplicateRowCount: 0,
        idempotencyFingerprint: preview.idempotencyFingerprint,
        status: batchStatus,
        importedAtIso,
        metadata: {
          previewId: request.previewId,
          acceptedRowIds: request.acceptedRowIds,
          rejectedRowIds: request.rejectedRowIds,
          rowIssues: parsedRows.flatMap((row) => row.issues.map((issue) => ({ rowId: row.row.id, issue }))),
          rawRows: preview.rows
        },
        lines
      });
      const auditEventId = await appendAuditEvent(tx, {
        actor,
        action: "office_bank_import_confirm",
        targetType: "office_bank_import_batch",
        targetId: batchId,
        before: {},
        after: {
          previewId: request.previewId,
          importedStatementLineCount: lines.length,
          rejectedRowCount: preview.rows.length - lines.length,
          status: batchStatus
        },
        idempotencyKey: resolvedIdempotencyKey
      });
      appendOfficeBankImportFixture(dependencies.fixtures, {
        batchId,
        workspaceId: request.workspaceId,
        source: preview.source,
        fileName: preview.fileName,
        checksum: preview.checksum,
        accountId: lines[0]?.accountId ?? null,
        periodStart: dateRange.start,
        periodEnd: dateRange.end,
        currency: lines[0]?.currency ?? null,
        acceptedRowCount: lines.length,
        rejectedRowCount: preview.rows.length - lines.length,
        duplicateRowCount: 0,
        idempotencyFingerprint: preview.idempotencyFingerprint,
        status: batchStatus,
        importedAt: importedAtIso,
        metadata: {
          previewId: request.previewId,
          acceptedRowIds: request.acceptedRowIds,
          rejectedRowIds: request.rejectedRowIds
        },
        lines
      });
      appendOfficeAuditFixture(dependencies.fixtures, {
        id: auditEventId,
        actorId: actor.userId,
        action: "office_bank_import_confirm",
        entityType: "office_bank_import_batch",
        entityId: batchId,
        occurredAt: importedAtIso
      });
      return {
        id: batchId,
        status: "completed",
        auditEventId,
        importedTransactionCount: lines.length,
        rejectedRowCount: preview.rows.length - lines.length
      };
    }
  });
  return context.json(result.body, result.status);
}
async function officeBankImportReverseResponse(context, dependencies) {
  const body = await readOptionalJsonBody(context);
  const idempotencyKey = requireIdempotencyKey(context);
  const batchId = requirePathParam(context, "batchId");
  const actor = context.get("authUser");
  const result = await runIdempotentMutation({
    runtime: dependencies.persistence,
    actor,
    action: "office_bank_import_reverse",
    route: context.req.path,
    idempotencyKey,
    requestBody: body,
    write: async (tx, resolvedIdempotencyKey) => {
      const statusChange = await markOfficeBankImportBatchVoid(tx, batchId);
      const auditEventId = await appendAuditEvent(tx, {
        actor,
        action: "office_bank_import_reverse",
        targetType: "office_bank_import_batch",
        targetId: batchId,
        before: { status: statusChange.previousStatus },
        after: { status: statusChange.nextStatus },
        idempotencyKey: resolvedIdempotencyKey
      });
      markOfficeBankImportFixtureVoid(dependencies.fixtures, batchId);
      appendOfficeAuditFixture(dependencies.fixtures, {
        id: auditEventId,
        actorId: actor.userId,
        action: "office_bank_import_reverse",
        entityType: "office_bank_import_batch",
        entityId: batchId,
        occurredAt: dependencies.nowIso()
      });
      return {
        id: batchId,
        status: "completed",
        auditEventId
      };
    }
  });
  return context.json(result.body, result.status);
}
function assertDistributionImportPreviewRequest(context, request) {
  assertStringField(context, request.workspaceId, "workspaceId");
  assertStringField(context, request.fileName, "fileName");
  assertStringField(context, request.checksum, "checksum");
  if (request.source !== "kontor" && request.source !== "routenote") {
    throw new ApiRouteError(400, "body_value_invalid", "Distribution import source is invalid.", [`path=${context.req.path}`, `source=${String(request.source)}`]);
  }
  assertStringRecordRows(context, request.rows, "rows");
}
function assertDistributionImportConfirmRequest(context, request) {
  assertStringField(context, request.workspaceId, "workspaceId");
  assertStringField(context, request.previewId, "previewId");
  assertStringArray(context, request.acceptedRowIds, "acceptedRowIds");
  assertStringArray(context, request.rejectedRowIds, "rejectedRowIds");
}
function assertAllocationRunPreviewRequest(context, request) {
  assertStringField(context, request.workspaceId, "workspaceId");
  assertPeriodField(context, request.period, "period");
  assertStringField(context, request.lockKey, "lockKey");
}
function assertAllocationRunStartRequest(context, request) {
  assertStringField(context, request.workspaceId, "workspaceId");
  assertPeriodField(context, request.period, "period");
  assertStringField(context, request.lockKey, "lockKey");
  if (request.cadence !== "manual" && request.cadence !== "scheduled") {
    throw new ApiRouteError(400, "body_field_invalid", "Allocation cadence is invalid.", [`path=${context.req.path}`, `cadence=${String(request.cadence)}`]);
  }
}
function assertStatementGenerateRequest(context, request) {
  assertStringField(context, request.workspaceId, "workspaceId");
  assertPeriodField(context, request.period, "period");
  assertStringArray(context, request.payeeIds, "payeeIds");
  assertStringField(context, request.lockKey, "lockKey");
}
function assertPaymentRecordRequest(context, request) {
  assertStringField(context, request.workspaceId, "workspaceId");
  assertStringField(context, request.statementId, "statementId");
  assertStringField(context, request.payeeId, "payeeId");
  assertPositiveErhAmountField(context, request.amountMicro, "amountMicro");
  assertCurrencyField(context, request.currency, "currency");
  assertIsoDateTimeField(context, request.paidAt, "paidAt");
  assertStringField(context, request.reference, "reference");
}
function assertPaymentUpdateRequest(context, request) {
  assertStringField(context, request.workspaceId, "workspaceId");
  assertPositiveErhAmountField(context, request.amountMicro, "amountMicro");
  assertCurrencyField(context, request.currency, "currency");
  assertStringField(context, request.reference, "reference");
}
function assertPaymentReconcileRequest(context, request) {
  assertStringField(context, request.workspaceId, "workspaceId");
  assertStringField(context, request.bankTransactionId, "bankTransactionId");
  assertIsoDateTimeField(context, request.reconciledAt, "reconciledAt");
}
function assertContractRoyaltyRulesUpdateRequest(context, request) {
  assertStringField(context, request.workspaceId, "workspaceId");
  if (!Array.isArray(request.rules) || request.rules.length === 0) {
    throw new ApiRouteError(400, "body_field_invalid", "Royalty rules must be a non-empty array.", [`path=${context.req.path}`, "field=rules"]);
  }
  for (const [index, rule] of request.rules.entries()) {
    assertStringField(context, rule.payeeId, `rules.${String(index)}.payeeId`);
    assertScale6PercentageField(context, rule.percentage, `rules.${String(index)}.percentage`);
    assertNullableStringField(context, rule.scopeType, `rules.${String(index)}.scopeType`);
    assertNullableStringField(context, rule.scopeId, `rules.${String(index)}.scopeId`);
    assertNullableIsoDateField(context, rule.effectiveFrom, `rules.${String(index)}.effectiveFrom`);
    assertNullableIsoDateField(context, rule.effectiveTo, `rules.${String(index)}.effectiveTo`);
  }
}
function assertFxRatesSaveRequest(context, request) {
  assertStringField(context, request.workspaceId, "workspaceId");
  if (!Array.isArray(request.rates) || request.rates.length === 0) {
    throw new ApiRouteError(400, "body_field_invalid", "FX rates must be a non-empty array.", [`path=${context.req.path}`, "field=rates"]);
  }
  for (const [index, rate] of request.rates.entries()) {
    assertCurrencyField(context, rate.fromCurrency, `rates.${String(index)}.fromCurrency`);
    assertCurrencyField(context, rate.toCurrency, `rates.${String(index)}.toCurrency`);
    assertIsoDateField(context, rate.effectiveDate, `rates.${String(index)}.effectiveDate`);
    assertPositiveScale10Field(context, rate.rate, `rates.${String(index)}.rate`);
  }
}
function assertOfficePartnerPayeeLinkRequest(context, request) {
  assertStringField(context, request.workspaceId, "workspaceId");
  if (request.payeeId === null) {
    throw new ApiRouteError(400, "body_field_required", "Linking a partner requires a payeeId; use unlink for null payees.", [
      `path=${context.req.path}`,
      "field=payeeId"
    ]);
  }
  assertStringField(context, request.payeeId, "payeeId");
}
function assertDistributionPayeePartnerLinkRequest(context, request) {
  assertStringField(context, request.workspaceId, "workspaceId");
  assertStringField(context, request.officePartnerId, "officePartnerId");
}
function requireLinkedPayeeId(context, payeeId) {
  if (payeeId === null) {
    throw new ApiRouteError(400, "body_field_required", "Linking a partner requires a payeeId; use unlink for null payees.", [
      `path=${context.req.path}`,
      "field=payeeId"
    ]);
  }
  return payeeId;
}
function assertPeriodField(context, value, field) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}$/u.test(value)) {
    throw new ApiRouteError(400, "body_field_invalid", "A body field must be an ISO month string.", [`path=${context.req.path}`, `field=${field}`]);
  }
}
function assertPositiveErhAmountField(context, value, field) {
  if (typeof value !== "string") {
    throw new ApiRouteError(400, "body_field_invalid", "A body field must be a distribution money string.", [`path=${context.req.path}`, `field=${field}`]);
  }
  let units;
  try {
    units = erhMoney.parse(value);
  } catch (error) {
    throw new ApiRouteError(400, "body_field_invalid", "A body field must be a valid scale-10 distribution money string.", [
      `path=${context.req.path}`,
      `field=${field}`,
      `error=${error instanceof Error ? error.message : "unknown"}`
    ]);
  }
  if (units <= 0n) {
    throw new ApiRouteError(400, "body_field_invalid", "A payment amount must be positive.", [`path=${context.req.path}`, `field=${field}`]);
  }
}
function normalizeErhAmountField(context, value, field) {
  assertPositiveErhAmountField(context, value, field);
  return erhMoney.format(erhMoney.parse(value));
}
function assertCurrencyField(context, value, field) {
  if (typeof value !== "string" || !/^[A-Z]{3}$/u.test(value)) {
    throw new ApiRouteError(400, "body_field_invalid", "A body field must be a three-letter uppercase currency code.", [
      `path=${context.req.path}`,
      `field=${field}`,
      `value=${String(value)}`
    ]);
  }
}
function assertScale6PercentageField(context, value, field) {
  if (typeof value !== "string") {
    throw new ApiRouteError(400, "body_field_invalid", "A body field must be a scale-6 percentage string.", [`path=${context.req.path}`, `field=${field}`]);
  }
  const units = parseScaleField(context, value, field, 6);
  const oneHundredUnits = 100000000n;
  if (units < 0n || units > oneHundredUnits) {
    throw new ApiRouteError(400, "body_field_invalid", "A royalty percentage must be between 0.000000 and 100.000000.", [
      `path=${context.req.path}`,
      `field=${field}`,
      `value=${value}`
    ]);
  }
}
function assertPositiveScale10Field(context, value, field) {
  if (typeof value !== "string") {
    throw new ApiRouteError(400, "body_field_invalid", "A body field must be a scale-10 decimal string.", [`path=${context.req.path}`, `field=${field}`]);
  }
  const units = parseScaleField(context, value, field, 10);
  if (units <= 0n) {
    throw new ApiRouteError(400, "body_field_invalid", "A decimal value must be positive.", [
      `path=${context.req.path}`,
      `field=${field}`,
      `value=${value}`
    ]);
  }
}
function parseScaleField(context, value, field, scale) {
  const regex = new RegExp(`^-?\\d+(?:\\.\\d{1,${String(scale)}})?$`, "u");
  if (!regex.test(value)) {
    throw new ApiRouteError(400, "body_field_invalid", "A body field has too many decimal places for its scale.", [
      `path=${context.req.path}`,
      `field=${field}`,
      `scale=${String(scale)}`,
      `value=${value}`
    ]);
  }
  try {
    return parse(value, scale, "TRUNCATE");
  } catch (error) {
    throw new ApiRouteError(400, "body_field_invalid", "A body field must be a valid decimal string.", [
      `path=${context.req.path}`,
      `field=${field}`,
      `error=${error instanceof Error ? error.message : "unknown"}`
    ]);
  }
}
function assertIsoDateTimeField(context, value, field) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T/u.test(value) || Number.isNaN(Date.parse(value))) {
    throw new ApiRouteError(400, "body_field_invalid", "A body field must be an ISO date-time string.", [
      `path=${context.req.path}`,
      `field=${field}`,
      `value=${String(value)}`
    ]);
  }
}
function assertIsoDateField(context, value, field) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00.000Z`))) {
    throw new ApiRouteError(400, "body_field_invalid", "A body field must be an ISO date string.", [
      `path=${context.req.path}`,
      `field=${field}`,
      `value=${String(value)}`
    ]);
  }
}
function assertNullableIsoDateField(context, value, field) {
  if (value === null) {
    return;
  }
  assertIsoDateField(context, value, field);
}
function assertNullableStringField(context, value, field) {
  if (value === null) {
    return;
  }
  assertStringField(context, value, field);
}
function assertOfficeBankImportPreviewRequest(context, request) {
  assertStringField(context, request.workspaceId, "workspaceId");
  assertStringField(context, request.fileName, "fileName");
  assertStringField(context, request.checksum, "checksum");
  if (request.source !== "sbi" && request.source !== "mcb" && request.source !== "csv" && request.source !== "cashflow" && request.source !== "pdf") {
    throw new ApiRouteError(400, "body_value_invalid", "Office bank import source is invalid.", [`path=${context.req.path}`, `source=${String(request.source)}`]);
  }
  assertStringRecordRows(context, request.rows, "rows");
}
function assertOfficeBankImportConfirmRequest(context, request) {
  assertStringField(context, request.workspaceId, "workspaceId");
  assertStringField(context, request.previewId, "previewId");
  assertStringArray(context, request.acceptedRowIds, "acceptedRowIds");
  assertStringArray(context, request.rejectedRowIds, "rejectedRowIds");
}
function assertStringField(context, value, field) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ApiRouteError(400, "body_field_required", "A required string body field is missing.", [`path=${context.req.path}`, `field=${field}`]);
  }
}
function assertStringArray(context, value, field) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || item.trim().length === 0)) {
    throw new ApiRouteError(400, "body_field_invalid", "A body field must be an array of non-empty strings.", [`path=${context.req.path}`, `field=${field}`]);
  }
}
function assertStringRecordRows(context, value, field) {
  if (!Array.isArray(value)) {
    throw new ApiRouteError(400, "body_field_invalid", "Import rows must be an array of string records.", [`path=${context.req.path}`, `field=${field}`]);
  }
  for (const [index, row] of value.entries()) {
    if (typeof row !== "object" || row === null || Array.isArray(row)) {
      throw new ApiRouteError(400, "body_field_invalid", "Import rows must be objects.", [`path=${context.req.path}`, `field=${field}`, `rowIndex=${String(index)}`]);
    }
    for (const [key, cell] of Object.entries(row)) {
      if (typeof cell !== "string") {
        throw new ApiRouteError(400, "body_field_invalid", "Import row cells must be strings.", [`path=${context.req.path}`, `field=${field}`, `rowIndex=${String(index)}`, `column=${key}`]);
      }
    }
  }
}
function previewRowsFromRecords(rows) {
  return rows.map((row, index) => ({
    id: `row_${String(index + 1)}`,
    rowNumber: index + 1,
    rawData: row
  }));
}
function buildAllocationExecutionPlan(dependencies, period, lockKey, runId) {
  const pendingEarnings = dependencies.fixtures.distribution.normalizedEarnings.filter((earning) => earning.mappingStatus === "matched").filter((earning) => earning.calculationStatus === "pending").filter((earning) => earningMatchesPeriod(dependencies.fixtures.distribution, earning, period));
  const allocations = [];
  const expenseApplications = [];
  const costTermUpdates = /* @__PURE__ */ new Map();
  const suspenseItems = [];
  for (const earning of pendingEarnings) {
    const outcome = buildAllocationPlan(
      toDistributionEarningInput(dependencies.fixtures.distribution, earning, runId, period),
      royaltyRulesForEarning(dependencies, earning, period),
      costStateForAllocation(dependencies)
    );
    if (isAllocationSuspense(outcome)) {
      suspenseItems.push(outcome.suspense);
      continue;
    }
    allocations.push(...outcome.allocations);
    expenseApplications.push(...outcome.expenseApplications);
    for (const update of outcome.costTermStatusUpdates) {
      costTermUpdates.set(update.id, update);
    }
  }
  return {
    runId,
    period,
    lockKey,
    pendingEarnings,
    allocations,
    expenseApplications,
    costTermStatusUpdates: [...costTermUpdates.values()],
    suspenseItems,
    batchId: singleBatchId(pendingEarnings)
  };
}
function toAllocationRunPlanResponse(plan, auditEventId) {
  return {
    runId: plan.runId,
    status: "completed",
    lockKey: plan.lockKey,
    auditEventId,
    allocationCount: plan.allocations.length,
    expenseApplicationCount: plan.expenseApplications.length,
    costTermUpdateCount: plan.costTermStatusUpdates.length,
    suspenseCount: plan.suspenseItems.length,
    allocations: plan.allocations,
    expenseApplications: plan.expenseApplications,
    costTermStatusUpdates: plan.costTermStatusUpdates,
    suspenseItems: plan.suspenseItems
  };
}
function isAllocationSuspense(outcome) {
  return "suspense" in outcome;
}
function toDistributionEarningInput(dataset, earning, runId, period) {
  const periodWindow = periodWindowForMonth(period);
  const track = trackForEarning(dataset, earning);
  return {
    id: earning.id,
    calculationRunId: runId,
    trackId: track?.id ?? null,
    grossAmount: earning.grossAmount,
    currency: earning.currency,
    saleDate: periodWindow.end,
    periodStart: periodWindow.start,
    periodEnd: periodWindow.end,
    today: periodWindow.end
  };
}
function royaltyRulesForEarning(dependencies, earning, period) {
  const track = trackForEarning(dependencies.fixtures.distribution, earning);
  const periodWindow = periodWindowForMonth(period);
  return dependencies.fixtures.distributionRoyaltyRules.filter((rule) => rule.status === "active").filter((rule) => rule.effectiveFrom === null || rule.effectiveFrom <= periodWindow.end).filter((rule) => rule.effectiveTo === null || rule.effectiveTo >= periodWindow.start).filter((rule) => royaltyRuleScopeMatches(rule.scopeType, rule.scopeId, earning, track)).map((rule) => ({
    contractId: rule.contractId,
    royaltyRuleId: rule.royaltyRuleId,
    payeeId: rule.payeeId,
    artistId: rule.artistId,
    role: rule.role,
    percentage: rule.percentage
  }));
}
function royaltyRuleScopeMatches(scopeType, scopeId, earning, track) {
  if (scopeType === null || scopeId === null) {
    return true;
  }
  if (scopeType === "track") {
    return track?.id === scopeId;
  }
  if (scopeType === "isrc") {
    return earning.isrc === scopeId;
  }
  if (scopeType === "upc" || scopeType === "ean") {
    return earning.upc === scopeId;
  }
  return true;
}
function costStateForAllocation(dependencies) {
  return {
    costTerms: dependencies.fixtures.distributionCostTerms,
    expenseApplications: dependencies.fixtures.distributionExpenseApplications,
    fxRates: dependencies.fixtures.distributionFxRates
  };
}
function earningMatchesPeriod(dataset, earning, period) {
  const batch = dataset.importBatches.find((candidate) => candidate.id === earning.batchId);
  if (batch === void 0 || batch.importedAt === null) {
    return false;
  }
  return batch.importedAt.startsWith(period);
}
function trackForEarning(dataset, earning) {
  if (earning.isrc !== null) {
    const isrcMatch = dataset.tracks.find((track) => track.isrc === earning.isrc);
    if (isrcMatch !== void 0) {
      return isrcMatch;
    }
  }
  return null;
}
function singleBatchId(earnings) {
  const batchIds = uniqueStrings(earnings.map((earning) => earning.batchId));
  return batchIds.length === 1 ? batchIds[0] ?? null : null;
}
function periodWindowForMonth(period) {
  const [yearText, monthText] = period.split("-");
  const year2 = Number(yearText);
  const month = Number(monthText);
  const endDay = new Date(Date.UTC(year2, month, 0)).getUTCDate();
  return {
    start: `${period}-01`,
    end: `${period}-${String(endDay).padStart(2, "0")}`
  };
}
function buildStatementGenerateExecutionPlan(dependencies, request, runId) {
  const period = periodWindowForMonth(request.period);
  const allocationInputs = statementAllocationInputs(dependencies.fixtures.distribution, request.payeeIds);
  const payeeIds = request.payeeIds.length === 0 ? uniqueStrings(allocationInputs.map((allocation) => allocation.payeeId)) : request.payeeIds;
  const statementKeys = uniqueStatementKeys(allocationInputs.filter((allocation) => payeeIds.includes(allocation.payeeId)));
  const statementPlans = statementKeys.map((key) => {
    assertNoLiveStatementForKey(dependencies, key.payeeId, period.start, period.end, key.currency);
    const payee = requireDistributionPayee(dependencies.fixtures.distribution, key.payeeId);
    const lastClosing = lastPayeeClosing(dependencies.fixtures.distributionPayeeBalances, key.payeeId, key.currency);
    const statementPlan = buildStatementPlan({ id: payee.id }, period, key.currency, allocationInputs, lastClosing, 1);
    const statementId = randomUUID2();
    return {
      statementId,
      statement: statementPlan.statement,
      lines: statementPlan.lines,
      balanceLedgerRow: {
        ...statementPlan.balanceLedgerRow,
        statementId
      }
    };
  });
  return {
    runId,
    period: request.period,
    lockKey: request.lockKey,
    statementPlans
  };
}
function toStatementGenerateResponse(plan, auditEventId) {
  return {
    runId: plan.runId,
    status: "completed",
    lockKey: plan.lockKey,
    auditEventId,
    statementCount: plan.statementPlans.length,
    lineCount: statementLineCount(plan.statementPlans),
    balanceLedgerRowCount: plan.statementPlans.length,
    statements: plan.statementPlans.map((statementPlan) => ({
      id: statementPlan.statementId,
      payeeId: statementPlan.statement.payeeId,
      period: statementPlan.statement.periodStart.slice(0, 7),
      currency: statementPlan.statement.currency,
      amountDue: statementPlan.statement.amountDue,
      closingBalance: statementPlan.balanceLedgerRow.closingBalance
    }))
  };
}
function statementAllocationInputs(dataset, payeeIds) {
  const payeeFilter = new Set(payeeIds);
  return dataset.earningAllocations.filter((allocation) => allocation.status === "calculated" || allocation.status === "posted").filter((allocation) => payeeFilter.size === 0 || payeeFilter.has(allocation.payeeId)).map((allocation) => {
    const earning = dataset.normalizedEarnings.find((candidate) => candidate.id === allocation.earningId);
    return {
      id: allocation.id,
      payeeId: allocation.payeeId,
      trackId: allocation.trackId,
      currency: allocation.currency,
      grossShare: allocation.grossShare,
      recoupmentApplied: allocation.recoupmentApplied,
      netPayable: allocation.netPayable,
      quantity: earning?.quantity ?? "0.000000"
    };
  });
}
function uniqueStatementKeys(allocations) {
  const keys = /* @__PURE__ */ new Map();
  for (const allocation of allocations) {
    keys.set(`${allocation.payeeId}:${allocation.currency}`, {
      payeeId: allocation.payeeId,
      currency: allocation.currency
    });
  }
  return [...keys.values()].sort((left, right) => `${left.payeeId}:${left.currency}`.localeCompare(`${right.payeeId}:${right.currency}`));
}
function assertNoLiveStatementForKey(dependencies, payeeId, periodStart, periodEnd, currency) {
  const existing = dependencies.fixtures.distribution.statements.find(
    (statement) => statement.payeeId === payeeId && statement.periodStart === periodStart && statement.periodEnd === periodEnd && statement.currency === currency && statement.status !== "void"
  );
  if (existing !== void 0) {
    throw new ApiRouteError(409, "statement_generation_conflict", "A live statement already exists for this payee, period, and currency.", [
      `statementId=${existing.id}`,
      `payeeId=${payeeId}`,
      `periodStart=${periodStart}`,
      `periodEnd=${periodEnd}`,
      `currency=${currency}`
    ]);
  }
}
function requireDistributionPayee(dataset, payeeId) {
  const payee = dataset.payees.find((candidate) => candidate.id === payeeId);
  if (payee === void 0) {
    throw new ApiRouteError(404, "distribution_payee_not_found", "Distribution payee was not found.", [`payeeId=${payeeId}`]);
  }
  return payee;
}
function lastPayeeClosing(rows, payeeId, currency) {
  const latest = [...rows].filter((row) => row.payeeId === payeeId && row.currency === currency).sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
  return latest?.closingBalance ?? "0.0000000000";
}
function statementLineCount(plans) {
  return plans.reduce((sum, plan) => sum + plan.lines.length, 0);
}
function statementLockKey(payeeId, periodStart, currency) {
  return `distribution:statement:${payeeId}:${periodStart.slice(0, 7)}:${currency}`;
}
function previewIdFor(scope, fingerprint) {
  return `preview_${scope}_${hashRequestBody({ fingerprint }).slice(0, 16)}`;
}
function currencyCodesFromRows(rows, fallback) {
  const codes = uniqueStrings(
    rows.map((row) => normalizedCurrency(rowValue(row, ["currency", "currency_code", "Currency", "CURRENCY"]))).filter((currency) => currency !== null)
  );
  return codes.length === 0 ? [fallback] : codes;
}
function normalizedCurrency(value) {
  if (value === null) {
    return null;
  }
  const normalized = value.trim().toUpperCase();
  return /^[A-Z]{3}$/u.test(normalized) ? normalized : null;
}
function joinKeysFromRows(rows) {
  const normalizedKeys = /* @__PURE__ */ new Set();
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      normalizedKeys.add(normalizeColumnKey(key));
    }
  }
  const keys = [];
  if (normalizedKeys.has("isrc")) {
    keys.push("ISRC");
  }
  if (normalizedKeys.has("upc") || normalizedKeys.has("ean")) {
    keys.push("UPC/EAN");
  }
  if (normalizedKeys.has("title")) {
    keys.push("title");
  }
  if (normalizedKeys.has("artist")) {
    keys.push("artist");
  }
  return keys.length === 0 ? ["raw_row"] : keys;
}
function parseOfficeBankPreviewRow(row, workspaceId, accounts) {
  const currency = normalizedCurrency(rowValue(row.rawData, ["currency", "currency_code", "Currency", "CURRENCY"])) ?? "MUR";
  const account = accountForRow(row.rawData, workspaceId, currency, accounts);
  const occurredOn = isoDateValue(row.rawData, ["occurredOn", "occurred_on", "transactionDate", "transaction_date", "date", "DATE", "Date", "paid_on", "paidOn"]);
  const description = rowValue(row.rawData, ["description", "label", "particulars", "details", "narrative", "memo"]);
  const amount = amountForBankRow(row.rawData);
  const issues = [
    ...account === null ? ["account_not_found"] : [],
    ...occurredOn === null ? ["occurred_on_missing"] : [],
    ...description === null ? ["description_missing"] : [],
    ...amount === null ? ["amount_missing_or_invalid"] : [],
    ...amount !== null && amount.currency !== "MUR" && amount.amountMurMinor === null ? ["amount_mur_missing_for_foreign_currency"] : []
  ];
  if (issues.length > 0 || account === null || occurredOn === null || description === null || amount === null || amount.amountMurMinor === null) {
    return {
      row,
      line: null,
      issues
    };
  }
  return {
    row,
    line: {
      id: randomUUID2(),
      accountId: account.id,
      occurredOn,
      valueOn: isoDateValue(row.rawData, ["valueOn", "value_on", "valueDate", "value_date"]),
      description,
      reference: rowValue(row.rawData, ["reference", "ref", "transactionId", "transaction_id", "invoice_ref"]),
      direction: amount.direction,
      amountMinor: amount.amountMinor,
      balanceMinor: moneyValue(row.rawData, ["balance", "balanceMinor", "closingBalance", "closing_balance"]),
      currency: amount.currency,
      amountMurMinor: amount.amountMurMinor,
      balanceMurMinor: moneyValue(row.rawData, ["balanceMur", "balance_mur", "balanceMurMinor", "balance_mur_minor"]),
      isDuplicateCandidate: false,
      rawData: row.rawData
    },
    issues: []
  };
}
function accountForRow(row, workspaceId, currency, accounts) {
  const accountId = rowValue(row, ["accountId", "account_id"]);
  if (accountId !== null) {
    return accounts.find((account) => account.id === accountId && account.workspaceId === workspaceId) ?? null;
  }
  return accounts.find((account) => account.workspaceId === workspaceId && account.currency === currency && account.isActive) ?? null;
}
function amountForBankRow(row) {
  const currency = normalizedCurrency(rowValue(row, ["currency", "currency_code", "Currency", "CURRENCY"])) ?? "MUR";
  const credit = moneyValue(row, ["credit", "Credit", "amountCredit", "amount_credit"]);
  const debit = moneyValue(row, ["debit", "Debit", "amountDebit", "amount_debit"]);
  const amount = moneyValue(row, ["amount", "Amount", "amountMinor", "amount_minor", "amountMicro", "amount_micro", "amount_mur", "AMOUNT MUR"]);
  const signedAmount = signedMoneyValue(row, ["signedAmount", "signed_amount", "net", "Net"]);
  if (credit !== null) {
    return {
      amountMinor: absBigInt(credit),
      amountMurMinor: currency === "MUR" ? absBigInt(credit) : moneyValue(row, ["amountMur", "amount_mur", "amountMurMinor", "amount_mur_minor"]),
      currency,
      direction: "credit"
    };
  }
  if (debit !== null) {
    return {
      amountMinor: absBigInt(debit),
      amountMurMinor: currency === "MUR" ? absBigInt(debit) : moneyValue(row, ["amountMur", "amount_mur", "amountMurMinor", "amount_mur_minor"]),
      currency,
      direction: "debit"
    };
  }
  if (signedAmount !== null) {
    return {
      amountMinor: absBigInt(signedAmount),
      amountMurMinor: currency === "MUR" ? absBigInt(signedAmount) : moneyValue(row, ["amountMur", "amount_mur", "amountMurMinor", "amount_mur_minor"]),
      currency,
      direction: signedAmount < 0n ? "debit" : "credit"
    };
  }
  if (amount === null) {
    return null;
  }
  const direction = directionValue(row) ?? "credit";
  return {
    amountMinor: absBigInt(amount),
    amountMurMinor: currency === "MUR" ? absBigInt(amount) : moneyValue(row, ["amountMur", "amount_mur", "amountMurMinor", "amount_mur_minor"]),
    currency,
    direction
  };
}
function directionValue(row) {
  const value = rowValue(row, ["direction", "type", "debitCredit", "debit_credit"]);
  if (value === null) {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "credit" || normalized === "cr" || normalized === "income") {
    return "credit";
  }
  if (normalized === "debit" || normalized === "dr" || normalized === "expense") {
    return "debit";
  }
  return null;
}
function moneyValue(row, aliases) {
  const value = rowValue(row, aliases);
  if (value === null) {
    return null;
  }
  try {
    return eofMoney.parse(cleanMoneyText(value));
  } catch (_error) {
    return null;
  }
}
function signedMoneyValue(row, aliases) {
  return moneyValue(row, aliases);
}
function cleanMoneyText(value) {
  const trimmed = value.trim().replaceAll(",", "");
  if (trimmed.startsWith("(") && trimmed.endsWith(")")) {
    return `-${trimmed.slice(1, -1)}`;
  }
  return trimmed;
}
function isoDateValue(row, aliases) {
  const value = rowValue(row, aliases);
  if (value === null) {
    return null;
  }
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/u.test(trimmed)) {
    return trimmed;
  }
  const slashMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/u.exec(trimmed);
  if (slashMatch !== null) {
    const rawDay = slashMatch[1];
    const rawMonth = slashMatch[2];
    const rawYear = slashMatch[3];
    if (rawDay === void 0 || rawMonth === void 0 || rawYear === void 0) {
      return null;
    }
    const day2 = rawDay.padStart(2, "0");
    const month = rawMonth.padStart(2, "0");
    return `${rawYear}-${month}-${day2}`;
  }
  return null;
}
function rowValue(row, aliases) {
  const normalizedAliases = new Set(aliases.map((alias) => normalizeColumnKey(alias)));
  for (const [key, value] of Object.entries(row)) {
    if (normalizedAliases.has(normalizeColumnKey(key)) && value.trim().length > 0) {
      return value;
    }
  }
  return null;
}
function normalizeColumnKey(key) {
  return key.trim().toLowerCase().replace(/[^a-z0-9]+/gu, "");
}
function uniqueStrings(values) {
  return [...new Set(values)];
}
function absBigInt(value) {
  return value < 0n ? -value : value;
}
function officeDateRange(dates) {
  if (dates.length === 0) {
    return {
      start: null,
      end: null,
      label: "undetected"
    };
  }
  const sorted = [...dates].sort();
  const start = sorted[0] ?? null;
  const end = sorted[sorted.length - 1] ?? null;
  if (start === null || end === null) {
    return {
      start: null,
      end: null,
      label: "undetected"
    };
  }
  return {
    start,
    end,
    label: start === end ? start : `${start} to ${end}`
  };
}
function requireDistributionPreview(context, dependencies, previewId, workspaceId) {
  const preview = dependencies.persistence.getDistributionImportPreview(previewId);
  if (preview === null) {
    throw new ApiRouteError(400, "import_preview_missing", "Import preview was not found or has expired; run preview again before confirm.", [
      `path=${context.req.path}`,
      `previewId=${previewId}`
    ]);
  }
  if (preview.workspaceId !== workspaceId) {
    throw new ApiRouteError(400, "import_preview_workspace_mismatch", "Import preview belongs to a different workspace.", [
      `path=${context.req.path}`,
      `previewId=${previewId}`,
      `workspaceId=${workspaceId}`,
      `previewWorkspaceId=${preview.workspaceId}`
    ]);
  }
  return preview;
}
function requireOfficeBankPreview(context, dependencies, previewId, workspaceId) {
  const preview = dependencies.persistence.getOfficeBankImportPreview(previewId);
  if (preview === null) {
    throw new ApiRouteError(400, "bank_import_preview_missing", "Bank import preview was not found or has expired; run preview again before confirm.", [
      `path=${context.req.path}`,
      `previewId=${previewId}`
    ]);
  }
  if (preview.workspaceId !== workspaceId) {
    throw new ApiRouteError(400, "bank_import_preview_workspace_mismatch", "Bank import preview belongs to a different workspace.", [
      `path=${context.req.path}`,
      `previewId=${previewId}`,
      `workspaceId=${workspaceId}`,
      `previewWorkspaceId=${preview.workspaceId}`
    ]);
  }
  return preview;
}
function appendDistributionImportFixture(fixtures, batch) {
  const mutableDistribution = fixtures.distribution;
  mutableDistribution.importBatches = [...fixtures.distribution.importBatches, batch];
}
function appendAllocationRunFixture(fixtures, input) {
  const mutableDistribution = fixtures.distribution;
  const createdAt = input.finishedAtIso;
  mutableDistribution.calculationRuns = [
    ...fixtures.distribution.calculationRuns,
    {
      id: input.runId,
      batchId: input.batchId,
      status: "calculated",
      startedAt: input.startedAtIso,
      finishedAt: input.finishedAtIso,
      createdAt
    }
  ];
  mutableDistribution.earningAllocations = [
    ...fixtures.distribution.earningAllocations,
    ...input.allocations.map((allocation) => ({
      id: allocation.id,
      earningId: allocation.earningId,
      calculationRunId: input.runId,
      payeeId: allocation.payeeId,
      contractId: allocation.contractId,
      trackId: allocation.trackId,
      grossAmount: allocation.grossAmount,
      grossShare: allocation.grossShare,
      recoupmentApplied: allocation.recoupmentApplied,
      netPayable: allocation.netPayable,
      splitPercentage: allocation.splitPercentage,
      currency: allocation.currency,
      status: "calculated",
      createdAt
    }))
  ];
  mutableDistribution.suspenseItems = [
    ...fixtures.distribution.suspenseItems,
    ...input.suspenseItems.map((suspense, index) => ({
      id: `suspense_${input.runId}_${String(index + 1)}`,
      earningId: suspense.earningId,
      amount: suspense.amount,
      currency: suspense.currency,
      reasonCode: suspense.reasonCode,
      resolved: false,
      resolvedAt: null,
      createdAt
    }))
  ];
  mutableDistribution.normalizedEarnings = fixtures.distribution.normalizedEarnings.map((earning) => {
    if (!input.allocations.some((allocation) => allocation.earningId === earning.id) && !input.suspenseItems.some((suspense) => suspense.earningId === earning.id)) {
      return earning;
    }
    return {
      ...earning,
      calculationStatus: input.allocations.some((allocation) => allocation.earningId === earning.id) ? "calculated" : "suspense"
    };
  });
  appendDistributionAllocationStateFixture(fixtures, input);
}
function appendStatementGenerateFixture(fixtures, plan, createdAt) {
  const mutableDistribution = fixtures.distribution;
  const mutableFixtures = fixtures;
  mutableDistribution.statements = [
    ...fixtures.distribution.statements,
    ...plan.statementPlans.map((statementPlan) => ({
      id: statementPlan.statementId,
      payeeId: statementPlan.statement.payeeId,
      calculationRunId: null,
      periodStart: statementPlan.statement.periodStart,
      periodEnd: statementPlan.statement.periodEnd,
      currency: statementPlan.statement.currency,
      grossTotal: statementPlan.statement.grossTotal,
      recoupmentTotal: statementPlan.statement.recoupmentTotal,
      netPayable: statementPlan.statement.netPayable,
      amountDue: statementPlan.statement.amountDue,
      version: statementPlan.statement.version,
      status: statementPlan.statement.status,
      createdAt
    }))
  ];
  mutableDistribution.statementLines = [
    ...fixtures.distribution.statementLines,
    ...plan.statementPlans.flatMap(
      (statementPlan) => statementPlan.lines.map((line, index) => ({
        id: `statement_line_${statementPlan.statementId}_${String(index + 1)}`,
        statementId: statementPlan.statementId,
        earningAllocationId: line.earningAllocationId,
        trackId: line.trackId,
        grossShare: line.grossShare,
        recoupmentApplied: line.recoupmentApplied,
        netPayable: line.netPayable,
        quantity: line.quantity,
        currency: line.currency
      }))
    )
  ];
  mutableFixtures.distributionPayeeBalances = [
    ...fixtures.distributionPayeeBalances,
    ...plan.statementPlans.map((statementPlan) => ({
      id: `balance_${statementPlan.statementId}`,
      payeeId: statementPlan.balanceLedgerRow.payeeId,
      statementId: statementPlan.statementId,
      currency: statementPlan.balanceLedgerRow.currency,
      openingBalance: statementPlan.balanceLedgerRow.openingBalance,
      periodNet: statementPlan.balanceLedgerRow.periodNet,
      closingBalance: statementPlan.balanceLedgerRow.closingBalance,
      movementType: statementPlan.balanceLedgerRow.movementType,
      createdAt
    }))
  ];
}
function appendStatementVoidFixture(fixtures, input, createdAt) {
  const mutableDistribution = fixtures.distribution;
  const mutableFixtures = fixtures;
  mutableDistribution.statements = fixtures.distribution.statements.map(
    (statement) => statement.id === input.statementId ? { ...statement, status: input.status } : statement
  );
  mutableFixtures.distributionPayeeBalances = [
    ...fixtures.distributionPayeeBalances,
    {
      id: `balance_void_${input.statementId}_${String(fixtures.distributionPayeeBalances.length + 1)}`,
      payeeId: input.reversalLedgerRow.payeeId,
      statementId: input.statementId,
      currency: input.reversalLedgerRow.currency,
      openingBalance: input.reversalLedgerRow.openingBalance,
      periodNet: input.reversalLedgerRow.periodNet,
      closingBalance: input.reversalLedgerRow.closingBalance,
      movementType: input.reversalLedgerRow.movementType,
      createdAt
    }
  ];
}
function paymentRecordFixturePatch(input) {
  return {
    payment: {
      id: input.paymentId,
      payeeId: input.payeeId,
      amount: input.amount,
      currency: input.currency,
      status: "recorded",
      paidAt: input.paidAt,
      reference: input.reference
    },
    link: {
      id: input.statementPaymentLinkId,
      statementId: input.statementId,
      paymentId: input.paymentId,
      amountApplied: input.amount
    }
  };
}
function paymentUpdateFixturePatch(payment, link, input) {
  return {
    payment: {
      ...payment,
      amount: input.amount,
      currency: input.currency,
      status: "edited",
      reference: input.reference
    },
    link: {
      ...link,
      amountApplied: input.amount
    }
  };
}
function paymentReconcileFixturePatch(payment, link, input) {
  return {
    payment: {
      ...payment,
      status: "reconciled"
    },
    link: {
      ...link,
      id: input.statementPaymentLinkId,
      statementId: input.statementId,
      amountApplied: input.amountApplied
    }
  };
}
function applyDistributionPaymentPatchFixture(fixtures, patch) {
  const mutableDistribution = fixtures.distribution;
  mutableDistribution.payments = upsertPayment(fixtures.distribution.payments, patch.payment);
  mutableDistribution.statementPaymentLinks = upsertStatementPaymentLink(fixtures.distribution.statementPaymentLinks, patch.link);
}
function distributionDatasetWithPaymentPatch(dataset, patch) {
  return {
    ...dataset,
    payments: upsertPayment(dataset.payments, patch.payment),
    statementPaymentLinks: upsertStatementPaymentLink(dataset.statementPaymentLinks, patch.link)
  };
}
function upsertPayment(payments, payment) {
  const existing = payments.some((candidate) => candidate.id === payment.id);
  if (!existing) {
    return [...payments, payment];
  }
  return payments.map((candidate) => candidate.id === payment.id ? payment : candidate);
}
function upsertStatementPaymentLink(links, link) {
  const existing = links.some((candidate) => candidate.statementId === link.statementId && candidate.paymentId === link.paymentId);
  if (!existing) {
    return [...links, link];
  }
  return links.map((candidate) => candidate.statementId === link.statementId && candidate.paymentId === link.paymentId ? link : candidate);
}
function computePaymentBalances(dataset, statementId) {
  const statement = requireDistributionStatement(dataset, statementId);
  const paymentLinks = statementPaymentBalanceInputs(dataset);
  const statements = dataset.statements.map((row) => ({
    id: row.id,
    currency: row.currency,
    amountDue: row.amountDue
  }));
  return {
    statementBalance: computeStatementBalance(
      {
        id: statement.id,
        currency: statement.currency,
        amountDue: statement.amountDue
      },
      paymentLinks
    ),
    groupTotals: computeStatementGroupTotals(statements, paymentLinks)
  };
}
function statementPaymentBalanceInputs(dataset) {
  const paymentsById = new Map(
    dataset.payments.map((payment) => [payment.id, payment])
  );
  return dataset.statementPaymentLinks.map((link) => {
    const payment = paymentsById.get(link.paymentId);
    if (payment === void 0) {
      throw new ApiRouteError(500, "distribution_payment_missing", "Statement payment link references a missing payment.", [
        `paymentId=${link.paymentId}`,
        `statementId=${link.statementId}`
      ]);
    }
    return {
      statementId: link.statementId,
      amountApplied: payment.status === "void" ? "0.0000000000" : link.amountApplied,
      currency: payment.currency
    };
  });
}
function paymentMutationResponse(paymentId, statementId, amount, currency, paymentStatus, balances, auditEventId) {
  return {
    id: paymentId,
    status: "completed",
    auditEventId,
    paymentId,
    statementId,
    amountMicro: amount,
    currency,
    paymentStatus,
    statementBalance: balances.statementBalance,
    groupTotals: balances.groupTotals
  };
}
function persistedRoyaltyRulesFromRequest(contractId, rules) {
  return rules.map((rule, index) => ({
    id: randomUUID2(),
    contractId,
    payeeId: rule.payeeId,
    percentage: normalizeScaleDecimal(rule.percentage, 6),
    scopeType: rule.scopeType,
    scopeId: rule.scopeId,
    priority: rules.length - index,
    effectiveFrom: rule.effectiveFrom,
    effectiveTo: rule.effectiveTo,
    status: "active"
  }));
}
function assertRoyaltySplitTotalsOneHundred(context, rules) {
  const totalUnits = rules.reduce((sum, rule) => sum + parse(rule.percentage, 6, "TRUNCATE"), 0n);
  const expectedUnits = 100000000n;
  if (totalUnits !== expectedUnits) {
    throw new ApiRouteError(422, "royalty_split_total_invalid", "Royalty split must equal exactly 100.000000.", [
      `path=${context.req.path}`,
      `expected=100.000000`,
      `actual=${format(totalUnits, 6)}`
    ]);
  }
  return format(totalUnits, 6);
}
function apiRoyaltyRulesFromPersistedRules(rules) {
  return rules.map((rule) => ({
    contractId: rule.contractId,
    royaltyRuleId: rule.id,
    payeeId: rule.payeeId,
    artistId: rule.scopeType === "artist" && rule.scopeId !== null ? rule.scopeId : rule.payeeId,
    role: rule.scopeType ?? "artist",
    percentage: rule.percentage,
    scopeType: rule.scopeType,
    scopeId: rule.scopeId,
    effectiveFrom: rule.effectiveFrom,
    effectiveTo: rule.effectiveTo,
    status: rule.status
  }));
}
function applyDistributionRoyaltyRulesFixture(fixtures, contractId, rules) {
  const mutableFixtures = fixtures;
  mutableFixtures.distributionRoyaltyRules = [
    ...fixtures.distributionRoyaltyRules.filter((rule) => rule.contractId !== contractId),
    ...rules
  ];
}
function fxRatesFromRequest(rates) {
  return rates.map((rate) => ({
    fromCurrency: rate.fromCurrency,
    toCurrency: rate.toCurrency,
    effectiveDate: rate.effectiveDate,
    rate: normalizeScaleDecimal(rate.rate, 10)
  }));
}
function normalizeScaleDecimal(value, scale) {
  return format(parse(value, scale, "TRUNCATE"), scale);
}
function distributionFxRateMatches(existingRates, newRates) {
  return existingRates.filter(
    (existing) => newRates.some(
      (rate) => existing.fromCurrency === rate.fromCurrency && existing.toCurrency === rate.toCurrency && existing.effectiveDate === rate.effectiveDate
    )
  );
}
function applyDistributionFxRatesFixture(fixtures, rates) {
  const mutableFixtures = fixtures;
  mutableFixtures.distributionFxRates = rates.reduce(
    (current, rate) => upsertDistributionFxRate(current, rate),
    fixtures.distributionFxRates
  );
}
function upsertDistributionFxRate(rates, rate) {
  const existing = rates.some(
    (candidate) => candidate.fromCurrency === rate.fromCurrency && candidate.toCurrency === rate.toCurrency && candidate.effectiveDate === rate.effectiveDate
  );
  if (!existing) {
    return [...rates, rate];
  }
  return rates.map(
    (candidate) => candidate.fromCurrency === rate.fromCurrency && candidate.toCurrency === rate.toCurrency && candidate.effectiveDate === rate.effectiveDate ? rate : candidate
  );
}
function fxRatesAuditTargetId(rates) {
  return rates.map((rate) => `${rate.fromCurrency}-${rate.toCurrency}-${rate.effectiveDate}`).sort().join(",");
}
function identityOfficeLink(partner, payee, confidence) {
  return {
    partnerId: partner.id,
    partnerName: partner.name,
    payeeId: payee.id,
    payeeName: payee.name,
    resolution: "stored_link",
    status: payee.isActive ? "active" : "inactive",
    source: "identity_link",
    confidence
  };
}
function applyIdentityLinkFixture(fixtures, link) {
  const mutableFixtures = fixtures;
  const retained = Object.fromEntries(
    Object.entries(fixtures.officePartnerPayeeLinks).filter(
      ([partnerId, candidate]) => partnerId !== link.partnerId && candidate.payeeId !== link.payeeId
    )
  );
  mutableFixtures.officePartnerPayeeLinks = {
    ...retained,
    [link.partnerId]: link
  };
}
function toDistributionPayeePartnerLink(fixtures, payee) {
  const link = Object.values(fixtures.officePartnerPayeeLinks).find((candidate) => candidate.payeeId === payee.id && candidate.status === "active");
  return {
    payeeId: payee.id,
    payeeName: payee.name,
    officePartnerId: link?.partnerId ?? null,
    officePartnerName: link?.partnerName ?? null,
    linked: link !== void 0,
    confidence: link?.confidence ?? null,
    status: link?.status ?? null
  };
}
function identityLinkTargetId(officePartnerId, payeeId) {
  return `${officePartnerId}:${payeeId}`;
}
function requireDistributionContract(dependencies, contractId) {
  const contract = dependencies.fixtures.distributionContracts.find((candidate) => candidate.id === contractId);
  if (contract === void 0) {
    throw new ApiRouteError(404, "distribution_contract_not_found", "Distribution contract was not found.", [`contractId=${contractId}`]);
  }
  return contract;
}
function requireDistributionStatement(dataset, statementId) {
  const statement = dataset.statements.find((candidate) => candidate.id === statementId);
  if (statement === void 0) {
    throw new ApiRouteError(404, "distribution_statement_not_found", "Distribution statement was not found.", [`statementId=${statementId}`]);
  }
  return statement;
}
function requireDistributionPayment(dataset, paymentId) {
  const payment = dataset.payments.find((candidate) => candidate.id === paymentId);
  if (payment === void 0) {
    throw new ApiRouteError(404, "distribution_payment_not_found", "Distribution payment was not found.", [`paymentId=${paymentId}`]);
  }
  return payment;
}
function requireDistributionPaymentLink(dataset, paymentId) {
  const link = dataset.statementPaymentLinks.find((candidate) => candidate.paymentId === paymentId);
  if (link === void 0) {
    throw new ApiRouteError(404, "distribution_payment_link_not_found", "Distribution payment is not linked to a statement.", [`paymentId=${paymentId}`]);
  }
  return link;
}
function assertPaymentMatchesStatement(context, payeeId, currency, statement) {
  if (statement.payeeId !== payeeId) {
    throw new ApiRouteError(409, "distribution_payment_payee_mismatch", "Payment payee does not match the statement payee.", [
      `path=${context.req.path}`,
      `paymentPayeeId=${payeeId}`,
      `statementPayeeId=${statement.payeeId}`,
      `statementId=${statement.id}`
    ]);
  }
  if (statement.currency !== currency) {
    throw new ApiRouteError(409, "distribution_payment_currency_mismatch", "Payment currency does not match the statement currency.", [
      `path=${context.req.path}`,
      `paymentCurrency=${currency}`,
      `statementCurrency=${statement.currency}`,
      `statementId=${statement.id}`
    ]);
  }
}
function assertPaymentIsMutable(context, payment) {
  if (payment.status === "void") {
    throw new ApiRouteError(409, "distribution_payment_void", "Void payments cannot be updated or reconciled.", [
      `path=${context.req.path}`,
      `paymentId=${payment.id}`
    ]);
  }
}
function requireStatementForVoid(dependencies, statementId) {
  const statement = dependencies.fixtures.distribution.statements.find((candidate) => candidate.id === statementId);
  if (statement === void 0) {
    throw new ApiRouteError(404, "distribution_statement_not_found", "Distribution statement was not found.", [`statementId=${statementId}`]);
  }
  if (statement.status === "void") {
    throw new ApiRouteError(409, "distribution_statement_already_void", "Distribution statement is already void.", [`statementId=${statementId}`]);
  }
  return statement;
}
function requireStatementLedgerRow(dependencies, statementId) {
  const ledgerRow = [...dependencies.fixtures.distributionPayeeBalances].filter((row) => row.statementId === statementId && row.movementType === "statement").sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
  if (ledgerRow === void 0) {
    throw new ApiRouteError(404, "distribution_statement_ledger_not_found", "Distribution statement ledger row was not found.", [`statementId=${statementId}`]);
  }
  return ledgerRow;
}
function appendDistributionAllocationStateFixture(fixtures, input) {
  const mutableFixtures = fixtures;
  mutableFixtures.distributionExpenseApplications = [
    ...fixtures.distributionExpenseApplications,
    ...input.expenseApplications.map((application) => ({
      costTermId: application.costTermId,
      amountApplied: application.amountApplied,
      currency: application.currency
    }))
  ];
  mutableFixtures.distributionCostTerms = fixtures.distributionCostTerms.map((term) => {
    const update = input.costTermStatusUpdates.find((candidate) => candidate.id === term.id);
    return update === void 0 ? term : { ...term, status: update.status };
  });
}
function markDistributionImportFixtureVoid(fixtures, batchId) {
  const mutableDistribution = fixtures.distribution;
  mutableDistribution.importBatches = fixtures.distribution.importBatches.map((batch) => batch.id === batchId ? { ...batch, status: "void" } : batch);
}
function appendOfficeBankImportFixture(fixtures, patch) {
  const mutableOffice = fixtures.office;
  mutableOffice.bankImportBatches = [
    ...fixtures.office.bankImportBatches,
    {
      id: patch.batchId,
      workspaceId: patch.workspaceId,
      source: patch.source,
      fileName: patch.fileName,
      checksum: patch.checksum,
      accountId: patch.accountId,
      periodStart: patch.periodStart,
      periodEnd: patch.periodEnd,
      openingBalanceMinor: null,
      closingBalanceMinor: null,
      currency: patch.currency,
      acceptedRowCount: patch.acceptedRowCount,
      rejectedRowCount: patch.rejectedRowCount,
      duplicateRowCount: patch.duplicateRowCount,
      idempotencyFingerprint: patch.idempotencyFingerprint,
      status: patch.status,
      importedAt: patch.importedAt,
      metadata: patch.metadata
    }
  ];
  mutableOffice.bankStatementLines = [
    ...fixtures.office.bankStatementLines,
    ...patch.lines.map((line) => ({
      id: line.id,
      importBatchId: patch.batchId,
      accountId: line.accountId,
      occurredOn: line.occurredOn,
      valueOn: line.valueOn,
      description: line.description,
      reference: line.reference,
      direction: line.direction,
      amountMinor: line.amountMinor,
      balanceMinor: line.balanceMinor,
      currency: line.currency,
      amountMurMinor: line.amountMurMinor,
      balanceMurMinor: line.balanceMurMinor,
      isDuplicateCandidate: line.isDuplicateCandidate,
      reconciliationStatus: "unmatched",
      matchedTransactionId: null,
      rawData: line.rawData
    }))
  ];
}
function markOfficeBankImportFixtureVoid(fixtures, batchId) {
  const mutableOffice = fixtures.office;
  mutableOffice.bankImportBatches = fixtures.office.bankImportBatches.map((batch) => batch.id === batchId ? { ...batch, status: "void" } : batch);
}
function appendOfficeAuditFixture(fixtures, patch) {
  const mutableFixtures = fixtures;
  mutableFixtures.officeAuditLog = [
    {
      id: patch.id,
      occurredAt: patch.occurredAt,
      actorId: patch.actorId,
      action: patch.action,
      entityType: patch.entityType,
      entityId: patch.entityId,
      entityReference: auditEntityReference(fixtures, patch.entityType, patch.entityId),
      idempotencyKey: null,
      context: {}
    },
    ...fixtures.officeAuditLog
  ];
}
function auditEntityReference(fixtures, entityType, entityId) {
  if (entityType === "office_bank_import_batch") {
    return fixtures.office.bankImportBatches.find((batch) => batch.id === entityId)?.fileName ?? entityId;
  }
  if (entityType === "office_transaction") {
    return fixtures.office.transactions.find((transaction) => transaction.id === entityId)?.description ?? entityId;
  }
  if (entityType === "office_partner") {
    return fixtures.office.partners.find((partner) => partner.id === entityId)?.name ?? entityId;
  }
  if (entityType === "distribution_statement") {
    const statement = fixtures.distribution.statements.find((candidate) => candidate.id === entityId);
    if (statement !== void 0) {
      const payee = fixtures.distribution.payees.find((candidate) => candidate.id === statement.payeeId);
      return `${payee?.name ?? statement.payeeId} \xB7 ${statement.periodStart} \u2192 ${statement.periodEnd}`;
    }
  }
  if (entityType === "distribution_payment") {
    return fixtures.distribution.payments.find((payment) => payment.id === entityId)?.reference ?? entityId;
  }
  return entityId;
}
async function readOptionalJsonBody(context) {
  const text = await readRequestText(context);
  if (text.trim().length === 0) {
    return {};
  }
  try {
    const parsed = JSON.parse(text);
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      return parsed;
    }
  } catch (error) {
    throw new ApiRouteError(400, "json_body_invalid", "Request body must be valid JSON.", [
      `path=${context.req.path}`,
      `error=${error instanceof Error ? error.message : "unknown"}`
    ]);
  }
  throw new ApiRouteError(400, "json_body_invalid", "Request body must be a JSON object.", [`path=${context.req.path}`]);
}
async function readRequestText(context) {
  try {
    return await context.req.text();
  } catch (error) {
    throw new ApiRouteError(400, "body_read_failed", "Request body could not be read.", [
      `path=${context.req.path}`,
      `error=${error instanceof Error ? error.message : "unknown"}`
    ]);
  }
}
function pageItems(context, items) {
  const page = pageWindow(context);
  const pageItems2 = items.slice(page.offset, page.offset + page.limit);
  const nextOffset = page.offset + pageItems2.length;
  const nextCursor = nextOffset < items.length ? String(nextOffset) : null;
  return {
    items: pageItems2,
    nextCursor
  };
}
function pageWindow(context) {
  const cursorText = optionalCompatQuery(context, ["cursor", "offset", "page"]);
  const limitText = optionalCompatQuery(context, ["limit", "size", "pageSize"]);
  const parsedOffset = cursorText === null ? 0 : parsePositiveInteger(cursorText, "cursor");
  const parsedLimit = limitText === null ? 50 : parsePositiveInteger(limitText, "limit");
  const limit = parsedLimit > 100 ? 100 : parsedLimit;
  return {
    cursor: cursorText,
    offset: parsedOffset,
    limit
  };
}
function parsePositiveInteger(value, label) {
  if (!/^[0-9]+$/.test(value)) {
    throw new ApiRouteError(400, "query_integer_invalid", "Pagination query parameters must be non-negative integers.", [
      `${label}=${value}`
    ]);
  }
  const parsed = parseInt(value, 10);
  if (!Number.isSafeInteger(parsed)) {
    throw new ApiRouteError(400, "query_integer_invalid", "Pagination query parameter is outside the safe integer range.", [
      `${label}=${value}`
    ]);
  }
  return parsed;
}
function toApiDivisionPnl(row) {
  return {
    id: row.division_id,
    label: `${row.department_name} \xB7 ${row.division_name}`,
    incomeMicro: row.income,
    expenseMicro: row.expense,
    netMicro: row.profit
  };
}
function toOfficeVatReport(_dataset, period) {
  const zeroMicro = eofMoney.format(0n);
  return {
    period,
    hasVatSource: false,
    outputVatMicro: zeroMicro,
    inputVatMicro: zeroMicro,
    netVatMicro: zeroMicro,
    rows: []
  };
}
function buildBatchWorkspaceLookup(batches) {
  const lookup = /* @__PURE__ */ new Map();
  for (const batch of batches) {
    lookup.set(batch.id, batch.workspaceId);
  }
  return lookup;
}
function toApiBankAccountSummary(account) {
  return {
    id: account.id,
    workspaceId: account.workspaceId,
    bankName: account.bankName,
    accountLabel: account.accountLabel,
    currency: account.currency,
    currentBalanceMicro: eofMoney.format(account.currentBalanceMinor),
    currentBalanceMurMicro: account.currentBalanceMurMinor === null ? null : eofMoney.format(account.currentBalanceMurMinor),
    isActive: account.isActive,
    balanceAsOf: account.balanceAsOf
  };
}
function toApiBankRawLine(line, batchWorkspaceLookup) {
  return {
    id: line.id,
    workspaceId: batchWorkspaceLookup.get(line.importBatchId) ?? "unknown-workspace",
    importBatchId: line.importBatchId,
    accountId: line.accountId,
    occurredOn: line.occurredOn,
    transactionDate: line.occurredOn,
    description: line.description,
    direction: line.direction,
    reference: line.reference ?? "",
    amountMicro: eofMoney.format(line.amountMinor),
    amountMurMicro: eofMoney.format(line.amountMurMinor),
    currency: line.currency,
    isDuplicateCandidate: line.isDuplicateCandidate,
    status: line.reconciliationStatus,
    reconciliationStatus: line.reconciliationStatus,
    matchedTransactionId: line.matchedTransactionId
  };
}
function toAllocationStatusFilter(status) {
  if (status === null) {
    return null;
  }
  if (status === "preview" || status === "calculated" || status === "statemented" || status === "posted" || status === "void" || status === "error") {
    return status;
  }
  throw new ApiRouteError(400, "query_value_invalid", "Allocation status is invalid.", [
    `status=${status}`
  ]);
}
function filtersForPeriod(period, departmentId) {
  return {
    dateFrom: `${period}-01`,
    dateTo: `${period}-31`,
    departmentId
  };
}
function toOfficeGlobalPnl(dataset, period) {
  const filters = filtersForPeriod(period, null);
  const pnl = readGlobalPnl(dataset, filters);
  return {
    scope: "global",
    completeness: "complete",
    period,
    incomeMicro: pnl.income,
    expenseMicro: pnl.expense,
    netMicro: pnl.profit,
    validatedProjectionId: `projection_global_${period}`,
    projectionRows: toProjectionRows(readPnlByDepartment(dataset, filters), period),
    lines: readPnlByCategory(dataset, filters).map((row) => ({
      id: row.category_id,
      label: `${row.department_name} \xB7 ${row.division_name} \xB7 ${row.category_name}`,
      incomeMicro: row.income,
      expenseMicro: row.expense,
      netMicro: row.profit
    }))
  };
}
function toOfficeDepartmentPnl(dataset, departmentId, period) {
  const filters = filtersForPeriod(period, departmentId);
  const pnl = readDepartmentPnl(dataset, departmentId, filters);
  const categoryRows = readPnlByCategory(dataset, filters).filter((row) => row.department_id === departmentId);
  return {
    scope: "department",
    completeness: "complete",
    departmentId,
    departmentLabel: pnl.department.name,
    period,
    incomeMicro: pnl.income,
    expenseMicro: pnl.expense,
    netMicro: pnl.profit,
    validatedProjectionId: `projection_department_${departmentId}_${period}`,
    projectionRows: toProjectionRows(
      [
        {
          department_id: departmentId,
          department_name: pnl.department.name,
          department_type: pnl.department.type,
          income: pnl.income,
          expense: pnl.expense,
          profit: pnl.profit,
          tx_count: pnl.tx_count
        }
      ],
      period
    ),
    lines: categoryRows.map((row) => ({
      id: row.category_id,
      label: `${row.division_name} \xB7 ${row.category_name}`,
      incomeMicro: row.income,
      expenseMicro: row.expense,
      netMicro: row.profit
    }))
  };
}
function toProjectionRows(rows, period) {
  const maxUnits = maxAbsoluteOfficeUnits(rows.flatMap((row) => [row.income, row.expense, row.profit]));
  return rows.map((row) => ({
    id: `projection_${period}_${row.department_id}`,
    departmentId: row.department_id,
    departmentLabel: row.department_name,
    revenueMicro: row.income,
    expenseMicro: row.expense,
    netMicro: row.profit,
    revenueBarLevel: toBarLevel(eofMoney.parse(row.income), maxUnits),
    expenseBarLevel: toBarLevel(eofMoney.parse(row.expense), maxUnits),
    netBarLevel: toBarLevel(eofMoney.parse(row.profit), maxUnits),
    netTone: eofMoney.parse(row.profit) >= 0n ? "positive" : "negative",
    validatedProjectionId: `projection_${period}_${row.department_id}`,
    validatedAt: `${period}-28T18:00:00.000Z`
  }));
}
function maxAbsoluteOfficeUnits(values) {
  let maxUnits = 0n;
  for (const value of values) {
    const units = abs(eofMoney.parse(value));
    if (units > maxUnits) {
      maxUnits = units;
    }
  }
  return maxUnits;
}
function toBarLevel(value, maxUnits) {
  if (maxUnits === 0n) {
    return 0;
  }
  return parseInt((abs(value) * 100n / maxUnits).toString(), 10);
}
function abs(value) {
  return value < 0n ? -value : value;
}
function toOfficeTransaction(dataset, transaction) {
  const status = transaction.status === "draft" && transaction.categoryId === null ? "pending" : toApiTransactionStatus(transaction.status);
  const categoryPath = transaction.categoryId === null ? null : resolveCategoryPath(dataset, transaction.categoryId);
  const base = {
    id: transaction.id,
    occurredOn: transaction.transactionDate.slice(0, 10),
    accountId: "bank_mur",
    projectId: transaction.projectId,
    projectLabel: transaction.projectId === null ? null : requireProject2(dataset, transaction.projectId).name,
    description: transaction.description ?? "",
    amountMicro: eofMoney.format(transaction.amountMinor),
    currency: transaction.originalCurrency ?? "MUR",
    sourceAuditEventId: null
  };
  if (status === "pending" || status === "draft") {
    return {
      ...base,
      status,
      departmentId: categoryPath?.department?.id ?? null,
      departmentLabel: categoryPath?.department?.name ?? null,
      divisionId: categoryPath?.division?.id ?? null,
      divisionLabel: categoryPath?.division?.name ?? null,
      categoryId: categoryPath?.category.id ?? null,
      categoryLabel: categoryPath?.category.name ?? null,
      type: categoryPath?.category.type ?? null
    };
  }
  if (categoryPath === null) {
    throw new ApiRouteError(500, "canonical_category_missing", "Validated transactions must carry a category.", [
      `transactionId=${transaction.id}`
    ]);
  }
  return {
    ...base,
    status,
    departmentId: categoryPath.department?.id ?? null,
    departmentLabel: categoryPath.department?.name ?? null,
    divisionId: categoryPath.division?.id ?? null,
    divisionLabel: categoryPath.division?.name ?? null,
    categoryId: categoryPath.category.id,
    categoryLabel: categoryPath.category.name,
    type: categoryPath.category.type
  };
}
function toApiTransactionStatus(status) {
  if (status === "validated") {
    return "posted";
  }
  if (status === "cancelled") {
    return "voided";
  }
  return status;
}
function resolveCategoryPath(dataset, categoryId) {
  const category = dataset.categories.find((candidate) => candidate.id === categoryId);
  if (category === void 0) {
    throw new ApiRouteError(500, "category_not_found", "Transaction category was not found in the chart of accounts.", [
      `categoryId=${categoryId}`
    ]);
  }
  if (category.divisionId === null) {
    return { category, division: null, department: null };
  }
  const division = dataset.divisions.find((candidate) => candidate.id === category.divisionId);
  if (division === void 0) {
    throw new ApiRouteError(500, "division_not_found", "Category division was not found in the chart of accounts.", [
      `categoryId=${categoryId}`,
      `divisionId=${category.divisionId}`
    ]);
  }
  const department = dataset.departments.find((candidate) => candidate.id === division.departmentId);
  if (department === void 0) {
    throw new ApiRouteError(500, "department_not_found", "Division department was not found in the chart of accounts.", [
      `divisionId=${division.id}`,
      `departmentId=${division.departmentId}`
    ]);
  }
  return { category, division, department };
}
function matchesOfficeTransactionQuery(context, transaction) {
  const period = nullableQuery(context, "period");
  const departmentId = nullableQuery(context, "departmentId");
  const divisionId = nullableQuery(context, "divisionId");
  const categoryId = nullableQuery(context, "categoryId");
  const projectId = nullableQuery(context, "projectId");
  const type = nullableQuery(context, "type");
  const status = nullableQuery(context, "status");
  if (period !== null && !transaction.occurredOn.startsWith(period)) {
    return false;
  }
  if (departmentId !== null && transaction.departmentId !== departmentId) {
    return false;
  }
  if (divisionId !== null && transaction.divisionId !== divisionId) {
    return false;
  }
  if (categoryId !== null && transaction.categoryId !== categoryId) {
    return false;
  }
  if (projectId !== null && transaction.projectId !== projectId) {
    return false;
  }
  if (type !== null && transaction.type !== type) {
    return false;
  }
  return !(status !== null && transaction.status !== status);
}
function toPlanComptableNodes(dataset, includeInactive) {
  const departments = dataset.departments.filter((department) => includeInactive || department.isActive).map((department) => ({
    kind: "department",
    id: department.id,
    code: department.id,
    label: department.name,
    active: department.isActive,
    parentId: null
  }));
  const divisions = dataset.divisions.filter((division) => includeInactive || division.isActive).map((division) => ({
    kind: "division",
    id: division.id,
    code: division.id,
    label: division.name,
    active: division.isActive,
    parentId: division.departmentId,
    departmentId: division.departmentId,
    departmentLabel: requireDepartment2(dataset, division.departmentId).name
  }));
  const categories = dataset.categories.filter((category) => includeInactive || category.isActive).flatMap((category) => {
    const path = resolveCategoryPath(dataset, category.id);
    if (path.division === null || path.department === null) {
      return [];
    }
    return {
      kind: "category",
      id: category.id,
      code: category.id,
      label: category.name,
      active: category.isActive,
      parentId: path.division.id,
      departmentId: path.department.id,
      departmentLabel: path.department.name,
      divisionId: path.division.id,
      divisionLabel: path.division.name,
      type: category.type
    };
  });
  return [...departments, ...divisions, ...categories];
}
function toReconciliationCandidates(dataset) {
  return dataset.bankStatementLines.map((line) => {
    const match2 = dataset.bankReconciliationMatches.find((candidate) => candidate.bankStatementLineId === line.id);
    const transactionId = line.matchedTransactionId ?? match2?.transactionId ?? "tx_uncategorized";
    const transaction = dataset.transactions.find((candidate) => candidate.id === transactionId);
    return {
      id: match2?.id ?? `recon_${line.id}`,
      transactionId,
      statementLineId: line.id,
      occurredOn: line.occurredOn,
      bankDescription: line.reference ?? line.id,
      ledgerDescription: transaction?.description ?? "Unmatched ledger line",
      amountMicro: eofMoney.format(line.amountMurMinor),
      confidenceBp: match2?.confidenceBp ?? (line.reconciliationStatus === "matched" ? 1e4 : 0),
      status: toApiReconciliationStatus(line)
    };
  });
}
function toApiReconciliationStatus(line) {
  if (line.reconciliationStatus === "matched") {
    return "matched";
  }
  if (line.reconciliationStatus === "suggested") {
    return "suggested";
  }
  return "unmatched";
}
function matchesReconciliationQuery(context, candidate) {
  const period = nullableQuery(context, "period");
  const status = nullableQuery(context, "status");
  if (period !== null && !candidate.occurredOn.startsWith(period)) {
    return false;
  }
  return !(status !== null && candidate.status !== status);
}
function toCashflowBuckets(rows) {
  const maxUnits = maxAbsoluteOfficeUnits(rows.flatMap((row) => [row.inflowMur, row.outflowMur]));
  return rows.map((row) => ({
    period: row.period,
    inflowMicro: row.inflowMur,
    outflowMicro: row.outflowMur,
    closingMicro: row.closingMur,
    inflowLevel: toBarLevel(eofMoney.parse(row.inflowMur), maxUnits),
    outflowLevel: toBarLevel(eofMoney.parse(row.outflowMur), maxUnits)
  }));
}
function matchesAuditQuery(context, entry) {
  const entityType = nullableQuery(context, "entityType");
  const actorId = nullableQuery(context, "actorId");
  const from = nullableQuery(context, "from");
  const to = nullableQuery(context, "to");
  if (entityType !== null && entry.entityType !== entityType) {
    return false;
  }
  if (actorId !== null && entry.actorId !== actorId) {
    return false;
  }
  if (from !== null && entry.occurredAt.slice(0, 10) < from) {
    return false;
  }
  return !(to !== null && entry.occurredAt.slice(0, 10) > to);
}
function requirePartnerFacet(context) {
  const facet = requireQuery(context, "facet");
  if (facet !== "client" && facet !== "supplier") {
    throw new ApiRouteError(400, "partner_facet_invalid", "Partner facet must be client or supplier.", [`facet=${facet}`]);
  }
  return facet;
}
function toPartnerListItem(fixtures, partner, period) {
  return {
    id: partner.id,
    name: partner.name,
    status: partner.isActive ? "active" : "inactive",
    activity: toPartnerActivity(fixtures.office, partner.id, period),
    distributionPayeeLink: toPartnerPayeeLink(fixtures, partner)
  };
}
function toPartnerDetail(fixtures, partner, period) {
  readPartnerPnl(fixtures.office, partner.id, filtersForPeriod(period, null));
  return {
    ...toPartnerListItem(fixtures, partner, period),
    completeness: "partial",
    period,
    email: null,
    phone: null,
    address: null,
    taxId: null,
    notes: null,
    classificationSuggestions: fixtures.officeClassificationSuggestions[partner.id] ?? []
  };
}
function toPartnerPayeeLink(fixtures, partner) {
  return fixtures.officePartnerPayeeLinks[partner.id] ?? {
    partnerId: partner.id,
    partnerName: partner.name,
    payeeId: null,
    payeeName: null,
    resolution: "unmatched",
    status: null,
    source: "fixture",
    confidence: null
  };
}
function hasFacetActivity(partner, facet) {
  const side = facet === "client" ? partner.activity.income : partner.activity.expense;
  return eofMoney.parse(side.periodTotalMicro) > 0n;
}
function toPartnerActivity(dataset, partnerId, period) {
  const units = partnerActivityUnits(dataset, partnerId, period);
  const income = {
    periodTotalMicro: eofMoney.format(units.incomeUnits),
    openBalanceMicro: eofMoney.format(units.incomeUnits),
    transactionCount: units.incomeCount,
    lastActivityOn: units.incomeLastActivityOn
  };
  const expense = {
    periodTotalMicro: eofMoney.format(units.expenseUnits),
    openBalanceMicro: eofMoney.format(units.expenseUnits),
    transactionCount: units.expenseCount,
    lastActivityOn: units.expenseLastActivityOn
  };
  return {
    income,
    expense,
    netMicro: eofMoney.format(units.incomeUnits - units.expenseUnits)
  };
}
function partnerActivityUnits(dataset, partnerId, period) {
  let incomeUnits = 0n;
  let expenseUnits = 0n;
  let incomeCount = 0;
  let expenseCount = 0;
  let incomeLastActivityOn = null;
  let expenseLastActivityOn = null;
  for (const transaction of dataset.transactions) {
    if (transaction.partnerId !== partnerId || !transaction.transactionDate.startsWith(period) || !transaction.isActive) {
      continue;
    }
    if (transaction.status !== "validated") {
      continue;
    }
    const occurredOn = transaction.transactionDate.slice(0, 10);
    if (transaction.type === "income") {
      incomeUnits = eofMoney.add(incomeUnits, transaction.amountMinor);
      incomeCount += 1;
      incomeLastActivityOn = latestDate(incomeLastActivityOn, occurredOn);
    } else {
      expenseUnits = eofMoney.add(expenseUnits, transaction.amountMinor);
      expenseCount += 1;
      expenseLastActivityOn = latestDate(expenseLastActivityOn, occurredOn);
    }
  }
  return {
    incomeUnits,
    expenseUnits,
    incomeCount,
    expenseCount,
    incomeLastActivityOn,
    expenseLastActivityOn
  };
}
function latestDate(left, right) {
  if (left === null) {
    return right;
  }
  return left > right ? left : right;
}
function toProjectSummary(dataset, project, period) {
  const pnl = readProjectPnl(dataset, project.id, filtersForPeriod(period, null));
  return {
    id: project.id,
    code: project.id,
    label: project.name,
    status: project.status === "archived" ? "archived" : "active",
    ownerLabel: "Office",
    periodIncomeMicro: pnl.income,
    periodExpenseMicro: pnl.expense,
    netMicro: pnl.profit,
    openViolationCount: 0,
    lastActivityOn: latestProjectActivityOn(dataset, project.id)
  };
}
function latestProjectActivityOn(dataset, projectId) {
  let latest = null;
  for (const transaction of dataset.transactions) {
    if (transaction.projectId !== projectId) {
      continue;
    }
    latest = latestDate(latest, transaction.transactionDate.slice(0, 10));
  }
  return latest;
}
function toProjectPnl(dataset, projectId, period) {
  const pnl = readProjectPnl(dataset, projectId, filtersForPeriod(period, null));
  const lines = projectPnlLines(dataset, projectId, period);
  return {
    completeness: "partial",
    projectId,
    projectLabel: pnl.project.name,
    period,
    incomeMicro: pnl.income,
    expenseMicro: pnl.expense,
    netMicro: pnl.profit,
    receivableMicro: pnl.income,
    payableMicro: pnl.expense,
    transactionCount: pnl.tx_count,
    validatedProjectionId: `projection_project_${projectId}_${period}`,
    lines
  };
}
function projectPnlLines(dataset, projectId, period) {
  const categoryRows = /* @__PURE__ */ new Map();
  for (const transaction of dataset.transactions) {
    if (transaction.projectId !== projectId || !transaction.transactionDate.startsWith(period) || transaction.categoryId === null) {
      continue;
    }
    const path = resolveCategoryPath(dataset, transaction.categoryId);
    if (path.division === null || path.department === null) {
      continue;
    }
    const previous = categoryRows.get(transaction.categoryId);
    const existingUnits = previous?.amountUnits ?? 0n;
    const existingCount = previous?.transactionCount ?? 0;
    categoryRows.set(transaction.categoryId, {
      category: {
        category_id: path.category.id,
        category_name: path.category.name,
        category_type: path.category.type,
        division_id: path.division.id,
        division_name: path.division.name,
        department_id: path.department.id,
        department_name: path.department.name,
        income: path.category.type === "income" ? eofMoney.format(transaction.amountMinor) : "0.00",
        expense: path.category.type === "expense" ? eofMoney.format(transaction.amountMinor) : "0.00",
        profit: path.category.type === "income" ? eofMoney.format(transaction.amountMinor) : eofMoney.format(-transaction.amountMinor),
        tx_count: 1
      },
      transactionCount: existingCount + 1,
      amountUnits: eofMoney.add(existingUnits, transaction.amountMinor)
    });
  }
  return [...categoryRows.entries()].map(([categoryId, row]) => ({
    id: categoryId,
    label: `${row.category.department_name} \xB7 ${row.category.division_name} \xB7 ${row.category.category_name}`,
    categoryLabel: row.category.category_name,
    type: row.category.category_type,
    transactionCount: row.transactionCount,
    amountMicro: eofMoney.format(row.amountUnits)
  }));
}
function toOfficeIntegrity(dataset, checkedAt) {
  const bankQuality = readOfficeBankQuality(dataset, "2026-02");
  const checks = [
    {
      id: "integrity_bank_quality",
      label: "Bank matching quality",
      status: bankQuality.unmatchedLineCount === 0 ? "pass" : "warning",
      detail: `${String(bankQuality.unmatchedLineCount)} bank line(s) need review.`,
      exactFixPath: "reconciliation"
    },
    {
      id: "integrity_uncategorized",
      label: "Uncategorized transactions",
      status: dataset.transactions.some((transaction) => transaction.categoryId === null) ? "warning" : "pass",
      detail: "Pending lines must receive a category before validation.",
      exactFixPath: "transactions"
    }
  ];
  return {
    checkedAt,
    status: checks.some((check) => check.status === "fail") ? "fail" : checks.some((check) => check.status === "warning") ? "warning" : "pass",
    passCount: checks.filter((check) => check.status === "pass").length,
    warningCount: checks.filter((check) => check.status === "warning").length,
    failCount: checks.filter((check) => check.status === "fail").length,
    checks
  };
}
function requirePartner2(dataset, partnerId) {
  const partner = dataset.partners.find((candidate) => candidate.id === partnerId);
  if (partner === void 0) {
    throw new ApiRouteError(404, "partner_not_found", "Office partner fixture was not found.", [`partnerId=${partnerId}`]);
  }
  return partner;
}
function requireProject2(dataset, projectId) {
  const project = dataset.projects.find((candidate) => candidate.id === projectId);
  if (project === void 0) {
    throw new ApiRouteError(404, "project_not_found", "Office project fixture was not found.", [`projectId=${projectId}`]);
  }
  return project;
}
function requireDepartment2(dataset, departmentId) {
  const department = dataset.departments.find((candidate) => candidate.id === departmentId);
  if (department === void 0) {
    throw new ApiRouteError(404, "department_not_found", "Office department fixture was not found.", [`departmentId=${departmentId}`]);
  }
  return department;
}
function toDistributionDashboard(dataset, period) {
  const allocations = readAllocationList(dataset, { calculationRunId: null, payeeId: null, status: "posted" });
  const total = allocations.totals[0];
  const suspense = readSuspense(dataset, { status: "open", reasonCode: null });
  const statements = readStatementSummaries(dataset, { period, payeeId: null, status: null });
  return {
    period,
    grossRoyaltyMicro: total?.grossShare ?? "0.0000000000",
    recoupedMicro: total?.recoupmentApplied ?? "0.0000000000",
    netPayableMicro: total?.netPayable ?? "0.0000000000",
    suspenseCount: suspense.rows.length,
    openStatementCount: statements.rows.filter((statement) => statement.status !== "paid" && statement.status !== "void").length,
    lastAuditEventId: null
  };
}
function toDistributionImportBatch(dataset, batchId) {
  const batch = dataset.importBatches.find((candidate) => candidate.id === batchId);
  if (batch === void 0) {
    throw new ApiRouteError(404, "distribution_import_batch_not_found", "Distribution import batch fixture was not found.", [
      `batchId=${batchId}`
    ]);
  }
  const rows = dataset.normalizedEarnings.filter((earning) => earning.batchId === batch.id);
  const grossUnits = rows.reduce((sum, row) => erhMoney.add(sum, erhMoney.parse(row.grossAmount)), 0n);
  return {
    id: batch.id,
    source: batch.source === "routenote" ? "routenote" : "kontor",
    fileName: batch.fileName,
    period: "2026-04",
    statementReference: batch.id,
    accountReference: batch.source,
    rowCount: rows.length,
    unmatchedRowCount: rows.filter((row) => row.mappingStatus !== "matched").length,
    currency: rows[0]?.currency ?? "USD",
    grossMicro: erhMoney.format(grossUnits),
    payableColumn: "netPayable",
    joinKeySummary: "ISRC / UPC / title / artist",
    status: toApiImportStatus(batch.status),
    nextAction: rows.some((row) => row.mappingStatus !== "matched") ? "review_mapping" : "validate",
    importedAt: batch.importedAt ?? "2026-04-30T10:00:00.000Z"
  };
}
function toApiImportStatus(status) {
  if (status === "completed") {
    return "validated";
  }
  if (status === "failed") {
    return "failed";
  }
  if (status === "processing") {
    return "mapped";
  }
  return "uploaded";
}
function toReleaseSummaries(dataset) {
  const releaseIds = /* @__PURE__ */ new Set();
  for (const track of dataset.tracks) {
    if (track.releaseId !== null) {
      releaseIds.add(track.releaseId);
    }
  }
  return [...releaseIds].map((releaseId) => ({
    id: releaseId,
    title: "Seggae light",
    artistName: "Kaya",
    upc: "742000000001",
    status: "released",
    releaseDate: "2026-04-01",
    trackCount: dataset.tracks.filter((track) => track.releaseId === releaseId).length
  }));
}
function toAllocationRunSummary(dataset, run) {
  const allocations = readAllocationList(dataset, { calculationRunId: run.id, payeeId: null, status: null });
  const total = allocations.totals[0];
  const period = "2026-04";
  return {
    id: run.id,
    runReference: `${period} \xB7 distribution:allocation:${run.id}`,
    period,
    status: toApiRunStatus(run.status),
    lockKey: `distribution:allocation:${run.id}`,
    startedAt: run.startedAt,
    completedAt: run.finishedAt,
    totalInputMicro: total?.grossShare ?? "0.0000000000",
    totalAllocatedMicro: total?.netPayable ?? "0.0000000000"
  };
}
function toApiRunStatus(status) {
  if (status === "calculated") {
    return "completed";
  }
  if (status === "error") {
    return "failed";
  }
  return "queued";
}
function toDomainSuspenseStatus(status) {
  if (status === "open" || status === "resolved") {
    return status;
  }
  return null;
}
function toApiSuspenseItem(row, period) {
  return {
    id: row.id,
    period: period ?? "2026-04",
    sourceReference: row.sourceReference,
    reason: toApiSuspenseReason(row.reasonCode),
    exactFixPath: row.exactFixPath,
    amountMicro: row.amount,
    currency: row.currency,
    status: row.status
  };
}
function toApiSuspenseReason(reasonCode) {
  if (reasonCode === "missing_split" || reasonCode === "import_retry" || reasonCode === "contract_hold") {
    return reasonCode;
  }
  return "unmapped_track";
}
function toApiStatementSummary(row) {
  return {
    id: row.id,
    period: row.periodStart.slice(0, 7),
    period_start: row.periodStart,
    period_end: row.periodEnd,
    payeeId: row.payeeId,
    payeeName: row.payeeName,
    status: toApiStatementStatus(row.status),
    grossMicro: row.grossTotal,
    recoupedMicro: row.recoupmentTotal,
    expenseMicro: row.recoupmentTotal,
    paidMicro: row.paymentsApplied,
    netPayableMicro: row.statementBalance,
    currency: row.currency
  };
}
function toApiStatementStatus(status) {
  if (status === "paid") {
    return "paid";
  }
  if (status === "draft") {
    return "draft";
  }
  return "posted";
}
function toPaymentSummaries(dataset) {
  return dataset.payments.map((payment) => {
    const payee = dataset.payees.find((candidate) => candidate.id === payment.payeeId);
    const link = dataset.statementPaymentLinks.find((candidate) => candidate.paymentId === payment.id);
    return {
      id: payment.id,
      statementId: link?.statementId ?? "statement_unlinked",
      payeeId: payment.payeeId,
      payeeName: payee?.name ?? payment.payeeId,
      amountMicro: payment.amount,
      currency: payment.currency,
      status: toApiPaymentStatus(payment.status),
      paidAt: payment.paidAt,
      reference: payment.reference
    };
  });
}
function toApiPaymentStatus(status) {
  if (status === "void") {
    return "voided";
  }
  if (status === "reconciled") {
    return "paid";
  }
  return "draft";
}
function toRevenueRows(dataset, groupBy) {
  const allocations = readAllocationList(dataset, { calculationRunId: null, payeeId: null, status: "posted" }).rows;
  const groups = /* @__PURE__ */ new Map();
  for (const allocation of allocations) {
    const group = revenueGroup(dataset, allocation, groupBy);
    const previous = groups.get(group.id);
    groups.set(group.id, {
      label: group.label,
      currency: allocation.currency,
      rows: [...previous?.rows ?? [], allocation]
    });
  }
  const maxUnits = maxDistributionNetUnits([...groups.values()].map((group) => group.rows));
  return [...groups.entries()].map(([id, group]) => {
    const grossUnits = group.rows.reduce((sum, row) => erhMoney.add(sum, erhMoney.parse(row.grossShare)), 0n);
    const netUnits = group.rows.reduce((sum, row) => erhMoney.add(sum, erhMoney.parse(row.netPayable)), 0n);
    return {
      id,
      label: group.label,
      grossMicro: erhMoney.format(grossUnits),
      netMicro: erhMoney.format(netUnits),
      payableMicro: erhMoney.format(netUnits),
      currency: group.currency,
      barLevel: toDistributionBarLevel(netUnits, maxUnits)
    };
  });
}
function revenueGroup(dataset, allocation, groupBy) {
  if (groupBy === "track") {
    return {
      id: allocation.trackId ?? allocation.earningId,
      label: allocation.trackTitle ?? allocation.earningId
    };
  }
  if (groupBy === "currency") {
    return {
      id: allocation.currency,
      label: allocation.currency
    };
  }
  if (groupBy === "store") {
    const earning = dataset.normalizedEarnings.find((candidate) => candidate.id === allocation.earningId);
    return {
      id: earning?.dsp ?? "unknown_store",
      label: earning?.dsp ?? "Unknown store"
    };
  }
  if (groupBy === "period") {
    return {
      id: "2026-04",
      label: "2026-04"
    };
  }
  return {
    id: allocation.payeeId,
    label: allocation.payeeName
  };
}
function maxDistributionNetUnits(groups) {
  let maxUnits = 0n;
  for (const rows of groups) {
    const total = rows.reduce((sum, row) => erhMoney.add(sum, erhMoney.parse(row.netPayable)), 0n);
    if (total > maxUnits) {
      maxUnits = total;
    }
  }
  return maxUnits;
}
function toDistributionBarLevel(value, maxUnits) {
  if (maxUnits === 0n) {
    return 0;
  }
  return parseInt((value * 100n / maxUnits).toString(), 10);
}
var distributionReconciliationSampleLimit = 25;
function toDistributionReconciliation(store) {
  const dataset = store.distribution;
  const payeeName = (payeeId) => dataset.payees.find((candidate) => candidate.id === payeeId)?.name ?? payeeId;
  const contractTitle = (contractId) => store.distributionContracts.find((candidate) => candidate.id === contractId)?.title ?? contractId;
  const linkedPaymentIds = new Set(dataset.statementPaymentLinks.map((link) => link.paymentId));
  const unlinkedPayments = dataset.payments.filter((payment) => !linkedPaymentIds.has(payment.id));
  const missingPaymentDates = dataset.payments.filter((payment) => payment.paidAt === null);
  const linkedStatementIds = new Set(dataset.statementPaymentLinks.map((link) => link.statementId));
  const statementsWithoutLinks = dataset.statements.filter((statement) => !linkedStatementIds.has(statement.id));
  const allocatedEarningIds = new Set(dataset.earningAllocations.map((allocation) => allocation.earningId));
  const matchedUnallocated = dataset.normalizedEarnings.filter(
    (earning) => earning.mappingStatus === "matched" && !allocatedEarningIds.has(earning.id)
  );
  const expenseTermsMissingPayee = store.distributionCostTerms.filter((term) => term.payeeId === null);
  const balanceGroups = /* @__PURE__ */ new Map();
  for (const balance of store.distributionPayeeBalances) {
    const key = `${balance.payeeId}:${balance.currency}`;
    const existing = balanceGroups.get(key);
    if (existing === void 0) {
      balanceGroups.set(key, {
        payeeId: balance.payeeId,
        currency: balance.currency,
        ids: [balance.id],
        latest: balance.closingBalance
      });
    } else {
      existing.ids.push(balance.id);
      existing.latest = balance.closingBalance;
    }
  }
  const kpis = [
    { id: "payments_total", label: "Payments", value: String(dataset.payments.length), detail: `${String(unlinkedPayments.length)} unlinked`, tone: "info" },
    { id: "payments_unlinked", label: "Unlinked payments", value: String(unlinkedPayments.length), detail: "no statement link", tone: unlinkedPayments.length > 0 ? "warning" : "success" },
    { id: "strict_matches", label: "Strict payment matches", value: String(dataset.statementPaymentLinks.length), detail: "statement \u2194 payment", tone: "info" },
    { id: "statement_plans", label: "Statement plans", value: String(linkedStatementIds.size), detail: "statements with a payment", tone: "info" },
    { id: "payment_only_plans", label: "Payment-only plans", value: String(unlinkedPayments.length), detail: "payment without statement", tone: unlinkedPayments.length > 0 ? "warning" : "success" },
    { id: "missing_payment_dates", label: "Missing payment dates", value: String(missingPaymentDates.length), detail: "paidAt is null", tone: missingPaymentDates.length > 0 ? "warning" : "success" },
    { id: "statements", label: "Statements", value: String(dataset.statements.length), detail: `${String(dataset.statementLines.length)} statement lines`, tone: "info" },
    { id: "payee_balances", label: "Payee balances", value: String(store.distributionPayeeBalances.length), detail: `${String(balanceGroups.size)} payee/currency rows`, tone: "info" },
    { id: "expense_applications", label: "Expense applications", value: String(store.distributionExpenseApplications.length), detail: "applied cost terms", tone: "info" },
    { id: "missing_expense_payees", label: "Missing expense payees", value: String(expenseTermsMissingPayee.length), detail: "cost terms with null payee", tone: expenseTermsMissingPayee.length > 0 ? "warning" : "success" },
    { id: "allocations", label: "Allocations", value: String(dataset.earningAllocations.length), detail: "earning allocations", tone: "info" },
    { id: "matched_unallocated", label: "Matched unallocated", value: String(matchedUnallocated.length), detail: "matched, no allocation", tone: matchedUnallocated.length > 0 ? "warning" : "success" }
  ];
  const statementsWithoutPaymentLinks = statementsWithoutLinks.slice(0, distributionReconciliationSampleLimit).map((statement) => ({
    id: statement.id,
    statementReference: `${payeeName(statement.payeeId)} \xB7 ${statement.periodStart} \u2192 ${statement.periodEnd}`,
    payee: payeeName(statement.payeeId),
    periodStart: statement.periodStart,
    periodEnd: statement.periodEnd,
    currency: statement.currency,
    netPayableMicro: statement.netPayable
  }));
  const expenseTermsMissingPayeeRows = expenseTermsMissingPayee.slice(0, distributionReconciliationSampleLimit).map((term) => ({
    id: term.id,
    expenseReference: `${contractTitle(term.contractId)} \xB7 ${term.currency} ${term.amount}`,
    contract: contractTitle(term.contractId),
    description: term.recoupable ? "recoupable cost term" : "non-recoupable cost term",
    amountMicro: term.amount,
    currency: term.currency,
    status: term.status
  }));
  const matchedUnallocatedSamples = matchedUnallocated.slice(0, distributionReconciliationSampleLimit).map((earning) => ({
    id: earning.id,
    sourceReference: `${earning.batchId} \xB7 ${earning.rawTitle ?? earning.isrc ?? earning.upc ?? earning.id}`,
    batch: earning.batchId,
    track: earning.rawTitle ?? earning.id,
    currency: earning.currency,
    grossMicro: earning.grossAmount,
    status: earning.calculationStatus
  }));
  const payeeBalancesSummary = [...balanceGroups.values()].slice(0, distributionReconciliationSampleLimit).map((group) => ({
    payee: payeeName(group.payeeId),
    currency: group.currency,
    rows: group.ids.length,
    firstId: group.ids[0] ?? null,
    lastId: group.ids[group.ids.length - 1] ?? null,
    firstReference: balanceReference(group.payeeId, group.currency, group.ids[0] ?? null),
    lastReference: balanceReference(group.payeeId, group.currency, group.ids[group.ids.length - 1] ?? null),
    latestClosingMicro: group.latest
  }));
  const actions = [
    { id: "link-statement-payment", label: "Link statement payment", description: "Records and links a payment to the first open statement gap.", maintenance: false },
    { id: "recompute-payee-balance", label: "Recompute payee balance", description: "Recomputes statement/payment balances through the payment write path.", maintenance: false },
    { id: "assign-expense-payee", label: "Assign expense payee", description: "Creates a guarded contract expense with an explicit payee.", maintenance: false },
    { id: "allocate-matched-row", label: "Allocate matched row", description: "Runs the locked allocation engine for matched rows.", maintenance: false },
    { id: "void-statement", label: "Void statement", description: "Voids a statement and appends the reversal balance row.", maintenance: false },
    { id: "repair-identity-link", label: "Repair identity link", description: "One-off backfill; kept as flagged maintenance.", maintenance: true },
    { id: "refresh-derived-summary", label: "Refresh derived summary", description: "One-off derived summary rebuild; kept as flagged maintenance.", maintenance: true }
  ];
  return {
    kpis,
    statementsWithoutPaymentLinks,
    expenseTermsMissingPayee: expenseTermsMissingPayeeRows,
    matchedUnallocatedSamples,
    payeeBalancesSummary,
    actions
  };
}
function toDistributionAliases(store) {
  void store;
  return [];
}
function toDistributionDuplicates(store) {
  const dataset = store.distribution;
  const groups = /* @__PURE__ */ new Map();
  for (const earning of dataset.normalizedEarnings) {
    if (earning.isrc === null) {
      continue;
    }
    const label = `${earning.rawTitle ?? earning.isrc} \xB7 ${earning.rawArtist ?? earning.dsp}`;
    const existing = groups.get(earning.isrc);
    if (existing === void 0) {
      groups.set(earning.isrc, { title: earning.rawTitle ?? earning.isrc, ids: [earning.id], labels: [label] });
    } else {
      existing.ids.push(earning.id);
      existing.labels.push(label);
    }
  }
  return [...groups.entries()].filter(([, group]) => group.ids.length > 1).map(([isrc, group]) => ({
    id: isrc,
    label: group.title,
    kind: "normalized_earning_isrc",
    count: group.ids.length,
    sampleIds: group.ids.slice(0, distributionReconciliationSampleLimit),
    sampleLabels: group.labels.slice(0, distributionReconciliationSampleLimit)
  }));
}
function toDistributionAuditLog(store) {
  return store.officeAuditLog.filter((entry) => entry.action.startsWith("distribution."));
}
function toDistributionSettings(context, store, writesEnabled) {
  const workspaceId = requireQuery(context, "workspaceId");
  const dataset = store.distribution;
  const currencies = [...new Set(dataset.payees.map((payee) => payee.preferredCurrency))].sort();
  return {
    workspaceId,
    namespace: "erh/v1",
    reads: "live",
    payeeCount: dataset.payees.length,
    contractCount: store.distributionContracts.length,
    currencies,
    fxRateCount: store.distributionFxRates.length,
    mutationsEnabled: writesEnabled
  };
}
function balanceReference(payeeId, currency, balanceId) {
  void payeeId;
  if (balanceId === null) {
    return null;
  }
  return `${currency} balance row`;
}
function formatPeriodLabel(start, end) {
  if (start === null && end === null) {
    return "Unscoped";
  }
  if (start === null) {
    return `Until ${end ?? "unknown"}`;
  }
  if (end === null) {
    return `From ${start}`;
  }
  return `${start} to ${end}`;
}

// src/postgres.ts
import { Pool as Pool2 } from "pg";
async function createPostgresApiRuntime(env) {
  const pool = createPostgresPool(env);
  try {
    const fixtures = await readApiFixtureStoreFromPostgres(pool);
    return {
      fixtures,
      persistence: createPostgresPersistenceRuntime(pool, env),
      health: async () => readPostgresHealth(pool),
      close: async () => {
        await pool.end();
      }
    };
  } catch (error) {
    await pool.end();
    throw error;
  }
}
function createPostgresPool(env) {
  const databaseUrl = requireDatabaseUrl(env);
  return new Pool2({
    connectionString: databaseUrl,
    max: 1,
    connectionTimeoutMillis: 15e3,
    idleTimeoutMillis: 3e4,
    keepAlive: true,
    keepAliveInitialDelayMillis: 1e4,
    query_timeout: 6e4,
    statement_timeout: 6e4,
    ssl: sslForDatabaseUrl(databaseUrl)
  });
}
function requireDatabaseUrl(env) {
  const value = env.DATABASE_URL;
  if (value === void 0 || value.trim().length === 0) {
    throw new Error("DATABASE_URL is required to run the Hono shadow API against migrated Postgres.");
  }
  return value;
}
async function readApiFixtureStoreFromPostgres(pool) {
  const office = await readOfficeDataset(pool);
  const distribution = await readDistributionDataset(pool);
  const distributionContracts = await readDistributionContracts(pool);
  const distributionContractExpenses = await readDistributionContractExpenses(pool);
  const distributionMappingRows = await readDistributionMappingRows(pool);
  const distributionRoyaltyRules = await readDistributionRoyaltyRules(pool);
  const distributionCostTerms = await readDistributionAllocationCostTerms(pool);
  const distributionExpenseApplications = await readDistributionExistingExpenseApplications(pool);
  const distributionFxRates = await readDistributionFxRates(pool);
  const distributionPayeeBalances = await readDistributionPayeeBalances(pool);
  const officePartnerPayeeLinks = await readOfficePartnerPayeeLinks(pool);
  return {
    office,
    officeAuditLog: [],
    officeClassificationSuggestions: emptyRecord(),
    officePartnerPayeeLinks,
    officeProjectViolations: emptyRecord(),
    distribution,
    distributionContracts,
    distributionContractExpenses,
    distributionMappingRows,
    distributionRoyaltyRules,
    distributionCostTerms,
    distributionExpenseApplications,
    distributionFxRates,
    distributionPayeeBalances
  };
}
async function readPostgresHealth(pool) {
  const officeTransactions = await readCount(pool, "transactions");
  const distributionStatements = await readCount(pool, "statements");
  return {
    status: "ok",
    database: "postgres",
    officeTransactions,
    distributionStatements
  };
}
async function readOfficeDataset(pool) {
  const departments = await queryRows(pool, "select id::text, name, type, color, is_active from departments order by legacy_id nulls last, id", []);
  const divisions = await queryRows(pool, "select id::text, department_id::text, name, is_active from divisions order by legacy_id nulls last, id", []);
  const categories = await queryRows(pool, "select id::text, division_id::text, name, type, is_active from categories order by legacy_id nulls last, id", []);
  const partners = await queryRows(pool, "select id::text, name, type, is_active from partners order by legacy_id nulls last, id", []);
  const projects = await queryRows(pool, "select id::text, name, status, state, is_active from projects order by legacy_id nulls last, id", []);
  const projectBudgetLines = await queryRows(pool, "select id::text, project_id::text, category_id::text, type, planned_amount_minor::text from project_budget_lines order by legacy_id nulls last, id", []);
  const transactions = await queryRows(
    pool,
    "select id::text, transaction_date, type, status, is_active, description, category_id::text, partner_id::text, project_id::text, amount_minor::text, original_currency, exchange_rate_e10::text from transactions order by transaction_date, id",
    []
  );
  const financialAllocations = await queryRows(pool, "select id::text, transaction_id::text, department_id::text, amount_minor::text from financial_allocations order by legacy_id nulls last, id", []);
  const bankAccounts = await queryRows(
    pool,
    "select id::text, workspace_id, bank_name, account_label, account_reference_hash, currency, current_balance_minor::text, current_balance_mur_minor::text, is_active, balance_as_of from office_bank_accounts order by legacy_id nulls last, id",
    []
  );
  const bankImportBatches = await queryRows(
    pool,
    "select id::text, workspace_id, source, file_name, checksum, account_id::text, period_start, period_end, opening_balance_minor::text, closing_balance_minor::text, currency, accepted_row_count, rejected_row_count, duplicate_row_count, idempotency_fingerprint, status, imported_at, metadata from office_bank_import_batches order by legacy_id nulls last, id",
    []
  );
  const bankStatementLines = await queryRows(
    pool,
    "select id::text, import_batch_id::text, account_id::text, occurred_on, value_on, description, reference, direction, amount_minor::text, balance_minor::text, currency, amount_mur_minor::text, balance_mur_minor::text, is_duplicate_candidate, reconciliation_status, matched_transaction_id::text, raw_data from office_bank_statement_lines order by occurred_on, id",
    []
  );
  const bankReconciliationMatches = await queryRows(
    pool,
    "select id::text, bank_statement_line_id::text, transaction_id::text, confidence_bp, status, approved_by_user_id, approved_at from office_bank_reconciliation_matches order by legacy_id nulls last, id",
    []
  );
  const cashflowProjectionRows = await queryRows(
    pool,
    "select id::text, workspace_id, account_id::text, period_month, expected_inflow_minor::text, expected_outflow_minor::text, expected_closing_balance_minor::text, currency from office_cashflow_projection_rows order by period_month, id",
    []
  );
  return {
    departments: departments.map(toOfficeDepartment),
    divisions: divisions.map(toOfficeDivision),
    categories: categories.map(toOfficeCategory),
    partners: partners.map(toOfficePartner),
    projects: projects.map(toOfficeProject),
    projectBudgetLines: projectBudgetLines.map(toOfficeProjectBudgetLine),
    transactions: transactions.map(toOfficeTransaction2),
    financialAllocations: financialAllocations.map(toOfficeFinancialAllocation),
    bankAccounts: bankAccounts.map(toOfficeBankAccount),
    bankImportBatches: bankImportBatches.map(toOfficeBankImportBatch),
    bankStatementLines: bankStatementLines.map(toOfficeBankStatementLine),
    bankReconciliationMatches: bankReconciliationMatches.map(toOfficeBankReconciliationMatch),
    cashflowProjectionRows: cashflowProjectionRows.map(toOfficeCashflowProjectionRow)
  };
}
async function readDistributionDataset(pool) {
  const importBatches = await queryRows(pool, "select id::text, source, file_name, status, imported_at from import_batches order by legacy_id nulls last, id", []);
  const normalizedEarnings = await queryRows(
    pool,
    "select id::text, batch_id::text, dsp, gross_amount::text, quantity::text, currency, isrc, upc, raw_title, raw_artist, raw_label, mapping_status, calculation_status from normalized_earnings order by legacy_id nulls last, id",
    []
  );
  const calculationRuns = await queryRows(pool, "select id::text, batch_id::text, status, started_at, finished_at, created_at from calculation_runs order by legacy_id nulls last, id", []);
  const earningAllocations = await queryRows(
    pool,
    "select id::text, earning_id::text, calculation_run_id::text, payee_id::text, contract_id::text, track_id::text, gross_amount::text, gross_share::text, recoupment_applied::text, net_payable::text, split_percentage::text, currency, status, created_at from earning_allocations order by legacy_id nulls last, id",
    []
  );
  const suspenseItems = await queryRows(pool, "select id::text, earning_id::text, amount::text, currency, reason_code, resolved, resolved_at, created_at from suspense_items order by legacy_id nulls last, id", []);
  const statements = await queryRows(
    pool,
    "select id::text, payee_id::text, calculation_run_id::text, period_start, period_end, currency, gross_total::text, recoupment_total::text, net_payable::text, amount_due::text, version, status, created_at from statements order by period_end, id",
    []
  );
  const statementLines = await queryRows(
    pool,
    "select id::text, statement_id::text, earning_allocation_id::text, track_id::text, gross_share::text, recoupment_applied::text, net_payable::text, quantity::text, currency from statement_lines order by legacy_id nulls last, id",
    []
  );
  const statementPaymentLinks = await queryRows(pool, "select id::text, statement_id::text, payment_id::text, amount_applied::text from statement_payment_links order by legacy_id nulls last, id", []);
  const payments = await queryRows(pool, "select id::text, payee_id::text, amount::text, currency, status, paid_at, reference from payments order by legacy_id nulls last, id", []);
  const payees = await queryRows(pool, "select id::text, name, preferred_currency, is_active from payees order by legacy_id nulls last, id", []);
  const tracks = await queryRows(pool, "select id::text, title, isrc, release_id::text from tracks order by legacy_id nulls last, id", []);
  return {
    importBatches: importBatches.map(toDistributionImportBatchRow),
    normalizedEarnings: normalizedEarnings.map(toDistributionNormalizedEarning),
    calculationRuns: calculationRuns.map(toDistributionCalculationRun),
    earningAllocations: earningAllocations.map(toDistributionEarningAllocation),
    suspenseItems: suspenseItems.map(toDistributionSuspenseItem),
    statements: statements.map(toDistributionStatement),
    statementLines: statementLines.map(toDistributionStatementLine),
    statementPaymentLinks: statementPaymentLinks.map(toDistributionStatementPaymentLink),
    payments: payments.map(toDistributionPayment),
    payees: payees.map(toDistributionPayee),
    tracks: tracks.map(toDistributionTrack)
  };
}
async function readDistributionContracts(pool) {
  const rows = await queryRows(
    pool,
    `select c.id::text, c.title, c.status, c.effective_from, c.effective_to, rr.payee_id::text, rr.percentage::text,
      coalesce(ct.currency, 'MUR') as currency,
      coalesce(sum(ct.amount) filter (where ct.recoupable = true and ct.status not in ('recovered', 'satisfied', 'cancelled', 'deleted')), 0)::text as open_expense
     from contracts c
     left join royalty_rules rr on rr.contract_id = c.id
     left join contract_cost_terms ct on ct.contract_id = c.id
     group by c.id, c.title, c.status, c.effective_from, c.effective_to, rr.payee_id, rr.percentage, ct.currency
     order by c.title, c.id`,
    []
  );
  return rows.map((row) => ({
    id: stringCell(row, "id"),
    payeeId: nullableStringCell(row, "payee_id") ?? "unassigned",
    title: stringCell(row, "title"),
    status: toApiContractStatus(stringCell(row, "status")),
    effectiveFrom: nullableDateCell(row, "effective_from") ?? "1970-01-01",
    effectiveTo: nullableDateCell(row, "effective_to"),
    splitBp: percentageToBasisPoints(nullableStringCell(row, "percentage") ?? "0"),
    openExpenseMicro: stringCell(row, "open_expense"),
    currency: currencyCell(row, "currency")
  }));
}
async function readDistributionContractExpenses(pool) {
  const rows = await queryRows(
    pool,
    "select id::text, contract_id::text, payee_id::text, amount::text, currency, status, created_at from contract_cost_terms order by legacy_id nulls last, id",
    []
  );
  return rows.map((row) => ({
    id: stringCell(row, "id"),
    contractId: stringCell(row, "contract_id"),
    payeeId: nullableStringCell(row, "payee_id") ?? "unassigned",
    incurredOn: timestampCell(row, "created_at").slice(0, 10),
    label: "Contract cost term",
    originalAmountMicro: stringCell(row, "amount"),
    openAmountMicro: isOpenExpenseStatus(stringCell(row, "status")) ? stringCell(row, "amount") : "0.0000000000",
    currency: currencyCell(row, "currency"),
    status: toApiExpenseStatus(stringCell(row, "status"))
  }));
}
async function readDistributionMappingRows(pool) {
  const rows = await queryRows(
    pool,
    `select ne.id::text, ne.batch_id::text, ne.raw_title, ne.raw_artist, ne.dsp, ne.mapping_status, etm.track_id::text, t.title as track_title, etm.confidence::text
     from normalized_earnings ne
     left join earning_track_matches etm on etm.earning_id = ne.id
     left join tracks t on t.id = etm.track_id
     order by ne.legacy_id nulls last, ne.id
     limit 1000`,
    []
  );
  return rows.map((row) => ({
    id: stringCell(row, "id"),
    batchId: stringCell(row, "batch_id"),
    sourceTitle: nullableStringCell(row, "raw_title") ?? "",
    sourceArtist: nullableStringCell(row, "raw_artist") ?? "",
    sourceStore: stringCell(row, "dsp"),
    suggestedTrackId: nullableStringCell(row, "track_id"),
    suggestedTrackTitle: nullableStringCell(row, "track_title"),
    confidenceBp: percentageToBasisPoints(nullableStringCell(row, "confidence") ?? "0"),
    status: toApiMappingStatus(stringCell(row, "mapping_status")),
    exactFixPath: "manual_track"
  }));
}
async function readDistributionRoyaltyRules(pool) {
  const rows = await queryRows(
    pool,
    `select id::text, contract_id::text, payee_id::text, percentage::text, scope_type, scope_id,
      effective_from, effective_to, status
     from royalty_rules
     order by priority desc, legacy_id nulls last, id`,
    []
  );
  return rows.map((row) => {
    const scopeType = nullableStringCell(row, "scope_type");
    const scopeId = nullableStringCell(row, "scope_id");
    const payeeId = stringCell(row, "payee_id");
    return {
      contractId: stringCell(row, "contract_id"),
      royaltyRuleId: stringCell(row, "id"),
      payeeId,
      artistId: scopeType === "artist" && scopeId !== null ? scopeId : payeeId,
      role: scopeType ?? "artist",
      percentage: stringCell(row, "percentage"),
      scopeType,
      scopeId,
      effectiveFrom: nullableDateCell(row, "effective_from"),
      effectiveTo: nullableDateCell(row, "effective_to"),
      status: enumCell(row, "status", ["draft", "active", "inactive", "archived"])
    };
  });
}
async function readDistributionAllocationCostTerms(pool) {
  const rows = await queryRows(
    pool,
    `select id::text, contract_id::text, payee_id::text, amount::text, currency, recoupable, status, created_at
     from contract_cost_terms
     order by legacy_id nulls last, id`,
    []
  );
  return rows.map((row) => ({
    id: stringCell(row, "id"),
    contractId: stringCell(row, "contract_id"),
    payeeId: nullableStringCell(row, "payee_id"),
    amount: stringCell(row, "amount"),
    currency: currencyCell(row, "currency"),
    recoupable: booleanCell(row, "recoupable"),
    status: enumCell(row, "status", [
      "draft",
      "active",
      "open",
      "partially_recovered",
      "recovered",
      "non_recoverable",
      "satisfied",
      "cancelled",
      "deleted"
    ]),
    expenseDate: timestampCell(row, "created_at").slice(0, 10)
  }));
}
async function readDistributionExistingExpenseApplications(pool) {
  const rows = await queryRows(
    pool,
    "select cost_term_id::text, amount_applied::text, currency from expense_applications order by legacy_id nulls last, id",
    []
  );
  return rows.map((row) => ({
    costTermId: stringCell(row, "cost_term_id"),
    amountApplied: stringCell(row, "amount_applied"),
    currency: currencyCell(row, "currency")
  }));
}
async function readDistributionFxRates(pool) {
  const rows = await queryRows(
    pool,
    "select from_currency, to_currency, effective_date, rate::text from fx_rates order by effective_date, from_currency, to_currency",
    []
  );
  return rows.map((row) => ({
    fromCurrency: currencyCell(row, "from_currency"),
    toCurrency: currencyCell(row, "to_currency"),
    effectiveDate: dateCell(row, "effective_date"),
    rate: stringCell(row, "rate")
  }));
}
async function readDistributionPayeeBalances(pool) {
  const rows = await queryRows(
    pool,
    `select id::text, payee_id::text, statement_id::text, currency, opening_balance::text, period_net::text,
      closing_balance::text, movement_type, created_at
     from payee_balances
     order by created_at, id`,
    []
  );
  return rows.map((row) => ({
    id: stringCell(row, "id"),
    payeeId: stringCell(row, "payee_id"),
    statementId: nullableStringCell(row, "statement_id"),
    currency: currencyCell(row, "currency"),
    openingBalance: stringCell(row, "opening_balance"),
    periodNet: stringCell(row, "period_net"),
    closingBalance: stringCell(row, "closing_balance"),
    movementType: enumCell(row, "movement_type", ["opening", "period", "statement", "void_reversal", "adjustment", "carry_forward"]),
    createdAt: timestampCell(row, "created_at")
  }));
}
function toOfficeDepartment(row) {
  return {
    id: stringCell(row, "id"),
    name: stringCell(row, "name"),
    type: enumCell(row, "type", ["income", "expense", "mixed"]),
    color: nullableStringCell(row, "color"),
    isActive: booleanCell(row, "is_active")
  };
}
function toOfficeDivision(row) {
  return {
    id: stringCell(row, "id"),
    departmentId: stringCell(row, "department_id"),
    name: stringCell(row, "name"),
    isActive: booleanCell(row, "is_active")
  };
}
function toOfficeCategory(row) {
  return {
    id: stringCell(row, "id"),
    divisionId: nullableStringCell(row, "division_id"),
    name: stringCell(row, "name"),
    type: enumCell(row, "type", ["income", "expense"]),
    isActive: booleanCell(row, "is_active")
  };
}
function toOfficePartner(row) {
  return {
    id: stringCell(row, "id"),
    name: stringCell(row, "name"),
    type: enumCell(row, "type", ["client", "supplier", "both"]),
    isActive: booleanCell(row, "is_active")
  };
}
function toOfficeProject(row) {
  return {
    id: stringCell(row, "id"),
    name: stringCell(row, "name"),
    status: enumCell(row, "status", ["draft", "active", "paused", "completed", "cancelled", "archived"]),
    state: stringCell(row, "state"),
    isActive: booleanCell(row, "is_active")
  };
}
function toOfficeProjectBudgetLine(row) {
  return {
    id: stringCell(row, "id"),
    projectId: stringCell(row, "project_id"),
    categoryId: stringCell(row, "category_id"),
    type: enumCell(row, "type", ["income", "expense"]),
    plannedAmountMinor: bigintCell(row, "planned_amount_minor")
  };
}
function toOfficeTransaction2(row) {
  return {
    id: stringCell(row, "id"),
    transactionDate: timestampCell(row, "transaction_date"),
    type: enumCell(row, "type", ["income", "expense"]),
    status: enumCell(row, "status", ["validated", "draft", "cancelled"]),
    isActive: booleanCell(row, "is_active"),
    description: nullableStringCell(row, "description"),
    categoryId: nullableStringCell(row, "category_id"),
    partnerId: nullableStringCell(row, "partner_id"),
    projectId: nullableStringCell(row, "project_id"),
    amountMinor: bigintCell(row, "amount_minor"),
    originalCurrency: nullableStringCell(row, "original_currency"),
    exchangeRateE10: nullableBigintCell(row, "exchange_rate_e10")
  };
}
function toOfficeFinancialAllocation(row) {
  return {
    id: stringCell(row, "id"),
    transactionId: stringCell(row, "transaction_id"),
    departmentId: nullableStringCell(row, "department_id"),
    amountMinor: bigintCell(row, "amount_minor")
  };
}
function toOfficeBankAccount(row) {
  return {
    id: stringCell(row, "id"),
    workspaceId: stringCell(row, "workspace_id"),
    bankName: stringCell(row, "bank_name"),
    accountLabel: stringCell(row, "account_label"),
    accountReferenceHash: stringCell(row, "account_reference_hash"),
    currency: currencyCell(row, "currency"),
    currentBalanceMinor: bigintCell(row, "current_balance_minor"),
    currentBalanceMurMinor: nullableBigintCell(row, "current_balance_mur_minor"),
    isActive: booleanCell(row, "is_active"),
    balanceAsOf: nullableTimestampCell(row, "balance_as_of")
  };
}
function toOfficeBankImportBatch(row) {
  return {
    id: stringCell(row, "id"),
    workspaceId: stringCell(row, "workspace_id"),
    source: enumCell(row, "source", ["sbi", "mcb", "csv", "cashflow", "pdf"]),
    fileName: stringCell(row, "file_name"),
    checksum: stringCell(row, "checksum"),
    accountId: nullableStringCell(row, "account_id"),
    periodStart: nullableDateCell(row, "period_start"),
    periodEnd: nullableDateCell(row, "period_end"),
    openingBalanceMinor: nullableBigintCell(row, "opening_balance_minor"),
    closingBalanceMinor: nullableBigintCell(row, "closing_balance_minor"),
    currency: nullableCurrencyCell(row, "currency"),
    acceptedRowCount: numberCell(row, "accepted_row_count"),
    rejectedRowCount: numberCell(row, "rejected_row_count"),
    duplicateRowCount: numberCell(row, "duplicate_row_count"),
    idempotencyFingerprint: stringCell(row, "idempotency_fingerprint"),
    status: enumCell(row, "status", ["previewed", "confirmed", "failed", "void"]),
    importedAt: nullableTimestampCell(row, "imported_at"),
    metadata: jsonRecordCell(row, "metadata")
  };
}
function toOfficeBankStatementLine(row) {
  return {
    id: stringCell(row, "id"),
    importBatchId: stringCell(row, "import_batch_id"),
    accountId: stringCell(row, "account_id"),
    occurredOn: dateCell(row, "occurred_on"),
    valueOn: nullableDateCell(row, "value_on"),
    description: stringCell(row, "description"),
    reference: nullableStringCell(row, "reference"),
    direction: enumCell(row, "direction", ["credit", "debit"]),
    amountMinor: bigintCell(row, "amount_minor"),
    balanceMinor: nullableBigintCell(row, "balance_minor"),
    currency: currencyCell(row, "currency"),
    amountMurMinor: bigintCell(row, "amount_mur_minor"),
    balanceMurMinor: nullableBigintCell(row, "balance_mur_minor"),
    isDuplicateCandidate: booleanCell(row, "is_duplicate_candidate"),
    reconciliationStatus: enumCell(row, "reconciliation_status", ["unmatched", "suggested", "matched", "rejected"]),
    matchedTransactionId: nullableStringCell(row, "matched_transaction_id"),
    rawData: jsonRecordCell(row, "raw_data")
  };
}
function toOfficeBankReconciliationMatch(row) {
  return {
    id: stringCell(row, "id"),
    bankStatementLineId: stringCell(row, "bank_statement_line_id"),
    transactionId: stringCell(row, "transaction_id"),
    confidenceBp: numberCell(row, "confidence_bp"),
    status: enumCell(row, "status", ["unmatched", "suggested", "matched", "rejected"]),
    approvedByUserId: nullableStringCell(row, "approved_by_user_id"),
    approvedAt: nullableTimestampCell(row, "approved_at")
  };
}
function toOfficeCashflowProjectionRow(row) {
  return {
    id: stringCell(row, "id"),
    workspaceId: stringCell(row, "workspace_id"),
    accountId: nullableStringCell(row, "account_id"),
    periodMonth: stringCell(row, "period_month"),
    expectedInflowMinor: bigintCell(row, "expected_inflow_minor"),
    expectedOutflowMinor: bigintCell(row, "expected_outflow_minor"),
    expectedClosingBalanceMinor: bigintCell(row, "expected_closing_balance_minor"),
    currency: currencyCell(row, "currency")
  };
}
function toDistributionImportBatchRow(row) {
  return {
    id: stringCell(row, "id"),
    source: stringCell(row, "source"),
    fileName: stringCell(row, "file_name"),
    status: enumCell(row, "status", ["draft", "processing", "normalized", "completed", "failed", "void"]),
    importedAt: nullableTimestampCell(row, "imported_at")
  };
}
function toDistributionNormalizedEarning(row) {
  return {
    id: stringCell(row, "id"),
    batchId: stringCell(row, "batch_id"),
    dsp: stringCell(row, "dsp"),
    grossAmount: stringCell(row, "gross_amount"),
    quantity: stringCell(row, "quantity"),
    currency: currencyCell(row, "currency"),
    isrc: nullableStringCell(row, "isrc"),
    upc: nullableStringCell(row, "upc"),
    rawTitle: nullableStringCell(row, "raw_title"),
    rawArtist: nullableStringCell(row, "raw_artist"),
    rawLabel: nullableStringCell(row, "raw_label"),
    mappingStatus: enumCell(row, "mapping_status", ["unmapped", "unmatched", "matched", "suspense", "ignored"]),
    calculationStatus: enumCell(row, "calculation_status", ["pending", "allocated", "calculated", "suspense", "completed", "failed", "running", "error", "excluded"])
  };
}
function toDistributionCalculationRun(row) {
  return {
    id: stringCell(row, "id"),
    batchId: nullableStringCell(row, "batch_id"),
    status: enumCell(row, "status", ["pending", "allocated", "calculated", "suspense", "completed", "failed", "running", "error", "excluded"]),
    startedAt: nullableTimestampCell(row, "started_at"),
    finishedAt: nullableTimestampCell(row, "finished_at"),
    createdAt: timestampCell(row, "created_at")
  };
}
function toDistributionEarningAllocation(row) {
  return {
    id: stringCell(row, "id"),
    earningId: stringCell(row, "earning_id"),
    calculationRunId: stringCell(row, "calculation_run_id"),
    payeeId: stringCell(row, "payee_id"),
    contractId: nullableStringCell(row, "contract_id"),
    trackId: nullableStringCell(row, "track_id"),
    grossAmount: stringCell(row, "gross_amount"),
    grossShare: stringCell(row, "gross_share"),
    recoupmentApplied: stringCell(row, "recoupment_applied"),
    netPayable: stringCell(row, "net_payable"),
    splitPercentage: stringCell(row, "split_percentage"),
    currency: currencyCell(row, "currency"),
    status: enumCell(row, "status", ["preview", "calculated", "statemented", "posted", "void", "error"]),
    createdAt: timestampCell(row, "created_at")
  };
}
function toDistributionSuspenseItem(row) {
  return {
    id: stringCell(row, "id"),
    earningId: nullableStringCell(row, "earning_id"),
    amount: stringCell(row, "amount"),
    currency: currencyCell(row, "currency"),
    reasonCode: stringCell(row, "reason_code"),
    resolved: booleanCell(row, "resolved"),
    resolvedAt: nullableTimestampCell(row, "resolved_at"),
    createdAt: timestampCell(row, "created_at")
  };
}
function toDistributionStatement(row) {
  return {
    id: stringCell(row, "id"),
    payeeId: stringCell(row, "payee_id"),
    calculationRunId: nullableStringCell(row, "calculation_run_id"),
    periodStart: dateCell(row, "period_start"),
    periodEnd: dateCell(row, "period_end"),
    currency: currencyCell(row, "currency"),
    grossTotal: stringCell(row, "gross_total"),
    recoupmentTotal: stringCell(row, "recoupment_total"),
    netPayable: stringCell(row, "net_payable"),
    amountDue: stringCell(row, "amount_due"),
    version: numberCell(row, "version"),
    status: enumCell(row, "status", ["draft", "generated", "locked", "sent", "paid", "void"]),
    createdAt: timestampCell(row, "created_at")
  };
}
function toDistributionStatementLine(row) {
  return {
    id: stringCell(row, "id"),
    statementId: stringCell(row, "statement_id"),
    earningAllocationId: nullableStringCell(row, "earning_allocation_id"),
    trackId: nullableStringCell(row, "track_id"),
    grossShare: stringCell(row, "gross_share"),
    recoupmentApplied: stringCell(row, "recoupment_applied"),
    netPayable: stringCell(row, "net_payable"),
    quantity: stringCell(row, "quantity"),
    currency: currencyCell(row, "currency")
  };
}
function toDistributionStatementPaymentLink(row) {
  return {
    id: stringCell(row, "id"),
    statementId: stringCell(row, "statement_id"),
    paymentId: stringCell(row, "payment_id"),
    amountApplied: stringCell(row, "amount_applied")
  };
}
function toDistributionPayment(row) {
  return {
    id: stringCell(row, "id"),
    payeeId: stringCell(row, "payee_id"),
    amount: stringCell(row, "amount"),
    currency: currencyCell(row, "currency"),
    status: enumCell(row, "status", ["recorded", "edited", "void", "reconciled"]),
    paidAt: nullableTimestampCell(row, "paid_at"),
    reference: nullableStringCell(row, "reference")
  };
}
function toDistributionPayee(row) {
  return {
    id: stringCell(row, "id"),
    name: stringCell(row, "name"),
    preferredCurrency: currencyCell(row, "preferred_currency"),
    isActive: booleanCell(row, "is_active")
  };
}
function toDistributionTrack(row) {
  return {
    id: stringCell(row, "id"),
    title: stringCell(row, "title"),
    isrc: nullableStringCell(row, "isrc"),
    releaseId: nullableStringCell(row, "release_id")
  };
}
async function readOfficePartnerPayeeLinks(pool) {
  const rows = await queryRows(
    pool,
    `select il.office_partner_id::text, op.name as partner_name, il.payee_id::text, p.name as payee_name,
      p.is_active as payee_is_active, il.confidence::text
     from identity_link il
     join partners op on op.id = il.office_partner_id
     join payees p on p.id = il.payee_id
     where il.status = 'linked'
     order by il.updated_at desc, il.created_at desc, il.id`,
    []
  );
  const links = {};
  for (const row of rows) {
    const partnerId = stringCell(row, "office_partner_id");
    if (links[partnerId] !== void 0) {
      continue;
    }
    links[partnerId] = {
      partnerId,
      partnerName: stringCell(row, "partner_name"),
      payeeId: stringCell(row, "payee_id"),
      payeeName: stringCell(row, "payee_name"),
      resolution: "stored_link",
      status: booleanCell(row, "payee_is_active") ? "active" : "inactive",
      source: "identity_link",
      confidence: stringCell(row, "confidence")
    };
  }
  return links;
}
function sslForDatabaseUrl(databaseUrl) {
  const parsed = new URL(databaseUrl);
  const sslMode = parsed.searchParams.get("sslmode");
  if (sslMode === "disable") {
    return false;
  }
  return { rejectUnauthorized: false };
}
async function queryRows(pool, sql2, values) {
  const result = await pool.query(sql2, values);
  return result.rows;
}
async function readCount(pool, tableName) {
  const rows = await queryRows(pool, `select count(*)::text as n from ${quoteIdentifier(tableName)}`, []);
  const first = rows[0];
  if (first === void 0) {
    throw new Error(`Postgres count returned no row for ${tableName}.`);
  }
  return numberFromText(stringCell(first, "n"), `${tableName}.count`);
}
function emptyRecord() {
  return {};
}
function stringCell(row, columnName) {
  const value = row[columnName];
  if (value === null || value === void 0) {
    throw new Error(`Postgres row is missing required column ${columnName}.`);
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return String(value);
}
function nullableStringCell(row, columnName) {
  const value = row[columnName];
  if (value === null || value === void 0) {
    return null;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return String(value);
}
function booleanCell(row, columnName) {
  const value = row[columnName];
  if (typeof value === "boolean") {
    return value;
  }
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  throw new Error(`Postgres column ${columnName} is not boolean.`);
}
function bigintCell(row, columnName) {
  return BigInt(stringCell(row, columnName));
}
function nullableBigintCell(row, columnName) {
  const value = nullableStringCell(row, columnName);
  return value === null ? null : BigInt(value);
}
function numberCell(row, columnName) {
  return numberFromText(stringCell(row, columnName), columnName);
}
function numberFromText(value, label) {
  if (!/^-?\d+$/u.test(value)) {
    throw new Error(`Postgres column ${label} is not an integer: ${value}.`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new Error(`Postgres column ${label} is outside safe integer range: ${value}.`);
  }
  return parsed;
}
function timestampCell(row, columnName) {
  const value = stringCell(row, columnName);
  return value.includes("T") ? value : `${value.replace(" ", "T")}.000Z`;
}
function nullableTimestampCell(row, columnName) {
  const value = nullableStringCell(row, columnName);
  if (value === null) {
    return null;
  }
  return value.includes("T") ? value : `${value.replace(" ", "T")}.000Z`;
}
function dateCell(row, columnName) {
  return stringCell(row, columnName).slice(0, 10);
}
function nullableDateCell(row, columnName) {
  return nullableStringCell(row, columnName)?.slice(0, 10) ?? null;
}
function currencyCell(row, columnName) {
  const value = stringCell(row, columnName);
  if (!/^[A-Z]{3}$/u.test(value)) {
    throw new Error(`Postgres column ${columnName} is not a 3-letter currency: ${value}.`);
  }
  return value;
}
function nullableCurrencyCell(row, columnName) {
  const value = nullableStringCell(row, columnName);
  if (value === null) {
    return null;
  }
  if (!/^[A-Z]{3}$/u.test(value)) {
    throw new Error(`Postgres column ${columnName} is not a 3-letter currency: ${value}.`);
  }
  return value;
}
function jsonRecordCell(row, columnName) {
  const value = row[columnName];
  if (value === null || value === void 0) {
    return {};
  }
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Postgres column ${columnName} is not a JSON object.`);
  }
  return value;
}
function enumCell(row, columnName, allowed) {
  const value = stringCell(row, columnName);
  for (const candidate of allowed) {
    if (value === candidate) {
      return candidate;
    }
  }
  throw new Error(`Postgres column ${columnName} has unsupported value ${value}.`);
}
function percentageToBasisPoints(value) {
  const [whole = "0", fraction = ""] = value.split(".");
  const scaled = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0").slice(0, 2));
  const parsed = Number(scaled);
  if (!Number.isSafeInteger(parsed)) {
    throw new Error(`Percentage is outside basis-point range: ${value}.`);
  }
  return parsed;
}
function toApiContractStatus(value) {
  if (value === "active" || value === "draft" || value === "paused") {
    return value;
  }
  return "ended";
}
function toApiExpenseStatus(value) {
  if (value === "recovered" || value === "satisfied") {
    return "recouped";
  }
  if (value === "cancelled" || value === "deleted" || value === "non_recoverable") {
    return "waived";
  }
  return "open";
}
function isOpenExpenseStatus(value) {
  return toApiExpenseStatus(value) === "open";
}
function toApiMappingStatus(value) {
  if (value === "matched") {
    return "mapped";
  }
  if (value === "unmapped" || value === "unmatched" || value === "suspense") {
    return "unmapped";
  }
  return "suggested";
}
function quoteIdentifier(identifier) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/u.test(identifier)) {
    throw new Error(`Unsafe SQL identifier: ${identifier}.`);
  }
  return `"${identifier}"`;
}

// src/server.ts
var envFilePath = resolveRootEnvPath(process.cwd());
if (existsSync(envFilePath)) {
  const envFile = readFileSync(envFilePath, "utf8");
  for (const line of envFile.split(/\r?\n/)) {
    const trimmedLine = line.trim();
    if (trimmedLine.length === 0 || trimmedLine.startsWith("#")) {
      continue;
    }
    const equalsIndex = trimmedLine.indexOf("=");
    if (equalsIndex < 1) {
      continue;
    }
    const key = trimmedLine.slice(0, equalsIndex).trim();
    let value = trimmedLine.slice(equalsIndex + 1).trim();
    if (value.length === 0) {
      if (process.env[key] === void 0) {
        process.env[key] = "";
      }
      continue;
    }
    const quote = value[0];
    if (quote === '"' && value.endsWith('"') || quote === "'" && value.endsWith("'")) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === void 0) {
      process.env[key] = value;
    }
  }
}
void bootServer();
async function bootServer() {
  const host = process.env.HOST ?? "0.0.0.0";
  const port = parsePort(process.env.PORT ?? 8787);
  process.stdout.write(`eHQ Hono API shadow booting on http://${host}:${String(port)}
`);
  process.stdout.write("eHQ Hono API shadow connecting to Postgres...\n");
  let runtime;
  try {
    runtime = await createPostgresApiRuntime(process.env);
  } catch (error) {
    writeBootError(error);
    process.exit(1);
    return;
  }
  process.stdout.write("eHQ Hono API shadow ready\n");
  const app = createApiService({
    fixtures: runtime.fixtures,
    persistence: runtime.persistence,
    health: runtime.health,
    nowIso: () => (/* @__PURE__ */ new Date()).toISOString(),
    auth: createSupabaseJwtVerifier(createSupabaseJwtAuthConfig(process.env))
  });
  const server = createServer((request, response) => {
    void handleRequestWithApp(app, host, port, request, response);
  });
  server.listen(port, host, () => {
    const serverWithAddress = server;
    const boundAddress = serverWithAddress.address();
    const resolvedPort = typeof boundAddress === "object" && boundAddress !== null ? boundAddress.port : port;
    process.stdout.write(`eHQ Hono API shadow listening on http://${host}:${String(resolvedPort)}
`);
  });
  process.on("SIGINT", () => {
    void shutdown(server, runtime, 0);
  });
  process.on("SIGTERM", () => {
    void shutdown(server, runtime, 0);
  });
}
async function handleRequestWithApp(app, host, port, request, response) {
  const method = request.method ?? "GET";
  const requestUrl = `http://${headerHost(request.headers.host, host, port)}${request.url ?? "/"}`;
  const body = method === "GET" || method === "HEAD" ? void 0 : Readable.toWeb(request);
  const honoResponse = await app.fetch(
    new Request(requestUrl, {
      method,
      headers: headersFromIncoming(request.headers),
      body,
      duplex: body === void 0 ? void 0 : "half"
    })
  );
  response.writeHead(honoResponse.status, responseHeaders(honoResponse.headers));
  if (honoResponse.body === null) {
    response.end();
    return;
  }
  const nodeBody = Readable.fromWeb(honoResponse.body);
  nodeBody.pipe(response);
}
function parsePort(rawPort) {
  const value = String(rawPort).trim();
  if (!/^\d+$/u.test(value)) {
    throw new Error(`PORT must be an integer, got ${value}.`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0 || parsed > 65535) {
    throw new Error(`PORT is outside the valid TCP port range: ${value}.`);
  }
  return parsed;
}
function headerHost(value, host, port) {
  if (typeof value === "string" && value.trim().length > 0) {
    return value;
  }
  return `${host}:${String(port)}`;
}
function headersFromIncoming(headers) {
  const result = new Headers();
  for (const [key, value] of Object.entries(headers)) {
    if (value === void 0) {
      continue;
    }
    if (typeof value === "string") {
      result.set(key, value);
      continue;
    }
    result.set(key, value.join(", "));
  }
  return result;
}
function responseHeaders(headers) {
  const result = {};
  headers.forEach((value, key) => {
    result[key] = value;
  });
  return result;
}
async function shutdown(server, runtime, code) {
  await new Promise((resolve2, reject) => {
    server.close((error) => {
      if (error === void 0) {
        resolve2();
        return;
      }
      reject(error);
    });
  });
  await runtime.close();
  process.exit(code);
}
function writeBootError(error) {
  if (error instanceof Error) {
    console.error(`eHQ Hono API shadow boot failed: ${error.message}`);
    if (error.stack !== void 0) {
      console.error(error.stack);
    }
    return;
  }
  console.error(`eHQ Hono API shadow boot failed: ${String(error)}`);
}
function resolveRootEnvPath(startPath) {
  let currentDirectory = startPath;
  for (let attempts = 0; attempts < 8; attempts += 1) {
    const candidate = resolve(currentDirectory, ".env");
    if (existsSync(candidate)) {
      return candidate;
    }
    if (existsSync(resolve(currentDirectory, ".git"))) {
      break;
    }
    const parentDirectory = dirname(currentDirectory);
    if (parentDirectory === currentDirectory) {
      break;
    }
    currentDirectory = parentDirectory;
  }
  return resolve(startPath, ".env");
}
