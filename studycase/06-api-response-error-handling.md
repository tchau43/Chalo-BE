# Case Study: Chuẩn hóa Response API & Global Error Handling

## 1. 📖 Tóm tắt Case Study

Client (POS, mobile, web admin) dễ tích hợp khi **mọi JSON** có cùng dạng: `meta` (code, type, message, …) + `data`. Lỗi dù HTTP status nào cũng map về envelope tương thích; lỗi 500 ở production không lộ stack/message nhạy cảm.

Quán cà phê: màn hình quầy cần hiển thị lỗi rõ ràng (“hết hàng”, “bàn đang có order mở”) — phân biệt **BusinessException** (lỗi nghiệp vụ có mã) với lỗi hệ thống.

---

## 2. 🔍 Cách `spark-backend` triển khai (The Reference)

### Luồng hoạt động

1. **Thành công**: `TransformInterceptor` bọc body trả về thành `new ResOp(HttpStatus.OK, data)`.
2. **Bỏ bọc**: decorator `@Bypass` để file stream / webhook không bị bọc.
3. **Lỗi**: `AllExceptionsFilter` `@Catch()` mọi exception → chuẩn hóa `ResOp` với `type`/`code`; `BusinessException` mang `errorCode` và `errorType` riêng; message escape chống XSS; 500 ẩn chi tiết ngoài dev.

### File cốt lõi

| Vai trò | Đường dẫn |
|--------|------------|
| Envelope model | `src/common/model/response.model.ts` |
| Success interceptor | `src/common/interceptors/transform.interceptor.ts` |
| Global filter | `src/common/filters/any-exception.filter.ts` |
| Business errors | `src/common/exceptions/biz.exception.ts` |
| Bypass decorator | `src/common/decorators/bypass.decorator.ts` |
| Bootstrap set service id | `src/main.ts` (`ResOp.setServiceId`) |

### Đoạn code quan trọng

**Envelope `ResOp`:**

```typescript
// spark-backend/src/common/model/response.model.ts (excerpt)
// meta holds string code, type, message, service_id for clients to parse uniformly.
export class ResOp<T = any> {
  meta: ResponseMeta;
  data?: T;

  constructor(code: number, data: T, message = RESPONSE_SUCCESS_MSG, type = 'SUCCESS', extraMeta: Record<string, any> = {}) {
    this.meta = {
      code: String(code),
      type,
      message,
      service_id: ResOp.serviceId,
      extra_meta: extraMeta,
    };
    this.data = data;
  }

  static setServiceId(name: string) {
    ResOp.serviceId = name.toLowerCase().replace(/\s+/g, '-');
  }
}
```

**TransformInterceptor:**

```typescript
// spark-backend/src/common/interceptors/transform.interceptor.ts (excerpt)
// If handler not @Bypass, wrap return value in ResOp OK envelope.
if (bypass)
  return next.handle();

return next.handle().pipe(
  map((data) => new ResOp(HttpStatus.OK, data ?? null)),
);
```

**AllExceptionsFilter — sanitize & hide 500:**

```typescript
// spark-backend/src/common/filters/any-exception.filter.ts (excerpt)
const status = this.getStatus(exception);
let message = this.getErrorMessage(exception);

if (status === HttpStatus.INTERNAL_SERVER_ERROR && !(exception instanceof BusinessException)) {
  if (!isDev)
    message = escape(ErrorEnum.SERVER_ERROR?.split(':')[1]);
}

const apiErrorCode = exception instanceof BusinessException ? exception.getErrorCode() : status;
const errorType = exception instanceof BusinessException ? exception.getErrorType() : this.getHttpErrorType(status);

response.status(status).send(new ResOp(apiErrorCode, null, message, errorType));
```

**BusinessException — HTTP 200 body with business code (Spark convention):**

```typescript
// spark-backend/src/common/exceptions/biz.exception.ts (excerpt)
// ErrorEnum values like "10001:Invalid credentials" => code + message split.
constructor(error: ErrorEnum | string) {
  const [code, ...messageParts] = error.split(':');
  super(HttpException.createBody({ code, message: messageParts.join(':') }), HttpStatus.OK);
  this.errorCode = Number(code);
}
```

