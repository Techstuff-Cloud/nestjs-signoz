// IMPORTANT: This file MUST be imported first in main.ts before any other imports

import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { BatchLogRecordProcessor } from '@opentelemetry/sdk-logs';
import { ExportResult } from '@opentelemetry/core';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { NestInstrumentation } from '@opentelemetry/instrumentation-nestjs-core';
import { PinoInstrumentation } from '@opentelemetry/instrumentation-pino';
import { resourceFromAttributes } from '@opentelemetry/resources';
import {
  SEMRESATTRS_SERVICE_NAME,
  SEMRESATTRS_DEPLOYMENT_ENVIRONMENT,
} from '@opentelemetry/semantic-conventions';

export interface TelemetryConfig {
  /**
   * Identifies this service in SigNoz.
   * Falls back to OTEL_SERVICE_NAME env var, then 'unknown-service'.
   */
  serviceName?: string;

  /**
   * Base URL of the OTel collector.
   * Falls back to OTEL_EXPORTER_OTLP_ENDPOINT env var, then 'http://localhost:4318'.
   */
  collectorUrl?: string;

  /**
   * How often to export metrics in ms. Default: 10000 (10s).
   */
  metricsIntervalMs?: number;

  /**
   * How often to flush logs in ms. Default: 5000 (5s).
   */
  logsDelayMs?: number;
}

let sdk: NodeSDK | null = null;
let logRecordProcessor: BatchLogRecordProcessor | null = null;

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
export function initializeTelemetry(config: TelemetryConfig = {}): void {
  const serviceName =
    config.serviceName ??
    process.env.OTEL_SERVICE_NAME ??
    'unknown-service';

  const collectorUrl =
    config.collectorUrl ??
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT ??
    'http://localhost:4318';

  const metricsIntervalMs = config.metricsIntervalMs ?? 10000;
  const logsDelayMs = config.logsDelayMs ?? 5000;

  const traceExporter = new OTLPTraceExporter({
    url: `${collectorUrl}/v1/traces`,
    timeoutMillis: 5000,
  });

  const metricExporter = new OTLPMetricExporter({
    url: `${collectorUrl}/v1/metrics`,
    timeoutMillis: 5000,
  });

  const logExporter = new OTLPLogExporter({
    url: `${collectorUrl}/v1/logs`,
    timeoutMillis: 5000,
  });

  // Debug wrapper — surfaces silent export failures that would otherwise
  // be swallowed without any indication.
  const debugLogExporter = {
    export(records: any[], cb: (result: ExportResult) => void) {
      logExporter.export(records, (result: ExportResult) => {
        if (result.code !== 0) {
          console.error('❌ OTel log export failed (code=%d):', result.code, result.error ?? '');
        }
        cb(result);
      });
    },
    shutdown(): Promise<void> {
      return logExporter.shutdown();
    },
    forceFlush(): Promise<void> {
      return logExporter.forceFlush?.() ?? Promise.resolve();
    },
  };

  logRecordProcessor = new BatchLogRecordProcessor(debugLogExporter, {
    maxQueueSize: 2048,
    maxExportBatchSize: 512,
    scheduledDelayMillis: logsDelayMs,
  });

  sdk = new NodeSDK({
    // service.name and deployment.environment are set here via resource
    // so they appear on every trace, metric, and log in SigNoz automatically.
    // No need to set resource.service.name manually in the PinoInstrumentation logHook.
    resource: resourceFromAttributes({
      [SEMRESATTRS_SERVICE_NAME]: serviceName,
      [SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV ?? 'development',
    }),
    traceExporter,
    metricReader: new PeriodicExportingMetricReader({
      exporter: metricExporter,
      exportIntervalMillis: metricsIntervalMs,
    }),
    logRecordProcessor,
    instrumentations: [
      new HttpInstrumentation(),
      new ExpressInstrumentation(),
      new NestInstrumentation(),
      new PinoInstrumentation({
        logHook: (_span, record) => {
          // resource.service.name is set via Resource above — not needed here.
          // These mappings promote Pino fields into indexed OTel attributes in SigNoz.

          if (record['nest.context']) {
            record['nest.context'] = record['nest.context'];
          } else if (record['context']) {
            record['nest.context'] = record['context'];
          }

          if (record['req']) {
            const req = record['req'] as Record<string, unknown>;
            record['http.method']     = req['method'];
            record['http.url']        = req['url'];
            record['http.request_id'] = req['id'];
          }
          if (record['res']) {
            const res = record['res'] as Record<string, unknown>;
            record['http.status_code'] = res['statusCode'];
          }
          if (record['responseTime']) {
            record['http.response_time_ms'] = record['responseTime'];
          }
          if (record['exception.message']) {
            record['exception.type']    = record['exception.type'];
            record['exception.message'] = record['exception.message'];
            record['exception.stack']   = record['exception.stack'];
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
export const flushAndShutdown = async (exitCode = 0): Promise<never> => {
  console.log('🔄 Flushing OpenTelemetry data before exit...');
  try {
    await logRecordProcessor?.forceFlush();
    await sdk?.shutdown();
    console.log('✅ OpenTelemetry terminated gracefully');
  } catch (err) {
    console.error('❌ Error during OpenTelemetry shutdown', err);
  }
  process.exit(exitCode);
};

// ── Graceful shutdown signals ─────────────────────────────────────────────────
const shutdown = () => flushAndShutdown(0);
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// ── Crash handlers ────────────────────────────────────────────────────────────
process.on('uncaughtException', async (error: Error) => {
  console.error('💥 Uncaught Exception:', error);
  await flushAndShutdown(1);
});

process.on('unhandledRejection', async (reason: unknown) => {
  console.error('💥 Unhandled Rejection:', reason);
  await flushAndShutdown(1);
});