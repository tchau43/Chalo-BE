# Bước 2 — Case study: typed env (`env`, `envNumber`, `envBoolean`)

**Vị trí trong lộ trình:** ngay sau dependencies (bước 1), **trước** `ConfigModule` (bước 3) và **trước** Fastify bootstrap (bước 4).  
Mọi `registerAs` sau này đọc biến môi trường qua helper thống nhất — tránh `Number(undefined)` và boolean kiểu chuỗi sai.

**Tham chiếu ý tưởng:** `spark-backend/src/global/env.ts` (đã rút gọn, bỏ cluster).

---

## 2.1 File `src/global/env.ts`

```typescript
/**
 * Parse biến môi trường — dùng cho toàn app (config, script).
 * Boolean: giá trị trong .env nên là JSON hợp lệ: true / false
 */
type BaseType = boolean | number | string | undefined | null

function formatValue<T extends BaseType = string>(
  key: string,
  defaultValue: T,
  callback?: (value: string) => T,
): T {
  const value = process.env[key]
  if (value === undefined)
    return defaultValue

  if (!callback)
    return value as unknown as T

  return callback(value)
}

export function env(key: string, defaultValue = ''): string {
  return formatValue(key, defaultValue)
}

export function envNumber(key: string, defaultValue = 0): number {
  return formatValue(key, defaultValue, (v) => {
    const n = Number(v)
    if (Number.isNaN(n))
      throw new Error(`Environment ${key} is not a valid number: ${v}`)
    return n
  })
}

export function envBoolean(key: string, defaultValue = false): boolean {
  return formatValue(key, defaultValue, (v) => {
    try {
      return Boolean(JSON.parse(v)) as boolean
    }
    catch {
      throw new Error(`Environment ${key} must be JSON boolean: true or false (got: ${v})`)
    }
  })
}
```

**Ghi chú ôn tập:**

- `envBoolean('DB_SYNCHRONIZE')` trong `.env` viết `DB_SYNCHRONIZE=true` hoặc `false` (không ngoặc cũng được vì `JSON.parse('true')`).
- Nếu muốn chấp nhận `1`/`0`, mở rộng callback (case study mở rộng).

---

## 2.2 Dùng trong config (preview bước 3)

Ví dụ `app.config.ts`:

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

---

## Checkpoint

- Import `~/global/env` không lỗi (đã có `paths` ở bước 1 + `tsc-alias` khi build nếu dùng alias).

Sang: [03-config-database-security.md](./03-config-database-security.md)
