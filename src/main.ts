import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestFastifyApplication } from '@nestjs/platform-fastify';
import { fastifyApp } from './common/adapters/fastify.adapter';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, fastifyApp);
  await app.listen(process.env.PORT ?? 3000);
  console.log("")
}
bootstrap();
