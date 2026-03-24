# Case Study: Logging — Winston, daily rotate, Nest Logger replacement

## 1. 📖 Tóm tắt Case Study

Vận hành quán cần **dấu vết** khi có sự cố: ai đăng nhập, order nào thanh toán lỗi, deadlock DB. Logging tách **console dev** (dễ đọc) và **file/json prod** (máy chủ thu thập). Spark dùng Winston + daily rotate file và gắn làm logger của Nest sau khi listen.

Quán cà phê: log không nên chứa PII nhạy cảm (full thẻ, password); order id / staff id là đủ cho điều tra.

---

## 2. 🔍 Cách `spark-backend` triển khai (The Reference)

### Luồng hoạt động

1. `LoggerService` extends `ConsoleLogger`, khởi tạo Winston với `DailyRotateFile` cho `app` và `app-error`.
2. Cấp độ và `maxFiles` đọc từ `ConfigService` (`app.logger.level`, `app.logger.maxFiles`).
3. Trong `main.ts`, sau `app.listen`, gọi `app.useLogger(app.get(LoggerService))` để log framework dùng cùng backend.
4. Dev thêm `LoggingInterceptor` global để log request/response (chỉ khi `isDev`).

### File cốt lõi

| Vai trò | Đường dẫn |
|--------|------------|
| Winston service | `src/shared/logger/logger.service.ts` |
| Module | `src/shared/logger/logger.module.ts` |
| Request logging | `src/common/interceptors/logging.interceptor.ts` |
| Bootstrap hook | `src/main.ts` |
| Env flags | `src/global/env.ts` (`isDev`) |

### Đoạn code quan trọng

**Winston transports (excerpt):**

```typescript
// spark-backend/src/shared/logger/logger.service.ts (excerpt)
// JSON logs to daily files; separate error-level file for alerting pipelines.
this.winstonLogger = createLogger({
  levels: config.npm.levels,
  format: format.combine(format.errors({ stack: true }), format.timestamp(), format.json()),
  transports: [
    new transports.DailyRotateFile({
      level: this.level,
      filename: 'logs/app.%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxFiles: this.maxFiles,
    }),
    new transports.DailyRotateFile({
      level: LogLevel.ERROR,
      filename: 'logs/app-error.%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxFiles: this.maxFiles,
    }),
  ],
});
```

**Gắn logger vào Nest sau listen:**

```typescript
// spark-backend/src/main.ts (excerpt)
await app.listen(port, '0.0.0.0', async () => {
  app.useLogger(app.get(LoggerService));
  // ...
});
```

---

## 3. ☕ Ứng dụng vào `chalo-be` (The Application)

- **MVP**: `nestjs-pino` hoặc Winston đều ổn; quan trọng là **structured log** (JSON fields: `level`, `msg`, `requestId`, `staffId`).
- **Correlation id**: Spark dùng CLS (`ClsModule`) cho `operateId`; Chalo nên có `requestId` middleware/interceptor để trace một order flow qua nhiều service call.
- **Compliance**: không log full JWT, không log body thanh toán.

---

## 4. 🛠️ Hướng dẫn thực hành (Step-by-step Implementation)

> **Cài package:** `pnpm add winston winston-daily-rotate-file` (hoặc npm).

### Step 1 — Bổ sung env trong `AppConfig` (case 02)

Đã gợi ý `LOGGER_LEVEL`, `LOGGER_MAX_FILES` trong case 02 — đảm bảo `.env.example` có hai biến này.

### Step 2 — `ChaloLoggerService` kế thừa `ConsoleLogger`

Nest mặc định inject `context` qua factory. Cách **đơn giản** không đụng dynamic module: dùng `Logger` của Nest cho dev, Winston cho file; hoặc làm module như dưới.

