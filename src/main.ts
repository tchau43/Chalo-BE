import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestFastifyApplication } from '@nestjs/platform-fastify';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule);
  const port = process.env.PORT ?? 3000
  await app.listen(port);
  const appUrl = await app.getUrl();
  console.log(`App running on: ${appUrl}`)
}
bootstrap();
