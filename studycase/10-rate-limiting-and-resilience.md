# Case Study: Rate Limiting & Request Resilience (Timeout)

## 1. 📖 Tóm tắt Case Study

API công khai dễ bị **brute-force login**, spam tạo order, hoặc treo worker vì query chậm. Hai lớp bảo vệ thường gặp: **rate limit** (giới hạn số request theo IP hoặc user) và **timeout** toàn cục (cắt request quá lâu, trả 408/504 tùy cấu hình).

Quán cà phê: quầy và WiFi khách dùng chung egress — ưu tiên giới hạn theo **user đã đăng nhập** để giảm bypass spoof IP; endpoint thanh toán cần timeout hợp lý để không khóa thread.

---

## 2. 🔍 Cách `spark-backend` triển khai (The Reference)

### Luồng hoạt động

1. `@nestjs/throttler` cung cấp `ThrottlerGuard`; Spark mở rộng thành `UserRateLimitGuard` để **tracker** ưu tiên `user.id` khi đã auth, còn không thì fallback IP (qua helper).
2. `TimeoutInterceptor` bọc `next.handle()` với RxJS `timeout(ms)`; nếu `TimeoutError` → `RequestTimeoutException`.

### File cốt lõi

| Vai trò | Đường dẫn |
|--------|------------|
| Rate limit guard | `src/common/guards/user-rate-limit.guard.ts` |
| IP helper | `src/utils/ip.util.ts` (`getRateLimitIdentifier`) |
| Timeout interceptor | `src/common/interceptors/timeout.interceptor.ts` |
| Đăng ký global | `src/app.module.ts` (`APP_GUARD` UserRateLimitGuard, `APP_INTERCEPTOR` TimeoutInterceptor) |
| Throttler config | Tìm `ThrottlerModule` trong codebase (import cùng `AppModule`) |

### Đoạn code quan trọng

**Tracker kết hợp user + IP:**

```typescript
// spark-backend/src/common/guards/user-rate-limit.guard.ts
// Prefer authenticated user id as rate limit key to avoid relying on spoofable IP alone.
@Injectable()
export class UserRateLimitGuard extends ThrottlerGuard {
  protected override getTracker(req: Record<string, any>): Promise<string> {
    const fastifyReq = req as FastifyRequest;
    const userId = (fastifyReq as any).user?.id || (fastifyReq as any).user?.userId;
    return Promise.resolve(getRateLimitIdentifier(fastifyReq, userId));
  }
}
```

**Timeout interceptor:**

```typescript
// spark-backend/src/common/interceptors/timeout.interceptor.ts
// Cuts off slow handlers; maps TimeoutError to RequestTimeoutException for consistent HTTP layer.
intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
  return next.handle().pipe(
    timeout(this.time),
    catchError((err) => {
      if (err instanceof TimeoutError)
        return throwError(() => new RequestTimeoutException('Request timeout'));
      return throwError(() => err);
    }),
  );
}
```

**Đăng ký với factory cho timeout 15s (Spark):**

```typescript
// spark-backend/src/app.module.ts (excerpt)
{ provide: APP_INTERCEPTOR, useFactory: () => new TimeoutInterceptor(15 * 1000) },
{ provide: APP_GUARD, useClass: UserRateLimitGuard },
```

---

## 3. ☕ Ứng dụng vào `chalo-be` (The Application)

- **Login / OTP** (nếu có): limit chặt theo IP + username.
- **Tạo order**: limit theo `staffId` để chống lỗi client lặp vô hạn.
- **Timeout**: 15s có thể quá ngắn cho báo cáo ngày dài; cân nhắc `@SkipThrottle()` hoặc timeout lớn hơn cho route báo cáo, hoặc chuyển báo cáo nặng sang job async.
- **Idempotency** (Spark có `IdempotenceInterceptor`): với thanh toán, nên có key idempotency — có thể là case study riêng sau; MVP ghi nhận trong tài liệu nội bộ.

---

## 4. 🛠️ Hướng dẫn thực hành (Step-by-step Implementation)

> **Cài package:** `pnpm add @nestjs/throttler`

### Step 1 — `ThrottlerModule` toàn cục trong `AppModule`

`ttl` đơn vị **giây** trong v3 (kiểm tra doc phiên bản bạn cài).

```typescript
// chalo-be/src/app.module.ts (imports)
import { ThrottlerModule } from '@nestjs/throttler';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        name: 'global',
        ttl: 60_000, // ms trong một số phiên bản — đọc doc @nestjs/throttler tương ứng package
        limit: 100,
      },
    ]),
    // ...
  ],
})
export class AppModule {}
```

