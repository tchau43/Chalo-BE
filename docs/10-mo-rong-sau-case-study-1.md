# Mở rộng sau case study Auth v1 — hướng về spark-backend

Phạm vi v1 đã cố định trong [CASE-STUDY-CHUAN-THAM-CHIEU-KY-THUAT.md](./CASE-STUDY-CHUAN-THAM-CHIEU-KY-THUAT.md).

Sau khi luồng JWT cơ bản chạy ổn, bạn có thể bổ sung lần lượt các lớp **giống tinh thần** `g:\spark-backend` mà không nhét hết vào bước đầu.

---

## 1. Logout & vô hiệu token

| Cách | Ý tưởng |
|------|---------|
| **Client-only** | Xóa access/refresh khỏi storage — đơn giản nhưng token còn hiệu lực đến khi hết hạn |
| **Blacklist access (Redis)** | Lưu `jti` hoặc hash token với TTL = thời gian sống còn lại của JWT; guard kiểm tra trước Passport (spark dùng pattern này) |
| **Refresh rotation + DB** | Mỗi refresh tạo bản ghi mới, revoke bản cũ; phát hiện reuse → revoke chuỗi |

Tham chiếu code spark: `JwtAuthGuard` + `genTokenBlacklistKey` + Redis.

---

## 2. Password version (invalidate mọi JWT khi đổi mật khẩu)

- Thêm cột `token_version` (integer) trên `users`  
- Nhúng `ver` vào **access** payload  
- Trong guard, so sánh `payload.ver` với DB  

Spark dùng `pv` (password version) tương tự.

---

## 3. Multi-device / single-session

- Lưu access token (hoặc session id) hiện tại trên Redis theo `userId`  
- Guard so khớp token gửi lên với cache — khác → `ACCOUNT_LOGGED_IN_ELSEWHERE`  

---

## 4. Rate limiting

```bash
pnpm add @nestjs/throttler
```

Bọc `@Throttle()` trên `POST /auth/login` và `register`.

---

## 5. OAuth Google / Apple

Spark có `OAuthController`, `OAuthService`, `google-auth-library`, Apple JWT verify. Luồng: exchange code / id_token → tìm hoặc tạo user → phát JWT nội bộ giống login.

---

## 6. Fastify adapter nâng cao (spark)

File `spark-backend/src/common/adapters/fastify.adapter.ts`:

- `@fastify/cookie`, `@fastify/multipart`
- Hook `onRequest`: chặn method override, favicon, `.php` joke response

Bạn có thể copy dần các rule bảo vệ HTTP vào Chalo.

---

## 7. Response wrapper thống nhất

Spark dùng `ResOp<T>` + interceptor transform. Chalo có thể thêm:

- `TransformInterceptor` bọc `{ data, meta }`  
- `AllExceptionsFilter` format lỗi  

Xem `spark-backend/src/common/model/response.model.ts`.

---

## 8. TypeORM & migration như production

- `DB_SYNCHRONIZE=false` mọi môi trường không phải dev cá nhân  
- Script `typeorm migration:run` với `DataSource` file riêng (hoặc Nest + TypeORM CLI)  

Spark dùng `dist/` paths trong config — căn chỉnh theo `nest-cli` output của bạn.

---

## Checklist “đủ production tối thiểu”

- [ ] HTTPS termination (reverse proxy)  
- [ ] Secret JWT/refresh mạnh, rotate định kỳ  
- [ ] bcrypt cost phù hợp tải CPU  
- [ ] Không log body chứa password  
- [ ] CORS whitelist domain thật (không `origin: true` mãi)  
- [ ] Refresh token: httpOnly cookie (tuỳ chọn) thay vì localStorage  

---

Tài liệu case study cốt lõi kết thúc ở [09-auth-module-controller-day-du.md](./09-auth-module-controller-day-du.md). File này là **lộ trình nâng cấp** có chọn lọc theo spark-backend.
