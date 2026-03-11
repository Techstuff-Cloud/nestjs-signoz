"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPinoConfig = getPinoConfig;
const pino_pretty_1 = __importDefault(require("pino-pretty"));
/**
 * Returns a ready-made pino-http config for nestjs-pino's LoggerModule.
 * Drop this into your LoggerModule.forRoot() call.
 *
 * @example
 * // app.module.ts
 * import { LoggerModule } from 'nestjs-pino';
 * import { getPinoConfig } from '@techstuff-cloud/telemetry-backend';
 *
 * @Module({
 *   imports: [
 *     LoggerModule.forRoot(getPinoConfig()),
 *   ],
 * })
 * export class AppModule {}
 */
function getPinoConfig() {
    return {
        pinoHttp: {
            stream: process.env.NODE_ENV !== 'production'
                ? (0, pino_pretty_1.default)({
                    colorize: true,
                    singleLine: false,
                    translateTime: 'SYS:standard',
                    ignore: 'pid,hostname',
                })
                : undefined, // raw JSON to stdout in production
            level: 'trace',
            autoLogging: true,
            serializers: {
                req: (req) => ({ id: req.id, method: req.method, url: req.url }),
                res: (res) => ({ statusCode: res.statusCode }),
            },
        },
    };
}
//# sourceMappingURL=pino-config.js.map