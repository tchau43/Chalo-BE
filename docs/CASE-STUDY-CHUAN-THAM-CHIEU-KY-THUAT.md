# Case study Auth v1 — tham chiếu kỹ thuật chuẩn (ôn tập)

Tài liệu này là **chuẩn duy nhất** về sự kiện kỹ thuật: phạm vi, gói npm, env, hợp đồng HTTP, payload JWT, đăng ký Nest, quy tắc DI.  
Không mô tả “câu chuyện” nghiệp vụ; chi tiết từng file nằm ở `01`–`10` (xem bảng cuối tài liệu).

---

## 1. Phạm vi (scope)

| Thuộc case study v1 | Không thuộc v1 |
|---------------------|----------------|
| NestJS + **Fastify** (HTTP) | RBAC, permission string, menu tree |
| **TypeORM** + PostgreSQL, entity `User` | Redis, blacklist token |
| **bcrypt** hash mật khẩu | OAuth Google/Apple |
| JWT **access** + JWT **refresh** (hai secret khác nhau) | Lưu refresh token trong DB / rotation |
| Passport `jwt` strategy + `JwtAuthGuard` | Password version, multi-device lock (spark) |
| `@Public()`, `@CurrentUser()`, guard global | Response wrapper `ResOp` (spark) |
| `class-validator` trên DTO | SSE / Socket |
| Helper **`env` / `envNumber` / `envBoolean`** (`src/global/env.ts`) | Thư viện env schema (Zod, envalid) — tuỳ chọn sau |

---

## 2. Phụ thuộc runtime (tên gói)

| Gói | Vai trò |
|-----|---------|
| `@nestjs/common`, `@nestjs/core` | Nest core |
| `@nestjs/platform-fastify` | Adapter HTTP Fastify (**thay** Express cho case study) |
| `@nestjs/config` | `ConfigModule`, `ConfigService` |
| `@nestjs/typeorm`, `typeorm`, `pg` | ORM + driver PostgreSQL |
| `@nestjs/jwt` | Ký/verify JWT (dùng cho access và refresh trong code mẫu) |
| `@nestjs/passport`, `passport`, `passport-jwt` | Strategy + `AuthGuard('jwt')` |
| `class-validator`, `class-transformer` | DTO + `ValidationPipe` |
| `bcrypt` | Hash mật khẩu |

**Dev typings (khuyến nghị):** `@types/passport-jwt`, `@types/bcrypt`

**Không** dùng `@nestjs/platform-express` cho luồng này (tránh lẫn `NestFactory.create` mặc định Express).

---

## 3. Biến môi trường (hợp đồng)

| Biến | Bắt buộc | Ý nghĩa |
|------|----------|---------|
| `PORT` | Không (mặc định 3000) | Cổng listen |
| `GLOBAL_PREFIX` | Không (mặc định `api`) | Prefix toàn cục → ví dụ `/api/auth/login` |
| `APP_NAME` | Không | Metadata app |
| `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_DATABASE` | Có (khi bật DB) | PostgreSQL |
| `DB_SYNCHRONIZE` | Không | `true`/`false` — **prod nên `false`** |
| `DB_LOGGING` | Không | `true`/`false` |
| `JWT_SECRET` | Có | Ký/verify **access** |
| `REFRESH_SECRET` | Có | Ký/verify **refresh** — **phải khác** `JWT_SECRET` |
| `JWT_EXPIRES_IN` | Không | Chuỗi `ms` format của `jsonwebtoken` / Nest, ví dụ `15m` |
| `REFRESH_EXPIRES_IN` | Không | Ví dụ `7d` |

**Parse:** trong lộ trình mới, số và boolean đọc qua **`envNumber` / `envBoolean`** (bước 2 doc); chuỗi qua **`env`**.

**Quy ước bảo mật (ôn tập):** hai secret đủ dài, không commit `.env`. File mẫu: `.env.example` (không chứa secret thật).

---

## 4. Hợp đồng HTTP (case study)

