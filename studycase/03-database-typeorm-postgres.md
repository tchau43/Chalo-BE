# Case Study: Database — TypeORM + PostgreSQL

## 1. 📖 Tóm tắt Case Study

PostgreSQL là nguồn sự thật cho **đơn hàng, menu, ca làm, tồn kho**. TypeORM kết nối Nest với DB qua `TypeOrmModule.forRootAsync`: đọc cấu hình từ `ConfigService`, bật `autoLoadEntities` để không phải liệt kê tay mọi entity, và dùng **migration** thay vì `synchronize: true` trên production.

Quán cà phê cần tính **toàn vẹn giao dịch** (order + order lines + cập nhật tồn) — kiến trúc DB module rõ ràng giúp bạn thêm subscriber/constraint dùng chung.

---

## 2. 🔍 Cách `spark-backend` triển khai (The Reference)

### Luồng hoạt động

1. `database.config.ts` build `DataSourceOptions` (host, pool, paths `entities`/`migrations` trỏ `dist/` cho CLI).
2. `DatabaseModule` dùng `forRootAsync`: merge options từ config + `autoLoadEntities: true` + custom `TypeORMLogger` + `dataSourceFactory` để khởi tạo `DataSource` tường minh.
3. **Global constraints** (`EntityExistConstraint`, `UniqueConstraint`) và **subscriber** (`UuidSubscriber`) đăng ký làm providers của `DatabaseModule` để dùng trong validation/class-validator.

### File cốt lõi

| Vai trò | Đường dẫn |
|--------|------------|
| Dynamic module | `src/shared/database/database.module.ts` |
| Static DataSource (CLI / scripts) | `src/config/database.config.ts` |
| Custom SQL logging | `src/shared/database/typeorm-logger.ts` |
| UUID v7 before insert | `src/common/subscribers/uuid-subscriber.ts` |
| Custom validators DB | `src/shared/database/constraints/*.ts` |

### Đoạn code quan trọng

**`DatabaseModule` — async factory + explicit DataSource:**

```typescript
// spark-backend/src/shared/database/database.module.ts
// useFactory merges ConfigService 'database' block with runtime options (logging, subscribers).
// dataSourceFactory ensures a single initialized DataSource instance.

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService<ConfigKeyPaths>) => ({
        ...configService.get<IDatabaseConfig>('database'),
        autoLoadEntities: true,
        logging: loggerOptions,
        logger: new TypeORMLogger(loggerOptions),
      }),
      dataSourceFactory: async (options) => {
        const dataSource = await new DataSource(options).initialize();
        return dataSource;
      },
    }),
  ],
  providers: [EntityExistConstraint, UniqueConstraint, UuidSubscriber],
  exports: [EntityExistConstraint, UniqueConstraint, UuidSubscriber],
})
export class DatabaseModule {}
```

**Cấu hình Postgres + pool (excerpt):**

```typescript
// spark-backend/src/config/database.config.ts
const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: env('DB_HOST', '127.0.0.1'),
  port: envNumber('DB_PORT', 5432),
  synchronize: envBoolean('DB_SYNCHRONIZE', false),
  entities: ['dist/modules/**/*.entity{.ts,.js}'],
  migrations: ['dist/migrations/*{.ts,.js}'],
  extra: {
    max: envNumber('DB_POOL_MAX', 20),
    connectionTimeoutMillis: envNumber('DB_POOL_TIMEOUT', 30000),
  },
};
```

**Subscriber gán UUID trước khi insert:**

```typescript
// spark-backend/src/common/subscribers/uuid-subscriber.ts
// If entity has `id` and it is empty, assign uuidv7 before flush to DB.
beforeInsert(event: InsertEvent<any>): void {
  const entity = event.entity;
  if (entity && Object.prototype.hasOwnProperty.call(entity, 'id') && !entity.id) {
    entity.id = uuidv7();
  }
}
```

---

## 3. ☕ Ứng dụng vào `chalo-be` (The Application)

- **Bắt buộc**: `synchronize: false` trên môi trường thật; dùng migration cho mọi thay đổi schema.
- **Entity design**: Order/OrderItem nên có quan hệ rõ; cân nhắc `version` hoặc `updatedAt` cho optimistic locking khi nhiều thiết bị cùng sửa bàn.
- **UUID vs serial**: Spark dùng UUID v7 — phù hợp khi expose id ra API hoặc merge dữ liệu offline sau; nếu Chalo chỉ server-generated sequential id cũng được, nhưng phải thống nhất một chiến lược.
- **Constraint helpers**: `EntityExist` hữu ích cho DTO “`menuItemId` phải tồn tại” — giảm lỗi 500 do FK.

---

## 4. 🛠️ Hướng dẫn thực hành (Step-by-step Implementation)

> **Tiên quyết:** Case 02 xong (`DatabaseConfig`, `ConfigModule`). PostgreSQL đã cài và tạo database `chalo` (hoặc tên bạn đặt trong `.env`).

### Step 1 — Đồng bộ glob `entities` / `migrations` với build Nest

- Khi chạy `nest start`, code nằm trong `src/`.
- Khi chạy `node dist/main`, TypeORM cần trỏ tới `dist/**/*.entity.js`.

