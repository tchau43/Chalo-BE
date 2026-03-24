import { AppConfig, appRegToken, IAppConfig } from './app.config'
import { DatabaseConfig, dbRegToken, IDatabaseConfig } from './database.config'
import { ISecurityConfig, SecurityConfig, securityRegToken } from './security.config'

export * from './app.config'
export * from './database.config'
export * from './security.config'

export interface AllConfigType {
  [appRegToken]: IAppConfig;
  [dbRegToken]: IDatabaseConfig;
  [securityRegToken]: ISecurityConfig;
}

export type ConfigKeyPaths = AllConfigType;

export default {
  AppConfig,
  DatabaseConfig,
  SecurityConfig
}