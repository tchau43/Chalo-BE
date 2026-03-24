# Chalo-be — mục lục Todo theo Case Study

Mỗi file `01-` … `10-` có **§4. Hướng dẫn thực hành** (chi tiết từng bước + code minh họa để bạn tự cài đặt) và **§5. ✅ Todo checklist** ở cuối file. Checklist là **nguồn chính** để đánh dấu `[x]` khi review.

## Snapshot đánh giá codebase (cập nhật: review tự động)

| Case | Đã tick (ước lượng) | Ghi chú ngắn |
|------|---------------------|--------------|
| **01** | 3/5 | Có `MenuModule` + Fastify boot; thiếu khung `common` đầy đủ, chưa ghi quy ước README |
| **02** | 1/6 | Có `src/global/env.ts`; chưa `ConfigModule`, `registerAs`, `config/index`, `.env.example` |
| **03** | 0/6 | Có package TypeORM/pg nhưng chưa `DatabaseModule` / entity / migration |
| **04** | 0/8 | Có deps JWT/Passport/bcrypt, chưa triển khai auth |
| **05** | 0/6 | Chưa RBAC |
| **06** | 0/8 | Chưa envelope / filter (TODO trong `app.module`) |
| **07** | 0/6 | Chưa `ValidationPipe` / DTO |
| **08** | 0/6 | Chưa Winston / `useLogger` |
| **09** | 1/7 | Fastify adapter + listen; thiếu CORS, Swagger, prefix từ config, shutdown hooks |
| **10** | 0/6 | Chưa Throttler / timeout |

**Ưu tiên tiếp theo gợi ý:** hoàn tất **02** (Config) → **09** (prefix, CORS, validation pipe) → **03** (DB) → **04**–**06**.

## Khi nhờ AI review

Gửi một trong các thông tin sau:

- **Số case** (vd. `case 04`, `case 06`) + mô tả ngắn đã làm gì, **hoặc**
- Đường dẫn file / diff / PR, **hoặc**
- Paste đoạn code liên quan.

Yêu cầu rõ: *“Review và cập nhật checklist trong `studycase/0X-….md`”* — AI sẽ đổi `- [ ]` → `- [x]` cho đủ điều kiện.

## Bảng nhanh

| Case | File | Nội dung chính |
|------|------|----------------|
| 01 | [01-project-structure-and-modules.md](./01-project-structure-and-modules.md) | Cấu trúc thư mục, module mẫu |
| 02 | [02-environment-and-typed-configuration.md](./02-environment-and-typed-configuration.md) | Env, `registerAs`, `ConfigModule` |
| 03 | [03-database-typeorm-postgres.md](./03-database-typeorm-postgres.md) | TypeORM, Postgres, migration |
| 04 | [04-authentication-jwt-passport.md](./04-authentication-jwt-passport.md) | JWT, Passport, login |
| 05 | [05-authorization-rbac-permissions.md](./05-authorization-rbac-permissions.md) | RBAC, `@Perm` |
| 06 | [06-api-response-error-handling.md](./06-api-response-error-handling.md) | Envelope, exception filter |
| 07 | [07-request-validation-dtos.md](./07-request-validation-dtos.md) | DTO, `ValidationPipe` |
| 08 | [08-logging-winston.md](./08-logging-winston.md) | Winston / logging |
| 09 | [09-bootstrap-fastify-cors-swagger.md](./09-bootstrap-fastify-cors-swagger.md) | Bootstrap, CORS, Swagger |
| 10 | [10-rate-limiting-and-resilience.md](./10-rate-limiting-and-resilience.md) | Throttle, timeout |

## Thứ tự gợi ý

`01` → `02` → `03` → `09` (bootstrap sớm nếu cần chạy app) → `04` → `05` → `06` → `07` → `08` → `10`

(Bạn có thể lệch thứ tự nếu đang học theo hướng khác — chỉ cần tick đúng file tương ứng.)
