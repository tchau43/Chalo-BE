import { AppConfig, appConfigKey, IAppConfig } from './app.config'
import { DatabaseConfig, databaseConfigKey, IDatabaseConfig } from './database.config'

export * from './app.config'
export * from './database.config'

export default {
  AppConfig,
  DatabaseConfig
}

interface AllConfigType {
  [appConfigKey]: IAppConfig,
  [databaseConfigKey]: IDatabaseConfig
}

export type ConfigKeyPaths = RecordNamePaths<AllConfigType>
