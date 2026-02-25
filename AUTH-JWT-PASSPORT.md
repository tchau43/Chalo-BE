# NestJS Auth (JWT + Passport) – Cài đặt & Lệnh thường dùng

## 1. Cài đặt thư viện

### 1.1. JWT + Passport (bắt buộc)
```bash
bun add @nestjs/jwt @nestjs/passport passport passport-jwt
```

### 1.2. Local Strategy (đăng nhập bằng email/phone + password)
```bash
bun add passport-local
```

### 1.3. Type definitions (khuyến nghị)
```bash
bun add -d @types/passport-jwt @types/passport-local
```

### 1.4. Đọc biến môi trường `.env` (khuyến nghị)
```bash
bun add @nestjs/config
```

### 1.5. Hash mật khẩu (khuyến nghị)
```bash
bun add bcrypt
bun add -d @types/bcrypt
```

## 2. Biến môi trường `.env` (gợi ý tối thiểu)

```env
JWT_ACCESS_SECRET="change_me"
JWT_ACCESS_EXPIRES_IN="15m"
```

Nếu bạn có refresh token:

```env
JWT_REFRESH_SECRET="change_me_too"
JWT_REFRESH_EXPIRES_IN="7d"
```

## 3. Flow cơ bản (gợi ý)

### 3.1. Login (Local Strategy)
- **Input**: username/password (tuỳ bạn map là `email`, `phoneNumber`…)
- **Output**: access token (và refresh token nếu dùng)

### 3.2. Bảo vệ API (JWT Strategy)
- Client gửi token qua header:

```http
Authorization: Bearer <access_token>
```

- Guard `AuthGuard('jwt')` sẽ:
  - Verify token
  - Gắn `req.user` (payload) cho route handler

## 4. Checklist setup (nhanh)

## 4.1. AuthModule
- Import `PassportModule`
- Import `JwtModule.register(...)` (thường dùng `JwtModule.registerAsync` + `ConfigService`)

### 4.2. Strategies
- `LocalStrategy` (passport-local): validate username/password
- `JwtStrategy` (passport-jwt): validate access token từ header

### 4.3. Guards
- `LocalAuthGuard` cho endpoint login
- `JwtAuthGuard` cho endpoint cần đăng nhập

## 5. Lệnh thường dùng (dev)

### 5.1. Cài thêm gói khi thiếu
```bash
bun add <package>
bun add -d <dev_package>
```

### 5.2. Chạy project
```bash
bun run dev
```

## 6. Gợi ý cấu hình JWT (tham khảo)

### 6.1. Access token
- Thời gian sống ngắn (vd: 10–30 phút)
- Dùng cho request API

### 6.2. Refresh token (tuỳ chọn)
- Thời gian sống dài hơn (vd: 7–30 ngày)
- Dùng để xin access token mới
- Nên lưu refresh token dạng hash trong DB (nếu bạn muốn revoke)

## 7. Troubleshooting nhanh

| Lỗi | Nguyên nhân hay gặp | Cách xử lý |
|-----|----------------------|-----------|
| 401 Unauthorized | Thiếu header `Authorization` | Gửi `Bearer <token>` |
| 401 Unauthorized | JWT secret sai | Check `.env` + config `JwtModule` |
| Cannot find module `@types/passport-jwt` | Thiếu types | `bun add -d @types/passport-jwt` |
| LocalStrategy không nhận username/password | Tên field khác `username/password` | Config `passport-local` (vd: `usernameField: 'email'`) |