---

## 3. ☕ Ứng dụng vào `chalo-be` (The Application)

- **Quyết định kiến trúc**: Bạn có giữ convention “business error trả HTTP 200 + code trong meta” như Spark hay chuyển sang **4xx/422 + body chuẩn** — cả hai đều được miễn là frontend thống nhất.
- **Mã lỗi nghiệp vụ**: Định nghĩa enum/file constant cho quán (`OUT_OF_STOCK`, `TABLE_OCCUPIED`) để POS map sang toast.
- **Validation**: Spark dùng `ValidationPipe` với `UnprocessableEntityException` — filter vẫn bọc được; đảm bảo message user-friendly tiếng Việt nếu cần (i18n layer sau).

---

## 4. 🛠️ Hướng dẫn thực hành (Step-by-step Implementation)

> **Mục tiêu:** Mọi response JSON cùng một “envelope”; lỗi map về cùng format. Fastify dùng `reply.status(code).send(body)`.

### Step 1 — Hằng HTTP success và class envelope

```typescript
// chalo-be/src/common/constants/response.constant.ts
export const HTTP_OK = 200;
export const MSG_OK = 'OK';
export const TYPE_SUCCESS = 'SUCCESS';
export const TYPE_ERROR = 'ERROR';
```

```typescript
// chalo-be/src/common/model/chalo-response.model.ts
import { HTTP_OK, MSG_OK, TYPE_SUCCESS } from '../constants/response.constant';

export class ChaloResponse<T = unknown> {
  static serviceId = 'chalo-be';

  meta: {
    code: string;
    type: string;
    message: string;
    service_id: string;
  };
  data: T | null;

  constructor(
    code: number,
    data: T | null,
    message: string = MSG_OK,
    type: string = TYPE_SUCCESS,
  ) {
    this.meta = {
      code: String(code),
      type,
      message,
      service_id: ChaloResponse.serviceId,
    };
    this.data = data;
  }

  static setServiceId(id: string) {
    ChaloResponse.serviceId = id.replace(/\s+/g, '-').toLowerCase();
  }
}
```

### Step 2 — `BusinessException` + mã lỗi nghiệp vụ

```typescript
// chalo-be/src/common/constants/error-codes.constant.ts
export const BusinessErrors = {
  OUT_OF_STOCK: '40001:The item is out of stock',
  TABLE_OCCUPIED: '40002:Table is already occupied',
} as const;
```

```typescript
// chalo-be/src/common/exceptions/business.exception.ts
import { HttpException, HttpStatus } from '@nestjs/common';
import { TYPE_ERROR } from '../constants/response.constant';

export class BusinessException extends HttpException {
  private readonly bizCode: number;
  private readonly bizType: string;

  constructor(code: number, message: string, bizType = TYPE_ERROR) {
    super({ code, message }, HttpStatus.BAD_REQUEST);
    this.bizCode = code;
    this.bizType = bizType;
  }

  getBizCode() {
    return this.bizCode;
  }
  getBizType() {
    return this.bizType;
  }

  /** Helper: parse "40001:message" */
  static fromPair(pair: string) {
    const [c, ...rest] = pair.split(':');
    return new BusinessException(Number(c), rest.join(':') || 'Error');
  }
}
```

### Step 3 — `@BypassTransform()` để không bọc envelope (file, raw)

```typescript
// chalo-be/src/common/decorators/bypass-transform.decorator.ts
import { SetMetadata } from '@nestjs/common';

export const BYPASS_TRANSFORM_KEY = 'chalo:bypassTransform';
export const BypassTransform = () => SetMetadata(BYPASS_TRANSFORM_KEY, true);
```

### Step 4 — `TransformInterceptor`

