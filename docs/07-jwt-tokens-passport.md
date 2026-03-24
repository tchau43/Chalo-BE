# Bước 7 — JWT: TokenService + Payload + JwtStrategy (Passport)

## 7.1 Payload JWT — một nguồn: `src/modules/auth/auth.types.ts`

Định nghĩa **chỉ ở đây** (tránh lệch bản copy giữa các đoạn doc):

- `sub`: id user (uuid).
- `typ`: phân biệt access vs refresh (string literal).
- `ver` trên refresh: dự phòng v2 (đổi mật khẩu / revoke hàng loạt); spark tương đương `passwordVersion`.

## 7.2 `TokenService`

`src/modules/auth/services/token.service.ts`:

```typescript
import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'

import type { ISecurityConfig } from '~/config/security.config'
import type { AccessTokenPayload, RefreshTokenPayload } from '../auth.types'

@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  private get security() {
    return this.config.get<ISecurityConfig>('security')!
  }

  signAccess(userId: string, email: string) {
    const payload: AccessTokenPayload = { sub: userId, email, typ: 'access' }
    return this.jwt.signAsync(payload, {
      secret: this.security.jwtSecret,
      expiresIn: this.security.jwtExpiresIn,
    })
  }

  signRefresh(userId: string, version = 0) {
    const payload: RefreshTokenPayload = { sub: userId, typ: 'refresh', ver: version }
    return this.jwt.signAsync(payload, {
      secret: this.security.refreshSecret,
      expiresIn: this.security.refreshExpiresIn,
    })
  }

  async verifyRefresh(token: string): Promise<RefreshTokenPayload> {
    return this.jwt.verifyAsync<RefreshTokenPayload>(token, {
      secret: this.security.refreshSecret,
    })
  }
}
```

## 7.3 Nội dung `src/modules/auth/auth.types.ts`

```typescript
export interface AccessTokenPayload {
  sub: string
  email: string
  typ: 'access'
}

export interface RefreshTokenPayload {
  sub: string
  typ: 'refresh'
  ver: number
}
```

## 7.4 `JwtStrategy` — validate access token

`src/modules/auth/strategies/jwt.strategy.ts`:

```typescript
import { Injectable, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'

import type { ISecurityConfig } from '~/config/security.config'
import type { AccessTokenPayload } from '../auth.types'

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService) {
    const security = config.get<ISecurityConfig>('security')!
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: security.jwtSecret,
    })
  }

  async validate(payload: AccessTokenPayload) {
    if (!payload?.sub || payload.typ !== 'access')
      throw new UnauthorizedException('Invalid token')
    return { userId: payload.sub, email: payload.email }
  }
}
```

**Đối tượng `request.user` sau guard:** `{ userId, email }`.

## 7.5 Đăng ký `JwtModule` trong `AuthModule`

```typescript
JwtModule.registerAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService) => {
    const s = config.get<ISecurityConfig>('security')!
    return {
      secret: s.jwtSecret,
      signOptions: { expiresIn: s.jwtExpiresIn },
    }
  },
}),
```

**Sự kiện `@nestjs/jwt`:** `JwtService.signAsync(payload, { expiresIn })` cho **lần ký đó** có thể ghi đè `signOptions.expiresIn` của `JwtModule`. Case study v1: giữ `expiresIn` trong `signAccess` / `signRefresh` (khớp `TokenService` mẫu) là đủ; `JwtModule.signOptions.expiresIn` có thể coi là mặc định cho các chỗ không truyền option.

## Checkpoint

- Ký access token, gửi `Authorization: Bearer ...`, strategy `validate` chạy  

Sang: [08-guards-public-decorators.md](./08-guards-public-decorators.md)