Base URL giả định: `http://localhost:{PORT}/{GLOBAL_PREFIX}`.

| Method | Path | Auth | Body JSON | 2xx thân phản hồi (ý tưởng) |
|--------|------|------|-----------|------------------------------|
| `GET` | `/health` | Không | — | `{ "ok": true, "service": "chalo-be" }` (hoặc tương đương) |
| `POST` | `/auth/register` | Không | `{ "email", "password" }` | `{ user: { id, email, createdAt }, accessToken, refreshToken }` |
| `POST` | `/auth/login` | Không | `{ "email", "password" }` | Giống register (không tạo user mới) |
| `POST` | `/auth/refresh` | Không | `{ "refreshToken" }` | `{ accessToken }` |
| `GET` | `/auth/me` | Bearer access | — | `{ userId, email }` |

**Lỗi thường gặp:**

- Thiếu/sai Bearer trên route không `@Public` → **401** (`UnauthorizedException`).
- Validation DTO fail → **422** nếu dùng `ValidationPipe` với `UnprocessableEntityException` như doc `02`.
- Email trùng khi register → **409** nếu ném `ConflictException` (đúng như mẫu `AuthService`).

---

## 5. JWT — sự kiện chính xác

| Khái niệm | Giá trị / quy tắc |
|-----------|-------------------|
| Access payload (tối thiểu) | `sub` = user id (uuid), `email`, `typ: 'access'` |
| Refresh payload (tối thiểu) | `sub` = user id, `typ: 'refresh'`, `ver` (số, dự phòng v2) |
| Ký access | `secret = JWT_SECRET`, `expiresIn = JWT_EXPIRES_IN` |
| Ký refresh | `secret = REFRESH_SECRET` (**khác** access), `expiresIn = REFRESH_EXPIRES_IN` |
| Đọc Bearer | `ExtractJwt.fromAuthHeaderAsBearerToken()` |
| `request.user` sau guard | `{ userId: string, email: string }` — map từ `validate()` của `JwtStrategy` |

**Passport — khớp tên strategy:**

- `PassportStrategy(Strategy, 'jwt')` → tên `'jwt'`
- `AuthGuard('jwt')` → **cùng** chuỗi `'jwt'`

**Hết hạn:** Access hết hạn → 401; client gọi `POST /auth/refresh` với refresh hợp lệ để lấy access mới.

**Refresh → access:** Sau khi verify refresh, **phải** load user từ DB (hoặc nguồn đáng tin) để lấy `email` hiện tại rồi mới `signAccess`; không được `signAccess(sub, '')`.

---

## 6. TypeORM — sự kiện chính xác

| Mục | Quy tắc |
|-----|---------|
| Đăng ký root | `TypeOrmModule.forRootAsync({ inject: [ConfigService], useFactory })` |
| Entity discovery | **`autoLoadEntities: true`** + mọi module feature dùng `TypeOrmModule.forFeature([Entity])` — **không** phụ thuộc glob `entities: [...]` trong config trừ khi bạn kiểm chứng đường dẫn `dist/` |
| `synchronize` | Chỉ `true` trên môi trường dev cá nhân; prod dùng migration |
| Bảng `users` (mẫu) | `id` uuid PK, `email` unique, `password_hash`, `created_at`, `updated_at` |

`dataSourceFactory` trong doc là **tuỳ chọn**; không bắt buộc để chạy case study.

---

## 7. NestJS — đăng ký module và guard global (chuẩn ôn tập)

**Thứ tự import trong `AppModule` (gợi ý):** `ConfigModule` → `DatabaseModule` → `UserModule` → `AuthModule`.

**Guard JWT global — khớp hướng dẫn chính thức Nest (Authentication → enable globally):**

1. **`JwtAuthGuard` là provider của `AuthModule`** (`providers: [..., JwtAuthGuard]`).
2. **`AuthModule` `exports: [JwtAuthGuard]`** để module gốc có thể tham chiếu class guard khi đăng ký global.
3. **`AppModule` có** `providers: [{ provide: APP_GUARD, useClass: JwtAuthGuard }]` **và** `imports: [AuthModule, ...]`.

