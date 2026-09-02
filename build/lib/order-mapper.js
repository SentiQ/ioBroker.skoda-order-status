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
var order_mapper_exports = {};
__export(order_mapper_exports, {
  checkpointDate: () => checkpointDate,
  mapOrder: () => mapOrder,
  sanitizeId: () => sanitizeId,
  splitCheckpoints: () => splitCheckpoints,
  statusLabel: () => statusLabel
});
module.exports = __toCommonJS(order_mapper_exports);
var import_const = require("./const");
function sanitizeId(id) {
  const sanitized = id.replace(/[^A-Za-z0-9_-]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
  return sanitized || "order";
}
function statusLabel(orderStatus) {
  var _a;
  if (!orderStatus) {
    return null;
  }
  return (_a = import_const.STATUS_LABELS[orderStatus]) != null ? _a : orderStatus;
}
function checkpointDate(checkpoints, status) {
  if (!checkpoints) {
    return null;
  }
  for (const item of checkpoints) {
    if (item.status === status && item.date) {
      return item.date;
    }
  }
  return null;
}
function splitCheckpoints(checkpoints) {
  var _a;
  const reached = [];
  const pending = [];
  for (const checkpoint of checkpoints || []) {
    const entry = {
      status: checkpoint.status,
      label: (_a = statusLabel(checkpoint.status)) != null ? _a : checkpoint.status,
      date: checkpoint.date
    };
    if (checkpoint.date) {
      reached.push(entry);
    } else {
      pending.push(entry);
    }
  }
  return { reached, pending };
}
function mapOrder(data) {
  var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k;
  const spec = data.vehicleSpecification || {};
  const checkpoints = data.checkPoints || [];
  const { reached, pending } = splitCheckpoints(checkpoints);
  const model = spec.model || data.name || null;
  return {
    deviceName: model || "Skoda order",
    orderStatus: (_a = data.orderStatus) != null ? _a : null,
    orderStatusLabel: statusLabel(data.orderStatus),
    commissionId: (_b = data.commissionId) != null ? _b : null,
    model,
    trimLevel: (_c = spec.trimLevel) != null ? _c : null,
    exteriorColour: (_d = spec.exteriorColour) != null ? _d : null,
    interiorColour: (_e = spec.interiorColour) != null ? _e : null,
    batteryKwh: (_g = (_f = spec.battery) == null ? void 0 : _f.capacityInKWh) != null ? _g : null,
    maxPerformanceKw: (_h = spec.maxPerformanceInKW) != null ? _h : null,
    dealerId: (_j = (_i = data.dealer) == null ? void 0 : _i.servicePartnerId) != null ? _j : null,
    activationState: (_k = data.activationState) != null ? _k : null,
    orderConfirmedDate: checkpointDate(checkpoints, "ORDER_CONFIRMED"),
    inProductionDate: checkpointDate(checkpoints, "IN_PRODUCTION"),
    inDeliveryDate: checkpointDate(checkpoints, "IN_DELIVERY"),
    toHandoverDate: checkpointDate(checkpoints, "TO_HANDOVER"),
    checkpointsReached: reached,
    checkpointsPending: pending
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  checkpointDate,
  mapOrder,
  sanitizeId,
  splitCheckpoints,
  statusLabel
});
//# sourceMappingURL=order-mapper.js.map
