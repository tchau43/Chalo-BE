import { env } from "@/global/env"
import { ConfigType, registerAs } from "@nestjs/config"

export const securityRegToken = "security"

export const SecurityConfig = registerAs(securityRegToken, () => ({
  jwtSecret: env("JWT_SECRET"),
  jwtExpiresIn: env("JWT_EXPIRES_IN")
}))

export type ISecurityConfig = ConfigType(typeof SecurityConfig)