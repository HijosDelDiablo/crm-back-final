import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  app.enableCors({
    origin: [
      'http://localhost:3000',
      'http://localhost',
      'http://10.0.2.2:3000',
      'http://10.0.2.2',
      'http://192.168.1.40:3000',
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

  await app.listen(process.env.PORT ?? 3000);
  console.log(`Servidor ejecutándose en: ${await app.getUrl()}`);
}
bootstrap();