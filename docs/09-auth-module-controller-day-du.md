# Bước 9 — AuthModule + DTO + AuthController + Ghép AppModule (file hoàn chỉnh)

Phần này là **bản ghép đầy đủ** để bạn copy-adapt theo từng file. Đường dẫn gợi ý theo cây trong `00-PLAN`.

---

## 9.1 DTO

`src/modules/auth/dto/register.dto.ts`:

```typescript
import { IsEmail, IsString, MinLength } from 'class-validator'

export class RegisterDto {
  @IsEmail()
  email!: string

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  password!: string
}
```

`src/modules/auth/dto/login.dto.ts`:

```typescript
import { IsEmail, IsString, MinLength } from 'class-validator'

export class LoginDto {
  @IsEmail()
  email!: string

  @IsString()
  @MinLength(1)
  password!: string
}
```

`src/modules/auth/dto/refresh.dto.ts`:

```typescript
import { IsString, MinLength } from 'class-validator'

export class RefreshDto {
  @IsString()
  @MinLength(10)
  refreshToken!: string
}
```

---

## 9.2 `AuthController` (đã gộp refresh đúng: load user từ DB + try/catch)

`src/modules/auth/auth.controller.ts`:

```typescript
import {
  Body,
  Controller,
  Get,
  Post,
  UnauthorizedException,
} from '@nestjs/common'

import { Public } from '~/common/decorators/public.decorator'
import { CurrentUser, type AuthUser } from '~/common/decorators/current-user.decorator'

import { AuthService } from './auth.service'
import { LoginDto } from './dto/login.dto'
import { RefreshDto } from './dto/refresh.dto'
import { RegisterDto } from './dto/register.dto'
import { TokenService } from './services/token.service'

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly tokenService: TokenService,
  ) {}

  @Public()
  @Post('register')
  async register(@Body() dto: RegisterDto) {
    const user = await this.authService.register(dto.email, dto.password)
    const accessToken = await this.tokenService.signAccess(user.id, user.email)
    const refreshToken = await this.tokenService.signRefresh(user.id, 0)
    return {
      user: { id: user.id, email: user.email, createdAt: user.createdAt },
      accessToken,
      refreshToken,
    }
  }

  @Public()
  @Post('login')
  async login(@Body() dto: LoginDto) {
    const user = await this.authService.validateUser(dto.email, dto.password)
    const accessToken = await this.tokenService.signAccess(user.id, user.email)
    const refreshToken = await this.tokenService.signRefresh(user.id, 0)
    return {
      user: { id: user.id, email: user.email, createdAt: user.createdAt },
      accessToken,
      refreshToken,
    }
  }

  @Public()
  @Post('refresh')
  async refresh(@Body() dto: RefreshDto) {
    try {
      const payload = await this.tokenService.verifyRefresh(dto.refreshToken)
      if (payload.typ !== 'refresh')
        throw new UnauthorizedException('Invalid refresh token')

      const user = await this.authService.getUserForRefresh(payload.sub)
      const accessToken = await this.tokenService.signAccess(user.id, user.email)
      return { accessToken }
    }
    catch (e) {
      if (e instanceof UnauthorizedException)
        throw e
      throw new UnauthorizedException('Invalid or expired refresh token')
    }
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return { userId: user.userId, email: user.email }
  }
}
```

---

## 9.3 `AuthModule` (export `JwtAuthGuard` cho `AppModule`)

`src/modules/auth/auth.module.ts`:

```typescript
import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { JwtModule } from '@nestjs/jwt'
import { PassportModule } from '@nestjs/passport'

import type { ISecurityConfig } from '~/config/security.config'
import { UserModule } from '~/modules/user/user.module'

import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'
import { JwtAuthGuard } from './guards/jwt-auth.guard'
import { JwtStrategy } from './strategies/jwt.strategy'
import { TokenService } from './services/token.service'

@Module({
  imports: [
    UserModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    ConfigModule,
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
  ],
  controllers: [AuthController],
  providers: [AuthService, TokenService, JwtStrategy, JwtAuthGuard],
  exports: [AuthService, TokenService, JwtAuthGuard],
})
export class AuthModule {}
```

---

## 9.4 `AuthService` đầy đủ (gồm `getUserForRefresh` cho refresh token)

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

  async getUserForRefresh(userId: string) {
    const user = await this.userService.findById(userId)
    if (!user)
      throw new UnauthorizedException('User not found')
    return user
  }
}
```

---

## 9.5 `AppModule` (`APP_GUARD` — theo Nest doc)

```typescript
import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { APP_GUARD } from '@nestjs/core'

import { configLoaders } from './config'
import { AppController } from './app.controller'
import { AuthModule } from './modules/auth/auth.module'
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard'
import { UserModule } from './modules/user/user.module'
import { DatabaseModule } from './shared/database/database.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      expandVariables: true,
      envFilePath: ['.env.local', `.env.${process.env.NODE_ENV}`, '.env'],
      load: configLoaders,
    }),
    DatabaseModule,
    UserModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [{ provide: APP_GUARD, useClass: JwtAuthGuard }],
})
export class AppModule {}
```

`AuthModule` phải **export** `JwtAuthGuard` (mục 8.3). Tham chiếu: [CASE-STUDY-CHUAN-THAM-CHIEU-KY-THUAT.md](./CASE-STUDY-CHUAN-THAM-CHIEU-KY-THUAT.md) mục 7 (DI / `APP_GUARD`).

---

## 9.6 Test thủ công (Thunder Client / curl)

**Register:**

```http
POST http://localhost:3000/api/auth/register
Content-Type: application/json

{"email":"a@b.com","password":"password12"}
```

**Login:**

```http
POST http://localhost:3000/api/auth/login
Content-Type: application/json

{"email":"a@b.com","password":"password12"}
```

**Me:**

```http
GET http://localhost:3000/api/auth/me
Authorization: Bearer <accessToken>
```

**Refresh:**

```http
POST http://localhost:3000/api/auth/refresh
Content-Type: application/json

{"refreshToken":"<refreshToken>"}
```

---

## Checkpoint cuối case study Auth v1

- Register / Login / Refresh / Me hoạt động  
- Route có `@Public()` không cần Bearer  
- Route không public trả 401 khi thiếu/sai token  

Tiếp: [10-mo-rong-sau-case-study-1.md](./10-mo-rong-sau-case-study-1.md)
