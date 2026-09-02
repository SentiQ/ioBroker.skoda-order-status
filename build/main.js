"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
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
var utils = __toESM(require("@iobroker/adapter-core"));
var import_const = require("./lib/const");
var import_errors = require("./lib/errors");
var import_myskoda_api = require("./lib/myskoda-api");
var import_myskoda_auth = require("./lib/myskoda-auth");
var import_order_mapper = require("./lib/order-mapper");
const CONNECTION_NAME = {
  en: "Device or service connected",
  de: "Ger\xE4t oder Dienst verbunden",
  ru: "\u0423\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u043E \u0438\u043B\u0438 \u0441\u043B\u0443\u0436\u0431\u0430 \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u044B",
  pt: "Dispositivo ou servi\xE7o conectado",
  nl: "Apparaat of dienst verbonden",
  fr: "Appareil ou service connect\xE9",
  it: "Dispositivo o servizio connesso",
  es: "Dispositivo o servicio conectado",
  pl: "Urz\u0105dzenie lub us\u0142uga po\u0142\u0105czona",
  uk: "\u041F\u0440\u0438\u0441\u0442\u0440\u0456\u0439 \u0430\u0431\u043E \u0441\u043B\u0443\u0436\u0431\u0430 \u043F\u0456\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u0430",
  "zh-cn": "\u8BBE\u5907\u6216\u670D\u52A1\u5DF2\u8FDE\u63A5"
};
class SkodaOrderStatus extends utils.Adapter {
  pollTimer;
  auth;
  api;
  polling = false;
  unloaded = false;
  constructor(options = {}) {
    super({
      ...options,
      name: "skoda-order-status"
    });
    this.on("ready", this.onReady.bind(this));
    this.on("unload", this.onUnload.bind(this));
  }
  async onReady() {
    await this.extendObjectAsync("info.connection", {
      common: {
        name: CONNECTION_NAME,
        type: "boolean",
        role: "indicator.connected",
        read: true,
        write: false
      }
    });
    const username = (this.config.username || "").trim();
    const password = this.config.password || "";
    const pollInterval = (0, import_const.clampPollInterval)(this.config.pollInterval);
    if (!username || !password) {
      this.log.error("MySkoda email and password must be configured");
      await this.setConnection(false);
      return;
    }
    this.auth = new import_myskoda_auth.MySkodaAuth();
    this.api = new import_myskoda_api.MySkodaApi(this.auth);
    try {
      await this.login(username, password);
    } catch (error) {
      this.log.error(`Authentication failed: ${error.message}`);
      await this.setConnection(false);
      return;
    }
    await this.poll();
    this.pollTimer = this.setInterval(() => {
      void this.poll();
    }, pollInterval * 1e3);
    this.log.info(`Polling order status every ${pollInterval} seconds`);
  }
  onUnload(callback) {
    this.unloaded = true;
    try {
      if (this.pollTimer) {
        this.clearInterval(this.pollTimer);
        this.pollTimer = void 0;
      }
    } catch (error) {
      this.log.error(`Error during unloading: ${error.message}`);
    }
    callback();
  }
  async login(username, password) {
    if (!this.auth) {
      throw new import_errors.SkodaOrderAuthError("Auth client not initialized");
    }
    const storedToken = await this.loadRefreshToken();
    if (storedToken) {
      try {
        await this.auth.authorizeRefreshToken(storedToken);
        this.log.info("Authenticated with stored refresh token");
        await this.persistRefreshToken();
        return;
      } catch (error) {
        this.log.warn(`Refresh token login failed, retrying with password: ${error.message}`);
      }
    }
    await this.auth.authorize(username, password);
    this.log.info("Authenticated with MySkoda username and password");
    await this.persistRefreshToken();
  }
  async poll() {
    if (this.unloaded || this.polling || !this.api || !this.auth) {
      return;
    }
    this.polling = true;
    try {
      const orders = await this.api.discoverOrders();
      await this.persistRefreshToken();
      await this.setConnection(true);
      if (orders.length === 0) {
        this.log.warn("No open Skoda order was found in the MySkoda account");
        return;
      }
      for (const order of orders) {
        if (this.unloaded) {
          return;
        }
        try {
          const details = await this.api.fetchOrder(order.commissionId);
          await this.writeOrder(
            (0, import_order_mapper.mapOrder)({ ...details, commissionId: details.commissionId || order.commissionId })
          );
        } catch (error) {
          this.log.error(`Failed to fetch order ${order.commissionId}: ${error.message}`);
        }
      }
      await this.persistRefreshToken();
    } catch (error) {
      const message = error.message;
      if (error instanceof import_errors.SkodaOrderAuthError) {
        this.log.error(`Authentication failed: ${message}`);
      } else {
        this.log.error(`Failed to poll order status: ${message}`);
      }
      await this.setConnection(false);
    } finally {
      this.polling = false;
    }
  }
  async writeOrder(mapped) {
    const commissionId = mapped.commissionId;
    if (!commissionId) {
      this.log.warn("Skipping order without commissionId");
      return;
    }
    const deviceId = (0, import_order_mapper.sanitizeId)(commissionId);
    await this.setObjectNotExistsAsync(deviceId, {
      type: "device",
      common: {
        name: mapped.deviceName
      },
      native: {
        commissionId
      }
    });
    await this.extendObjectAsync(deviceId, {
      common: {
        name: mapped.deviceName
      }
    });
    const states = [
      { id: "orderStatus", name: "Order status", type: "string", role: "text", val: mapped.orderStatus },
      {
        id: "orderStatusLabel",
        name: "Order status label",
        type: "string",
        role: "text",
        val: mapped.orderStatusLabel
      },
      { id: "commissionId", name: "Commission ID", type: "string", role: "text", val: mapped.commissionId },
      { id: "model", name: "Model", type: "string", role: "text", val: mapped.model },
      { id: "trimLevel", name: "Trim level", type: "string", role: "text", val: mapped.trimLevel },
      { id: "exteriorColour", name: "Exterior colour", type: "string", role: "text", val: mapped.exteriorColour },
      { id: "interiorColour", name: "Interior colour", type: "string", role: "text", val: mapped.interiorColour },
      {
        id: "batteryKwh",
        name: "Battery capacity",
        type: "number",
        role: "value",
        unit: "kWh",
        val: mapped.batteryKwh
      },
      {
        id: "maxPerformanceKw",
        name: "Max performance",
        type: "number",
        role: "value",
        unit: "kW",
        val: mapped.maxPerformanceKw
      },
      { id: "dealerId", name: "Dealer ID", type: "string", role: "text", val: mapped.dealerId },
      {
        id: "activationState",
        name: "Activation state",
        type: "string",
        role: "text",
        val: mapped.activationState
      },
      {
        id: "orderConfirmedDate",
        name: "Order confirmed date",
        type: "string",
        role: "date",
        val: mapped.orderConfirmedDate
      },
      {
        id: "inProductionDate",
        name: "In production date",
        type: "string",
        role: "date",
        val: mapped.inProductionDate
      },
      {
        id: "inDeliveryDate",
        name: "In delivery date",
        type: "string",
        role: "date",
        val: mapped.inDeliveryDate
      },
      {
        id: "toHandoverDate",
        name: "To handover date",
        type: "string",
        role: "date",
        val: mapped.toHandoverDate
      },
      {
        id: "checkpointsReached",
        name: "Checkpoints reached",
        type: "string",
        role: "json",
        val: JSON.stringify(mapped.checkpointsReached)
      },
      {
        id: "checkpointsPending",
        name: "Checkpoints pending",
        type: "string",
        role: "json",
        val: JSON.stringify(mapped.checkpointsPending)
      },
      { id: "lastPoll", name: "Last poll", type: "string", role: "date", val: (/* @__PURE__ */ new Date()).toISOString() }
    ];
    for (const state of states) {
      const id = `${deviceId}.${state.id}`;
      const common = {
        name: state.name,
        type: state.type,
        role: state.role,
        read: true,
        write: false,
        ...state.unit ? { unit: state.unit } : {}
      };
      await this.setObjectNotExistsAsync(id, {
        type: "state",
        common,
        native: {}
      });
      await this.extendObjectAsync(id, { common });
      await this.setState(id, { val: state.val, ack: true });
    }
  }
  async setConnection(connected) {
    await this.setState("info.connection", { val: connected, ack: true });
  }
  async loadRefreshToken() {
    await this.ensureRefreshTokenObject();
    const state = await this.getStateAsync("info.refreshToken");
    if (typeof (state == null ? void 0 : state.val) === "string" && state.val) {
      try {
        const decrypted = this.decrypt(state.val);
        if (decrypted) {
          return decrypted;
        }
      } catch {
        return state.val;
      }
    }
    if (this.config.refreshToken) {
      return this.config.refreshToken;
    }
    return void 0;
  }
  async persistRefreshToken() {
    var _a;
    const token = (_a = this.auth) == null ? void 0 : _a.getRefreshToken();
    if (!token) {
      return;
    }
    this.config.refreshToken = token;
    try {
      await this.ensureRefreshTokenObject();
      await this.setState("info.refreshToken", { val: this.encrypt(token), ack: true });
    } catch (error) {
      this.log.debug(`Could not persist refresh token: ${error.message}`);
    }
  }
  async ensureRefreshTokenObject() {
    await this.setObjectNotExistsAsync("info.refreshToken", {
      type: "state",
      common: {
        name: "Refresh token",
        type: "string",
        role: "text",
        read: true,
        write: false,
        expert: true
      },
      native: {}
    });
  }
}
if (require.main !== module) {
  module.exports = (options) => new SkodaOrderStatus(options);
} else {
  (() => new SkodaOrderStatus())();
}
//# sourceMappingURL=main.js.map
