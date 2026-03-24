# Bước 8 — JwtAuthGuard global + decorator @Public() + CurrentUser

## 8.1 `PUBLIC_KEY` và `@Public()`

`src/common/decorators/public.decorator.ts`:

```typescript
import { SetMetadata } from '@nestjs/common'

export const IS_PUBLIC_KEY = 'isPublic'

export const Public = () => SetMetadata(IS_PUBLIC_KEY, true)
```

## 8.2 `@CurrentUser()` — lấy user từ request

`src/common/decorators/current-user.decorator.ts`:

```typescript
import { createParamDecorator, ExecutionContext } from '@nestjs/common'

export interface AuthUser {
  userId: string
  email: string
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const request = ctx.switchToHttp().getRequest()
    return request.user as AuthUser
  },
)
```

## 8.3 `JwtAuthGuard` (phiên bản học tập — đơn giản)

`src/modules/auth/guards/jwt-auth.guard.ts`:

```typescript
import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { AuthGuard } from '@nestjs/passport'

import { IS_PUBLIC_KEY } from '~/common/decorators/public.decorator'

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super()
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (isPublic)
      return true

    return super.canActivate(context)
  }

  handleRequest<TUser = unknown>(
    err: Error | undefined,
    user: TUser,
    info: Error | undefined,
  ): TUser {
    if (err || !user) {
      throw err ?? new UnauthorizedException(info?.message ?? 'Unauthorized')
    }
    return user
  }
}
```

## 8.4 Đăng ký guard global (chuẩn Nest doc)

- `AuthModule`: `providers` có `JwtAuthGuard`; **`exports: [JwtAuthGuard]`** (và export service khác nếu cần).
- `AppModule`: `providers: [{ provide: APP_GUARD, useClass: JwtAuthGuard }]` + `imports: [AuthModule, ...]`.

Code đầy đủ: [09-auth-module-controller-day-du.md](./09-auth-module-controller-day-du.md) mục **9.3** và **9.5**.

## 8.5 Ví dụ route protected

```typescript
import { Controller, Get } from '@nestjs/common'

import { CurrentUser, type AuthUser } from '~/common/decorators/current-user.decorator'

@Controller('users')
export class UserMeController {
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return { userId: user.userId, email: user.email }
  }
}
```

Không cần `@UseGuards(JwtAuthGuard)` trên từng method vì đã global — chỉ cần **không** gắn `@Public()`.

**Spark-backend:** `JwtAuthGuard` thêm Redis blacklist, password version, multi-device, demo mode, SSE token query. Case study v1 **không** gồm các lớp đó.

Tham chiếu ôn tập: [CASE-STUDY-CHUAN-THAM-CHIEU-KY-THUAT.md](./CASE-STUDY-CHUAN-THAM-CHIEU-KY-THUAT.md).

Sang: [09-auth-module-controller-day-du.md](./09-auth-module-controller-day-du.md)
