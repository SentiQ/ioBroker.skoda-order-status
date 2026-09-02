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
var myskoda_api_exports = {};
__export(myskoda_api_exports, {
  MySkodaApi: () => MySkodaApi
});
module.exports = __toCommonJS(myskoda_api_exports);
var import_const = require("./const");
var import_errors = require("./errors");
class MySkodaApi {
  constructor(auth) {
    this.auth = auth;
  }
  async discoverOrders() {
    const garage = await this.getJson(import_const.GARAGE_PATH);
    return (garage.orderedVehicles || []).filter((vehicle) => !!vehicle.commissionId);
  }
  async fetchOrder(commissionId) {
    return await this.getJson(`/v2/garage/vehicles/ordered/${encodeURIComponent(commissionId)}`);
  }
  async getJson(path) {
    const token = await this.auth.getAccessToken();
    const response = await fetch(`${import_const.BASE_URL_SKODA}/api${path}`, {
      method: "GET",
      headers: {
        authorization: `Bearer ${token}`,
        accept: "application/json",
        "user-agent": import_const.USER_AGENT
      }
    });
    const text = await response.text();
    if (!response.ok) {
      throw new import_errors.SkodaOrderApiError(`Request to ${path} failed with status ${response.status}`);
    }
    try {
      return JSON.parse(text);
    } catch (error) {
      throw new import_errors.SkodaOrderApiError(`Invalid JSON from ${path}: ${error.message}`);
    }
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  MySkodaApi
});
//# sourceMappingURL=myskoda-api.js.map