**Quan trọng:** Với `@nestjs/throttler` v5+, cấu hình có thể là `{ throttlers: [{ ttl: 60000, limit: 100 }] }` — mở [doc chính thức](https://docs.nestjs.com/security/rate-limiting) và chỉnh đúng schema phiên bản bạn dùng.

### Step 2 — Guard tracker: ưu tiên user, fallback IP

```typescript
// chalo-be/src/common/utils/client-ip.util.ts
import type { FastifyRequest } from 'fastify';

export function getClientIp(req: FastifyRequest): string {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string')
    return xff.split(',')[0]!.trim();
  return req.socket.remoteAddress ?? 'unknown';
}
```

```typescript
// chalo-be/src/common/guards/chalo-throttler.guard.ts
import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { FastifyRequest } from 'fastify';

import { getClientIp } from '../utils/client-ip.util';

type ReqWithUser = FastifyRequest & { user?: { sub?: string } };

@Injectable()
export class ChaloThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, unknown>): Promise<string> {
    const r = req as ReqWithUser;
    if (r.user?.sub)
      return `user:${r.user.sub}`;
    return `ip:${getClientIp(r)}`;
  }
}
```

### Step 3 — Đăng ký guard global

```typescript
// chalo-be/src/app.module.ts
import { APP_GUARD } from '@nestjs/core';
import { ChaloThrottlerGuard } from './common/guards/chalo-throttler.guard';

@Module({
  // ...
  providers: [{ provide: APP_GUARD, useClass: ChaloThrottlerGuard }],
})
export class AppModule {}
```

**Thứ tự với JWT:** Thường để `JwtAuthGuard` chạy trước để `request.user` có trước khi throttle theo user — kiểm tra thứ tự `APP_GUARD` trong Nest (thực nghiệm: đổi thứ tự hai dòng nếu tracker luôn là IP).

### Step 4 — Giới hạn riêng cho `/auth/login`

Dùng decorator `@Throttle({ default: { limit: 5, ttl: 60000 } })` trên method `login` (cú pháp chính xác theo version throttler).

```typescript
// ví dụ trên AuthController.login
// @Throttle({ default: { limit: 5, ttl: 60_000 } })
```

### Step 5 — Bỏ throttle cho health / docs

```typescript
import { SkipThrottle } from '@nestjs/throttler';

@SkipThrottle()
@Controller('health')
export class HealthController {
  @Get()
  ok() {
    return { ok: true };
  }
}
```

### Step 6 — `TimeoutInterceptor`

```typescript
// chalo-be/src/common/interceptors/timeout.interceptor.ts
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  RequestTimeoutException,
} from '@nestjs/common';
import { Observable, throwError, TimeoutError } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';

@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  constructor(private readonly ms: number) {}

  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      timeout(this.ms),
      catchError((err) => {
        if (err instanceof TimeoutError)
          return throwError(() => new RequestTimeoutException('timeout'));
        return throwError(() => err);
      }),
    );
  }
}
```

Đăng ký:

```typescript
import { APP_INTERCEPTOR } from '@nestjs/core';
// { provide: APP_INTERCEPTOR, useFactory: () => new TimeoutInterceptor(15_000) },
```

Route báo cáo nặng: tăng timeout hoặc `@BypassTransform` + không áp interceptor (hoặc dùng `@UseInterceptors` local với timeout lớn hơn).

### Step 7 — Kiểm thử

Script bash gọi lặp `POST /auth/login` > limit → kỳ vọng `429 Too Many Requests`.

**Kiểm tra cuối §4:** WebSocket có bị ảnh hưởng không? Upload file lớn có vượt quá timeout? Login có bị limit quá chặt cho môi trường dev?

---

## 5. ✅ Todo checklist (đánh dấu khi xong / nhờ review)

**Cách dùng:** Nhờ review → gửi **số case 10** + cấu hình Throttler + route được skip (nếu có).

_Review codebase: không có `@nestjs/throttler`, không có timeout interceptor._

- [ ] `ThrottlerModule.forRoot` với `ttl` / `limit` hợp lý
- [ ] Guard global (vd. extend `ThrottlerGuard`) với tracker ưu tiên user đã login
- [ ] Thử vượt limit trên endpoint login hoặc API thử — nhận 429 (hoặc behavior bạn thiết kế)
- [ ] `TimeoutInterceptor` (hoặc tương đương) với ngưỡng ms hợp lý
- [ ] Route báo cáo nặng / upload lớn: không bị timeout quá ngắn (đã xử lý hoặc ghi chú TODO)
- [ ] (Tuỳ chọn) `@SkipThrottle()` cho health/Swagger nếu cần
