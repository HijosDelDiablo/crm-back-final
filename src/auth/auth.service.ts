import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument, ValidatedUser } from '../user/schemas/user.schema';
import { UserService } from '../user/user.service';
import { RegisterAuthDto } from './dto/register-auth.dto';
import { LoginAuthDto } from './dto/login-auth.dto';
import { TwoFactorCodeDto } from './dto/2fa-code.dto';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { OneSignalService } from '../notifications/onesignal.service';
import { compare, hash } from 'bcrypt';
import { Rol } from './enums/rol.enum';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly oneSignalService: OneSignalService,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  async register(dto: RegisterAuthDto) {
    const userExists = await this.userService.findByEmail(dto.email);
    if (userExists) {
      throw new ConflictException('El correo electrónico ya está registrado.');
    }
    const hashedPassword = await hash(dto.password, 10);
    const newUser = await this.userService.create({
      nombre: dto.nombre,
      email: dto.email,
      password: hashedPassword,
      telefono: dto.telefono,
    });
    const { password, ...user } = newUser.toObject();
    return user;
  }

  async loginConCredenciales(userFromValidation: ValidatedUser) {
    if (userFromValidation.twoFactorEnabled) {
      return {
        message: 'Autenticación de dos factores requerida.',
        userId: userFromValidation._id.toString(),
      };
    }
    return this._generarTokenAcceso(userFromValidation);
  }

  async loginConGoogle(profile: any) {
    const user = await this.validateGoogleUser(profile);
    if (!user) {
      throw new UnauthorizedException('No se pudo validar al usuario de Google.');
    }
    const userObject = user.toObject();
    if (userObject.twoFactorEnabled) {
      const frontendUrl = this.configService.get<string>('FRONTEND_URL');
      const redirectUrl = `${frontendUrl}/autenticacion-2fa?userId=${userObject._id.toString()}`;
      return { redirect: true, url: redirectUrl };
    }
    const tokenData = await this._generarTokenAcceso(userObject as ValidatedUser);
    const frontendUrl = this.configService.get<string>('FRONTEND_URL');
    const redirectUrl = `${frontendUrl}/login-exitoso?token=${tokenData.accessToken}`;
    return { redirect: true, url: redirectUrl };
  }

  async autenticarCon2FA(userId: string, code: string) {
    const usuario = await this.userModel.findById(userId);
    if (!usuario) {
      throw new UnauthorizedException('Usuario no encontrado.');
    }
    if (!usuario.twoFactorEnabled) {
      throw new UnauthorizedException('2FA no está activado para este usuario.');
    }
    const isMatch = await compare(code, usuario.twoFactorTempSecret || '');
    if (!isMatch || !usuario.twoFactorTempExpiry || usuario.twoFactorTempExpiry < new Date()) {
      throw new UnauthorizedException('Código 2FA inválido o expirado.');
    }
    usuario.twoFactorTempSecret = undefined;
    usuario.twoFactorTempExpiry = undefined;
    await usuario.save();
    return this._generarTokenAcceso(usuario.toObject() as ValidatedUser);
  }

  async generarSecreto2FA(user: ValidatedUser) {
    const usuario = await this.userModel.findById(user._id);
    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado.');
    }
    if (usuario.twoFactorEnabled) {
      throw new BadRequestException('El 2FA ya está activado.');
    }

    const tempCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = new Date(Date.now() + 10 * 60 * 1000);
    const hashedCode = await hash(tempCode, 10);
    
    usuario.twoFactorTempSecret = hashedCode;
    usuario.twoFactorTempExpiry = expiry;
    await usuario.save();

    try {
      await this.oneSignalService.enviarCodigo2FA(usuario.email, tempCode);
      return { message: 'Se ha enviado un código de 6 dígitos a tu correo electrónico.' };
    } catch (error) {
      this.logger.error('Error enviando 2FA con OneSignal:', error.message);
      throw new BadRequestException('No se pudo enviar el correo de verificación.');
    }
  }

  async activar2FA(user: ValidatedUser, dto: TwoFactorCodeDto) {
    const usuario = await this.userModel.findById(user._id);
    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado.');
    }
    if (
      !usuario.twoFactorTempSecret ||
      !usuario.twoFactorTempExpiry ||
      usuario.twoFactorTempExpiry < new Date()
    ) {
      throw new UnauthorizedException('El código ha expirado o es inválido.');
    }
    const isMatch = await compare(dto.code, usuario.twoFactorTempSecret);
    if (!isMatch) {
      throw new UnauthorizedException('El código de 6 dígitos es incorrecto.');
    }
    usuario.twoFactorEnabled = true;
    usuario.twoFactorTempSecret = undefined;
    usuario.twoFactorTempExpiry = undefined;
    await usuario.save();
    return { message: 'El 2FA ha sido activado exitosamente.' };
  }

  async desactivar2FA(userId: string) {
    await this.userService.update(userId, {
      twoFactorEnabled: false,
      twoFactorTempSecret: undefined,
      twoFactorTempExpiry: undefined,
    });
    return { message: '2FA desactivado exitosamente.' };
  }

  async assignRole(targetUserId: string, newRole: Rol, performingAdmin: ValidatedUser) {
    const userToUpdate: any = await this.userService.findById(targetUserId);
    if (!userToUpdate) {
      throw new NotFoundException('Usuario objetivo no encontrado.');
    }
    
    if (userToUpdate.rol === Rol.ADMIN) {
      throw new ForbiddenException('No se puede modificar el rol de un Administrador.');
    }
    
    if (userToUpdate._id.toString() === performingAdmin._id.toString()) {
       throw new ForbiddenException('Un administrador no puede cambiar su propio rol.');
    }

    return this.userService.update(targetUserId, { rol: newRole });
  }

  async deleteUser(targetUserId: string, performingAdmin: ValidatedUser) {
    if (targetUserId === performingAdmin._id.toString()) {
      throw new ForbiddenException('Un administrador no puede eliminarse a sí mismo.');
    }

    const userToDelete: any = await this.userService.findById(targetUserId);
    if (!userToDelete) {
      throw new NotFoundException('Usuario objetivo no encontrado.');
    }

    if (userToDelete.rol === Rol.ADMIN) {
      throw new ForbiddenException('No se puede eliminar a un Administrador.');
    }
    
    const result = await this.userModel.findByIdAndDelete(targetUserId);
    if (!result) {
      throw new NotFoundException('Usuario no encontrado para eliminar.');
    }
    return { message: 'Usuario eliminado exitosamente.' };
  }

  private async _generarTokenAcceso(user: ValidatedUser) {
    const payload = {
      email: user.email,
      sub: user._id.toString(),
      rol: user.rol,
    };
    const expiresConfig = this.configService.get<string>('JWT_EXPIRATION', '3600');
    const expiresIn: number = Number(expiresConfig);
    const accessToken = this.jwtService.sign(payload, { expiresIn });
    return {
      accessToken,
      user: {
        email: user.email,
        nombre: user.nombre,
        rol: user.rol,
        _id: user._id,
      },
    };
  }

  async validateUser(dto: LoginAuthDto): Promise<any> {
    const user = await this.userService.findByEmailWithPassword(dto.email);
    if (!user || !user.password) {
      throw new UnauthorizedException('Credenciales inválidas.');
    }
    const passwordMatches = await compare(dto.password, user.password);
    if (!passwordMatches) {
      throw new UnauthorizedException('Credenciales inválidas.');
    }
    return user.toObject();
  }

  async validateGoogleUser(profile: any): Promise<UserDocument | null> {
    if (!profile) throw new UnauthorizedException('No se recibió perfil de Google.');
    
    let user: UserDocument | null = await this.userService.findByGoogleId(profile.googleId);
    if (user) return user;

    user = await this.userService.findByEmail(profile.email);
    if (user) {
      return this.userService.update(user.id, { googleId: profile.googleId });
    }
    
    return this.userService.create({
      email: profile.email,
      nombre: profile.nombre,
      googleId: profile.googleId,
    });
  }
}