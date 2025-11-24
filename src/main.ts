import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  
  const port = Number(process.env.FRONTEND_PORT ?? 2000);
  const backendPort = Number(process.env.PORT ?? 2002);

  app.enableCors({
    origin: [
      `http://localhost:${port}`,
      `http://[::1]:${port}`,
      'http://localhost',
      `http://10.0.2.2:${port}`,
      'http://10.0.2.2',
      `http://192.168.1.40:${port}`,
      'http://192.168.1.40',
      'smartassistant://login-success',
      'http://localhost:3000/auth/google/callback',
    ],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
      'Access-Control-Allow-Headers',
      'Access-Control-Request-Method',
      'Access-Control-Request-Headers',
    ],
    credentials: true,
    preflightContinue: false,
    optionsSuccessStatus: 204
  });

  await app.listen(backendPort ?? 2002, '0.0.0.0');
  console.log(`Servidor ejecutándose en: ${await app.getUrl()}`);
}
bootstrap();