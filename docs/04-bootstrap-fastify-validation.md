# Bước 4 — Bootstrap NestJS + Fastify + ValidationPipe

**Tiên quyết:** [03-config-database-security.md](./03-config-database-security.md) — đã có `AppModule` load `configLoaders`, `AppController` (`GET /health`).

Bước này chỉ thêm **adapter Fastify**, **`main.ts`** (listen, CORS, `ValidationPipe`, `useContainer`).

---

## 4.1 Adapter Fastify tối giản

Tạo `src/common/adapters/fastify.adapter.ts`:

```typescript
import { FastifyAdapter } from '@nestjs/platform-fastify'

/**
 * FastifyAdapter dùng cho NestFactory.create(..., fastifyApp).
 * Có thể mở rộng: trustProxy, @fastify/cookie, hooks (xem spark-backend).
 */
export const fastifyApp = new FastifyAdapter({
  trustProxy: true,
  logger: false,
})
```

---

## 4.2 `main.ts`

```typescript
import { HttpStatus, UnprocessableEntityException, ValidationPipe } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import { NestFastifyApplication } from '@nestjs/platform-fastify'
import { useContainer } from 'class-validator'

import { AppModule } from './app.module'
import { fastifyApp } from './common/adapters/fastify.adapter'

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    fastifyApp,
    { bufferLogs: true },
  )

  const config = app.get(ConfigService)
  const port = config.get<number>('app.port') ?? 3000
  const globalPrefix = config.get<string>('app.globalPrefix') ?? 'api'

  app.setGlobalPrefix(globalPrefix)

  app.enableCors({
    origin: true,
    credentials: true,
  })

  useContainer(app.select(AppModule), { fallbackOnErrors: true })

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
      errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
      exceptionFactory: (errors) => {
        const first = errors[0]
        const rule = first?.constraints ? Object.keys(first.constraints)[0] : 'unknown'
        const msg = first?.constraints?.[rule] ?? 'Validation failed'
        return new UnprocessableEntityException(msg)
      },
    }),
  )

  await app.listen(port, '0.0.0.0')
  console.log(`Listening on http://0.0.0.0:${port}/${globalPrefix}`)
}

bootstrap().catch((err) => {
  console.error(err)
  process.exit(1)
})
```

**Lưu ý:** `listen(port, '0.0.0.0')` — adapter Fastify của Nest.

---

## 4.3 `AppModule` / health

Không lặp lại ở đây: **bước 3** đã có `ConfigModule.forRoot` + `configLoaders` + `AppController` (`GET /health`). Chỉ cần đảm bảo `main.ts` dùng `NestFastifyApplication` như trên.

---

## Checkpoint

```bash
pnpm run start:dev
```

`GET http://localhost:3000/api/health` → **200**, JSON `{ "ok": true, ... }` (port/prefix lấy từ config bước 3).

Sang: [05-typeorm-module-entities.md](./05-typeorm-module-entities.md)
