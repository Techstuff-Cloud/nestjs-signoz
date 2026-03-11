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
export declare function getPinoConfig(): {
    pinoHttp: {
        stream: pretty.PrettyStream | undefined;
        level: string;
        autoLogging: boolean;
        serializers: {
            req: (req: any) => {
                id: any;
                method: any;
                url: any;
            };
            res: (res: any) => {
                statusCode: any;
            };
        };
    };
};
//# sourceMappingURL=pino-config.d.ts.map