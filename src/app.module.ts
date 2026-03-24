import { Module } from '@nestjs/common';
import { MenuModule } from '@/modules/menu/menu.module';
import { ConfigModule } from '@nestjs/config';
import config from '@/config';

@Module({
  imports: [
    // TODO: configmodule
    ConfigModule.forRoot({
      isGlobal: true,
      expandVariables: true,
      envFilePath: ['.env.local', `.env.${process.env.NODE_ENV}`, '.env'],
      load: [...Object.values(config)]
    }),
    // TODO: dbmobule
    // TODO: authmodule
    MenuModule
  ],
  controllers: [],
  providers: [
    // TODO: [provide: app-filter]
    // TODO: global interceptor - guard
  ],
})
export class AppModule { }
