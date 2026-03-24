# Kế hoạch tổng thể — thứ tự case study (đã sắp xếp lại)

**Chuẩn ôn tập kỹ thuật:** [CASE-STUDY-CHUAN-THAM-CHIEU-KY-THUAT.md](./CASE-STUDY-CHUAN-THAM-CHIEU-KY-THUAT.md)  
Mâu thuẫn với file `01`–`10` → ưu tiên file chuẩn, rồi chỉnh file con.

---

## Thứ tự case study (từ dưới lên stack)

| Bước | File | Nội dung |
|------|------|----------|
| **0** | [CASE-STUDY-CHUAN-THAM-CHIEU-KY-THUAT.md](./CASE-STUDY-CHUAN-THAM-CHIEU-KY-THUAT.md) | Bảng phạm vi, env, HTTP, JWT, Nest — đọc trước khi ôn |
| **1** | [01-dependencies-path-alias-env.md](./01-dependencies-path-alias-env.md) | Dependencies, `tsconfig` paths, `.env` / `.env.example`, `tsc-alias` |
| **2** | [02-case-study-env-helpers.md](./02-case-study-env-helpers.md) | **`env` / `envNumber` / `envBoolean`** — parse env cho toàn app (trước config chi tiết) |
| **3** | [03-config-database-security.md](./03-config-database-security.md) | `ConfigModule`, `app` / `database` / `security` — **dùng helper bước 2** |
| **4** | [04-bootstrap-fastify-validation.md](./04-bootstrap-fastify-validation.md) | Fastify adapter, `main.ts`, `ValidationPipe` (sau khi đã có config + health ở bước 3) |
| **5** | [05-typeorm-module-entities.md](./05-typeorm-module-entities.md) | `DatabaseModule`, entity `User`, migration / `synchronize` dev |
| **6** | [06-auth-password-bcrypt-service.md](./06-auth-password-bcrypt-service.md) | `AuthService`, bcrypt |
| **7** | [07-jwt-tokens-passport.md](./07-jwt-tokens-passport.md) | `TokenService`, `JwtStrategy` |
| **8** | [08-guards-public-decorators.md](./08-guards-public-decorators.md) | `JwtAuthGuard`, `@Public`, `@CurrentUser` |
| **9** | [09-auth-module-controller-day-du.md](./09-auth-module-controller-day-du.md) | DTO, `AuthController`, `AuthModule`, `AppModule` + `APP_GUARD` |
| **10** | [10-mo-rong-sau-case-study-1.md](./10-mo-rong-sau-case-study-1.md) | RBAC, Redis, OAuth, … |

**Lý do thứ tự:** env helpers → config (đọc `process.env` một kiểu) → HTTP server → DB → auth từng lớp. Tránh bootstrap Fastify trước khi có `ConfigModule` đầy đủ.

---

## Checkpoint theo pha

| Sau bước | Kiểm tra |
|----------|-----------|
| 1 | `pnpm install`, alias `~/` (và `tsc-alias` nếu cần) |
| 2 | Import `~/global/env` compile được |
| 3 | App boot, đọc được `app.port` / secrets JWT |
| 4 | `GET /api/health` → **200** JSON |
| 5 | Kết nối Postgres, có bảng `users` |
| 6–8 | (tuỳ tiến độ code) service + JWT + guard |
| 9 | Register / login / refresh / `me` end-to-end |
| 10 | (tuỳ chọn) mở rộng |

---

## Phạm vi v1 (nhắc lại)

- **Authn** (JWT, guard), **chưa** RBAC **authz**.  
- Refresh dạng **JWT** (hai secret), **chưa** lưu refresh DB trong v1.

---

## Cây thư mục đích (rút gọn)

```
src/
├── main.ts
├── app.module.ts
├── global/
│   └── env.ts                 ← bước 2
├── config/
├── common/
│   ├── adapters/
│   └── decorators/
├── modules/
│   ├── auth/
│   └── user/
├── shared/
│   └── database/
└── migrations/
```

---

## Liên hệ spark-backend

| Khía cạnh | Spark | Chalo case study |
|-----------|--------|------------------|
| Env | `~/global/env` | Bước 2 tương đương (rút gọn) |
| HTTP | Fastify + adapter | Bước 4 |
| Config | `registerAs` | Bước 3 |
| Guard JWT | Phức tạp hơn | Bước 8–9 đơn giản |

Chi tiết mở rộng: [10-mo-rong-sau-case-study-1.md](./10-mo-rong-sau-case-study-1.md)