**Không** đăng ký `APP_GUARD` hai lần (trùng lặp ở `AppModule` và `AuthModule`).

**Tuỳ chọn (một số repo):** chỉ khai báo `APP_GUARD` trong `AuthModule`. Cách này **phụ thuộc** phiên bản Nest và cách bạn import module; để ôn thi an toàn, nhớ **cách 1–3** ở trên.

**`@Public()`:** `SetMetadata` + `Reflector.getAllAndOverride` trong `JwtAuthGuard.canActivate` — nếu public thì `return true` **trước** `super.canActivate`.

**`JwtStrategy`** phải nằm trong `AuthModule.providers` (hoặc module được import) để Passport đăng ký strategy.

---

## 8. ValidationPipe (khớp doc `02`)

| Thuộc tính | Ý nghĩa ôn tập |
|------------|----------------|
| `transform: true` | Gán kiểu theo DTO (`class-transformer`) |
| `whitelist: true` | Cắt field không khai báo trên DTO |
| `forbidNonWhitelisted: true` | Throw nếu client gửi thừa field |
| `enableImplicitConversion: true` | Ép kiểu số/boolean từ query/body |

**Fastify + validation:** `useContainer(app.select(AppModule), { fallbackOnErrors: true })` trong `main.ts` để `class-validator` dùng DI (khi có custom validator inject service).

---

## 9. TypeScript path `~/` và build `dist/`

| Sự kiện |
|--------|
| `tsconfig` `paths`: `"~/*" → "src/*"` chỉ áp dụng lúc compile TypeScript. |
| `node dist/main.js` **không** đọc `paths` — cần **`tsc-alias`** sau `nest build` hoặc bỏ alias, dùng import tương đối. |

---

## 10. Health check (ôn tập vận hành)

| Sự kiện |
|--------|
| Route `/health` (hoặc tương đương) trả **200 + JSON** là pattern thật trong prod (probe K8s, LB). |
| Checkpoint trong tutorial = xác nhận bootstrap; **không** đồng nghĩa “chỉ test rồi xóa”. |

---

## 11. So sánh nhanh với `spark-backend` (sự kiện)

| | Spark (yelu) | Case study Chalo v1 |
|--|--------------|---------------------|
| HTTP | Fastify | Fastify (mục tiêu) |
| Password | MD5+salt (legacy trong tài liệu) | bcrypt |
| Guard JWT | + Redis blacklist, password version, multi-device, demo, SSE query token | Chỉ Bearer + `@Public` |
| RBAC | `RbacGuard`, `@Perm()`, menu | Không |

---

## 12. Liên kết tài liệu từng bước (thứ tự)

| Bước | File | Nội dung |
|------|------|----------|
| 1 | [01](./01-dependencies-path-alias-env.md) | Cài gói, alias `~/`, `.env`, `tsc-alias` |
| 2 | [02](./02-case-study-env-helpers.md) | `env`, `envNumber`, `envBoolean` |
| 3 | [03](./03-config-database-security.md) | Config loaders (dùng helper bước 2) |
| 4 | [04](./04-bootstrap-fastify-validation.md) | Fastify, `main.ts`, `ValidationPipe` |
| 5 | [05](./05-typeorm-module-entities.md) | DB module, User |
| 6 | [06](./06-auth-password-bcrypt-service.md) | AuthService, bcrypt |
| 7 | [07](./07-jwt-tokens-passport.md) | TokenService, JwtStrategy |
| 8 | [08](./08-guards-public-decorators.md) | Guard, `@Public`, `@CurrentUser` |
| 9 | [09](./09-auth-module-controller-day-du.md) | Controller, `AuthModule`, `AppModule` |
| 10 | [10](./10-mo-rong-sau-case-study-1.md) | Mở rộng sau v1 |

Nếu mâu thuẫn giữa file con và file này → **ưu tiên file này** cho phần “chuẩn ôn tập”; sau đó sửa file con cho khớp.
