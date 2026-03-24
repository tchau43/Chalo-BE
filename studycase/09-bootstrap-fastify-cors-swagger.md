# Case Study: Bootstrap — Fastify adapter, CORS, static, Swagger, WebSocket adapter

## 1. 📖 Tóm tắt Case Study

`bootstrap` là nơi **ghép các policy vận hành**: HTTP server (Fastify vs Express), CORS cho frontend POS, phục vụ file tĩnh, tài liệu API (Swagger), và adapter WebSocket (Spark dùng Redis IO adapter để scale socket).

Quán cà phê: POS chạy trên domain/port khác backend → CORS whitelist rõ ràng; Swagger giúp bạn và frontend thống nhất contract; real-time (gọi món ở bếp) **có thể** đến sau MVP.

---

## 2. 🔍 Cách `spark-backend` triển khai (The Reference)

### Luồng hoạt động

1. `NestFactory.create(AppModule, fastifyApp)` — custom Fastify instance (helmet, cookie, multipart, …) từ `fastify.adapter.ts`.
2. Đọc `port`, `globalPrefix`, `name` từ `ConfigService`; `ResOp.setServiceId(name)`.
3. `enableCors` với callback `origin` kiểm tra whitelist từ `ALLOWED_ORIGINS` env.
4. `setGlobalPrefix`, `useStaticAssets` cho thư mục `public`.
5. `enableShutdownHooks` khi không dev (graceful).
6. `setupSwagger` khi cần doc.
7. `useWebSocketAdapter(new RedisIoAdapter(app))` cho Socket.IO scale.

### File cốt lõi

| Vai trò | Đường dẫn |
|--------|------------|
| Bootstrap | `src/main.ts` |
| Fastify factory | `src/common/adapters/fastify.adapter.ts` |
| Socket adapter | `src/common/adapters/socket.adapter.ts` |
| Swagger | `src/setup-swagger.ts` |

### Đoạn code quan trọng

**Tạo app với Fastify adapter:**

```typescript
// spark-backend/src/main.ts (excerpt)
const app = await NestFactory.create<NestFastifyApplication>(AppModule, fastifyApp, {
  bufferLogs: true,
  snapshot: true,
});
```

**CORS whitelist:**

```typescript
// spark-backend/src/main.ts (excerpt)
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((origin) => origin.trim())
  : ['http://localhost:3000', 'http://localhost:5173'];

app.enableCors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) callback(null, true);
    else callback(new Error('Not allowed by CORS'), false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  maxAge: 86400,
});
```

**Global prefix + static:**

```typescript
app.setGlobalPrefix(globalPrefix);
app.useStaticAssets({ root: path.join(__dirname, '..', 'public') });
```

**WebSocket adapter:**

```typescript
app.useWebSocketAdapter(new RedisIoAdapter(app));
```

---

## 3. ☕ Ứng dụng vào `chalo-be` (The Application)

- **Fastify**: Giữ nếu bạn muốn đồng bộ với Spark (hiệu năng, schema); Express cũng đủ MVP nếu team quen hơn — nhưng đừng trộn lộn trong một repo.
- **CORS**: Thêm origin của mọi môi trường POS (LAN IP tablet, localhost Vite).
- **Swagger**: Bật dev/staging; tắt hoặc bảo vệ basic auth trên production.
- **Redis WebSocket**: Chỉ khi có nhiều instance backend + cần broadcast real-time; single instance có thể dùng adapter mặc định.

---

## 4. 🛠️ Hướng dẫn thực hành (Step-by-step Implementation)

> **Tiên quyết:** Case 02 (`AppConfig` có `port`, `globalPrefix`, `allowedOriginsRaw`, `nodeEnv`). Cài `@nestjs/swagger` khi làm Swagger.

### Step 1 — `fastify.adapter.ts` — trust proxy + giới hạn body

```typescript
// chalo-be/src/common/adapters/fastify.adapter.ts
import { FastifyAdapter } from '@nestjs/platform-fastify';

export const fastifyApp = new FastifyAdapter({
  trustProxy: true,
  logger: false,
  bodyLimit: 10 * 1024 * 1024,
});

// Tuỳ chọn: cookie / multipart — register trên fastifyApp.getInstance()
```

