import { env, envNumber } from "@/global/env"
import { ConfigType, registerAs } from "@nestjs/config"

export const appRegToken = "app"

export const AppConfig = registerAs(appRegToken, () => {
  return {
    name: env("APP_NAME", "chalo-coffee"),
    globalPrefix: env("GLOBAL_PREFIX", "api"),
    port: envNumber("PORT", 3000)
  }
})

export type IAppConfig = ConfigType<typeof AppConfig>