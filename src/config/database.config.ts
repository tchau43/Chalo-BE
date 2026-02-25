import { ConfigType, registerAs } from "@nestjs/config"
import { envBoolean, envNumber, envString } from "src/global/env"
import { DataSource, DataSourceOptions } from "typeorm"

const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: envString('DB_HOST', '127.0.0.1'),
  port: envNumber('DB_PORT', 5432),
  username: envString('DB_USERNAME'),
  password: envString('DB_PASSWORD'),
  database: envString('DB_DATABASE'),
  entities: ['dist/modules/**/*.entity{.ts,.js}'],
  synchronize: envBoolean('DB_SYNCHRONIZE', false),
  migrations: ['dist/migrations/*{.ts,.js}'],
  subscribers: ['dist/modules/**/*.subscriber{.ts,.js}', 'dist/common/**/*.subscriber{.ts,.js}'],
  // Connection pool configuration (pg options)
  extra: {
    max: envNumber('DB_POOL_MAX', 20),
    connectionTimeoutMillis: envNumber('DB_POOL_TIMEOUT', 30000),
  },
}

const databaseConfigKey = "database"

export const DatabaseConfig = registerAs(databaseConfigKey, () => dataSourceOptions)

export type IDatabaseConfig = ConfigType<typeof DatabaseConfig>

const dataSource = new DataSource(dataSourceOptions)

export default dataSource