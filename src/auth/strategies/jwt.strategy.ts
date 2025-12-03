import { Injectable, UnauthorizedException, InternalServerErrorException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UserService } from '../../user/user.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly userService: UserService,
  ) {
    const secretFromConfig = configService.get<string>('JWT_SECRET');

    if (!secretFromConfig) {
      console.error('\n\n[JwtStrategy] ¡ERROR CRÍTICO! La variable de entorno JWT_SECRET no está definida.\n\n');
      throw new InternalServerErrorException('Configuración de JWT incompleta en el servidor.');
    }

    console.log(`\n\n[JwtStrategy - VERIFICANDO] ---- LEYENDO SECRETO ----`);
    console.log(`[JwtStrategy - VERIFICANDO] Secreto leído del ConfigService: Encontrado`);
    console.log(`[JwtStrategy - VERIFICANDO] ---------------------------\n\n`);
    
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secretFromConfig,
    });
  }

  async validate(payload: { sub: string; email: string; rol: string }) {
    const user = await this.userService.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('Token inválido, usuario no existe.');
    }
    const { password, twoFactorSecret, ...result } = user.toObject();
    return result;
  }
}