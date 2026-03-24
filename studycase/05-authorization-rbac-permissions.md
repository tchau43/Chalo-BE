# Case Study: Authorization — RBAC, Permission metadata, Guard thứ hai

## 1. 📖 Tóm tắt Case Study

**Authorization** trả lời: “Người này được làm gì?” Spark tách bạch **JwtAuthGuard** (đã đăng nhập) và **RbacGuard** (đủ quyền). Quyền gắn vào handler qua decorator `@Perm('module:action')`; guard đọc metadata, lấy danh sách permission của user (cache hoặc DB), so khớp. `ADMIN` short-circuit toàn quyền.

Quán cà phê: BARISTA không được xóa báo cáo doanh thu; CASHIER không được sửa giá menu; OWNER full quyền — cùng một cơ chế metadata + guard.

---

## 2. 🔍 Cách `spark-backend` triển khai (The Reference)

### Luồng hoạt động

1. `RbacGuard` chạy sau khi `request.user` đã có (từ JWT).
2. Nếu `@Public()` → true. Nếu `@AllowAnonPermission()` (metadata `ALLOW_ANON_KEY`) → true (đã login nhưng không cần permission cụ thể — tuỳ use case).
3. Nếu handler không có `PERMISSION_KEY` → cho qua (chỉ cần authenticated).
4. Nếu có `PERMISSION_KEY` → load `allPermissions` cho `user.uid`; `admin` role bypass; ngược lại `includes` string hoặc `every` cho mảng.

### File cốt lõi

| Vai trò | Đường dẫn |
|--------|------------|
| Guard | `src/modules/auth/guards/rbac.guard.ts` |
| Decorators | `src/modules/auth/decorators/permission.decorator.ts`, `allow-anon.decorator.ts` |
| Constants | `src/modules/auth/auth.constant.ts` (`PERMISSION_KEY`, `Roles`) |
| Ví dụ dùng | `src/modules/user/user.controller.ts` (`@Perm(...)`) |

### Đoạn code quan trọng

**Định nghĩa permission helper + metadata:**

```typescript
// spark-backend/src/modules/auth/decorators/permission.decorator.ts
// Perm attaches PERMISSION_KEY for Reflector in RbacGuard.
export function Perm(permission: string | string[]) {
  return applyDecorators(SetMetadata(PERMISSION_KEY, permission));
}
```

**RbacGuard — cốt lõi:**

```typescript
// spark-backend/src/modules/auth/guards/rbac.guard.ts (excerpt)
const payloadPermission = this.reflector.getAllAndOverride<string | string[]>(
  PERMISSION_KEY,
  [context.getHandler(), context.getClass()],
);

if (!payloadPermission)
  return true; // authenticated-only endpoint

if (user.roles.includes(Roles.ADMIN))
  return true;

const allPermissions =
  (await this.authService.getPermissionsCache(user.uid)) ??
  (await this.authService.getPermissions(user.uid));

if (Array.isArray(payloadPermission))
  canNext = payloadPermission.every((i) => allPermissions.includes(i));
if (typeof payloadPermission === 'string')
  canNext = allPermissions.includes(payloadPermission);

if (!canNext)
  throw new BusinessException(ErrorEnum.NO_PERMISSION);
```

**Roles constant:**

```typescript
// spark-backend/src/modules/auth/auth.constant.ts
export const Roles = {
  ADMIN: 'admin',
  USER: 'user',
} as const;
```

---

## 3. ☕ Ứng dụng vào `chalo-be` (The Application)

- **Đặt tên permission có tiền tố module**: `order:create`, `menu:update`, `report:read` — giống Spark (`definePermission` sinh chuỗi thống nhất).
- **Role quán**: map role → tập permission cố định trong DB hoặc seed; OWNER = superset; tránh hard-code trong controller ngoài bypass duy nhất cho super-admin.
- **Đơn giản hóa giai đoạn 1**: có thể chỉ `@Roles('MANAGER')` + một guard đọc `user.role` — nhưng khi quyền chi tiết tăng, hãy migrate sang string permission như Spark để không nổ controller.

**Flow đề xuất:** Bảng `role`, `permission`, `role_permission`, `staff_role` (hoặc `user` gắn role đơn) — `AuthService.getPermissions(uid)` aggregate.

---

## 4. 🛠️ Hướng dẫn thực hành (Step-by-step Implementation)

> **Tiên quyết:** Case 04 xong (`JwtAuthGuard`, `request.user` có `sub`). Bạn cần **nguồn permission** — MVP: bảng DB hoặc object hard-code trong service cho dev.

### Step 1 — Hằng metadata và decorator `@Perm`

```typescript
// chalo-be/src/modules/auth/constants/permission.constants.ts
export const PERMISSION_KEY = 'chalo:permission';

export const ChaloRoles = {
  OWNER: 'owner',
  MANAGER: 'manager',
  STAFF: 'staff',
} as const;

/** Chuỗi quyền dạng module:action — đồng bộ với seed DB */
export const Perms = {
  MENU_READ: 'menu:read',
  MENU_WRITE: 'menu:write',
  ORDER_CREATE: 'order:create',
} as const;
```

```typescript
// chalo-be/src/modules/auth/decorators/perm.decorator.ts
import { SetMetadata } from '@nestjs/common';
import { PERMISSION_KEY } from '../constants/permission.constants';

/** Một string = cần đúng quyền đó; mảng = cần mọi phần tử (AND). */
export const Perm = (permission: string | string[]) => SetMetadata(PERMISSION_KEY, permission);
```

