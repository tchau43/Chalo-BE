# NestJS – Lệnh thường dùng

## 1. Generate (tạo file tự động)

> Mặc định Nest sẽ tạo kèm file `.spec.ts`.  
> Nếu không muốn test file, thêm `--no-spec`.

### 1.1. Module

**Tạo module ở `src/modules/auth` (không có spec):**
```bash
npx nest g module modules/auth --no-spec
```

### 1.2. Service

**Tạo service `AuthService` trong `src/modules/auth` (không có spec):**
```bash
npx nest g service modules/auth --no-spec
```

### 1.3. Controller

**Tạo controller `AuthController` trong `src/modules/auth` (không có spec):**
```bash
npx nest g controller modules/auth --no-spec
```

### 1.4. Resource (module + service + controller cùng lúc)

```bash
npx nest g resource modules/auth
```

> CLI sẽ hỏi thêm:
> - Loại resource (REST API, GraphQL…)
> - Có tạo CRUD hay không
> - Có tạo DTO, Validation pipe… (tuỳ phiên bản)

## 2. Chạy project

### 2.1. Dev mode (watch)

```bash
npx nest start --watch
# hoặc nếu đã có script trong package.json:
bun run dev
```

### 2.2. Build + chạy production

```bash
npx nest build
node dist/main
```

Hoặc dùng script:

```bash
bun run build
bun run start:prod
```

## 3. Test

```bash
npx nest test           # unit test
npx nest test --watch   # test watch mode
```

Nếu đã có script:

```bash
bun run test
bun run test:watch
```

## 4. Lệnh CLI hữu ích khác

### 4.1. Xem trợ giúp Nest CLI

```bash
npx nest --help
```

### 4.2. Xem các lệnh generate hỗ trợ

```bash
npx nest g --help
```

## 5. Gợi ý luồng làm việc

| Tình huống | Lệnh gợi ý |
|-----------|------------|
| Tạo module mới cho feature | `npx nest g module modules/<feature> --no-spec` |
| Thêm service cho feature   | `npx nest g service modules/<feature> --no-spec` |
| Thêm controller cho feature| `npx nest g controller modules/<feature> --no-spec` |
| Tạo nhanh full resource    | `npx nest g resource modules/<feature>` |
| Chạy dev                   | `bun run dev` hoặc `npx nest start --watch` |
| Build + chạy prod          | `bun run build` → `bun run start:prod` |