```typescript
// chalo-be/src/shared/logger/chalo-logger.service.ts
import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createLogger, format, transports, type Logger as WinstonLogger } from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

import type { ConfigKeyPaths } from '../../config';
import type { IAppConfig } from '../../config/app.config';

@Injectable()
export class ChaloLoggerService implements NestLoggerService {
  private readonly winston: WinstonLogger;

  constructor(private readonly config: ConfigService<ConfigKeyPaths>) {
    const app = this.config.get<IAppConfig>('app', { infer: true })!;
    this.winston = createLogger({
      level: app.logger.level,
      format: format.combine(format.timestamp(), format.errors({ stack: true }), format.json()),
      transports: [
        new DailyRotateFile({
          filename: 'logs/chalo-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          maxFiles: String(app.logger.maxFiles),
          level: app.logger.level,
        }),
        new DailyRotateFile({
          filename: 'logs/chalo-error-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          maxFiles: String(app.logger.maxFiles),
          level: 'error',
        }),
      ],
    });

    if (app.nodeEnv === 'development') {
      this.winston.add(
        new transports.Console({
          format: format.combine(format.colorize(), format.simple()),
        }),
      );
    }
  }

  log(message: string, context?: string) {
    this.winston.info({ message, context });
  }

  error(message: string, trace?: string, context?: string) {
    this.winston.error({ message, trace, context });
  }

  warn(message: string, context?: string) {
    this.winston.warn({ message, context });
  }

  debug(message: string, context?: string) {
    this.winston.debug({ message, context });
  }

  verbose(message: string, context?: string) {
    this.winston.verbose({ message, context });
  }
}
```

Tạo thư mục `logs/` hoặc để Winston tự tạo; thêm `logs/` vào `.gitignore`.

### Step 3 — `LoggerModule`

```typescript
// chalo-be/src/shared/logger/logger.module.ts
import { Global, Module } from '@nestjs/common';
import { ChaloLoggerService } from './chalo-logger.service';

@Global()
@Module({
  providers: [ChaloLoggerService],
  exports: [ChaloLoggerService],
})
export class LoggerModule {}
```

Import `LoggerModule` vào `AppModule` **sau** `ConfigModule`.

### Step 4 — Gắn Nest dùng Winston (sau `listen`)

```typescript
// chalo-be/src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ChaloLoggerService } from './shared/logger/chalo-logger.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const port = 3000;
  await app.listen(port, '0.0.0.0');
  app.useLogger(app.get(ChaloLoggerService));
}
bootstrap();
```

`bufferLogs: true` giúp log sớm trong bootstrap không bị mất trước khi gắn logger.

### Step 5 — (Tuỳ chọn) `LoggingInterceptor` chỉ development

```typescript
// chalo-be/src/common/interceptors/logging.interceptor.ts
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<{ method?: string; url?: string }>();
    const start = Date.now();
    return next.handle().pipe(
      tap(() => {
        this.logger.log(`${req.method} ${req.url} ${Date.now() - start}ms`);
      }),
    );
  }
}
```

Trong `main.ts`: nếu `NODE_ENV === 'development'` thì `app.useGlobalInterceptors(new LoggingInterceptor())`.

### Step 6 — Không log dữ liệu nhạy cảm

Quy tắc: không `log(body)` cho login; không log full `Authorization`. Chỉ log `staffId`, `orderId`, `requestId`.

**Kiểm tra cuối §4:** File rotate có giới hạn `maxFiles`? Production có log ra stdout (Docker) nếu cần? Thư mục `logs` đã ignore git?

---

## 5. ✅ Todo checklist (đánh dấu khi xong / nhờ review)

**Cách dùng:** Nhờ review → gửi **số case 08** + sample dòng log JSON + cấu hình level.

_Review codebase: không có `winston` trong `package.json`; `main.ts` chỉ `console.log("")`._

- [ ] `LoggerModule` / service tích hợp Winston (hoặc Pino nếu bạn chọn — ghi rõ trong README)
- [ ] Log ra file rotate hoặc stdout phù hợp môi trường deploy
- [ ] `app.useLogger(...)` sau listen (hoặc tương đương) để Nest dùng cùng backend
- [ ] Level + retention (`LOGGER_LEVEL`, `LOGGER_MAX_FILES`) đọc từ config
- [ ] Không log JWT đầy đủ, password, hoặc PII nhạy cảm
- [ ] (Tuỳ chọn) `LoggingInterceptor` chỉ bật `development`