`RbacGuard` phải **tôn trọng `@Public()`** giống JWT: nếu route public thì return `true` ngay (hoặc guard thứ tự đảm bảo JWT không chạy — tuỳ thiết kế; an toàn nhất: RbacGuard cũng check `IS_PUBLIC_KEY`).

### Step 2 — Mở rộng `AuthUser` (roles + permissions cache)

```typescript
// chalo-be/src/modules/auth/auth.types.ts (bổ sung)
export interface AuthUser {
  sub: string;
  pv: number;
  roles?: string[];
  permissions?: string[];
}
```

**Cách điền `roles`/`permissions`:**

- **Cách A (chuẩn lâu dài):** Trong `JwtStrategy.validate`, sau khi có `sub`, query DB lấy role + flatten permissions → gắn vào object trả về (chậm hơn mỗi request).
- **Cách B:** Chỉ đưa `sub` + `pv` trong JWT; `RbacGuard` gọi `PermissionsService.getByStaffId(sub)` (có cache memory/Redis).

### Step 3 — `PermissionsService` minh họa (stub → DB sau)

```typescript
// chalo-be/src/modules/auth/permissions.service.ts
import { Injectable } from '@nestjs/common';

import { Perms } from './constants/permission.constants';

@Injectable()
export class PermissionsService {
  /** Thay bằng query: staff -> roles -> role_permission */
  async getPermissionStringsForStaff(staffId: string): Promise<string[]> {
    if (staffId === 'owner-seed-id')
      return Object.values(Perms);
    return [Perms.MENU_READ];
  }

  hasRole(user: { roles?: string[] }, role: string) {
    return !!user.roles?.includes(role);
  }
}
```

### Step 4 — `RbacGuard` đầy đủ logic

```typescript
// chalo-be/src/modules/auth/guards/rbac.guard.ts
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { ChaloRoles, PERMISSION_KEY } from '../constants/permission.constants';
import { PermissionsService } from '../permissions.service';
import type { AuthUser } from '../auth.types';

@Injectable()
export class RbacGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissions: PermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()]))
      return true;

    const required = this.reflector.getAllAndOverride<string | string[]>(PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required)
      return true;

    const req = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    const user = req.user;
    if (!user?.sub)
      throw new ForbiddenException('Not authenticated');

    if (this.permissions.hasRole(user, ChaloRoles.OWNER))
      return true;

    const owned = user.permissions ?? (await this.permissions.getPermissionStringsForStaff(user.sub));

    const ok = Array.isArray(required)
      ? required.every((p) => owned.includes(p))
      : owned.includes(required);

    if (!ok)
      throw new ForbiddenException('Missing permission');
    return true;
  }
}
```

**Đăng ký guard:** Trong `AppModule.providers`, đặt **sau** `JwtAuthGuard` trong mảng (Nest chạy guards theo thứ tự **ngược** với thứ tự khai báo — cần verify bằng test; nếu sai thứ tự, đổi vị trí hai dòng `APP_GUARD`).

```typescript
// providers: [
//   { provide: APP_GUARD, useClass: JwtAuthGuard },
//   { provide: APP_GUARD, useClass: RbacGuard },
// ],
```

### Step 5 — Gắn `@Perm` lên controller

```typescript
// chalo-be/src/modules/menu/menu.controller.ts (ví dụ)
import { Controller, Get, Post } from '@nestjs/common';
import { Perm } from '../auth/decorators/perm.decorator';
import { Perms } from '../auth/constants/permission.constants';
import { MenuService } from './menu.service';

@Controller('menu')
export class MenuController {
  constructor(private readonly menu: MenuService) {}

  @Get()
  @Perm(Perms.MENU_READ)
  list() {
    return this.menu.findAllActive();
  }

  @Post()
  @Perm(Perms.MENU_WRITE)
  create() {
    return { ok: true };
  }
}
```

### Step 6 — Seed / migration quyền (ý tưởng schema)

Bảng gợi ý: `permissions(id, code)`, `roles(id, name)`, `role_permissions(role_id, permission_id)`, `staff_roles(staff_id, role_id)`.

Script seed (pseudo-SQL): chèn `owner` role + gán full `Perms.*` + gán staff đầu tiên làm owner.

### Step 7 — Kiểm thử

1. Login lấy token user **không** có `menu:write` → `POST /api/menu` → 403.
2. User có đủ quyền → 200/201.

**Kiểm tra cuối §4:** Public route không bị RBAC chặn? Owner bypass hoạt động? Mảng permission là AND đúng ý bạn?

---

## 5. ✅ Todo checklist (đánh dấu khi xong / nhờ review)

**Cách dùng:** Nhờ review → gửi **số case 05** + danh sách permission string + ví dụ controller có `@Perm`.

_Review codebase: chưa có RBAC / `@Perm` / `RbacGuard`._

- [ ] Hằng `PERMISSION_KEY` + decorator `@Perm(...)` (hoặc tên bạn chọn)
- [ ] `RbacGuard` đăng ký `APP_GUARD` (sau JWT guard)
- [ ] Service load permission theo user (DB hoặc cache) — stub có test được
- [ ] Role bypass (vd. `OWNER` / `admin`) nếu có trong thiết kế
- [ ] Ít nhất 2 endpoint thử nghiệm: một chỉ cần login, một cần permission cụ thể
- [ ] Seed hoặc migration gán quyền mặc định cho role dev