**Cách A (khuyến nghị MVP):** Trong `DatabaseModule` dùng `autoLoadEntities: true` và **không** liệt kê `entities` tay trong config — TypeORM tự nạp entity đã đăng ký qua `forFeature`.

**Cách B:** Trong `database.config.ts` đặt:

```typescript
entities: [__dirname + '/../**/*.entity{.ts,.js}'],
```

sau khi build, chỉnh thành glob `dist` nếu CLI migration chạy từ JS.

### Step 2 — Tạo `DatabaseModule` (forRootAsync + DataSource)

```typescript
// chalo-be/src/shared/database/database.module.ts
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource, type DataSourceOptions } from 'typeorm';

import type { ConfigKeyPaths } from '../../config';
import type { IDatabaseConfig } from '../../config/database.config';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService<ConfigKeyPaths>) => {
        const base = configService.get<IDatabaseConfig>('database');
        return {
          ...base,
          autoLoadEntities: true,
          logging: process.env.NODE_ENV === 'development',
        } as DataSourceOptions;
      },
      dataSourceFactory: async (options: DataSourceOptions) => {
        const ds = new DataSource(options);
        return ds.initialize();
      },
    }),
  ],
})
export class DatabaseModule {}
```

**Import vào `AppModule`:** thêm `DatabaseModule` vào mảng `imports` **sau** `ConfigModule`.

### Step 3 — Entity đầu tiên (`MenuItemEntity`)

Ví dụ PK dạng **UUID string** (bạn tự generate ở service trước khi save, hoặc dùng `@PrimaryGeneratedColumn('uuid')` nếu Postgres extension):

```typescript
// chalo-be/src/modules/menu/entities/menu-item.entity.ts
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'menu_items' })
export class MenuItemEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 200 })
  name!: string;

  /** Giá lưu integer (ví dụ đồng) để tránh float */
  @Column({ type: 'int' })
  priceCents!: number;

  @Column({ default: true })
  isActive!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
```

### Step 4 — Đăng ký entity trong `MenuModule`

```typescript
// chalo-be/src/modules/menu/menu.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MenuItemEntity } from './entities/menu-item.entity';
import { MenuController } from './menu.controller';
import { MenuService } from './menu.service';

@Module({
  imports: [TypeOrmModule.forFeature([MenuItemEntity])],
  controllers: [MenuController],
  providers: [MenuService],
  exports: [MenuService, TypeOrmModule],
})
export class MenuModule {}
```

### Step 5 — `MenuService` dùng `Repository`

```typescript
// chalo-be/src/modules/menu/menu.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MenuItemEntity } from './entities/menu-item.entity';

@Injectable()
export class MenuService {
  constructor(
    @InjectRepository(MenuItemEntity)
    private readonly menuRepo: Repository<MenuItemEntity>,
  ) {}

  findAllActive() {
    return this.menuRepo.find({ where: { isActive: true }, order: { name: 'ASC' } });
  }
}
```

### Step 6 — Migration (không dùng `synchronize: true` trên prod)

1. Tạo file `src/data-source.ts` (hoặc `ormconfig`) export `DataSource` với cùng option như app — tham khảo [TypeORM Nest doc](https://docs.nestjs.com/techniques/database#migrations).

2. Thêm script vào `package.json`:

```json
{
  "scripts": {
    "typeorm": "typeorm-ts-node-commonjs -d src/data-source.ts",
    "migration:generate": "npm run typeorm -- migration:generate src/migrations/ChaloMigration",
    "migration:run": "npm run typeorm -- migration:run",
    "migration:revert": "npm run typeorm -- migration:revert"
  }
}
```

3. Chạy:

```bash
pnpm run migration:generate
pnpm run migration:run
```

**Lưu ý:** Tên lệnh phụ thuộc phiên bản TypeORM / `ts-node`; nếu lỗi, đổi sang `data-source.js` sau `nest build`.

### Step 7 — (Tuỳ chọn) `UuidSubscriber`

Chỉ khi bạn muốn auto-fill `id` trước insert — cần cài `uuid` package và đăng ký subscriber trong `DatabaseModule.providers`. Spark dùng `uuidv7`; bạn có thể dùng `randomUUID` của `crypto` (UUID v4).

**Kiểm tra cuối §4:** `pnpm run start:dev` kết nối DB thành công? `findAllActive` trả mảng (có thể rỗng)? Migration áp đúng bảng trên DB sạch?

---

## 5. ✅ Todo checklist (đánh dấu khi xong / nhờ review)

**Cách dùng:** Nhờ review → gửi **số case 03** + `database.module.ts`, `database.config.ts`, và output migration đầu tiên (nếu có).

_Review codebase: dependency có `@nestjs/typeorm`, `typeorm`, `pg` nhưng **chưa wire** vào `AppModule` / không có entity._

- [ ] `DatabaseModule` với `TypeOrmModule.forRootAsync` + inject `ConfigService`
- [ ] `synchronize: false` cho môi trường giống production (hoặc thống nhất rule rõ ràng)
- [ ] Cấu hình pool (`extra.max`, timeout) phù hợp
- [ ] Ít nhất **một** entity + `TypeOrmModule.forFeature` trong đúng feature module
- [ ] Script / lệnh migration chạy được (generate + run trên DB sạch)
- [ ] (Tuỳ chọn) Subscriber UUID hoặc constraint helper nếu bạn dùng pattern đó
