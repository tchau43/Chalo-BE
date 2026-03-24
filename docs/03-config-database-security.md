# Bước 3 — Config: App, Database, Security (JWT)

**Tiên quyết:** [02-case-study-env-helpers.md](./02-case-study-env-helpers.md) — mọi giá trị số/boolean từ env qua `env` / `envNumber` / `envBoolean`.

## 3.1 Barrel export `src/config/index.ts`

```typescript
import appConfig from './app.config'
import databaseConfig from './database.config'
import securityConfig from './security.config'

export const configLoaders = [appConfig, databaseConfig, securityConfig]

export type { IAppConfig } from './app.config'
export type { IDatabaseConfig } from './database.config'
export type { ISecurityConfig } from './security.config'
```

## 3.2 `src/config/app.config.ts`

```typescript
import { registerAs } from '@nestjs/config'

import { env, envNumber } from '~/global/env'

export interface IAppConfig {
  name: string
  port: number
  globalPrefix: string
}

export default registerAs(
  'app',
  (): IAppConfig => ({
    name: env('APP_NAME', 'chalo-backend'),
    port: envNumber('PORT', 3000),
    globalPrefix: env('GLOBAL_PREFIX', 'api'),
  }),
)
```

## 3.3 `src/config/database.config.ts` (chuẩn case study)

Chỉ chứa **tham số kết nối**. Danh sách entity do **`autoLoadEntities: true`** trong `DatabaseModule` (bước **5**) đảm nhiệm — **không** dùng glob `entities: [...]` trong file này.

```typescript
import { registerAs } from '@nestjs/config'

import { env, envBoolean, envNumber } from '~/global/env'

export interface IDatabaseConfig {
  type: 'postgres'
  host: string
  port: number
  username: string
  password: string
  database: string
  synchronize: boolean
  logging: boolean
}

export default registerAs(
  'database',
  (): IDatabaseConfig => ({
    type: 'postgres',
    host: env('DB_HOST', '127.0.0.1'),
    port: envNumber('DB_PORT', 5432),
    username: env('DB_USERNAME', 'postgres'),
    password: env('DB_PASSWORD', ''),
    database: env('DB_DATABASE', 'chalo_db'),
    synchronize: envBoolean('DB_SYNCHRONIZE', false),
    logging: envBoolean('DB_LOGGING', false),
  }),
)
```

## 3.4 `src/config/security.config.ts`

```typescript
import { registerAs } from '@nestjs/config'

import { env } from '~/global/env'

export interface ISecurityConfig {
  jwtSecret: string
  jwtExpiresIn: string
  refreshSecret: string
  refreshExpiresIn: string
}

export default registerAs(
  'security',
  (): ISecurityConfig => {
    const jwtSecret = env('JWT_SECRET')
    const refreshSecret = env('REFRESH_SECRET')
    if (!jwtSecret || jwtSecret.length < 32)
      throw new Error('JWT_SECRET must be set and at least 32 characters')
    if (!refreshSecret || refreshSecret.length < 32)
      throw new Error('REFRESH_SECRET must be set and at least 32 characters')

    return {
      jwtSecret,
      jwtExpiresIn: env('JWT_EXPIRES_IN', '15m'),
      refreshSecret,
      refreshExpiresIn: env('REFRESH_EXPIRES_IN', '7d'),
    }
  },
)
```

Cập nhật `.env` dùng **chuỗi thời gian** cho JWT (dễ đọc hơn giây):

```env
JWT_EXPIRES_IN=15m
REFRESH_EXPIRES_IN=7d
```

## 3.5 `AppController` (health) — để bước 4 có route kiểm tra

`src/app.controller.ts`:

```typescript
import { Controller, Get } from '@nestjs/common'

@Controller()
export class AppController {
  @Get('health')
  health() {
    return { ok: true, service: 'chalo-be' }
  }
}
```

## 3.6 `AppModule` load config

```typescript
import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'

import { AppController } from './app.controller'
import { configLoaders } from './config'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      expandVariables: true,
      envFilePath: ['.env.local', `.env.${process.env.NODE_ENV}`, '.env'],
      load: configLoaders,
    }),
  ],
  controllers: [AppController],
})
export class AppModule {}
```

**Lưu ý:** Lúc này `main.ts` có thể vẫn là template Express mặc định — bước **4** mới chuyển sang Fastify.

## 3.7 `ConfigService` và kiểu `infer: true`

Trong code mẫu có chỗ dùng `config.get<ISecurityConfig>('security', { infer: true })`. `infer` chỉ hữu ích khi bạn khai báo **generic** cho `ConfigService` (registry key paths). Nếu TypeScript báo lỗi, dùng:

```typescript
config.get<ISecurityConfig>('security')!
```

Tham chiếu chuẩn ôn tập: [CASE-STUDY-CHUAN-THAM-CHIEU-KY-THUAT.md](./CASE-STUDY-CHUAN-THAM-CHIEU-KY-THUAT.md).

## Checkpoint

- App khởi động không throw về `JWT_SECRET`  
- `ConfigService.get('app.port')` trả đúng  

Sang: [04-bootstrap-fastify-validation.md](./04-bootstrap-fastify-validation.md)