```typescript
// chalo-be/src/common/interceptors/transform.interceptor.ts
import {
  CallHandler,
  ExecutionContext,
  HttpStatus,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { BYPASS_TRANSFORM_KEY } from '../decorators/bypass-transform.decorator';
import { ChaloResponse } from '../model/chalo-response.model';
import { MSG_OK, TYPE_SUCCESS } from '../constants/response.constant';

@Injectable()
export class TransformInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const bypass = this.reflector.getAllAndOverride<boolean>(BYPASS_TRANSFORM_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (bypass)
      return next.handle();

    return next.handle().pipe(
      map((data) => new ChaloResponse(HttpStatus.OK, data ?? null, MSG_OK, TYPE_SUCCESS)),
    );
  }
}
```

**Đăng ký:** `{ provide: APP_INTERCEPTOR, useClass: TransformInterceptor }` trong `AppModule`.

### Step 5 — `AllExceptionsFilter` (HttpException + unknown)

```typescript
// chalo-be/src/common/filters/all-exceptions.filter.ts
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { FastifyReply } from 'fastify';

import { BusinessException } from '../exceptions/business.exception';
import { ChaloResponse } from '../model/chalo-response.model';
import { TYPE_ERROR } from '../constants/response.constant';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const reply = ctx.getResponse<FastifyReply>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let code = status;
    let type = TYPE_ERROR;

    if (exception instanceof BusinessException) {
      status = exception.getStatus();
      const res = exception.getResponse() as { message?: string };
      message = typeof res.message === 'string' ? res.message : message;
      code = exception.getBizCode();
      type = exception.getBizType();
    }
    else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      message =
        typeof res === 'string'
          ? res
          : (res as { message?: string | string[] }).message?.toString() ?? message;
    }
    else if (exception instanceof Error) {
      message = exception.message;
    }

    if (status === HttpStatus.INTERNAL_SERVER_ERROR)
      this.logger.error(exception);

    const body = new ChaloResponse(code, null, message, type);
    reply.status(status).send(body);
  }
}
```

**Đăng ký:** `{ provide: APP_FILTER, useClass: AllExceptionsFilter }` — **filter thường đăng ký trước** interceptor trong docs Nest; giữ một nguồn response shape.

### Step 6 — Bootstrap: `ChaloResponse.setServiceId`

Sau `ConfigModule` load, trong `main.ts`:

```typescript
import { ChaloResponse } from './common/model/chalo-response.model';
import { ConfigService } from '@nestjs/config';
// const app = await NestFactory.create(...);
// const cfg = app.get(ConfigService);
// ChaloResponse.setServiceId(cfg.get('app', { infer: true }).name);
```

### Step 7 — Dùng trong service

```typescript
throw BusinessException.fromPair(BusinessErrors.OUT_OF_STOCK);
```

### Step 8 — (Tuỳ chọn) Escape HTML trong message

Nếu client render message trong HTML, dùng `lodash/escape` trước khi gửi — giống spark `any-exception.filter`.

**Kiểm tra cuối §4:** `GET` thành công có `meta` + `data`? `throw new BadRequestException('x')` vẫn ra envelope? Route `@BypassTransform()` trả raw?

---

## 5. ✅ Todo checklist (đánh dấu khi xong / nhờ review)

**Cách dùng:** Nhờ review → gửi **số case 06** + ví dụ JSON success/error thực tế từ API.

_Review codebase: `app.module` vẫn TODO `APP_FILTER` / interceptor — chưa có envelope._

- [ ] Class envelope (vd. `ChaloResponse` / `ResOp`) với `meta` + `data`
- [ ] `TransformInterceptor` bọc response thành công (HTTP 2xx)
- [ ] Decorator `@Bypass()` (hoặc tương đương) cho route không bọc envelope
- [ ] `AllExceptionsFilter` (hoặc tên tương đương) đăng ký `APP_FILTER`
- [ ] `BusinessException` + enum/file mã lỗi nghiệp vụ Chalo (ít nhất 2 mã thử)
- [ ] Production: không lộ stack/message nhạy cảm cho lỗi 500
- [ ] `escape` / sanitize message lỗi nếu client hiển thị HTML
- [ ] Gọi `setServiceId` (hoặc field tương đương) ở bootstrap nếu envelope có `service_id`
