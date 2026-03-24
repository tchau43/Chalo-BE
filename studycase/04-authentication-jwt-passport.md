# Case Study: Authentication — JWT, Passport, Token lifecycle

## 1. 📖 Tóm tắt Case Study

Xác thực trả lời: **“Ai đang gọi API?”** Pattern trong Spark: Passport **strategy** (JWT) giải mã token → gắn `user` vào `request`; **Guard** toàn cục kiểm tra public route, blacklist Redis, phiên bản mật khẩu, và (tuỳ chọn) đăng nhập một thiết bị.

Hệ quán cà phê: nhân viên đăng nhập từ quầy hoặc tablet; cần session an toàn, có thể **đăng xuất mọi máy** khi đổi mật khẩu hoặc sa thải nhân viên.

---

## 2. 🔍 Cách `spark-backend` triển khai (The Reference)

### Luồng hoạt động (tóm tắt)

1. `AuthModule` import `PassportModule`, `JwtModule.registerAsync` (secret + expiry từ config), `TypeOrmModule.forFeature` cho bảng token nếu lưu DB.
2. `JwtStrategy` đọc Bearer token, `validate` trả về payload (vd. `uid`, `pv`).
3. `JwtAuthGuard` (global): `@Public()` hoặc route whitelist → bỏ qua; ngược lại verify JWT, check Redis blacklist, so khớp `pv` và optional single-device token cache.

### File cốt lõi

| Vai trò | Đường dẫn |
|--------|------------|
| Module wiring | `src/modules/auth/auth.module.ts` |
| JWT strategy | `src/modules/auth/strategies/jwt.strategy.ts` |
| Global auth guard | `src/modules/auth/guards/jwt-auth.guard.ts` |
| Metadata public | `src/modules/auth/decorators/public.decorator.ts` |
| Constants | `src/modules/auth/auth.constant.ts` |
| Whitelist route | `src/config/app.config.ts` → `RouterWhiteList` |

### Đoạn code quan trọng

**Đăng ký JwtModule async với secret từ config:**

```typescript
// spark-backend/src/modules/auth/auth.module.ts (excerpt)
JwtModule.registerAsync({
  imports: [ConfigModule],
  useFactory: (configService: ConfigService<ConfigKeyPaths>) => {
    const { jwtSecret, jwtExprire } = configService.get<ISecurityConfig>('security');
    return {
      secret: jwtSecret,
      signOptions: { expiresIn: `${jwtExprire}s` },
      ignoreExpiration: isDev, // dev convenience only — review for your security posture
    };
  },
  inject: [ConfigService],
}),
```

**Strategy — payload tối thiểu phải có `uid`:**

```typescript
// spark-backend/src/modules/auth/strategies/jwt.strategy.ts
async validate(payload: IAuthUser) {
  if (!payload || !payload.uid)
    throw new UnauthorizedException('Invalid token payload');
  return payload; // attached to request.user
}
```

**Guard — public, blacklist, password version:**

```typescript
// spark-backend/src/modules/auth/guards/jwt-auth.guard.ts (excerpt)
const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [
  context.getHandler(),
  context.getClass(),
]);
if (RouterWhiteList.includes(request.routeOptions.url))
  return true;

const token = this.jwtFromRequestFn(request);
if (await this.redis.get(genTokenBlacklistKey(token)))
  throw new BusinessException(ErrorEnum.INVALID_LOGIN);

// After JWT valid: invalidate if password changed (pv mismatch)
const pv = await this.authService.getPasswordVersionByUid(request.user.uid);
if (pv !== `${request.user.pv}`)
  throw new BusinessException(ErrorEnum.INVALID_LOGIN);
```

**Decorator `@Public()`:**

```typescript
// spark-backend/src/modules/auth/decorators/public.decorator.ts
export const Public = () => SetMetadata(PUBLIC_KEY, true);
```

---

## 3. ☕ Ứng dụng vào `chalo-be` (The Application)

- **MVP có thể đơn giản hóa**: JWT + hash password (bcrypt); chưa cần OAuth Google/GitHub như Spark.
- **Nên giữ ý tưởng `pv` (password version)** hoặc `tokenVersion` trên user: khi OWNER reset mật khẩu nhân viên, mọi JWT cũ vô hiệu — rất thực tế cho quán.
- **Redis**: Spark dùng cho blacklist + cache token; Chalo phase 1 có thể chỉ JWT stateless + short TTL, rồi bổ sung Redis khi cần revoke tức thì.
- **Thiết bị quán**: cân nhắc refresh token lưu httpOnly cookie hoặc rotation — Spark có `RefreshTokenEntity`; bạn có thể thiết kế tương tự cho POS web.

---

## 4. 🛠️ Hướng dẫn thực hành (Step-by-step Implementation)

> **Tiên quyết:** Case 02 (`SecurityConfig`), Case 03 (entity `Staff` hoặc `User` có `passwordHash`, `username`). Cài: `@nestjs/jwt` `@nestjs/passport` `passport` `passport-jwt` `bcrypt`.

### Step 1 — Payload JWT và kiểu `request.user`

Quy ước payload (chuẩn thường dùng `sub` là id user):

```typescript
// chalo-be/src/modules/auth/auth.types.ts
export interface JwtPayload {
  sub: string; // staff id
  pv: number; // password version — đổi MK thì tăng, token cũ chết
}

export interface AuthUser extends JwtPayload {
  /** Passport gắn object này vào request.user */
}
```

### Step 2 — Decorator `@Public()` và hằng metadata

```typescript
// chalo-be/src/modules/auth/decorators/public.decorator.ts
import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'chalo:isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
```

### Step 3 — `JwtStrategy` đọc Bearer token, validate payload

