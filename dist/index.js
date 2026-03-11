"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPinoConfig = exports.flushAndShutdown = exports.initializeTelemetry = void 0;
var telemetry_1 = require("./telemetry");
Object.defineProperty(exports, "initializeTelemetry", { enumerable: true, get: function () { return telemetry_1.initializeTelemetry; } });
Object.defineProperty(exports, "flushAndShutdown", { enumerable: true, get: function () { return telemetry_1.flushAndShutdown; } });
var pino_config_1 = require("./pino-config");
Object.defineProperty(exports, "getPinoConfig", { enumerable: true, get: function () { return pino_config_1.getPinoConfig; } });
//# sourceMappingURL=index.js.map