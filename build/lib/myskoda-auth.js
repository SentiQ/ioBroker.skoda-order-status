"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
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
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var myskoda_auth_exports = {};
__export(myskoda_auth_exports, {
  MySkodaAuth: () => MySkodaAuth
});
module.exports = __toCommonJS(myskoda_auth_exports);
var import_node_crypto = require("node:crypto");
var import_fetch_cookie = __toESM(require("fetch-cookie"));
var import_node_fetch = __toESM(require("node-fetch"));
var import_tough_cookie = require("tough-cookie");
var import_const = require("./const");
var import_csrf = require("./csrf");
var import_errors = require("./errors");
function generateNonce() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const bytes = (0, import_node_crypto.randomBytes)(16);
  let result = "";
  for (const byte of bytes) {
    result += chars[byte % chars.length];
  }
  return result;
}
function pkceChallenge(verifier) {
  return (0, import_node_crypto.createHash)("sha256").update(verifier, "utf8").digest("base64url");
}
function decodeJwtPayload(token) {
  const payload = token.split(".")[1];
  if (!payload) {
    return {};
  }
  const padded = payload.replace(/-/g, "+").replace(/_/g, "/");
  return JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
}
function isJwtExpired(token, skewMinutes) {
  const meta = decodeJwtPayload(token);
  const expiry = typeof meta.exp === "number" ? meta.exp * 1e3 : 0;
  return Date.now() + skewMinutes * 6e4 >= expiry;
}
function appPrefix(redirectUri) {
  const splitStr = "://";
  const idx = redirectUri.indexOf(splitStr);
  if (idx === -1) {
    throw new import_errors.SkodaOrderAuthError("Invalid redirect URI");
  }
  return redirectUri.slice(0, idx);
}
function resolveLocation(location, currentUrl) {
  return new URL(location, currentUrl).href;
}
async function readJson(response) {
  const text = await response.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new import_errors.SkodaOrderAuthError(`Failed to parse token response: ${error.message}`);
  }
  const accessToken = parsed.accessToken;
  const refreshToken = parsed.refreshToken;
  if (typeof accessToken !== "string" || typeof refreshToken !== "string") {
    throw new import_errors.SkodaOrderAuthError("Token response did not contain accessToken/refreshToken");
  }
  return {
    accessToken,
    refreshToken,
    idToken: typeof parsed.idToken === "string" ? parsed.idToken : void 0
  };
}
class MySkodaAuth {
  fetchFn;
  jar;
  email;
  password;
  session = null;
  refreshLock = Promise.resolve();
  constructor() {
    this.jar = new import_tough_cookie.CookieJar();
    this.fetchFn = (0, import_fetch_cookie.default)(import_node_fetch.default, this.jar);
  }
  getRefreshToken() {
    var _a;
    return (_a = this.session) == null ? void 0 : _a.refreshToken;
  }
  async authorize(email, password) {
    this.email = email;
    this.password = password;
    this.session = await this.getIdkSession();
  }
  async authorizeRefreshToken(refreshToken) {
    if (isJwtExpired(refreshToken, 1)) {
      throw new import_errors.SkodaOrderAuthError("Refresh token has expired. Please authorize using username/password.");
    }
    await this.withRefreshLock(async () => {
      const response = await this.fetchFn(
        `${import_const.BASE_URL_SKODA}/api/v1/authentication/refresh-token?tokenType=CONNECT`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "user-agent": import_const.USER_AGENT
          },
          body: JSON.stringify({ token: refreshToken })
        }
      );
      if (!response.ok) {
        throw new import_errors.SkodaOrderAuthError(`Refresh token authorization failed with status ${response.status}`);
      }
      this.session = await readJson(response);
    });
  }
  async getAccessToken() {
    if (!this.session) {
      throw new import_errors.SkodaOrderAuthError("Not authorized");
    }
    if (isJwtExpired(this.session.accessToken, 10)) {
      await this.refreshTokens();
    }
    if (!this.session) {
      throw new import_errors.SkodaOrderAuthError("Not authorized");
    }
    return this.session.accessToken;
  }
  async refreshTokens() {
    await this.withRefreshLock(async () => {
      if (!this.session) {
        throw new import_errors.SkodaOrderAuthError("Not authorized");
      }
      if (!isJwtExpired(this.session.accessToken, 10)) {
        return;
      }
      for (let attempt = 0; attempt < import_const.MAX_TOKEN_RETRIES; attempt++) {
        if (await this.performRefreshToken()) {
          return;
        }
      }
      if (this.email && this.password) {
        this.session = await this.getIdkSession();
        return;
      }
      throw new import_errors.SkodaOrderAuthError("Refreshing token failed");
    });
  }
  async performRefreshToken() {
    if (!this.session) {
      return false;
    }
    try {
      const response = await this.fetchFn(
        `${import_const.BASE_URL_SKODA}/api/v1/authentication/refresh-token?tokenType=CONNECT`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "user-agent": import_const.USER_AGENT
          },
          body: JSON.stringify({ token: this.session.refreshToken })
        }
      );
      if (!response.ok) {
        return false;
      }
      this.session = await readJson(response);
      return true;
    } catch {
      return false;
    }
  }
  async getIdkSession() {
    if (!this.email || !this.password) {
      throw new import_errors.SkodaOrderAuthError("Email and password are required");
    }
    const verifier = generateNonce();
    const loginMeta = await this.initialOidcAuthorize(verifier);
    const passwordMeta = await this.enterEmailAddress(loginMeta);
    const code = await this.enterPassword(passwordMeta);
    return this.exchangeAuthCode(code, verifier);
  }
  async initialOidcAuthorize(verifier) {
    const challenge = pkceChallenge(verifier);
    const params = new URLSearchParams({
      client_id: import_const.CLIENT_ID,
      nonce: generateNonce(),
      redirect_uri: import_const.REDIRECT_URI,
      response_type: "code",
      scope: import_const.OIDC_SCOPE,
      code_challenge: challenge,
      code_challenge_method: "s256",
      prompt: "login"
    });
    const response = await this.fetchFn(`${import_const.BASE_URL_IDENT}/oidc/v1/authorize?${params.toString()}`, {
      headers: { "user-agent": import_const.USER_AGENT, accept: "text/html" }
    });
    if (!response.ok) {
      throw new import_errors.SkodaOrderAuthError(`OIDC authorize failed with status ${response.status}`);
    }
    return (0, import_csrf.parseCsrfState)(await response.text());
  }
  async enterEmailAddress(csrf) {
    const body = new URLSearchParams({
      relayState: csrf.relayState,
      email: this.email,
      hmac: csrf.hmac,
      _csrf: csrf.csrf
    });
    const response = await this.fetchFn(`${import_const.BASE_URL_IDENT}/signin-service/v1/${import_const.CLIENT_ID}/login/identifier`, {
      method: "POST",
      headers: {
        "user-agent": import_const.USER_AGENT,
        accept: "text/html",
        "content-type": "application/x-www-form-urlencoded"
      },
      body
    });
    if (!response.ok) {
      throw new import_errors.SkodaOrderAuthError(`Email login step failed with status ${response.status}`);
    }
    return (0, import_csrf.parseCsrfState)(await response.text());
  }
  async enterPassword(csrf) {
    const body = new URLSearchParams({
      relayState: csrf.relayState,
      email: this.email,
      password: this.password,
      hmac: csrf.hmac,
      _csrf: csrf.csrf
    });
    const startUrl = `${import_const.BASE_URL_IDENT}/signin-service/v1/${import_const.CLIENT_ID}/login/authenticate`;
    const authResponse = await this.fetchFn(startUrl, {
      method: "POST",
      headers: {
        "user-agent": import_const.USER_AGENT,
        accept: "text/html",
        "content-type": "application/x-www-form-urlencoded"
      },
      body,
      redirect: "manual"
    });
    let location = authResponse.headers.get("location");
    if (!location) {
      throw new import_errors.SkodaOrderAuthError(
        `Password login failed with status ${authResponse.status} (no redirect). Credentials may be incorrect.`
      );
    }
    let currentUrl = startUrl;
    const prefix = appPrefix(import_const.REDIRECT_URI);
    let hops = 0;
    while (!location.startsWith(prefix)) {
      hops++;
      if (hops > import_const.MAX_AUTH_REDIRECTS) {
        throw new import_errors.SkodaOrderAuthError("Too many redirects during login");
      }
      const absolute = resolveLocation(location, currentUrl);
      if (absolute.includes("terms-and-conditions")) {
        throw new import_errors.TermsAndConditionsError(absolute);
      }
      if (absolute.includes("consent/marketing")) {
        throw new import_errors.MarketingConsentError(absolute);
      }
      const response = await this.fetchFn(absolute, {
        headers: { "user-agent": import_const.USER_AGENT, accept: "text/html" },
        redirect: "manual"
      });
      const next = response.headers.get("location");
      if (!next) {
        throw new import_errors.SkodaOrderAuthError(`Login redirect chain stopped with status ${response.status}`);
      }
      currentUrl = absolute;
      location = next;
    }
    const finalUrl = resolveLocation(location, currentUrl);
    const code = new URL(finalUrl).searchParams.get("code");
    if (!code) {
      throw new import_errors.SkodaOrderAuthError(`Failed to extract authorization code from ${finalUrl}`);
    }
    return code;
  }
  async exchangeAuthCode(code, verifier) {
    const response = await this.fetchFn(
      `${import_const.BASE_URL_SKODA}/api/v1/authentication/exchange-authorization-code?tokenType=CONNECT`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "user-agent": import_const.USER_AGENT
        },
        body: JSON.stringify({
          code,
          redirectUri: import_const.REDIRECT_URI,
          verifier
        }),
        redirect: "manual"
      }
    );
    if (!response.ok) {
      throw new import_errors.SkodaOrderAuthError(`Token exchange failed with status ${response.status}`);
    }
    return readJson(response);
  }
  async withRefreshLock(task) {
    const run = this.refreshLock.then(task, task);
    this.refreshLock = run.then(
      () => void 0,
      () => void 0
    );
    await run;
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  MySkodaAuth
});
//# sourceMappingURL=myskoda-auth.js.map
