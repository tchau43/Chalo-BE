# Case Study: Validation Pipeline — DTO, class-validator, ValidationPipe

## 1. 📖 Tóm tắt Case Study

Input từ HTTP phải được **kiểm tra trước khi vào service**: kiểu dữ liệu, độ dài, enum, quan hệ (vd. `tableId` UUID hợp lệ). Nest dùng `class-validator` + `class-transformer` qua `ValidationPipe` toàn cục: `whitelist` loại bỏ field thừa, `transform` ép kiểu query/param.

Quán cà phê: tạo order với số lượng âm, giá null, hoặc foreign key sai format phải bị chặn tại cửa HTTP — giảm bug nghiệp vụ và SQL lỗi.

---

## 2. 🔍 Cách `spark-backend` triển khai (The Reference)

### Luồng hoạt động

1. `main.ts` đăng ký `ValidationPipe` global với `transform: true`, `whitelist: true`, `transformOptions.enableImplicitConversion: true`.
2. DTO trong `modules/*/dto/*.ts` dùng decorator `@IsString`, `@IsInt`, `@Min`, …
3. `useContainer(app.select(AppModule), { fallbackOnErrors: true })` cho phép **custom class-validator constraint** inject service (vd. kiểm tra tồn tại entity — Spark có `EntityExistConstraint`).

### File cốt lõi

| Vai trò | Đường dẫn |
|--------|------------|
| Global pipe | `src/main.ts` |
| class-validator DI | `src/main.ts` (`useContainer`) |
| Custom DB constraints | `src/shared/database/constraints/*.ts` |
| Ví dụ DTO | `src/modules/user/dto/user.dto.ts` |

### Đoạn code quan trọng

**ValidationPipe global:**

```typescript
// spark-backend/src/main.ts (excerpt)
useContainer(app.select(AppModule), { fallbackOnErrors: true });

app.useGlobalPipes(
  new ValidationPipe({
    transform: true,
    whitelist: true,
    transformOptions: { enableImplicitConversion: true },
    errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
    stopAtFirstError: true,
    exceptionFactory: (errors) =>
      new UnprocessableEntityException(
        errors.map((e) => {
          const rule = Object.keys(e.constraints!)[0];
          const msg = e.constraints![rule];
          return msg;
        })[0],
      ),
  }),
);
```

**Ý nghĩa:**

- `whitelist: true` — client không gửi được field lạ vào entity.
- `exceptionFactory` — trả **một** message ngắn (first error) thay vì mảng phức tạp; phù hợp UI đơn giản.

---

## 3. ☕ Ứng dụng vào `chalo-be` (The Application)

- **DTO theo use case**: `CreateOrderDto` khác `UpdateOrderDto` — tránh reuse một class cho mọi thao tác.
- **Tiền tệ / số thập phân**: dùng `IsNumber`, `Min(0)` hoặc integer cents — thống nhất một convention.
- **Custom validator**: “`menuItemId` phải tồn tại và `isActive`” — có thể làm async validator hoặc check trong service; Spark ưu tiên constraint tái sử dụng.
- **i18n**: message `class-validator` mặc định tiếng Anh; có thể override `ValidationPipe` message factory sau.

---

## 4. 🛠️ Hướng dẫn thực hành (Step-by-step Implementation)

> **Tiên quyết:** `class-validator` + `class-transformer` trong `package.json`. Case 06 nếu bạn muốn lỗi validation đi qua cùng envelope — có thể map `422` trong filter.

### Step 1 — Bật DI cho custom validator (đặt ngay sau `create`)

```typescript
// chalo-be/src/main.ts
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, HttpStatus, UnprocessableEntityException } from '@nestjs/common';
import { useContainer } from 'class-validator';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  useContainer(app.select(AppModule), { fallbackOnErrors: true });

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: false,
      transformOptions: { enableImplicitConversion: true },
      errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
      stopAtFirstError: true,
      exceptionFactory: (errors) => {
        const first = errors[0];
        const rule = Object.keys(first.constraints ?? {})[0];
        const msg = first.constraints?.[rule] ?? 'Validation failed';
        return new UnprocessableEntityException(msg);
      },
    }),
  );

  await app.listen(3000);
}
bootstrap();
```

`forbidNonWhitelisted: true` nếu bạn muốn **từ chối** mọi field không khai báo trong DTO (chặt hơn).

### Step 2 — DTO body: tạo món menu

```typescript
// chalo-be/src/modules/menu/dto/create-menu-item.dto.ts
import { IsBoolean, IsInt, IsString, MaxLength, Min } from 'class-validator';

export class CreateMenuItemDto {
  @IsString()
  @MaxLength(200)
  name!: string;

  /** Giá đồng (integer) — tránh float */
  @IsInt()
  @Min(0)
  priceCents!: number;

  @IsBoolean()
  isActive!: boolean;
}
```

### Step 3 — DTO query: phân trang (ép kiểu từ string query)

```typescript
// chalo-be/src/common/dto/pagination-query.dto.ts
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}
```

### Step 4 — Controller sử dụng

```typescript
// chalo-be/src/modules/menu/menu.controller.ts (đoạn minh họa)
import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { CreateMenuItemDto } from './dto/create-menu-item.dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

@Controller('menu')
export class MenuController {
  @Get()
  list(@Query() q: PaginationQueryDto) {
    return { page: q.page, limit: q.limit };
  }

  @Post()
  create(@Body() dto: CreateMenuItemDto) {
    return dto;
  }
}
```

### Step 5 — Kiểm thử tay

**Body sai kiểu:**

```bash
curl -s -X POST http://localhost:3000/api/menu -H "Content-Type: application/json" \
  -d "{\"name\":\"\",\"priceCents\":-1,\"isActive\":true}"
```

Kỳ vọng: `422` + message validator (hoặc envelope từ filter case 06).

**Query string → number:**

`GET /api/menu?page=2&limit=10` — nếu không có `@Type(() => Number)`, `page` sẽ là string và fail validation.

### Step 6 — (Tuỳ chọn) Custom async validator

Ví dụ `@IsEntityExists(MenuItemEntity, 'id')` — cần class implementing `ValidatorConstraintInterface`, đăng ký `providers: [EntityExistsConstraint]` trong module và `useContainer` như Step 1.

### Step 7 — Multipart / upload

ValidationPipe mặc định áp cho JSON body. Route upload dùng `@UseInterceptors(FileInterceptor(...))` và **không** dùng cùng DTO JSON; validate field file riêng.

**Kiểm tra cuối §4:** Whitelist có loại bỏ field lạ? `enableImplicitConversion` có bật cho query? Message lỗi có đủ thân thiện cho POS?

---

## 5. ✅ Todo checklist (đánh dấu khi xong / nhờ review)

**Cách dùng:** Nhờ review → gửi **số case 07** + một DTO + kết quả request sai validation.

_Review codebase: có `class-validator` / `class-transformer` trong dependencies nhưng **`main.ts` chưa** `ValidationPipe` / chưa thấy file `dto`._

- [ ] `useContainer(app.select(AppModule))` cho class-validator (nếu dùng custom constraint sau này)
- [ ] `ValidationPipe` global: `whitelist`, `transform`, `enableImplicitConversion`
- [ ] Ít nhất **một** DTO cho body/query có decorator `class-validator`
- [ ] Controller dùng DTO thay vì `any`
- [ ] Thử 1 request invalid → nhận đúng HTTP status + message thống nhất với error filter
- [ ] (Tuỳ chọn) Custom validator kiểm tra FK tồn tại
