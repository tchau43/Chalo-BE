# Case Study: Environment & Typed Configuration

## 1. 📖 Tóm tắt Case Study

Ứng dụng backend cần **cấu hình theo môi trường** (dev/staging/prod) mà không hard-code secret hoặc URL. Pattern chuẩn: đọc `.env` + **đăng ký namespace config** (`registerAs`) để `ConfigService` inject có kiểu (type-safe) và có default hợp lý.

Hệ quản lý quán cần điều này cho: chuỗi kết nối Postgres, JWT secret, CORS origin cho POS web, và sau này URL kết nối máy in / payment gateway.

---

## 2. 🔍 Cách `spark-backend` triển khai (The Reference)

### Luồng hoạt động

1. `ConfigModule.forRoot` trong `AppModule` chỉ định thứ tự file env (`.env.local` → `.env.${NODE_ENV}` → `.env`) và `load` mảng các factory `registerAs`.
2. Mỗi file `src/config/*.config.ts` export một namespace (ví dụ `app`, `database`, `security`) qua `registerAs`.
3. `src/global/env.ts` cung cấp helper `env`, `envNumber`, `envBoolean` để parse an toàn khi build object config (đặc biệt khi TypeORM CLI hoặc script chạy ngoài Nest).

### File cốt lõi

| Vai trò               | Đường dẫn                                    |
| --------------------- | -------------------------------------------- |
| Gom config namespaces | `src/config/index.ts`                        |
| App-level settings    | `src/config/app.config.ts`                   |
| Database options      | `src/config/database.config.ts`              |
| Env helpers           | `src/global/env.ts`                          |
| Wiring vào Nest       | `src/app.module.ts` (`ConfigModule.forRoot`) |

### Đoạn code quan trọng

**Đăng ký global config + merge các namespace:**

```typescript
// spark-backend/src/app.module.ts (excerpt)
// isGlobal: true => any module can inject ConfigService without re-importing ConfigModule.
ConfigModule.forRoot({
  isGlobal: true,
  expandVariables: true,
  envFilePath: ['.env.local', `.env.${process.env.NODE_ENV}`, '.env'],
  load: [...Object.values(config)],
}),
```

**Namespace `app` với typed `ConfigType`:**

```typescript
// spark-backend/src/config/app.config.ts
// registerAs('app', ...) => configService.get('app', { infer: true }) is typed as IAppConfig.
export const AppConfig = registerAs(appRegToken, () => ({
  name: env('APP_NAME'),
  port: envNumber('APP_PORT', 3000),
  globalPrefix: env('GLOBAL_PREFIX', 'api'),
  multiDeviceLogin: envBoolean('MULTI_DEVICE_LOGIN', true),
  // ...
}));
export type IAppConfig = ConfigType<typeof AppConfig>;
```

**Type map toàn bộ namespaces (`ConfigKeyPaths`):**

```typescript
// spark-backend/src/config/index.ts
export interface AllConfigType {
  [appRegToken]: IAppConfig;
  [dbRegToken]: IDatabaseConfig;
  // ...
}
export type ConfigKeyPaths = RecordNamePaths<AllConfigType>;
```

---

## 3. ☕ Ứng dụng vào `chalo-be` (The Application)

- **Giữ**: `registerAs` theo domain (`app`, `database`, `security`); helper `env*` cho parse số/boolean.
- **Thêm khi cần**: namespace `chalo` hoặc `pos` cho các biến riêng (ví dụ `SHIFT_CLOSING_GRACE_MINUTES`, `TAX_RATE`) — tránh nhét hết vào `app`.
- **Không bắt chước blind**: Spark có MinIO, Firebase, Mailer — Chalo chỉ thêm khi có tính năng (ảnh menu, email hóa đơn).

**Flow đề xuất:** `.env.example` trong repo (không chứa secret thật) + document từng biến; prod dùng biến môi trường của hosting, không commit `.env.production`.

---

## 4. 🛠️ Hướng dẫn thực hành (Step-by-step Implementation)

> **Tiên quyết:** Đã có `src/global/env.ts` (hoặc bạn tạo theo mẫu case này). **Không** commit file `.env` có secret; chỉ commit `.env.example`.

### Step 1 — Chuẩn hóa `src/global/env.ts` (minh họa đầy đủ)

