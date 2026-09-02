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
var const_exports = {};
__export(const_exports, {
  BASE_URL_IDENT: () => BASE_URL_IDENT,
  BASE_URL_SKODA: () => BASE_URL_SKODA,
  CLIENT_ID: () => CLIENT_ID,
  DEFAULT_POLL_INTERVAL: () => DEFAULT_POLL_INTERVAL,
  GARAGE_PATH: () => GARAGE_PATH,
  MAX_AUTH_REDIRECTS: () => MAX_AUTH_REDIRECTS,
  MAX_POLL_INTERVAL: () => MAX_POLL_INTERVAL,
  MAX_TOKEN_RETRIES: () => MAX_TOKEN_RETRIES,
  MIN_POLL_INTERVAL: () => MIN_POLL_INTERVAL,
  OIDC_SCOPE: () => OIDC_SCOPE,
  REDIRECT_URI: () => REDIRECT_URI,
  STATUS_LABELS: () => STATUS_LABELS,
  USER_AGENT: () => USER_AGENT,
  clampPollInterval: () => clampPollInterval
});
module.exports = __toCommonJS(const_exports);
const CLIENT_ID = "7f045eee-7003-4379-9968-9355ed2adb06@apps_vw-dilab_com";
const REDIRECT_URI = "myskoda://redirect/login/";
const BASE_URL_SKODA = "https://mysmob.api.connect.skoda-auto.cz";
const BASE_URL_IDENT = "https://identity.vwgroup.io";
const GARAGE_PATH = "/v2/garage?connectivityGenerations=MOD1&connectivityGenerations=MOD2&connectivityGenerations=MOD3&connectivityGenerations=MOD4";
const DEFAULT_POLL_INTERVAL = 3600;
const MIN_POLL_INTERVAL = 900;
const MAX_POLL_INTERVAL = 86400;
const MAX_TOKEN_RETRIES = 5;
const MAX_AUTH_REDIRECTS = 20;
const OIDC_SCOPE = "address badge birthdate cars driversLicense dealers email mileage mbb nationalIdentifier openid phone profession profile vin";
const USER_AGENT = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36";
const STATUS_LABELS = {
  ORDER_CONFIRMED: "Best\xE4tigt",
  IN_PRODUCTION: "In Produktion",
  IN_DELIVERY: "Unterwegs",
  TO_HANDOVER: "Zur \xDCbergabe"
};
function clampPollInterval(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return DEFAULT_POLL_INTERVAL;
  }
  return Math.min(MAX_POLL_INTERVAL, Math.max(MIN_POLL_INTERVAL, Math.round(n)));
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  BASE_URL_IDENT,
  BASE_URL_SKODA,
  CLIENT_ID,
  DEFAULT_POLL_INTERVAL,
  GARAGE_PATH,
  MAX_AUTH_REDIRECTS,
  MAX_POLL_INTERVAL,
  MAX_TOKEN_RETRIES,
  MIN_POLL_INTERVAL,
  OIDC_SCOPE,
  REDIRECT_URI,
  STATUS_LABELS,
  USER_AGENT,
  clampPollInterval
});
//# sourceMappingURL=const.js.map
