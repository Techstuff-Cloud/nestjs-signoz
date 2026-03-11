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
export declare function initializeTelemetry(config?: TelemetryConfig): void;
/**
 * Flushes all buffered telemetry and shuts down the SDK gracefully.
 * Call this in your bootstrap() catch block.
 */
export declare const flushAndShutdown: (exitCode?: number) => Promise<never>;
//# sourceMappingURL=telemetry.d.ts.map