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
var errors_exports = {};
__export(errors_exports, {
  MarketingConsentError: () => MarketingConsentError,
  SkodaOrderApiError: () => SkodaOrderApiError,
  SkodaOrderAuthError: () => SkodaOrderAuthError,
  TermsAndConditionsError: () => TermsAndConditionsError
});
module.exports = __toCommonJS(errors_exports);
class SkodaOrderApiError extends Error {
  constructor(message) {
    super(message);
    this.name = "SkodaOrderApiError";
  }
}
class SkodaOrderAuthError extends SkodaOrderApiError {
  constructor(message) {
    super(message);
    this.name = "SkodaOrderAuthError";
  }
}
class TermsAndConditionsError extends SkodaOrderAuthError {
  constructor(location) {
    super(`Terms and conditions must be accepted in the MySkoda app: ${location}`);
    this.name = "TermsAndConditionsError";
  }
}
class MarketingConsentError extends SkodaOrderAuthError {
  constructor(location) {
    super(`Marketing consent must be accepted in the MySkoda app: ${location}`);
    this.name = "MarketingConsentError";
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  MarketingConsentError,
  SkodaOrderApiError,
  SkodaOrderAuthError,
  TermsAndConditionsError
});
//# sourceMappingURL=errors.js.map
