import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ServeStaticModule } from '@nestjs/serve-static';
import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';
import { HttpModule } from '@nestjs/axios';
import { join } from 'path';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { ProductModule } from './product/product.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { CotizacionModule } from './cotizacion/cotizacion.module';
import { EmailModule } from './email/email.module';
import { NotificationsModule } from './notifications/notifications.module';
import { TasksModule } from './tasks/tasks.module';
import { CompraModule } from './compra/compra.module';
import { ProveedoresModule } from './proveedores/proveedores.module';
import { GastosModule } from './gastos/gastos.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const uri = configService.get<string>('DATABASE_URL');

        console.log(`[Mongoose] Intentando conectar a: ${
          uri ? uri.substring(0, 20) + '...' : 'URI no definida'
        }`);

        if (!uri) {
          console.error("[Mongoose] ERROR: La variable de entorno DATABASE_URL no está definida.");
        }

        return { uri };
      },
    }),

    MailerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        transport: {
          host: configService.get<string>('SMTP_SERVER'),
          port: parseInt(configService.get<string>('SMTP_PORT', '587'), 10),
          secure: false,
          auth: {
            user: configService.get<string>('EMAIL_FROM'),
            pass: configService.get<string>('EMAIL_PASSWORD'),
          },
        },
        defaults: {
          from: `"SmartAssistant CRM" <${configService.get<string>('EMAIL_FROM')}>`,
        },
        template: {
          dir: join(process.cwd(), 'src', 'templates'),
          adapter: new HandlebarsAdapter(),
          options: { strict: true },
        },
      }),
    }),

    HttpModule.register({
      timeout: 5000,
      maxRedirects: 5,
    }),

    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'uploads'),
      serveRoot: '/uploads',
    }),

    AuthModule,
    UserModule,
    ProductModule,
    DashboardModule,
    CotizacionModule,
    EmailModule,
    NotificationsModule,
    TasksModule,
    CompraModule,       
    ProveedoresModule,   
    GastosModule,       
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}