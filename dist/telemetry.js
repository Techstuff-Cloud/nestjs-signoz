"use strict";
// IMPORTANT: This file MUST be imported first in main.ts before any other imports
Object.defineProperty(exports, "__esModule", { value: true });
exports.flushAndShutdown = void 0;
exports.initializeTelemetry = initializeTelemetry;
const sdk_node_1 = require("@opentelemetry/sdk-node");
const exporter_trace_otlp_http_1 = require("@opentelemetry/exporter-trace-otlp-http");
const exporter_metrics_otlp_http_1 = require("@opentelemetry/exporter-metrics-otlp-http");
const exporter_logs_otlp_http_1 = require("@opentelemetry/exporter-logs-otlp-http");
const sdk_metrics_1 = require("@opentelemetry/sdk-metrics");
const sdk_logs_1 = require("@opentelemetry/sdk-logs");
const instrumentation_http_1 = require("@opentelemetry/instrumentation-http");
const instrumentation_express_1 = require("@opentelemetry/instrumentation-express");
const instrumentation_nestjs_core_1 = require("@opentelemetry/instrumentation-nestjs-core");
const instrumentation_pino_1 = require("@opentelemetry/instrumentation-pino");
const resources_1 = require("@opentelemetry/resources");
const semantic_conventions_1 = require("@opentelemetry/semantic-conventions");
let sdk = null;
let logRecordProcessor = null;
/**
 * Initializes the OpenTelemetry SDK for NestJS backends.
 * Ships logs, traces, and metrics to SigNoz.
 *
 * MUST be called at the very top of main.ts before any other imports.
 *
 * @example
 * // main.ts
 * import { initializeTelemetry, flushAndShutdown } from '@techstuff-cloud/telemetry-backend';
 * initializeTelemetry();
 */
function initializeTelemetry(config = {}) {
    const serviceName = config.serviceName ??
        process.env.OTEL_SERVICE_NAME ??
        'unknown-service';
    const collectorUrl = config.collectorUrl ??
        process.env.OTEL_EXPORTER_OTLP_ENDPOINT ??
        'http://localhost:4318';
    const metricsIntervalMs = config.metricsIntervalMs ?? 10000;
    const logsDelayMs = config.logsDelayMs ?? 5000;
    const traceExporter = new exporter_trace_otlp_http_1.OTLPTraceExporter({
        url: `${collectorUrl}/v1/traces`,
        timeoutMillis: 5000,
    });
    const metricExporter = new exporter_metrics_otlp_http_1.OTLPMetricExporter({
        url: `${collectorUrl}/v1/metrics`,
        timeoutMillis: 5000,
    });
    const logExporter = new exporter_logs_otlp_http_1.OTLPLogExporter({
        url: `${collectorUrl}/v1/logs`,
        timeoutMillis: 5000,
    });
    // Debug wrapper — surfaces silent export failures that would otherwise
    // be swallowed without any indication.
    const debugLogExporter = {
        export(records, cb) {
            logExporter.export(records, (result) => {
                if (result.code !== 0) {
                    console.error('❌ OTel log export failed (code=%d):', result.code, result.error ?? '');
                }
                cb(result);
            });
        },
        shutdown() {
            return logExporter.shutdown();
        },
        forceFlush() {
            return logExporter.forceFlush?.() ?? Promise.resolve();
        },
    };
    logRecordProcessor = new sdk_logs_1.BatchLogRecordProcessor(debugLogExporter, {
        maxQueueSize: 2048,
        maxExportBatchSize: 512,
        scheduledDelayMillis: logsDelayMs,
    });
    sdk = new sdk_node_1.NodeSDK({
        // service.name and deployment.environment are set here via resource
        // so they appear on every trace, metric, and log in SigNoz automatically.
        // No need to set resource.service.name manually in the PinoInstrumentation logHook.
        resource: (0, resources_1.resourceFromAttributes)({
            [semantic_conventions_1.SEMRESATTRS_SERVICE_NAME]: serviceName,
            [semantic_conventions_1.SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV ?? 'development',
        }),
        traceExporter,
        metricReader: new sdk_metrics_1.PeriodicExportingMetricReader({
            exporter: metricExporter,
            exportIntervalMillis: metricsIntervalMs,
        }),
        logRecordProcessor,
        instrumentations: [
            new instrumentation_http_1.HttpInstrumentation(),
            new instrumentation_express_1.ExpressInstrumentation(),
            new instrumentation_nestjs_core_1.NestInstrumentation(),
            new instrumentation_pino_1.PinoInstrumentation({
                logHook: (_span, record) => {
                    // resource.service.name is set via Resource above — not needed here.
                    // These mappings promote Pino fields into indexed OTel attributes in SigNoz.
                    if (record['nest.context']) {
                        record['nest.context'] = record['nest.context'];
                    }
                    else if (record['context']) {
                        record['nest.context'] = record['context'];
                    }
                    if (record['req']) {
                        const req = record['req'];
                        record['http.method'] = req['method'];
                        record['http.url'] = req['url'];
                        record['http.request_id'] = req['id'];
                    }
                    if (record['res']) {
                        const res = record['res'];
                        record['http.status_code'] = res['statusCode'];
                    }
                    if (record['responseTime']) {
                        record['http.response_time_ms'] = record['responseTime'];
                    }
                    if (record['exception.message']) {
                        record['exception.type'] = record['exception.type'];
                        record['exception.message'] = record['exception.message'];
                        record['exception.stack'] = record['exception.stack'];
                    }
                },
            }),
        ],
    });
    sdk.start();
    console.log(`✅ OpenTelemetry initialized — service: ${serviceName}, collector: ${collectorUrl}`);
}
/**
 * Flushes all buffered telemetry and shuts down the SDK gracefully.
 * Call this in your bootstrap() catch block.
 */
const flushAndShutdown = async (exitCode = 0) => {
    console.log('🔄 Flushing OpenTelemetry data before exit...');
    try {
        await logRecordProcessor?.forceFlush();
        await sdk?.shutdown();
        console.log('✅ OpenTelemetry terminated gracefully');
    }
    catch (err) {
        console.error('❌ Error during OpenTelemetry shutdown', err);
    }
    process.exit(exitCode);
};
exports.flushAndShutdown = flushAndShutdown;
// ── Graceful shutdown signals ─────────────────────────────────────────────────
const shutdown = () => (0, exports.flushAndShutdown)(0);
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
// ── Crash handlers ────────────────────────────────────────────────────────────
process.on('uncaughtException', async (error) => {
    console.error('💥 Uncaught Exception:', error);
    await (0, exports.flushAndShutdown)(1);
});
process.on('unhandledRejection', async (reason) => {
    console.error('💥 Unhandled Rejection:', reason);
    await (0, exports.flushAndShutdown)(1);
});
//# sourceMappingURL=telemetry.js.map