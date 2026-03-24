# Tài liệu Chalo Backend — case study (thứ tự đã sắp xếp lại)

## Đọc trước khi ôn

| File | Vai trò |
|------|---------|
| **[CASE-STUDY-CHUAN-THAM-CHIEU-KY-THUAT.md](./CASE-STUDY-CHUAN-THAM-CHIEU-KY-THUAT.md)** | Chuẩn kỹ thuật: phạm vi, env, HTTP, JWT, Nest DI |

Mâu thuẫn với các bước dưới → sửa theo file chuẩn.

## Thứ tự thực hiện (1 → 9)

| Bước | File |
|------|------|
| 1 | [01-dependencies-path-alias-env.md](./01-dependencies-path-alias-env.md) |
| 2 | [02-case-study-env-helpers.md](./02-case-study-env-helpers.md) |
| 3 | [03-config-database-security.md](./03-config-database-security.md) |
| 4 | [04-bootstrap-fastify-validation.md](./04-bootstrap-fastify-validation.md) |
| 5 | [05-typeorm-module-entities.md](./05-typeorm-module-entities.md) |
| 6 | [06-auth-password-bcrypt-service.md](./06-auth-password-bcrypt-service.md) |
| 7 | [07-jwt-tokens-passport.md](./07-jwt-tokens-passport.md) |
| 8 | [08-guards-public-decorators.md](./08-guards-public-decorators.md) |
| 9 | [09-auth-module-controller-day-du.md](./09-auth-module-controller-day-du.md) |
| 10 | [10-mo-rong-sau-case-study-1.md](./10-mo-rong-sau-case-study-1.md) (tuỳ chọn) |

**Kế hoạch tổng thể + checkpoint:** [00-PLAN-TONG-THE-CHI-TIET.md](./00-PLAN-TONG-THE-CHI-TIET.md)

**Ý tưởng thứ tự:** env helpers → config → Fastify → TypeORM → auth từng lớp.
