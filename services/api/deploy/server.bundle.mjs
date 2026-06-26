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
var tryDecode = (str, decoder) => {
  try {
    return decoder(str);
  } catch {
    return str.replace(/(?:%[0-9A-Fa-f]{2})+/g, (match2) => {
      try {
        return decoder(match2);
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

// ../../packages/domain-finance/src/errors.ts
function createFinanceDomainError(code, message, context) {
  const error = new Error(message);
  Object.defineProperty(error, "name", { value: "FinanceDomainError", enumerable: true });
  Object.defineProperty(error, "code", { value: code, enumerable: true });
  Object.defineProperty(error, "context", { value: context, enumerable: true });
  return error;
}
function raiseFinanceDomainError(code, message, context) {
  throw createFinanceDomainError(code, message, context);
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
  let message;
  switch (issue.code) {
    case ZodIssueCode.invalid_type:
      if (issue.received === ZodParsedType.undefined) {
        message = "Required";
      } else {
        message = `Expected ${issue.expected}, received ${issue.received}`;
      }
      break;
    case ZodIssueCode.invalid_literal:
      message = `Invalid literal value, expected ${JSON.stringify(issue.expected, util.jsonStringifyReplacer)}`;
      break;
    case ZodIssueCode.unrecognized_keys:
      message = `Unrecognized key(s) in object: ${util.joinValues(issue.keys, ", ")}`;
      break;
    case ZodIssueCode.invalid_union:
      message = `Invalid input`;
      break;
    case ZodIssueCode.invalid_union_discriminator:
      message = `Invalid discriminator value. Expected ${util.joinValues(issue.options)}`;
      break;
    case ZodIssueCode.invalid_enum_value:
      message = `Invalid enum value. Expected ${util.joinValues(issue.options)}, received '${issue.received}'`;
      break;
    case ZodIssueCode.invalid_arguments:
      message = `Invalid function arguments`;
      break;
    case ZodIssueCode.invalid_return_type:
      message = `Invalid function return type`;
      break;
    case ZodIssueCode.invalid_date:
      message = `Invalid date`;
      break;
    case ZodIssueCode.invalid_string:
      if (typeof issue.validation === "object") {
        if ("includes" in issue.validation) {
          message = `Invalid input: must include "${issue.validation.includes}"`;
          if (typeof issue.validation.position === "number") {
            message = `${message} at one or more positions greater than or equal to ${issue.validation.position}`;
          }
        } else if ("startsWith" in issue.validation) {
          message = `Invalid input: must start with "${issue.validation.startsWith}"`;
        } else if ("endsWith" in issue.validation) {
          message = `Invalid input: must end with "${issue.validation.endsWith}"`;
        } else {
          util.assertNever(issue.validation);
        }
      } else if (issue.validation !== "regex") {
        message = `Invalid ${issue.validation}`;
      } else {
        message = "Invalid";
      }
      break;
    case ZodIssueCode.too_small:
      if (issue.type === "array")
        message = `Array must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `more than`} ${issue.minimum} element(s)`;
      else if (issue.type === "string")
        message = `String must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `over`} ${issue.minimum} character(s)`;
      else if (issue.type === "number")
        message = `Number must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${issue.minimum}`;
      else if (issue.type === "bigint")
        message = `Number must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${issue.minimum}`;
      else if (issue.type === "date")
        message = `Date must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${new Date(Number(issue.minimum))}`;
      else
        message = "Invalid input";
      break;
    case ZodIssueCode.too_big:
      if (issue.type === "array")
        message = `Array must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `less than`} ${issue.maximum} element(s)`;
      else if (issue.type === "string")
        message = `String must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `under`} ${issue.maximum} character(s)`;
      else if (issue.type === "number")
        message = `Number must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
      else if (issue.type === "bigint")
        message = `BigInt must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
      else if (issue.type === "date")
        message = `Date must be ${issue.exact ? `exactly` : issue.inclusive ? `smaller than or equal to` : `smaller than`} ${new Date(Number(issue.maximum))}`;
      else
        message = "Invalid input";
      break;
    case ZodIssueCode.custom:
      message = `Invalid input`;
      break;
    case ZodIssueCode.invalid_intersection_types:
      message = `Intersection results could not be merged`;
      break;
    case ZodIssueCode.not_multiple_of:
      message = `Number must be a multiple of ${issue.multipleOf}`;
      break;
    case ZodIssueCode.not_finite:
      message = "Number must be finite";
      break;
    default:
      message = _ctx.defaultError;
      util.assertNever(issue);
  }
  return { message };
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
  errorUtil2.errToObj = (message) => typeof message === "string" ? { message } : message || {};
  errorUtil2.toString = (message) => typeof message === "string" ? message : message?.message;
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
    const { message } = params;
    if (iss.code === "invalid_enum_value") {
      return { message: message ?? ctx.defaultError };
    }
    if (typeof ctx.data === "undefined") {
      return { message: message ?? required_error ?? ctx.defaultError };
    }
    if (iss.code !== "invalid_type")
      return { message: ctx.defaultError };
    return { message: message ?? invalid_type_error ?? ctx.defaultError };
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
  refine(check, message) {
    const getIssueProperties = (val) => {
      if (typeof message === "string" || typeof message === "undefined") {
        return { message };
      } else if (typeof message === "function") {
        return message(val);
      } else {
        return message;
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
function isValidIP(ip, version) {
  if ((version === "v4" || !version) && ipv4Regex.test(ip)) {
    return true;
  }
  if ((version === "v6" || !version) && ipv6Regex.test(ip)) {
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
function isValidCidr(ip, version) {
  if ((version === "v4" || !version) && ipv4CidrRegex.test(ip)) {
    return true;
  }
  if ((version === "v6" || !version) && ipv6CidrRegex.test(ip)) {
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
  _regex(regex, validation, message) {
    return this.refinement((data) => regex.test(data), {
      validation,
      code: ZodIssueCode.invalid_string,
      ...errorUtil.errToObj(message)
    });
  }
  _addCheck(check) {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  email(message) {
    return this._addCheck({ kind: "email", ...errorUtil.errToObj(message) });
  }
  url(message) {
    return this._addCheck({ kind: "url", ...errorUtil.errToObj(message) });
  }
  emoji(message) {
    return this._addCheck({ kind: "emoji", ...errorUtil.errToObj(message) });
  }
  uuid(message) {
    return this._addCheck({ kind: "uuid", ...errorUtil.errToObj(message) });
  }
  nanoid(message) {
    return this._addCheck({ kind: "nanoid", ...errorUtil.errToObj(message) });
  }
  cuid(message) {
    return this._addCheck({ kind: "cuid", ...errorUtil.errToObj(message) });
  }
  cuid2(message) {
    return this._addCheck({ kind: "cuid2", ...errorUtil.errToObj(message) });
  }
  ulid(message) {
    return this._addCheck({ kind: "ulid", ...errorUtil.errToObj(message) });
  }
  base64(message) {
    return this._addCheck({ kind: "base64", ...errorUtil.errToObj(message) });
  }
  base64url(message) {
    return this._addCheck({
      kind: "base64url",
      ...errorUtil.errToObj(message)
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
  date(message) {
    return this._addCheck({ kind: "date", message });
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
  duration(message) {
    return this._addCheck({ kind: "duration", ...errorUtil.errToObj(message) });
  }
  regex(regex, message) {
    return this._addCheck({
      kind: "regex",
      regex,
      ...errorUtil.errToObj(message)
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
  startsWith(value, message) {
    return this._addCheck({
      kind: "startsWith",
      value,
      ...errorUtil.errToObj(message)
    });
  }
  endsWith(value, message) {
    return this._addCheck({
      kind: "endsWith",
      value,
      ...errorUtil.errToObj(message)
    });
  }
  min(minLength, message) {
    return this._addCheck({
      kind: "min",
      value: minLength,
      ...errorUtil.errToObj(message)
    });
  }
  max(maxLength, message) {
    return this._addCheck({
      kind: "max",
      value: maxLength,
      ...errorUtil.errToObj(message)
    });
  }
  length(len, message) {
    return this._addCheck({
      kind: "length",
      value: len,
      ...errorUtil.errToObj(message)
    });
  }
  /**
   * Equivalent to `.min(1)`
   */
  nonempty(message) {
    return this.min(1, errorUtil.errToObj(message));
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
  gte(value, message) {
    return this.setLimit("min", value, true, errorUtil.toString(message));
  }
  gt(value, message) {
    return this.setLimit("min", value, false, errorUtil.toString(message));
  }
  lte(value, message) {
    return this.setLimit("max", value, true, errorUtil.toString(message));
  }
  lt(value, message) {
    return this.setLimit("max", value, false, errorUtil.toString(message));
  }
  setLimit(kind, value, inclusive, message) {
    return new _ZodNumber({
      ...this._def,
      checks: [
        ...this._def.checks,
        {
          kind,
          value,
          inclusive,
          message: errorUtil.toString(message)
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
  int(message) {
    return this._addCheck({
      kind: "int",
      message: errorUtil.toString(message)
    });
  }
  positive(message) {
    return this._addCheck({
      kind: "min",
      value: 0,
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  negative(message) {
    return this._addCheck({
      kind: "max",
      value: 0,
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  nonpositive(message) {
    return this._addCheck({
      kind: "max",
      value: 0,
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  nonnegative(message) {
    return this._addCheck({
      kind: "min",
      value: 0,
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  multipleOf(value, message) {
    return this._addCheck({
      kind: "multipleOf",
      value,
      message: errorUtil.toString(message)
    });
  }
  finite(message) {
    return this._addCheck({
      kind: "finite",
      message: errorUtil.toString(message)
    });
  }
  safe(message) {
    return this._addCheck({
      kind: "min",
      inclusive: true,
      value: Number.MIN_SAFE_INTEGER,
      message: errorUtil.toString(message)
    })._addCheck({
      kind: "max",
      inclusive: true,
      value: Number.MAX_SAFE_INTEGER,
      message: errorUtil.toString(message)
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
  gte(value, message) {
    return this.setLimit("min", value, true, errorUtil.toString(message));
  }
  gt(value, message) {
    return this.setLimit("min", value, false, errorUtil.toString(message));
  }
  lte(value, message) {
    return this.setLimit("max", value, true, errorUtil.toString(message));
  }
  lt(value, message) {
    return this.setLimit("max", value, false, errorUtil.toString(message));
  }
  setLimit(kind, value, inclusive, message) {
    return new _ZodBigInt({
      ...this._def,
      checks: [
        ...this._def.checks,
        {
          kind,
          value,
          inclusive,
          message: errorUtil.toString(message)
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
  positive(message) {
    return this._addCheck({
      kind: "min",
      value: BigInt(0),
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  negative(message) {
    return this._addCheck({
      kind: "max",
      value: BigInt(0),
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  nonpositive(message) {
    return this._addCheck({
      kind: "max",
      value: BigInt(0),
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  nonnegative(message) {
    return this._addCheck({
      kind: "min",
      value: BigInt(0),
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  multipleOf(value, message) {
    return this._addCheck({
      kind: "multipleOf",
      value,
      message: errorUtil.toString(message)
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
  min(minDate, message) {
    return this._addCheck({
      kind: "min",
      value: minDate.getTime(),
      message: errorUtil.toString(message)
    });
  }
  max(maxDate, message) {
    return this._addCheck({
      kind: "max",
      value: maxDate.getTime(),
      message: errorUtil.toString(message)
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
  min(minLength, message) {
    return new _ZodArray({
      ...this._def,
      minLength: { value: minLength, message: errorUtil.toString(message) }
    });
  }
  max(maxLength, message) {
    return new _ZodArray({
      ...this._def,
      maxLength: { value: maxLength, message: errorUtil.toString(message) }
    });
  }
  length(len, message) {
    return new _ZodArray({
      ...this._def,
      exactLength: { value: len, message: errorUtil.toString(message) }
    });
  }
  nonempty(message) {
    return this.min(1, message);
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
  strict(message) {
    errorUtil.errToObj;
    return new _ZodObject({
      ...this._def,
      unknownKeys: "strict",
      ...message !== void 0 ? {
        errorMap: (issue, ctx) => {
          const defaultError = this._def.errorMap?.(issue, ctx).message ?? ctx.defaultError;
          if (issue.code === "unrecognized_keys")
            return {
              message: errorUtil.errToObj(message).message ?? defaultError
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
ZodUnion.create = (types, params) => {
  return new ZodUnion({
    options: types,
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
  min(minSize, message) {
    return new _ZodSet({
      ...this._def,
      minSize: { value: minSize, message: errorUtil.toString(message) }
    });
  }
  max(maxSize, message) {
    return new _ZodSet({
      ...this._def,
      maxSize: { value: maxSize, message: errorUtil.toString(message) }
    });
  }
  size(size, message) {
    return this.min(size, message).max(size, message);
  }
  nonempty(message) {
    return this.min(1, message);
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

// ../../packages/domain-distribution/src/statements.ts
function computeStatementBalance(statement, paymentLinks) {
  const paymentUnits = sumPaymentsForStatement(statement.id, statement.currency, paymentLinks);
  const amountDueUnits = parseErhAmount(statement.amountDue);
  const balanceUnits = erhMoney.sub(amountDueUnits, paymentUnits);
  return {
    statementId: statement.id,
    currency: statement.currency,
    amountDue: formatErhAmount(amountDueUnits),
    paymentsApplied: formatErhAmount(paymentUnits),
    statementBalance: formatErhAmount(balanceUnits)
  };
}
function sumPaymentsForStatement(statementId, currency, paymentLinks) {
  return paymentLinks.filter((link) => link.statementId === statementId && link.currency === currency).reduce((sum, link) => erhMoney.add(sum, parseErhAmount(link.amountApplied)), 0n);
}
function parseErhAmount(value) {
  return erhMoney.parse(value);
}
function formatErhAmount(value) {
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
    grossAmount: formatErhAmount2(parseErhAmount2(allocation.grossAmount)),
    grossShare: formatErhAmount2(parseErhAmount2(allocation.grossShare)),
    recoupmentApplied: formatErhAmount2(parseErhAmount2(allocation.recoupmentApplied)),
    netPayable: formatErhAmount2(parseErhAmount2(allocation.netPayable)),
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
    amount: formatErhAmount2(parseErhAmount2(item.amount)),
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
    grossTotal: formatErhAmount2(parseErhAmount2(statement.grossTotal)),
    recoupmentTotal: formatErhAmount2(parseErhAmount2(statement.recoupmentTotal)),
    netPayable: formatErhAmount2(parseErhAmount2(statement.netPayable)),
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
    current.amountUnits = erhMoney.add(current.amountUnits, parseErhAmount2(row.amount));
    current.grossShareUnits = erhMoney.add(current.grossShareUnits, parseErhAmount2(row.grossShare));
    current.recoupmentAppliedUnits = erhMoney.add(current.recoupmentAppliedUnits, parseErhAmount2(row.recoupmentApplied));
    totals.set(row.currency, current);
  }
  return [...totals.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([currency, total]) => ({
    currency,
    amount: formatErhAmount2(total.amountUnits),
    grossShare: formatErhAmount2(total.grossShareUnits),
    recoupmentApplied: formatErhAmount2(total.recoupmentAppliedUnits)
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
    totals.set(row.currency, erhMoney.add(current, parseErhAmount2(row.amount)));
  }
  return [...totals.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([currency, amountUnits]) => ({
    currency,
    amount: formatErhAmount2(amountUnits)
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
    current.grossTotalUnits = erhMoney.add(current.grossTotalUnits, parseErhAmount2(row.grossTotal));
    current.recoupmentTotalUnits = erhMoney.add(current.recoupmentTotalUnits, parseErhAmount2(row.recoupmentTotal));
    current.netPayableUnits = erhMoney.add(current.netPayableUnits, parseErhAmount2(row.netPayable));
    current.amountDueUnits = erhMoney.add(current.amountDueUnits, parseErhAmount2(row.amountDue));
    current.statementBalanceUnits = erhMoney.add(current.statementBalanceUnits, parseErhAmount2(row.statementBalance));
    totals.set(row.currency, current);
  }
  return [...totals.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([currency, total]) => ({
    currency,
    grossTotal: formatErhAmount2(total.grossTotalUnits),
    recoupmentTotal: formatErhAmount2(total.recoupmentTotalUnits),
    netPayable: formatErhAmount2(total.netPayableUnits),
    amountDue: formatErhAmount2(total.amountDueUnits),
    statementBalance: formatErhAmount2(total.statementBalanceUnits)
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
function parseErhAmount2(value) {
  return erhMoney.parse(value);
}
function formatErhAmount2(value) {
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

// src/index.ts
var ApiRouteError = class extends Error {
  status;
  code;
  context;
  constructor(status, code, message, context) {
    super(message);
    this.name = "ApiRouteError";
    this.status = status;
    this.code = code;
    this.context = context;
  }
};
function createApiService(dependencies) {
  const app = new Hono2();
  app.onError((error, context) => {
    if (error instanceof ApiRouteError) {
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
  registerOfficeRoutes(app, dependencies);
  registerDistributionRoutes(app, dependencies);
  return app;
}
function registerOfficeRoutes(app, dependencies) {
  app.get("/eof/v1/dashboard", (context) => {
    const period = requireQuery(context, "period");
    requireQuery(context, "workspaceId");
    const filters = filtersForPeriod(period, null);
    const dashboard = readOfficeDashboardFull(dependencies.fixtures.office, period, filters, ["2026-02"]);
    const response = {
      period,
      cashBalanceMicro: dashboard.cashRunway.cashBalanceMur,
      receivablesMicro: dashboard.pnl.income,
      payablesMicro: dashboard.pnl.expense,
      unreconciledTransactionCount: dashboard.bankQuality.unmatchedLineCount,
      lastAuditEventId: dependencies.fixtures.officeAuditLog[0]?.id ?? null,
      recentImports: dependencies.fixtures.office.bankImportBatches.map((batch) => ({
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
    const period = requireQuery(context, "period");
    requireQuery(context, "workspaceId");
    const response = toOfficeGlobalPnl(dependencies.fixtures.office, period);
    return context.json(response);
  });
  app.get("/eof/v1/pl/department/:departmentId", (context) => {
    const period = requireQuery(context, "period");
    requireQuery(context, "workspaceId");
    const departmentId = context.req.param("departmentId");
    const response = toOfficeDepartmentPnl(dependencies.fixtures.office, departmentId, period);
    return context.json(response);
  });
  app.get("/eof/v1/transactions", (context) => {
    requireQuery(context, "workspaceId");
    const transactions = dependencies.fixtures.office.transactions.map((transaction) => toOfficeTransaction(dependencies.fixtures.office, transaction)).filter((transaction) => matchesOfficeTransactionQuery(context, transaction));
    return context.json(pageItems(context, transactions));
  });
  app.post("/eof/v1/transactions", async (context) => {
    const idempotencyKey = requireIdempotencyKey(context);
    await readJsonBody(context);
    return context.json(createMutationReceipt("office_transaction", idempotencyKey));
  });
  app.patch("/eof/v1/transactions/:transactionId", async (context) => {
    const idempotencyKey = requireIdempotencyKey(context);
    await readJsonBody(context);
    return context.json(createMutationReceipt(context.req.param("transactionId"), idempotencyKey));
  });
  app.get("/eof/v1/plan-comptable", (context) => {
    requireQuery(context, "workspaceId");
    const includeInactive = queryBoolean(context, "includeInactive");
    return context.json(toPlanComptableNodes(dependencies.fixtures.office, includeInactive));
  });
  app.post("/eof/v1/plan-comptable", async (context) => {
    const idempotencyKey = requireIdempotencyKey(context);
    await readJsonBody(context);
    return context.json(createMutationReceipt("office_plan_comptable", idempotencyKey));
  });
  app.patch("/eof/v1/plan-comptable/:nodeId", async (context) => {
    const idempotencyKey = requireIdempotencyKey(context);
    await readJsonBody(context);
    return context.json(createMutationReceipt(context.req.param("nodeId"), idempotencyKey));
  });
  app.post("/eof/v1/bank-import/preview", async (context) => {
    const idempotencyKey = requireIdempotencyKey(context);
    const request = await readJsonBody(context);
    const response = {
      previewId: `bank_preview_${sanitizeId(idempotencyKey)}`,
      source: request.source,
      detectedFormat: `${request.source}_fixture`,
      accountReference: request.source === "cashflow" ? null : "bank_mur",
      periodLabel: "2026-02",
      currencyCodes: ["MUR"],
      openingBalanceMicro: null,
      closingBalanceMicro: null,
      idempotencyFingerprint: request.checksum,
      acceptedRowCount: request.rows.length,
      rejectedRowCount: 0,
      duplicateRowCount: 0,
      parsingNotes: ["Fixture preview only; no import state was mutated."],
      warnings: []
    };
    return context.json(response);
  });
  app.post("/eof/v1/bank-import/confirm", async (context) => {
    const idempotencyKey = requireIdempotencyKey(context);
    const request = await readJsonBody(context);
    const receipt = createMutationReceipt(request.previewId, idempotencyKey);
    const response = {
      ...receipt,
      importedTransactionCount: request.acceptedRowIds.length
    };
    return context.json(response);
  });
  app.get("/eof/v1/reconciliations", (context) => {
    requireQuery(context, "workspaceId");
    return context.json(pageItems(context, toReconciliationCandidates(dependencies.fixtures.office).filter((candidate) => matchesReconciliationQuery(context, candidate))));
  });
  app.post("/eof/v1/reconciliations/approve", async (context) => {
    const idempotencyKey = requireIdempotencyKey(context);
    await readJsonBody(context);
    return context.json(createMutationReceipt("office_reconciliation_batch", idempotencyKey));
  });
  app.get("/eof/v1/cashflow", (context) => {
    const from = requireQuery(context, "from");
    const to = requireQuery(context, "to");
    requireQuery(context, "workspaceId");
    const accountId = nullableQuery(context, "accountId");
    const buckets = readOfficeCashflowProjection(dependencies.fixtures.office, from, to, accountId);
    return context.json(toCashflowBuckets(buckets));
  });
  app.get("/eof/v1/audit-log", (context) => {
    requireQuery(context, "workspaceId");
    return context.json(pageItems(context, dependencies.fixtures.officeAuditLog.filter((entry) => matchesAuditQuery(context, entry))));
  });
  app.get("/eof/v1/partners", (context) => {
    const period = requireQuery(context, "period");
    const facet = requirePartnerFacet(context);
    requireQuery(context, "workspaceId");
    const partners = dependencies.fixtures.office.partners.map((partner) => toPartnerListItem(dependencies.fixtures, partner, period)).filter((partner) => hasFacetActivity(partner, facet));
    return context.json(pageItems(context, partners));
  });
  app.get("/eof/v1/partners/:partnerId", (context) => {
    requireQuery(context, "workspaceId");
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
    const period = requireQuery(context, "period");
    requireQuery(context, "workspaceId");
    const partner = requirePartner2(dependencies.fixtures.office, context.req.param("partnerId"));
    const response = toPartnerDetail(dependencies.fixtures, partner, period);
    return context.json(response);
  });
  app.get("/eof/v1/classification/suggestions/:partnerId", (context) => {
    requireQuery(context, "workspaceId");
    return context.json(dependencies.fixtures.officeClassificationSuggestions[context.req.param("partnerId")] ?? []);
  });
  app.get("/eof/v1/partners/:partnerId/payee-link", (context) => {
    requireQuery(context, "workspaceId");
    const partner = requirePartner2(dependencies.fixtures.office, context.req.param("partnerId"));
    return context.json(toPartnerPayeeLink(dependencies.fixtures, partner));
  });
  app.post("/eof/v1/partners", async (context) => {
    const idempotencyKey = requireIdempotencyKey(context);
    await readJsonBody(context);
    return context.json(createMutationReceipt("office_partner", idempotencyKey));
  });
  app.patch("/eof/v1/partners/:partnerId", async (context) => {
    const idempotencyKey = requireIdempotencyKey(context);
    await readJsonBody(context);
    return context.json(createMutationReceipt(context.req.param("partnerId"), idempotencyKey));
  });
  app.post("/eof/v1/partners/:partnerId/payee-link", async (context) => {
    const idempotencyKey = requireIdempotencyKey(context);
    await readJsonBody(context);
    return context.json(createMutationReceipt(`${context.req.param("partnerId")}_payee_link`, idempotencyKey));
  });
  app.patch("/eof/v1/partners/:partnerId/payee-link", async (context) => {
    const idempotencyKey = requireIdempotencyKey(context);
    await readJsonBody(context);
    return context.json(createMutationReceipt(`${context.req.param("partnerId")}_payee_unlink`, idempotencyKey));
  });
  app.get("/eof/v1/projects", (context) => {
    requireQuery(context, "workspaceId");
    const status = nullableQuery(context, "status");
    const projects = dependencies.fixtures.office.projects.map((project) => toProjectSummary(dependencies.fixtures.office, project, "2026-02")).filter((project) => status === null || project.status === status);
    return context.json(pageItems(context, projects));
  });
  app.get("/eof/v1/projects/:projectId/coherence-violations", (context) => {
    requireQuery(context, "workspaceId");
    const violations = dependencies.fixtures.officeProjectViolations[context.req.param("projectId")] ?? [];
    return context.json(pageItems(context, violations));
  });
  app.get("/eof/v1/pl/project/:projectId", (context) => {
    const period = requireQuery(context, "period");
    requireQuery(context, "workspaceId");
    return context.json(toProjectPnl(dependencies.fixtures.office, context.req.param("projectId"), period));
  });
  app.get("/eof/v1/integrity/check-all", (context) => {
    requireQuery(context, "workspaceId");
    return context.json(toOfficeIntegrity(dependencies.fixtures.office, dependencies.nowIso()));
  });
  app.get("/eof/v1/analytics/bank-quality", (context) => {
    const period = requireQuery(context, "period");
    requireQuery(context, "workspaceId");
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
    const idempotencyKey = requireIdempotencyKey(context);
    const request = await readJsonBody(context);
    const response = {
      previewId: `distribution_preview_${sanitizeId(idempotencyKey)}`,
      source: request.source,
      statementReference: request.checksum,
      accountReference: request.source,
      acceptedRowCount: request.rows.length,
      rejectedRowCount: 0,
      unmappedRowCount: 0,
      payableMicro: "0.0000000000",
      currencyCodes: ["USD"],
      joinKeys: ["isrc", "upc", "rawTitle", "rawArtist"],
      idempotencyFingerprint: request.checksum,
      warnings: ["Fixture preview only; no royalty import state was mutated."]
    };
    return context.json(response);
  });
  app.post("/erh/v1/imports/confirm", async (context) => {
    const idempotencyKey = requireIdempotencyKey(context);
    const request = await readJsonBody(context);
    const receipt = createMutationReceipt(request.previewId, idempotencyKey);
    const response = {
      ...receipt,
      importedRoyaltyEventCount: request.acceptedRowIds.length
    };
    return context.json(response);
  });
  app.get("/erh/v1/mapping/rows", (context) => {
    requireQuery(context, "workspaceId");
    const batchId = nullableQuery(context, "batchId");
    const status = nullableQuery(context, "status");
    const rows = dependencies.fixtures.distributionMappingRows.filter((row) => batchId === null || row.batchId === batchId).filter((row) => status === null || row.status === status);
    return context.json(pageItems(context, rows));
  });
  app.post("/erh/v1/mapping/apply-rules", async (context) => {
    const idempotencyKey = requireIdempotencyKey(context);
    const request = await readJsonBody(context);
    return context.json(createMutationReceipt(request.batchId, idempotencyKey));
  });
  app.get("/erh/v1/contracts", (context) => {
    requireQuery(context, "workspaceId");
    const payeeId = nullableQuery(context, "payeeId");
    const status = nullableQuery(context, "status");
    const contracts = dependencies.fixtures.distributionContracts.filter((contract) => payeeId === null || contract.payeeId === payeeId).filter((contract) => status === null || contract.status === status);
    return context.json(pageItems(context, contracts));
  });
  app.get("/erh/v1/contracts/:contractId/expenses", (context) => {
    requireQuery(context, "workspaceId");
    const status = nullableQuery(context, "status");
    const contractId = context.req.param("contractId");
    const expenses = dependencies.fixtures.distributionContractExpenses.filter((expense) => expense.contractId === contractId).filter((expense) => status === null || expense.status === status);
    return context.json(pageItems(context, expenses));
  });
  app.post("/erh/v1/contracts/:contractId/expenses", async (context) => {
    const idempotencyKey = requireIdempotencyKey(context);
    await readJsonBody(context);
    return context.json(createMutationReceipt(`${context.req.param("contractId")}_expense`, idempotencyKey));
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
  app.get("/erh/v1/releases", (context) => {
    requireQuery(context, "workspaceId");
    const releases = toReleaseSummaries(dependencies.fixtures.distribution);
    return context.json(pageItems(context, releases));
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
    const idempotencyKey = requireIdempotencyKey(context);
    const request = await readJsonBody(context);
    return context.json(createRunReceipt(`preview_${sanitizeId(idempotencyKey)}`, "completed", request.lockKey, idempotencyKey));
  });
  app.post("/erh/v1/allocations/runs", async (context) => {
    const idempotencyKey = requireIdempotencyKey(context);
    const request = await readJsonBody(context);
    return context.json(createRunReceipt(`run_${sanitizeId(idempotencyKey)}`, "queued", request.lockKey, idempotencyKey));
  });
  app.post("/erh/v1/allocations/runs/:runId/unpost", async (context) => {
    const idempotencyKey = requireIdempotencyKey(context);
    const request = await readJsonBody(context);
    return context.json(createRunReceipt(context.req.param("runId"), "queued", request.lockToken, idempotencyKey));
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
    const idempotencyKey = requireIdempotencyKey(context);
    await readJsonBody(context);
    return context.json(createMutationReceipt(context.req.param("suspenseId"), idempotencyKey));
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
  app.post("/erh/v1/statements/generate", async (context) => {
    const idempotencyKey = requireIdempotencyKey(context);
    const request = await readJsonBody(context);
    return context.json(createRunReceipt(`statement_${sanitizeId(idempotencyKey)}`, "queued", request.lockKey, idempotencyKey));
  });
  app.get("/erh/v1/payments", (context) => {
    requireQuery(context, "workspaceId");
    const payeeId = nullableQuery(context, "payeeId");
    const status = nullableQuery(context, "status");
    const payments = toPaymentSummaries(dependencies.fixtures.distribution).filter((payment) => payeeId === null || payment.payeeId === payeeId).filter((payment) => status === null || payment.status === status);
    return context.json(pageItems(context, payments));
  });
  app.post("/erh/v1/payments", async (context) => {
    const idempotencyKey = requireIdempotencyKey(context);
    await readJsonBody(context);
    return context.json(createMutationReceipt("distribution_payment_record", idempotencyKey));
  });
  app.patch("/erh/v1/payments/:paymentId", async (context) => {
    const idempotencyKey = requireIdempotencyKey(context);
    await readJsonBody(context);
    return context.json(createMutationReceipt(context.req.param("paymentId"), idempotencyKey));
  });
  app.post("/erh/v1/payments/:paymentId/reconcile", async (context) => {
    const idempotencyKey = requireIdempotencyKey(context);
    await readJsonBody(context);
    return context.json(createMutationReceipt(`${context.req.param("paymentId")}_reconciliation`, idempotencyKey));
  });
  app.get("/erh/v1/revenue", (context) => {
    requireQuery(context, "workspaceId");
    const groupBy = nullableQuery(context, "groupBy") ?? "payee";
    const rows = toRevenueRows(dependencies.fixtures.distribution, groupBy);
    return context.json(pageItems(context, rows));
  });
}
function createErrorPayload(code, message, context) {
  return {
    error: {
      code,
      message,
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
function nullableQuery(context, key) {
  const value = context.req.query(key);
  if (value === void 0 || value.trim().length === 0) {
    return null;
  }
  return value;
}
function queryBoolean(context, key) {
  const value = nullableQuery(context, key);
  return value === "true" || value === "1";
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
  const cursor = nullableQuery(context, "cursor");
  const limitText = nullableQuery(context, "limit");
  const parsedOffset = cursor === null ? 0 : parsePositiveInteger(cursor, "cursor");
  const parsedLimit = limitText === null ? 50 : parsePositiveInteger(limitText, "limit");
  const limit = parsedLimit > 100 ? 100 : parsedLimit;
  return {
    cursor,
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
  return {
    id: run.id,
    period: "2026-04",
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
function createMutationReceipt(entityId, idempotencyKey) {
  const sanitized = sanitizeId(idempotencyKey);
  return {
    id: entityId,
    status: "accepted",
    auditEventId: `audit_${sanitized}`
  };
}
function createRunReceipt(runId, status, lockKey, idempotencyKey) {
  return {
    runId,
    status,
    lockKey,
    auditEventId: `audit_${sanitizeId(idempotencyKey)}`
  };
}
function sanitizeId(value) {
  const sanitized = value.replace(/[^A-Za-z0-9_:-]/g, "_");
  return sanitized.length === 0 ? "empty" : sanitized;
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
import { Pool } from "pg";
async function createPostgresApiRuntime(env) {
  const pool = createPostgresPool(env);
  try {
    const fixtures = await readApiFixtureStoreFromPostgres(pool);
    return {
      fixtures,
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
  return new Pool({
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
  return {
    office,
    officeAuditLog: [],
    officeClassificationSuggestions: emptyRecord(),
    officePartnerPayeeLinks: buildPartnerPayeeLinks(office.partners, distribution.payees),
    officeProjectViolations: emptyRecord(),
    distribution,
    distributionContracts,
    distributionContractExpenses,
    distributionMappingRows
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
  const bankAccounts = await queryRows(pool, "select id::text, workspace_id, currency, current_balance_minor::text, current_balance_mur_minor::text, is_active, balance_as_of from office_bank_accounts order by legacy_id nulls last, id", []);
  const bankImportBatches = await queryRows(
    pool,
    "select id::text, workspace_id, source, account_id::text, period_start, period_end, accepted_row_count, rejected_row_count, duplicate_row_count, status, imported_at from office_bank_import_batches order by legacy_id nulls last, id",
    []
  );
  const bankStatementLines = await queryRows(
    pool,
    "select id::text, import_batch_id::text, account_id::text, occurred_on, reference, amount_minor::text, currency, amount_mur_minor::text, is_duplicate_candidate, reconciliation_status, matched_transaction_id::text from office_bank_statement_lines order by occurred_on, id",
    []
  );
  const bankReconciliationMatches = await queryRows(pool, "select id::text, bank_statement_line_id::text, transaction_id::text, confidence_bp, status, approved_at from office_bank_reconciliation_matches order by legacy_id nulls last, id", []);
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
    accountId: nullableStringCell(row, "account_id"),
    periodStart: nullableDateCell(row, "period_start"),
    periodEnd: nullableDateCell(row, "period_end"),
    acceptedRowCount: numberCell(row, "accepted_row_count"),
    rejectedRowCount: numberCell(row, "rejected_row_count"),
    duplicateRowCount: numberCell(row, "duplicate_row_count"),
    status: enumCell(row, "status", ["previewed", "confirmed", "failed", "void"]),
    importedAt: nullableTimestampCell(row, "imported_at")
  };
}
function toOfficeBankStatementLine(row) {
  return {
    id: stringCell(row, "id"),
    importBatchId: stringCell(row, "import_batch_id"),
    accountId: stringCell(row, "account_id"),
    occurredOn: dateCell(row, "occurred_on"),
    reference: nullableStringCell(row, "reference"),
    amountMinor: bigintCell(row, "amount_minor"),
    currency: currencyCell(row, "currency"),
    amountMurMinor: bigintCell(row, "amount_mur_minor"),
    isDuplicateCandidate: booleanCell(row, "is_duplicate_candidate"),
    reconciliationStatus: enumCell(row, "reconciliation_status", ["unmatched", "suggested", "matched", "rejected"]),
    matchedTransactionId: nullableStringCell(row, "matched_transaction_id")
  };
}
function toOfficeBankReconciliationMatch(row) {
  return {
    id: stringCell(row, "id"),
    bankStatementLineId: stringCell(row, "bank_statement_line_id"),
    transactionId: stringCell(row, "transaction_id"),
    confidenceBp: numberCell(row, "confidence_bp"),
    status: enumCell(row, "status", ["unmatched", "suggested", "matched", "rejected"]),
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
function buildPartnerPayeeLinks(partners, payees) {
  const links = {};
  for (const partner of partners) {
    const payee = payees.find((candidate) => candidate.name.trim().toLowerCase() === partner.name.trim().toLowerCase());
    if (payee === void 0) {
      continue;
    }
    links[partner.id] = {
      partnerId: partner.id,
      partnerName: partner.name,
      payeeId: payee.id,
      payeeName: payee.name,
      resolution: "name_exact",
      status: payee.isActive ? "active" : "inactive",
      source: "postgres-shadow",
      confidence: "100.000000"
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
async function queryRows(pool, sql, values) {
  const result = await pool.query(sql, values);
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
    health: runtime.health,
    nowIso: () => (/* @__PURE__ */ new Date()).toISOString()
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
  Readable.fromWeb(honoResponse.body).pipe(response);
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
