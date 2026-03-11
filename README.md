# @techstuff-cloud/telemetry-backend

Shared OpenTelemetry telemetry package for all **NestJS** backend projects at Techstuff Cloud.  
One install, three lines of code — logs, traces, and metrics start flowing to SigNoz automatically.

---

## What you get out of the box

- ✅ Logs, traces, and metrics shipped to SigNoz
- ✅ Every HTTP request/response auto-logged (method, URL, status, response time)
- ✅ NestJS controller and service context on every log (`nest.context`)
- ✅ Deployment environment on every record (`development` / `production`)
- ✅ Graceful shutdown — no logs lost on SIGTERM, SIGINT, or crashes
- ✅ Pretty logs in development, raw JSON in production

---

## Installation

Move to your backend directory and run this command
```bash
npm install git+https://github.com/Techstuff-Cloud/nestjs-signoz.git
```

---

## Setup (4 steps)

### Step 1 — Add env vars to `.env`

```bash
OTEL_SERVICE_NAME=your-service-name
OTEL_EXPORTER_OTLP_ENDPOINT=http://your-signoz-collector:4318
NODE_ENV=production   # OPTIONAL
```

---

### Step 2 — Update `main.ts`

> ⚠️ `dotenv.config()` and `initializeTelemetry()` **must be the first lines** — before any NestJS imports.
> This ensures the `.env` file is loaded and OTel is ready before the framework boots.

```ts
import * as dotenv from 'dotenv';
dotenv.config(); // ← loads .env first so NODE_ENV and other vars are available

import { initializeTelemetry, flushAndShutdown } from '@techstuff-cloud/telemetry-backend';
initializeTelemetry({ serviceName: 'your-service-name' }); // ← pass serviceName explicitly; collectorUrl reads from OTEL_EXPORTER_OTLP_ENDPOINT

import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';

async function bootstrap() {
  try {
    const app = await NestFactory.create(AppModule, { bufferLogs: true });
    app.useLogger(app.get(Logger));
    app.setGlobalPrefix('api');
    app.enableCors({
      origin: (origin, callback) => {
        callback(null, true);
      },
      methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
      credentials: true,
    });
    const port = process.env.PORT ?? 4000;
    console.log(`🚀 Server listening on http://localhost:${port}`);
    await app.listen(port);
  } catch (error) {
    console.error('💥 Failed to start application:', error);
    await flushAndShutdown(1);
  }
}

bootstrap();
```

Also install `dotenv` if not already present:
```bash
npm install dotenv
```

---

### Step 3 — Update `app.module.ts`

```ts
import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { getPinoConfig } from '@techstuff-cloud/telemetry-backend';

@Module({
  imports: [
    LoggerModule.forRoot(getPinoConfig()),
    // ... rest of your modules
  ],
})
export class AppModule {}
```

`getPinoConfig()` uses `pino-pretty` for human-readable logs in development. Install it if not already present:
```bash
npm install pino-pretty
```

---

### Step 4 — Logging in controllers and services

Inject `PinoLogger` as usual — no changes needed:

```ts
import { Controller, Get } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

@Controller('users')
export class UsersController {
  constructor(
    @InjectPinoLogger(UsersController.name)
    private readonly logger: PinoLogger,
  ) {}

  @Get()
  findAll() {
    this.logger.info('Fetching all users');
    this.logger.warn({ userId: '123' }, 'User not found');
    this.logger.error({ err: new Error('DB timeout') }, 'Database error');
  }


  //Example
  // this.logger.info('Testing info log');
  // this.logger.warn({ warning: 'This is a test warning' }, 'Testing warn log');
  // this.logger.error({ err: new Error('This is a test error') }, 'Testing error log');
}
```

---

## Attributes in SigNoz

Every log, trace, and metric record is automatically enriched with:

| Attribute | Value |
|---|---|
| `service.name` | Your `OTEL_SERVICE_NAME` env var |
| `deployment.environment` | Your `NODE_ENV` env var |
| `nest.context` | Controller or service class name |
| `http.method` | GET, POST, PUT, etc. |
| `http.url` | Request URL |
| `http.request_id` | Auto-generated request ID |
| `http.status_code` | Response status code |
| `http.response_time_ms` | Response time in milliseconds |
| `exception.message` | Error message (on error logs) |
| `exception.type` | Error type (on error logs) |
| `exception.stack` | Stack trace (on error logs) |

---

## Config reference

`initializeTelemetry()` accepts an optional config object. All fields fall back to env vars so you typically don't need to pass anything:

```ts
initializeTelemetry({
  serviceName: 'my-service',        // fallback: OTEL_SERVICE_NAME → 'unknown-service'
  collectorUrl: 'http://...:4318',  // fallback: OTEL_EXPORTER_OTLP_ENDPOINT → 'http://localhost:4318'
  metricsIntervalMs: 10000,         // how often to export metrics (default: 10s)
  logsDelayMs: 5000,                // how often to flush log batches (default: 5s)
});
```

---

## Updating the package

After changes are merged to the repo:

```bash
# Update to latest
npm install git+https://github.com/Techstuff-Cloud/nestjs-signoz.git

# Or pin to a specific tag
npm install git+https://github.com/Techstuff-Cloud/nestjs-signoz.git#v1.1.0
```

---
