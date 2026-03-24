# Bước 1 — Dependencies, path alias, file môi trường

## 1.1 Gỡ Express (dự án mặc định Nest dùng Express)

Trong `package.json` hiện có `@nestjs/platform-express`. Khi chuyển Fastify bạn **không bắt buộc** gỡ hẳn nếu chỉ thêm Fastify, nhưng để tránh nhầm lẫn nên:

- Xóa dependency `@nestjs/platform-express` và `@types/express` (sau khi đã chuyển `main.ts` sang Fastify).

Hoặc giữ lại tạm thời — quan trọng là `NestFactory.create` phải dùng `NestFastifyApplication`.

## 1.2 Cài package (pnpm)

Chạy tại thư mục `g:\Chalo\chalo-be`:

```bash
pnpm add @nestjs/platform-fastify @nestjs/config @nestjs/typeorm @nestjs/jwt @nestjs/passport typeorm pg passport passport-jwt class-validator class-transformer bcrypt
pnpm add -D @types/passport-jwt @types/bcrypt
```

Tuỳ chọn (giống spark — cookie, multipart sau này):

```bash
pnpm add @fastify/cookie @fastify/multipart
```

**Case study Auth tối thiểu** không bắt buộc cookie/multipart.

## 1.3 `tsconfig.json` — alias `~/`

Thêm trong `compilerOptions`:

```json
{
  "compilerOptions": {
    "baseUrl": "./",
    "paths": {
      "~/*": ["src/*"]
    }
  }
}
```

## 1.4 `tsconfig.build.json`

Đảm bảo không loại trừ nhầm thư mục `config` / `migrations`. Mặc định Nest thường:

```json
{
  "extends": "./tsconfig.json",
  "exclude": ["node_modules", "test", "dist", "**/*spec.ts"]
}
```

## 1.5 `nest-cli.json` — webpack path (tuỳ chọn)

Nếu sau này dùng webpack và alias không resolve, có thể cần plugin; với `nest build` mặc định (tsc), `paths` trong `tsconfig` thường đủ.

## 1.6 File `.env` (không commit) và `.env.example` (commit)

Tạo `g:\Chalo\chalo-be\.env`:

```env
NODE_ENV=development
PORT=3000

APP_NAME=chalo-backend
GLOBAL_PREFIX=api

DB_HOST=127.0.0.1
DB_PORT=5432
DB_USERNAME=chalo
DB_PASSWORD=chalo_secret
DB_DATABASE=chalo_db
DB_SYNCHRONIZE=true
DB_LOGGING=false

JWT_SECRET=dev-change-me-use-long-random-string-at-least-32-chars
JWT_EXPIRES_IN=900
REFRESH_SECRET=dev-refresh-change-me-also-32-chars-min
REFRESH_EXPIRES_IN=604800
```

Tạo `.env.example` cùng nội dung nhưng **không** chứa secret thật (để placeholder).

**Giải thích:**

- `JWT_EXPIRES_IN=900` → access 15 phút (giây). Có thể dùng chuỗi như `15m` nếu bạn cấu hình `JwtModule` với `expiresIn` dạng string — nhất quán một kiểu trong toàn project.
- `REFRESH_EXPIRES_IN=604800` → 7 ngày (giây).

## 1.7 `.gitignore`

Thêm (nếu chưa có):

```
.env
.env.local
```

## 1.8 Alias `~/` khi build production (`dist/`)

TypeScript `paths` **không** tự đổi thành đường dẫn tương đối trong file `.js` output. Nếu dùng `import ... from '~/config/...'` trong code, sau `nest build` có thể lỗi `Cannot find module`.

**Cách A (khuyến nghị):** cài `tsc-alias` và chạy sau mỗi lần build:

```bash
pnpm add -D tsc-alias
```

Trong `package.json`:

```json
"scripts": {
  "build": "nest build && tsc-alias -p tsconfig.json"
}
```

**Cách B:** bỏ alias, dùng import tương đối (`../../modules/...`) trong toàn bộ file bạn tự viết.

**Cách C:** dùng bundler/webpack của Nest có plugin resolve alias (nâng cao).

---

## Checkpoint

- `pnpm install` không lỗi  
- `tsconfig` có `paths`  
- File `.env` tồn tại locally  
- (Nếu dùng `~/`) đã cấu hình `tsc-alias` hoặc chấp nhận dùng import tương đối  

Sang bước tiếp: [02-case-study-env-helpers.md](./02-case-study-env-helpers.md)
