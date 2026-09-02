"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var csrf_exports = {};
__export(csrf_exports, {
  parseCsrfState: () => parseCsrfState
});
module.exports = __toCommonJS(csrf_exports);
function extractIdkObject(html) {
  const marker = html.indexOf("window._IDK");
  if (marker === -1) {
    throw new Error("CSRF data not found in login page");
  }
  const equals = html.indexOf("=", marker);
  const start = html.indexOf("{", equals);
  if (start === -1) {
    throw new Error("CSRF object not found in login page");
  }
  let depth = 0;
  let inString = null;
  let escape = false;
  for (let i = start; i < html.length; i++) {
    const ch = html[i];
    if (inString) {
      if (escape) {
        escape = false;
      } else if (ch === "\\") {
        escape = true;
      } else if (ch === inString) {
        inString = null;
      }
      continue;
    }
    if (ch === '"' || ch === "'") {
      inString = ch;
      continue;
    }
    if (ch === "{") {
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0) {
        return html.slice(start, i + 1);
      }
    }
  }
  throw new Error("CSRF object unterminated in login page");
}
function extractQuotedField(source, name) {
  var _a;
  const quoted = new RegExp(`['"]?${name}['"]?\\s*:\\s*['"]([^'"]+)['"]`);
  const quotedMatch = quoted.exec(source);
  if (quotedMatch == null ? void 0 : quotedMatch[1]) {
    return quotedMatch[1];
  }
  const unquoted = new RegExp(`['"]?${name}['"]?\\s*:\\s*([A-Za-z0-9_-]+)`);
  return (_a = unquoted.exec(source)) == null ? void 0 : _a[1];
}
function parseCsrfState(html) {
  const raw = extractIdkObject(html);
  const csrf = extractQuotedField(raw, "csrf_token");
  const hmac = extractQuotedField(raw, "hmac");
  const relayState = extractQuotedField(raw, "relayState");
  if (!csrf || !hmac || !relayState) {
    throw new Error("Failed to parse CSRF information from login page");
  }
  return { csrf, hmac, relayState };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  parseCsrfState
});
//# sourceMappingURL=csrf.js.map
