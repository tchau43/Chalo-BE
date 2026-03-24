# Bước 6 — Auth: bcrypt, đăng ký, validate user (tầng service)

## 6.1 Nguyên tắc

- **Không** lưu mật khẩu thô  
- Dùng `bcrypt.hash` (cost 10–12) và `bcrypt.compare`  
- Email chuẩn hoá `toLowerCase().trim()` trước khi query  

## 6.2 `AuthService` minh hoạ

`src/modules/auth/auth.service.ts`:

```typescript
import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'

import * as bcrypt from 'bcrypt'

import { UserService } from '~/modules/user/user.service'

const BCRYPT_ROUNDS = 12

@Injectable()
export class AuthService {
  constructor(private readonly userService: UserService) {}

  async register(email: string, plainPassword: string) {
    const normalized = email.toLowerCase().trim()
    const existing = await this.userService.findByEmail(normalized)
    if (existing)
      throw new ConflictException('Email already registered')

    const passwordHash = await bcrypt.hash(plainPassword, BCRYPT_ROUNDS)
    return this.userService.create(normalized, passwordHash)
  }

  async validateUser(email: string, plainPassword: string) {
    const normalized = email.toLowerCase().trim()
    const user = await this.userService.findByEmail(normalized)
    if (!user)
      throw new UnauthorizedException('Invalid credentials')

    const ok = await bcrypt.compare(plainPassword, user.passwordHash)
    if (!ok)
      throw new UnauthorizedException('Invalid credentials')

    return user
  }
}
```

## 5.3 Không trả `passwordHash` ra API

Khi map user sang DTO public, luôn bỏ field nhạy cảm:

```typescript
export type SafeUser = {
  id: string
  email: string
  createdAt: Date
}

export function toSafeUser(u: { id: string; email: string; createdAt: Date }): SafeUser {
  return { id: u.id, email: u.email, createdAt: u.createdAt }
}
```

## Checkpoint

- Unit test: `register` tạo user, `validateUser` đúng/sai password  

Sang: [07-jwt-tokens-passport.md](./07-jwt-tokens-passport.md)
