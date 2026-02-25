import { ConfigType, registerAs } from "@nestjs/config";
import { envNumber } from "src/global/env";

const appConfigKey = "app"

export const AppConfig = registerAs(appConfigKey, () => ({
  port: envNumber('APP_PORT', 3000),
}))

export type IAppConfig = ConfigType<typeof AppConfig>