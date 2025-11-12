import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UserModule } from '../user/user.module';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
import { NotificationsModule } from '../notifications/notifications.module'; // Importar
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../user/schemas/user.schema';

@Module({
  imports: [
    UserModule,
    PassportModule,
    ConfigModule,
    NotificationsModule,
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const secret = configService.get<string>('JWT_SECRET');

        const expiresInString = configService.get<string>('JWT_EXPIRATION', '3600');
        const expiresIn = Number(expiresInString);

        console.log('[AuthModule - FIRMANDO] ---- VERIFICANDO JWT ----');
        console.log(`[AuthModule - FIRMANDO] Usando JWT_SECRET: ${secret ? 'OK' : 'NO ENCONTRADO'}`);
        console.log(`[AuthModule - FIRMANDO] Configurando JWT_EXPIRATION global: ${expiresIn}`);
        console.log('[AuthModule - FIRMANDO] ---------------------------');

        return {
          secret: secret,
          signOptions: { expiresIn: expiresIn },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    LocalStrategy,
    JwtStrategy,
    GoogleStrategy,
  ],
})
export class AuthModule {}