```typescript
// chalo-be/src/modules/auth/strategies/jwt.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import type { ConfigKeyPaths } from '../../../config';
import type { ISecurityConfig } from '../../../config/security.config';
import type { AuthUser, JwtPayload } from '../auth.types';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService<ConfigKeyPaths>) {
    const sec = config.get<ISecurityConfig>('security');
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: sec!.jwtSecret,
    });
  }

  validate(payload: JwtPayload): AuthUser {
    if (!payload?.sub)
      throw new UnauthorizedException('Invalid token');
    return { sub: payload.sub, pv: payload.pv };
  }
}
```

### Step 4 — `JwtAuthGuard` global + whitelist route login

Fastify/Nest: đường dẫn thực tế thường có prefix `/api`. Dùng `IS_PUBLIC_KEY` + danh sách path cho login.

```typescript
// chalo-be/src/modules/auth/guards/jwt-auth.guard.ts
import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()]))
      return true;

    const req = context.switchToHttp().getRequest<{ url?: string; path?: string }>();
    const path = req.url?.split('?')[0] ?? req.path ?? '';
    if (path.endsWith('/auth/login'))
      return true;

    return super.canActivate(context);
  }
}
```

**Đăng ký trong `AppModule`:**

```typescript
import { APP_GUARD } from '@nestjs/core';
// providers: [{ provide: APP_GUARD, useClass: JwtAuthGuard }],
```

### Step 5 — `AuthService`: hash password + verify + sign JWT

```typescript
// chalo-be/src/modules/auth/auth.service.ts (minh họa — cần StaffRepository thật)
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';

import type { ConfigKeyPaths } from '../../config';
import type { ISecurityConfig } from '../../config/security.config';
import type { JwtPayload } from './auth.types';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService<ConfigKeyPaths>,
    // @InjectRepository(StaffEntity) private readonly staffRepo: Repository<StaffEntity>,
  ) {}

  async validateUser(username: string, plainPassword: string) {
    // const staff = await this.staffRepo.findOne({ where: { username } });
    // if (!staff) throw new UnauthorizedException();
    // const ok = await bcrypt.compare(plainPassword, staff.passwordHash);
    // if (!ok) throw new UnauthorizedException();
    // return staff;
    throw new UnauthorizedException('Wire StaffEntity + repository');
  }

  async login(username: string, plainPassword: string) {
    const staff = await this.validateUser(username, plainPassword);
    const sec = this.config.get<ISecurityConfig>('security')!;
    const payload: JwtPayload = { sub: (staff as any).id, pv: (staff as any).passwordVersion ?? 0 };
    return {
      accessToken: await this.jwt.signAsync(payload, {
        secret: sec.jwtSecret,
        expiresIn: sec.jwtExpiresSeconds,
      }),
    };
  }
}
```

### Step 6 — `AuthModule` wiring đầy đủ

```typescript
// chalo-be/src/modules/auth/auth.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import type { ConfigKeyPaths } from '../../config';
import type { ISecurityConfig } from '../../config/security.config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService<ConfigKeyPaths>) => {
        const sec = config.get<ISecurityConfig>('security')!;
        return {
          secret: sec.jwtSecret,
          signOptions: { expiresIn: sec.jwtExpiresSeconds },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
```

### Step 7 — `AuthController` + DTO login (kết hợp case 07)

```typescript
// chalo-be/src/modules/auth/dto/login.dto.ts
import { IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsString()
  @MinLength(1)
  username!: string;

  @IsString()
  @MinLength(1)
  password!: string;
}
```

```typescript
// chalo-be/src/modules/auth/auth.controller.ts
import { Body, Controller, Post } from '@nestjs/common';
import { Public } from './decorators/public.decorator';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.username, dto.password);
  }
}
```

### Step 8 — Test nhanh

```bash
curl -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" -d "{\"username\":\"a\",\"password\":\"b\"}"
```

Header các route khác: `Authorization: Bearer <accessToken>`.

### Step 9 — (Tuỳ chọn) Vô hiệu token khi đổi mật khẩu

Trong `JwtAuthGuard` sau `super.canActivate`, đọc `staff` từ DB theo `request.user.sub`, so sánh `staff.passwordVersion === request.user.pv` — giống spark-backend.

**Kiểm tra cuối §4:** `JWT_SECRET` đủ mạnh? Không log password? Login trả token có expiry?

---

## 5. ✅ Todo checklist (đánh dấu khi xong / nhờ review)

**Cách dùng:** Nhờ review → gửi **số case 04** + `auth.module`, strategy, guard, flow login (Postman/curl).

_Review codebase: `package.json` có `@nestjs/jwt`, `passport`, `passport-jwt`, `bcrypt` nhưng **không có** thư mục `modules/auth` / không dùng trong code._

- [ ] `SecurityConfig` (hoặc tương đương): `jwtSecret`, `expiresIn`, đọc từ env
- [ ] `JwtModule.registerAsync` dùng `ConfigService`
- [ ] `JwtStrategy` + payload tối thiểu (`sub` / `staffId`, `pv` nếu dùng)
- [ ] `JwtAuthGuard` global + decorator `@Public()` + (tuỳ chọn) whitelist route login
- [ ] Endpoint đăng nhập: verify password (bcrypt) → trả JWT (và refresh nếu có thiết kế)
- [ ] `request.user` được gắn đúng kiểu sau khi qua guard
- [ ] (Tuỳ chọn) `tokenVersion` / `pv` để vô hiệu token cũ khi đổi mật khẩu
- [ ] (Tuỳ chọn) Redis blacklist — có thể để sau, ghi chú trong doc nội bộ
