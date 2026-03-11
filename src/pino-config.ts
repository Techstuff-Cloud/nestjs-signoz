import pretty from 'pino-pretty';

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
export function getPinoConfig() {
  return {
    pinoHttp: {
      stream:
        process.env.NODE_ENV !== 'production'
          ? pretty({
              colorize: true,
              singleLine: false,
              translateTime: 'SYS:standard',
              ignore: 'pid,hostname',
            })
          : undefined, // raw JSON to stdout in production
      level: 'trace',
      autoLogging: true,
      serializers: {
        req: (req: any) => ({ id: req.id, method: req.method, url: req.url }),
        res: (res: any) => ({ statusCode: res.statusCode }),
      },
    },
  };
}