File này dùng khi **build object config** và khi script CLI đọc env **ngoài** Nest. Các hàm cần: `env`, `envNumber`, `envBoolean`, `envString`.

```typescript
// chalo-be/src/global/env.ts
export type BaseType = string | number | boolean | undefined | null;

function formatVal<T extends BaseType = string>(
  key: string,
  defaultVal: T,
  callback?: (value: string) => T,
): T {
  const raw = process.env[key];
  if (raw === undefined)
    return defaultVal;
  if (!callback)
    return raw as unknown as T;
  return callback(raw);
}

export function env(key: string, defaultVal = '') {
  return formatVal(key, defaultVal);
}

export function envNumber(key: string, defaultVal = 0) {
  return formatVal<number>(key, defaultVal, (value) => {
    const num = Number(value);
    if (Number.isNaN(num))
      throw new Error(`${key} must be a number`);
    return num;
  });
}

export function envBoolean(key: string, defaultVal = false) {
  return formatVal<boolean>(key, defaultVal, (value) => {
    const v = value.trim().toLowerCase();
    if (v === 'true' || v === '1')
      return true;
    if (v === 'false' || v === '0')
      return false;
    throw new Error(`${key} must be true/false`);
  });
}
```

### Step 2 — `app.config.ts`: namespace `app` (port, prefix, tên service)

`registerAs('app', factory)` đăng ký namespace; sau này `configService.get('app', { infer: true })` trả về object đúng kiểu.

```typescript
// chalo-be/src/config/app.config.ts
import { registerAs } from '@nestjs/config';
import type { ConfigType } from '@nestjs/config';
import { env, envBoolean, envNumber } from '../global/env';

export const appRegToken = 'app';

const globalPrefix = env('GLOBAL_PREFIX', 'api');

export const AppConfig = registerAs(appRegToken, () => ({
  name: env('CHALO_APP_NAME', 'chalo-be'),
  port: envNumber('CHALO_PORT', 3000),
  globalPrefix,
  nodeEnv: env('NODE_ENV', 'development'),
  /** Dùng cho CORS case 09 — có thể bổ sung sau */
  allowedOriginsRaw: env('ALLOWED_ORIGINS', 'http://localhost:5173'),
  logger: {
    level: env('LOGGER_LEVEL', 'info'),
    maxFiles: envNumber('LOGGER_MAX_FILES', 14),
  },
}));

export type IAppConfig = ConfigType<typeof AppConfig>;

/** Whitelist path đầy đủ (có prefix) cho guard auth — cập nhật khi có route login */
export const buildAuthPublicPaths = (prefix: string) => [
  `/${prefix}/auth/login`.replace(/\/+/g, '/'),
];
```

### Step 3 — `database.config.ts` + `security.config.ts`

**Database** — dùng cho cả Nest `TypeOrmModule` và (tuỳ chọn) DataSource CLI.

```typescript
// chalo-be/src/config/database.config.ts
import { registerAs } from '@nestjs/config';
import type { ConfigType } from '@nestjs/config';
import type { DataSourceOptions } from 'typeorm';
import { env, envBoolean, envNumber } from '../global/env';

export const dbRegToken = 'database';

export const DatabaseConfig = registerAs(
  dbRegToken,
  (): DataSourceOptions => ({
    type: 'postgres',
    host: env('DB_HOST', '127.0.0.1'),
    port: envNumber('DB_PORT', 5432),
    username: env('DB_USERNAME', 'postgres'),
    password: env('DB_PASSWORD', 'postgres'),
    database: env('DB_DATABASE', 'chalo'),
    synchronize: envBoolean('DB_SYNCHRONIZE', false),
    autoLoadEntities: true, // có thể override trong DatabaseModule
    entities: [__dirname + '/../**/*.entity{.ts,.js}'], // chỉnh theo cấu trúc build của bạn
    migrations: [__dirname + '/../../migrations/*{.ts,.js}'],
    extra: {
      max: envNumber('DB_POOL_MAX', 10),
      connectionTimeoutMillis: envNumber('DB_POOL_TIMEOUT', 30_000),
    },
  }),
);

export type IDatabaseConfig = ConfigType<typeof DatabaseConfig>;
```

**Security** — JWT (case 04).