### Step 2 — `main.ts` — thứ tự khởi tạo

Thứ tự khuyến nghị: `create` → `ConfigService` → `setGlobalPrefix` → `enableCors` → `useStaticAssets` → (ValidationPipe trong main hoặc module) → `setupSwagger` (dev) → `listen` → `useLogger` (case 08).

```typescript
// chalo-be/src/main.ts
import { join } from 'path';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { NestFastifyApplication } from '@nestjs/platform-fastify';

import { AppModule } from './app.module';
import { fastifyApp } from './common/adapters/fastify.adapter';
import type { ConfigKeyPaths } from './config';
import type { IAppConfig } from './config/app.config';
import { setupSwagger } from './setup-swagger';
// import { ChaloResponse } from './common/model/chalo-response.model'; // case 06

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, fastifyApp, {
    bufferLogs: true,
  });

  const config = app.get(ConfigService<ConfigKeyPaths>);
  const appCfg = config.get<IAppConfig>('app', { infer: true })!;

  // ChaloResponse.setServiceId(appCfg.name);
  app.setGlobalPrefix(appCfg.globalPrefix);

  const origins = appCfg.allowedOriginsRaw.split(',').map((o) => o.trim());
  app.enableCors({
    origin: (origin, cb) => {
      if (!origin)
        return cb(null, true);
      if (origins.includes(origin))
        return cb(null, true);
      return cb(new Error('CORS'), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  });

  await app.useStaticAssets({ root: join(__dirname, '..', 'public') });

  if (appCfg.nodeEnv !== 'production')
    setupSwagger(app);

  if (appCfg.nodeEnv === 'production')
    app.enableShutdownHooks();

  await app.listen(appCfg.port, '0.0.0.0');
}

bootstrap();
```

### Step 3 — Thư mục `public/`

Tạo `public/.gitkeep`. Kiểm tra URL sau khi chạy (có global prefix hay không tuỳ phiên bản Nest/Fastify).

### Step 4 — `setup-swagger.ts`

```bash
pnpm add @nestjs/swagger
```

```typescript
// chalo-be/src/setup-swagger.ts
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function setupSwagger(app: NestFastifyApplication) {
  const doc = new DocumentBuilder()
    .setTitle('Chalo API')
    .setVersion('0.1')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, doc);
  SwaggerModule.setup('docs', app, document);
}
```

### Step 5 — Reverse proxy

Client dùng HTTPS; Nest listen HTTP sau nginx. `trustProxy: true` để IP client đọc từ `X-Forwarded-For`.

### Step 6 — (Sau) WebSocket + Redis

Khi scale nhiều instance: `app.useWebSocketAdapter(new RedisIoAdapter(app))` — tách khỏi HTTP bootstrap.

**Kiểm tra cuối §4:** URL API có đúng prefix? CORS từ POS? Prod tắt hoặc khóa `/docs`?

---

## 5. ✅ Todo checklist (đánh dấu khi xong / nhờ review)

**Cách dùng:** Nhờ review → gửi **số case 09** + `main.ts` + `fastify.adapter` (nếu dùng Fastify).

_Review codebase:_

- [x] `NestFactory.create` với adapter bạn chọn (Fastify giống Spark hoặc Express có chủ đích) — _`NestFastifyApplication` + `fastifyApp`_
- [ ] Đọc `port` / `globalPrefix` từ config (không hard-code prod) — _đang `process.env.PORT ?? 3000`, chưa `ConfigService`_
- [ ] CORS whitelist từ env (`ALLOWED_ORIGINS` hoặc tương đương)
- [ ] Static assets (nếu cần) hoặc ghi chú “không dùng”
- [ ] Swagger bật dev / tắt hoặc bảo vệ prod
- [ ] `enableShutdownHooks` khi chạy production container
- [ ] (Tuỳ chọn) WebSocket adapter — khi nào cần thì tick

_Phụ: `fastify.adapter.ts` đã set `trustProxy: true`, `logger: false`._
