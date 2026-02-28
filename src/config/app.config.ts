import { ConfigType, registerAs } from "@nestjs/config";
import { envNumber, envString } from "src/global/env";

const appConfigKey = "app"

const globalPrefix = envString('GLOBAL_PREFIX', 'api')

export const AppConfig = registerAs(appConfigKey, () => ({
  port: envNumber('APP_PORT', 3000),
}))

export type IAppConfig = ConfigType<typeof AppConfig>

export const whiteList = [
  `${globalPrefix ? '/' : ''}${globalPrefix}/auth/captcha/img`,
  `${globalPrefix ? '/' : ''}${globalPrefix}/auth/login`,
]