```typescript
// chalo-be/src/config/security.config.ts
import { registerAs } from '@nestjs/config';
import type { ConfigType } from '@nestjs/config';
import { env, envNumber } from '../global/env';

export const securityRegToken = 'security';

export const SecurityConfig = registerAs(securityRegToken, () => ({
  jwtSecret: env('JWT_SECRET', 'change-me-in-dev-only'),
  jwtExpiresSeconds: envNumber('JWT_EXPIRES_SECONDS', 3600),
}));

export type ISecurityConfig = ConfigType<typeof SecurityConfig>;
```

### Step 4 — `index.ts`: gom `load` + type an toàn cho `ConfigService`

Cách đơn giản **không** cần utility `RecordNamePaths` của Spark:

```typescript
// chalo-be/src/config/index.ts
import { AppConfig, appRegToken, type IAppConfig } from './app.config';
import { DatabaseConfig, dbRegToken, type IDatabaseConfig } from './database.config';
import { SecurityConfig, securityRegToken, type ISecurityConfig } from './security.config';

const configLoaders = [AppConfig, DatabaseConfig, SecurityConfig];

export default configLoaders;

/** Map token → interface — dùng khi inject ConfigService<ConfigKeyPaths> */
export interface AllConfigType {
  [appRegToken]: IAppConfig;
  [dbRegToken]: IDatabaseConfig;
  [securityRegToken]: ISecurityConfig;
}

export type ConfigKeyPaths = AllConfigType;
```

**Cách inject có kiểu trong service:**

```typescript
import { ConfigService } from '@nestjs/config';
import type { ConfigKeyPaths } from '~/config';
// constructor(private readonly config: ConfigService<ConfigKeyPaths>) {}
// this.config.get('app', { infer: true }).port
```

(Cần alias `~` trong `tsconfig` hoặc dùng đường dẫn tương đối.)

### Step 5 — Gắn `ConfigModule.forRoot` vào `AppModule`

```typescript
// chalo-be/src/app.module.ts (phần imports)
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configLoaders from './config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      expandVariables: true,
      envFilePath: ['.env.local', `.env.${process.env.NODE_ENV ?? 'development'}`, '.env'],
      load: configLoaders,
    }),
  ],
})
export class AppModule {}
```

### Step 6 — Tạo `.env.example` (bắt buộc)

```env
# .env.example — copy thành .env và điền giá trị thật
NODE_ENV=development
CHALO_APP_NAME=chalo-be
CHALO_PORT=3000
GLOBAL_PREFIX=api
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000

DB_HOST=127.0.0.1
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_DATABASE=chalo
DB_SYNCHRONIZE=false
DB_POOL_MAX=10

JWT_SECRET=replace-with-long-random-string
JWT_EXPIRES_SECONDS=3600

LOGGER_LEVEL=info
LOGGER_MAX_FILES=14
```

### Step 7 — Verify

```bash
pnpm run build
pnpm run start:dev
```

Tạo `src/config/config-debug.controller.ts` tạm (xóa sau) inject `ConfigService` và `GET /debug/config` chỉ log `port` — **không** trả `jwtSecret` ra client.

**Kiểm tra cuối §4:** Mọi secret chỉ nằm trong env? `JWT_SECRET` đủ dài trên prod? `infer: true` hoạt động với `get('app')`?

---

## 5. ✅ Todo checklist (đánh dấu khi xong / nhờ review)

**Cách dùng:** Nhờ review → gửi **số case 02** + nội dung `AppConfig` / `DatabaseConfig` (hoặc diff).

_Review codebase:_

- [x] Có `src/global/env.ts` (hoặc tương đương) với `env` / `envNumber` / `envBoolean`
- [ ] Có `registerAs` cho namespace `app` (port, prefix, tên service, …)
- [ ] Có `registerAs` cho `database` và/hoặc `security` tùy giai đoạn
- [ ] `src/config/index.ts` export `load` array + type `ConfigKeyPaths` (hoặc cách type-safe bạn chọn)
- [ ] `ConfigModule.forRoot` trong `AppModule`: `isGlobal`, `envFilePath` theo `NODE_ENV` — _trong `app.module.ts` vẫn TODO comment_
- [ ] File `.env.example` liệt kê mọi biến cần thiết, **không** chứa secret thật — _chưa có file; có `.env` local (không đánh giá nội dung)_
