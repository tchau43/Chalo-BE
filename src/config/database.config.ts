import { env, envBoolean, envNumber } from "@/global/env";
import { ConfigType, registerAs } from "@nestjs/config";
import { DataSourceOptions } from "typeorm"

export const dbRegToken = 'database';

export const DatabaseConfig = registerAs(dbRegToken, (): DataSourceOptions => ({
  type: 'postgres',
  host: env('DB_HOST', '127.0.0.1'),
  port: envNumber('DB_PORT', 5432),
  username: env('DB_USERNAME'),
  password: env('DB_PASSWORD'),
  database: env('DB_DATABASE'),
  synchronize: envBoolean('DB_SYNCHRONIZE', false),
  entities: ['dist/modules/**/*.entity{.ts,.js}'],
  migrations: ['dist/migrations/*{.ts,.js}'],
  subscribers: ['dist/modules/**/*.subscriber{.ts,.js}', 'dist/common/**/*.subscriber{.ts,.js}'],
  extra: {
    max: envNumber('DB_POOL_MAX', 20),
    connectionTimeoutMillis: envNumber('DB_POOL_TIMEOUT', 30000),
  },
}))

export type IDatabaseConfig = ConfigType<typeof DatabaseConfig>