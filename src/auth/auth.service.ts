import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  Logger,
  NotFoundException,
  ForbiddenException,
  InternalServerErrorException,
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
    this.logger.log(`Iniciando autenticación 2FA para usuario: ${userId}`);
    
    const usuario = await this.userModel.findById(userId);
    if (!usuario) {
      this.logger.error(`Usuario no encontrado: ${userId}`);
      throw new UnauthorizedException('Usuario no encontrado.');
    }

    this.logger.log(`Usuario encontrado: ${usuario.email}`);
    this.logger.log(`2FA habilitado: ${usuario.twoFactorEnabled}`);
    this.logger.log(`Tiene código temporal: ${!!usuario.twoFactorTempSecret}`);
    this.logger.log(`Código expira: ${usuario.twoFactorTempExpiry}`);

    if (!usuario.twoFactorEnabled) {
      this.logger.error(`2FA no está activado para: ${usuario.email}`);
      throw new UnauthorizedException('2FA no está activado para este usuario.');
    }

    if (!usuario.twoFactorTempSecret) {
      this.logger.error(`No hay código temporal para: ${usuario.email}`);
      throw new UnauthorizedException('No hay código de verificación activo.');
    }

    if (!usuario.twoFactorTempExpiry || usuario.twoFactorTempExpiry < new Date()) {
      this.logger.error(`Código expirado para: ${usuario.email}`);
      throw new UnauthorizedException('El código ha expirado.');
    }

    this.logger.log(`Verificando código ingresado: ${code}`);
    const isMatch = await compare(code, usuario.twoFactorTempSecret);
    
    if (!isMatch) {
      this.logger.error(`Código incorrecto para: ${usuario.email}`);
      throw new UnauthorizedException('Código 2FA inválido.');
    }

    this.logger.log(`Código correcto, limpiando datos temporales`);
    
    usuario.twoFactorTempSecret = undefined;
    usuario.twoFactorTempExpiry = undefined;
    await usuario.save();

    this.logger.log(`Autenticación 2FA exitosa para: ${usuario.email}`);
    
    return this._generarTokenAcceso(usuario.toObject() as ValidatedUser);
  }

  async generarSecreto2FA(user: ValidatedUser) {
    this.logger.log(`Iniciando generación de código 2FA para: ${user.email}`);
    
    const usuario = await this.userModel.findById(user._id);
    if (!usuario) {
      this.logger.error(`Usuario no encontrado: ${user._id}`);
      throw new NotFoundException('Usuario no encontrado.');
    }

    if (usuario.twoFactorEnabled) {
      this.logger.warn(`2FA ya está activado para: ${user.email}`);
      throw new BadRequestException('El 2FA ya está activado.');
    }

    const tempCode = Math.floor(100000 + Math.random() * 900000).toString();
    this.logger.log(`Código generado: ${tempCode}`);

    const hashedCode = await hash(tempCode, 10);
    this.logger.log(`Código hasheado exitosamente`);

    const expiry = new Date(Date.now() + 10 * 60 * 1000);
    this.logger.log(`Código expirará: ${expiry.toISOString()}`);
    
    usuario.twoFactorTempSecret = hashedCode;
    usuario.twoFactorTempExpiry = expiry;
    await usuario.save();
    
    this.logger.log(`Código guardado en base de datos`);

    try {
      this.logger.log(`Enviando email via OneSignal a: ${usuario.email}`);
      await this.oneSignalService.enviarCodigo2FA(usuario.email, tempCode);
      this.logger.log(`Email 2FA enviado exitosamente via OneSignal a: ${usuario.email}`);
      
      return { 
        message: 'Se ha enviado un código de 6 dígitos a tu correo electrónico.',
        expiresAt: expiry.toISOString() 
      };
    } catch (error) {
      this.logger.error(`Error enviando email via OneSignal a ${usuario.email}:`, error.message);
      this.logger.error('Stack trace:', error.stack);
      
      usuario.twoFactorTempSecret = undefined;
      usuario.twoFactorTempExpiry = undefined;
      await usuario.save();
      
      throw new BadRequestException('No se pudo enviar el correo de verificación. Por favor intenta de nuevo.');
    }
  }

  async activar2FA(user: ValidatedUser, dto: TwoFactorCodeDto) {
    this.logger.log(`Activando 2FA para usuario: ${user.email}`);
    
    const usuario = await this.userModel.findById(user._id);
    if (!usuario) {
      this.logger.error(`Usuario no encontrado: ${user._id}`);
      throw new NotFoundException('Usuario no encontrado.');
    }

    this.logger.log(`Verificando código temporal...`);
    this.logger.log(`Tiene código: ${!!usuario.twoFactorTempSecret}`);
    this.logger.log(`Expira: ${usuario.twoFactorTempExpiry}`);

    if (!usuario.twoFactorTempSecret || !usuario.twoFactorTempExpiry) {
      this.logger.error(`No hay código temporal para: ${user.email}`);
      throw new UnauthorizedException('No hay código de verificación pendiente.');
    }

    if (usuario.twoFactorTempExpiry < new Date()) {
      this.logger.error(`Código expirado para: ${user.email}`);
      throw new UnauthorizedException('El código ha expirado. Solicita uno nuevo.');
    }

    const isMatch = await compare(dto.code, usuario.twoFactorTempSecret);
    if (!isMatch) {
      this.logger.error(`Código incorrecto para: ${user.email}`);
      throw new UnauthorizedException('El código de 6 dígitos es incorrecto.');
    }

    this.logger.log(`Código verificado, activando 2FA`);

    usuario.twoFactorEnabled = true;
    usuario.twoFactorTempSecret = undefined;
    usuario.twoFactorTempExpiry = undefined;
    await usuario.save();

    this.logger.log(`2FA activado exitosamente para: ${user.email}`);
    
    return { message: 'El 2FA ha sido activado exitosamente.' };
  }

  async desactivar2FA(userId: string) {
    this.logger.log(`Desactivando 2FA para usuario: ${userId}`);
    
    await this.userService.update(userId, {
      twoFactorEnabled: false,
      twoFactorTempSecret: undefined,
      twoFactorTempExpiry: undefined,
    });
    
    this.logger.log(`2FA desactivado para usuario: ${userId}`);
    
    return { message: '2FA desactivado exitosamente.' };
  }

  async assignRole(targetUserId: string, newRole: Rol, performingAdmin: ValidatedUser) {
    const userToUpdate = await this.userService.findById(targetUserId);
    if (!userToUpdate) {
      throw new NotFoundException('Usuario objetivo no encontrado.');
    }
    
    if (userToUpdate.rol === Rol.ADMIN) {
      throw new ForbiddenException('No se puede modificar el rol de un Administrador.');
    }
    
    if (userToUpdate._id && userToUpdate._id.toString() === performingAdmin._id.toString()) {
       throw new ForbiddenException('Un administrador no puede cambiar su propio rol.');
    }

    return this.userService.update(targetUserId, { rol: newRole });
  }

  async deleteUser(targetUserId: string, performingAdmin: ValidatedUser) {
    if (targetUserId === performingAdmin._id.toString()) {
      throw new ForbiddenException('Un administrador no puede eliminarse a sí mismo.');
    }

    const userToDelete = await this.userService.findById(targetUserId);
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
    
    const userObject = user.toObject();
    return {
      _id: userObject._id?.toString() || userObject._id,
      email: userObject.email,
      nombre: userObject.nombre,
      rol: userObject.rol,
      twoFactorEnabled: userObject.twoFactorEnabled,
    } as ValidatedUser;
  }

  async validateGoogleUser(profile: any): Promise<UserDocument | null> {
    if (!profile) throw new UnauthorizedException('No se recibió perfil de Google.');
    
    let user: UserDocument | null = await this.userService.findByGoogleId(profile.googleId);
    if (user) return user;

    user = await this.userService.findByEmail(profile.email);
    if (user) {
      const updatedUser = await this.userService.update(user.id, { googleId: profile.googleId });
      return updatedUser as UserDocument;
    }
    
    return this.userService.create({
      email: profile.email,
      nombre: profile.nombre,
      googleId: profile.googleId,
    });
  }

  async requestPasswordReset(email: string): Promise<{ message: string }> {
    const user = await this.userService.findByEmail(email);
    if (!user) {
      return { message: 'Si el email existe, se enviarán instrucciones de recuperación.' };
    }

    const userId = user._id ? user._id.toString() : user.id;
    const resetToken = this.jwtService.sign(
      { sub: userId, type: 'password_reset' },
      { expiresIn: '1h' }
    );

    try {
      await this._enviarEmailRecuperacion(user.email, resetToken, user.nombre);
      this.logger.log(`Email de recuperación enviado via OneSignal a: ${user.email}`);
      
      return { 
        message: 'Si el email existe, se enviarán instrucciones de recuperación.' 
      };
    } catch (error) {
      this.logger.error('Error enviando email de recuperación via OneSignal:', error);
      return { 
        message: 'Si el email existe, se enviarán instrucciones de recuperación.' 
      };
    }
  }

  async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    try {
      const payload = this.jwtService.verify(token);
      
      if (payload.type !== 'password_reset') {
        throw new UnauthorizedException('Token inválido.');
      }

      const hashedPassword = await hash(newPassword, 10);
      await this.userService.update(payload.sub, { password: hashedPassword });

      const user = await this.userService.findById(payload.sub);
      if (user) {
        await this._enviarEmailConfirmacionCambioPassword(user.email, user.nombre);
      }

      return { message: 'Contraseña restablecida exitosamente.' };
    } catch (error) {
      this.logger.error('Error restableciendo contraseña:', error);
      throw new UnauthorizedException('Token inválido o expirado.');
    }
  }

  private async _enviarEmailRecuperacion(
    email: string, 
    resetToken: string, 
    nombre: string
  ): Promise<void> {
    try {
      const backendUrl = this.configService.get<string>('BACKEND_URL', 'https://crm-back-final-production.up.railway.app');
      const resetLink = `${backendUrl}/auth/reset-password-page?token=${resetToken}`;

      const emailSubject = 'Recuperación de Contraseña - SmartAssistant CRM';
      const emailBody = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
                .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
                .button { background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; }
                .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px; }
                .warning { background: #fef3c7; border: 1px solid #f59e0b; padding: 12px; border-radius: 6px; margin: 16px 0; }
                .instructions { background: #f0f9ff; border: 1px solid #0ea5e9; padding: 15px; border-radius: 6px; margin: 16px 0; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>SmartAssistant CRM</h1>
                    <p>Recuperación de Contraseña</p>
                </div>
                <div class="content">
                    <h2>Hola ${nombre},</h2>
                    <p>Hemos recibido una solicitud para restablecer tu contraseña.</p>
                    
                    <div class="instructions">
                        <h3>📱 Instrucciones Rápidas:</h3>
                        <p>Haz clic en el botón para abrir una página donde podrás copiar tu token de recuperación y seguir las instrucciones para la app móvil.</p>
                    </div>
                    
                    <p style="text-align: center; margin: 30px 0;">
                        <a href="${resetLink}" class="button">Abrir Instrucciones de Recuperación</a>
                    </p>
                    
                    <div class="warning">
                        <strong>Importante:</strong>
                        <p>• Este enlace expirará en 1 hora</p>
                        <p>• Si no solicitaste este cambio, ignora este email</p>
                        <p>• Necesitarás la app móvil para completar el proceso</p>
                    </div>
                    
                    <p>Si el botón no funciona, copia y pega este enlace en tu navegador:</p>
                    <p style="word-break: break-all; background: #f3f4f6; padding: 10px; border-radius: 4px;">
                        ${resetLink}
                    </p>
                </div>
                <div class="footer">
                    <p>Este es un email automático, por favor no respondas a este mensaje.</p>
                    <p>© 2024 SmartAssistant CRM. Todos los derechos reservados.</p>
                </div>
            </div>
        </body>
        </html>
      `;

      await this.oneSignalService.enviarEmailPersonalizado(
        email,
        emailSubject,
        emailBody
      );

      this.logger.log(`✅ Email de recuperación enviado a: ${email}`);
      this.logger.log(`🔗 Enlace de recuperación: ${resetLink}`);

    } catch (error) {
      this.logger.error('Error en _enviarEmailRecuperacion:', error);
      throw new InternalServerErrorException('No se pudo enviar el email de recuperación.');
    }
  }

  private async _enviarEmailConfirmacionCambioPassword(
    email: string, 
    nombre: string
  ): Promise<void> {
    try {
      const emailSubject = 'Contraseña Actualizada - SmartAssistant CRM';
      const emailBody = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: #10b981; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
                .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
                .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px; }
                .security-note { background: #f3f4f6; padding: 12px; border-radius: 6px; margin: 16px 0; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>SmartAssistant CRM</h1>
                    <p>Contraseña Actualizada Exitosamente</p>
                </div>
                <div class="content">
                    <h2>Hola ${nombre},</h2>
                    <p>Tu contraseña ha sido actualizada exitosamente.</p>
                    
                    <div class="security-note">
                        <strong>Nota de Seguridad:</strong>
                        <p>Si no realizaste este cambio, por favor contacta inmediatamente al administrador del sistema.</p>
                    </div>
                    
                    <p>Fecha y hora del cambio: ${new Date().toLocaleString('es-MX')}</p>
                </div>
                <div class="footer">
                    <p>Este es un email automático de seguridad.</p>
                    <p>© 2024 SmartAssistant CRM. Todos los derechos reservados.</p>
                </div>
            </div>
        </body>
        </html>
      `;

      await this.oneSignalService.enviarEmailPersonalizado(
        email,
        emailSubject,
        emailBody
      );

    } catch (error) {
      this.logger.error('Error en _enviarEmailConfirmacionCambioPassword:', error);
    }
  }
}