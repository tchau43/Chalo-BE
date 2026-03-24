# Bước 5 — TypeORM + PostgreSQL + Entity User + Migration

**Tiên quyết:** bước **3** (config DB), bước **4** (app chạy Fastify).

## 5.1 `DatabaseModule`

Tạo `src/shared/database/database.module.ts`:

```typescript
import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { TypeOrmModule } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'

import type { IDatabaseConfig } from '~/config/database.config'

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const db = configService.get<IDatabaseConfig>('database')!
        return {
          ...db,
          autoLoadEntities: true,
        }
      },
      dataSourceFactory: async (options) => {
        const ds = new DataSource(options)
        return ds.initialize()
      },
    }),
  ],
})
export class DatabaseModule {}
```

**Ghi chú spark-backend:** Cũng dùng `dataSourceFactory` + custom logger; case study có thể bỏ logger trước.

## 5.2 Import vào `AppModule`

```typescript
import { DatabaseModule } from './shared/database/database.module'

@Module({
  imports: [
    ConfigModule.forRoot({ /* ... */ }),
    DatabaseModule,
  ],
  // ...
})
export class AppModule {}
```

## 5.3 Entity `User`

Tạo `src/modules/user/entities/user.entity.ts`:

```typescript
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm'

@Entity('users')
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ unique: true, length: 255 })
  email!: string

  @Column({ name: 'password_hash', length: 255 })
  passwordHash!: string

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date
}
```

## 5.4 `UserModule` + `TypeOrmModule.forFeature`

`src/modules/user/user.module.ts`:

```typescript
import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'

import { UserEntity } from './entities/user.entity'
import { UserService } from './user.service'

@Module({
  imports: [TypeOrmModule.forFeature([UserEntity])],
  providers: [UserService],
  exports: [UserService, TypeOrmModule],
})
export class UserModule {}
```

## 5.5 `UserService` tối thiểu

`src/modules/user/user.service.ts`:

```typescript
import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'

import { UserEntity } from './entities/user.entity'

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
  ) {}

  findByEmail(email: string) {
    return this.userRepo.findOne({ where: { email: email.toLowerCase() } })
  }

  findById(id: string) {
    return this.userRepo.findOne({ where: { id } })
  }

  async create(email: string, passwordHash: string) {
    const user = this.userRepo.create({
      email: email.toLowerCase(),
      passwordHash,
    })
    return this.userRepo.save(user)
  }
}
```

## 5.6 Migration (khuyến nghị khi `synchronize: false`)

Cài CLI TypeORM (một trong hai cách):

- Dùng `typeorm` CLI với `data-source.ts` ở root, hoặc
- Viết migration tay trong `src/migrations/`.

**Migration minh hoạ** `src/migrations/1730000000000-CreateUsers.ts`:

```typescript
import type { MigrationInterface, QueryRunner } from 'typeorm'

export class CreateUsers1730000000000 implements MigrationInterface {
  name = 'CreateUsers1730000000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "email" character varying(255) NOT NULL,
        "password_hash" character varying(255) NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_users_email" UNIQUE ("email"),
        CONSTRAINT "PK_users" PRIMARY KEY ("id")
      )
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "users"`)
  }
}
```

**PostgreSQL:** Cần extension `uuid-ossp` hoặc dùng `gen_random_uuid()` (PG 13+):

```sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
```

Và đổi default thành `gen_random_uuid()`.

Hoặc để TypeORM generate UUID ở ứng dụng (`@PrimaryGeneratedColumn('uuid')` không cần default DB).

Đơn giản hóa migration (không default DB):

```typescript
await queryRunner.query(`
  CREATE TABLE "users" (
    "id" uuid NOT NULL,
    "email" character varying(255) NOT NULL,
    "password_hash" character varying(255) NOT NULL,
    "created_at" TIMESTAMP NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
    CONSTRAINT "UQ_users_email" UNIQUE ("email"),
    CONSTRAINT "PK_users" PRIMARY KEY ("id")
  )
`)
```

## 5.7 Dev nhanh

Đặt `DB_SYNCHRONIZE=true` **chỉ** trên máy dev để TypeORM tạo bảng; **tắt** trên staging/prod và dùng migration.

## Checkpoint

- App boot, không lỗi kết nối Postgres  
- Có bảng `users`  

Sang: [06-auth-password-bcrypt-service.md](./06-auth-password-bcrypt-service.md)
