/**
 * All runtime configuration comes from the environment, with safe local defaults.
 */
export interface AppConfig {
  port: number;
  corsOrigins: string[];
  seedDemoData: boolean;
  maxUploadBytes: number;
  logRequests: boolean;
}

export const config: AppConfig = {
  port: Number(process.env.PORT ?? 4000),
  corsOrigins: (process.env.CORS_ORIGIN ?? 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  seedDemoData: process.env.SEED_DEMO_DATA !== 'false',
  maxUploadBytes: 5 * 1024 * 1024,
  logRequests: process.env.NODE_ENV !== 'test',
};
