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
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly rpID = 'crm-back-final-production.up.railway.app';
  private readonly origin = 'https://crm-back-final-production.up.railway.app';

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
      const id = userFromValidation._id.toString();

      return {
        message: 'Autenticación de dos factores requerida.',
        userId: id,
        redirect: true,
        deepLink: `smartassistant://login-success?userId=${id}&type=2fa`,
      };
    }

    return this._generarTokenAcceso(userFromValidation);
  }

  async loginConGoogle(profile: any) {
    const user = await this.validateGoogleUser(profile);
    if (!user) {
      throw new UnauthorizedException('No se pudo validar al usuario de Google.');
    }

    const obj = user.toObject();
    const id = obj._id.toString();

    if (obj.twoFactorEnabled) {
      return {
        redirect: true,
        deepLink: `smartassistant://login-success?userId=${id}&type=2fa`,
      };
    }

    const tokenData = await this._generarTokenAcceso(obj as ValidatedUser);

    return {
      redirect: true,
      deepLink: `smartassistant://login-success?token=${tokenData.accessToken}`,
    };
  }

  async autenticarCon2FA(userId: string, code: string) {
    this.logger.log(`Iniciando autenticación 2FA para usuario: ${userId}`);

    const usuario = await this.userModel.findById(userId);
    if (!usuario) throw new UnauthorizedException('Usuario no encontrado.');

    if (!usuario.twoFactorEnabled)
      throw new UnauthorizedException('2FA no está activado.');

    if (!usuario.twoFactorTempSecret)
      throw new UnauthorizedException('No hay código activo.');

    if (!usuario.twoFactorTempExpiry || usuario.twoFactorTempExpiry < new Date()) {
      throw new UnauthorizedException('El código ha expirado.');
    }

    const isMatch = await compare(code, usuario.twoFactorTempSecret);
    if (!isMatch) throw new UnauthorizedException('Código 2FA inválido.');

    usuario.twoFactorTempSecret = undefined;
    usuario.twoFactorTempExpiry = undefined;
    await usuario.save();

    const tokenData = await this._generarTokenAcceso(
      usuario.toObject() as ValidatedUser,
    );

    return {
      redirect: true,
      deepLink: `smartassistant://login-success?token=${tokenData.accessToken}`,
    };
  }

  async generarSecreto2FA(user: ValidatedUser) {
    const usuario = await this.userModel.findById(String(user._id));
    if (!usuario) throw new NotFoundException('Usuario no encontrado.');

    if (usuario.twoFactorEnabled)
      throw new BadRequestException('El 2FA ya está activado.');

    const tempCode = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedCode = await hash(tempCode, 10);
    const expiry = new Date(Date.now() + 10 * 60 * 1000);

    usuario.twoFactorTempSecret = hashedCode;
    usuario.twoFactorTempExpiry = expiry;
    await usuario.save();

    await this.oneSignalService.enviarCodigo2FA(usuario.email, tempCode);

    return {
      message: 'Código enviado al correo.',
      expiresAt: expiry.toISOString(),
    };
  }

  async activar2FA(user: ValidatedUser, dto: TwoFactorCodeDto) {
    const usuario = await this.userModel.findById(String(user._id));
    if (!usuario) throw new NotFoundException('Usuario no encontrado.');

    if (!usuario.twoFactorTempSecret || !usuario.twoFactorTempExpiry)
      throw new UnauthorizedException('No hay código pendiente.');

    if (usuario.twoFactorTempExpiry < new Date())
      throw new UnauthorizedException('Código expirado.');

    const isMatch = await compare(dto.code, usuario.twoFactorTempSecret);
    if (!isMatch) throw new UnauthorizedException('Código incorrecto.');

    usuario.twoFactorEnabled = true;
    usuario.twoFactorTempSecret = undefined;
    usuario.twoFactorTempExpiry = undefined;
    await usuario.save();

    return { message: '2FA activado exitosamente.' };
  }

  async desactivar2FA(userId: string) {
    await this.userService.update(userId, {
      twoFactorEnabled: false,
      twoFactorTempSecret: undefined,
      twoFactorTempExpiry: undefined,
    });

    return { message: '2FA desactivado.' };
  }

  async assignRole(targetUserId: string, newRole: Rol, performingAdmin: ValidatedUser) {
    const userToUpdate = await this.userService.findById(targetUserId);
    if (!userToUpdate) throw new NotFoundException('Usuario no encontrado.');

    if (userToUpdate.rol === Rol.ADMIN)
      throw new ForbiddenException('No se puede modificar un Administrador.');

    if (String(userToUpdate._id) === String(performingAdmin._id))
      throw new ForbiddenException('No puedes cambiar tu propio rol.');

    return this.userService.update(targetUserId, { rol: newRole });
  }

  async deleteUser(targetUserId: string, performingAdmin: ValidatedUser) {
    if (targetUserId === String(performingAdmin._id))
      throw new ForbiddenException('No puedes eliminarte a ti mismo.');

    const userToDelete = await this.userService.findById(targetUserId);
    if (!userToDelete) throw new NotFoundException('Usuario no encontrado.');

    if (userToDelete.rol === Rol.ADMIN)
      throw new ForbiddenException('No se puede eliminar a un Administrador.');

    await this.userModel.findByIdAndDelete(targetUserId);
    return { message: 'Usuario eliminado.' };
  }

  async validateUser(dto: LoginAuthDto): Promise<ValidatedUser> {
    const user = await this.userService.findByEmailWithPassword(dto.email);

    if (!user || !user.password)
      throw new UnauthorizedException('Credenciales inválidas.');

    const passwordMatches = await compare(dto.password, user.password);
    if (!passwordMatches) throw new UnauthorizedException('Credenciales inválidas.');

    const u = user.toObject();

    return {
      _id: String(u._id),
      email: u.email,
      nombre: u.nombre,
      rol: u.rol,
      twoFactorEnabled: u.twoFactorEnabled,
    };
  }

  async validateGoogleUser(profile: any): Promise<UserDocument | null> {
    let user = await this.userService.findByGoogleId(profile.googleId);
    if (user) return user;

    user = await this.userService.findByEmail(profile.email);
    if (user) {
      return this.userService.update(user.id, { googleId: profile.googleId }) as any;
    }

    return this.userService.create({
      email: profile.email,
      nombre: profile.nombre,
      googleId: profile.googleId,
    });
  }

  async requestPasswordReset(email: string): Promise<{ message: string }> {
    const user = await this.userService.findByEmail(email);

    if (!user) return { message: 'Si el email existe, se enviarán instrucciones.' };

    const userId = String(user._id);

    const resetToken = this.jwtService.sign(
      { sub: userId, type: 'password_reset' },
      { expiresIn: '1h' },
    );

    try {
      await this._enviarEmailRecuperacion(user.email, resetToken, user.nombre);
    } catch {}

    return { message: 'Si el email existe, se enviarán instrucciones.' };
  }

  async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    try {
      const payload = this.jwtService.verify(token);

      if (payload.type !== 'password_reset')
        throw new UnauthorizedException('Token inválido.');

      const hashedPassword = await hash(newPassword, 10);

      await this.userService.update(payload.sub, { password: hashedPassword });

      const user = await this.userService.findById(payload.sub);
      if (user) {
        await this._enviarEmailConfirmacionCambioPassword(user.email, user.nombre);
      }

      return { message: 'Contraseña restablecida exitosamente.' };
    } catch {
      throw new UnauthorizedException('Token inválido o expirado.');
    }
  }

  private async _enviarEmailRecuperacion(
    email: string,
    resetToken: string,
    nombre: string,
  ): Promise<void> {
    const deepLink = `smartassistant://reset-password?token=${resetToken}`;

    const backendUrl = this.configService.get<string>(
      'BACKEND_URL',
      'https://crm-back-final-production.up.railway.app',
    );

    const webFallbackLink = `${backendUrl}/auth/reset-password-page?token=${resetToken}`;

    const emailSubject = 'Recuperación de Contraseña - SmartAssistant CRM';
    const emailBody = `
      <!DOCTYPE html>
      <html>
      <body style="font-family: Arial;">
        <h2>Hola ${nombre}</h2>
        <p>Hemos recibido una solicitud para restablecer tu contraseña.</p>
        <a href="${deepLink}">Restablecer Contraseña (App)</a>
        <p>Si la app no abre el enlace, usa este:</p>
        <p>${webFallbackLink}</p>
      </body>
      </html>
    `;

    await this.oneSignalService.enviarEmailPersonalizado(
      email,
      emailSubject,
      emailBody,
    );
  }

  private async _enviarEmailConfirmacionCambioPassword(
    email: string,
    nombre: string,
  ): Promise<void> {
    const emailSubject = 'Tu contraseña ha sido actualizada';
    const emailBody = `
      <!DOCTYPE html>
      <html>
      <body style="font-family: Arial;">
        <h2>Hola ${nombre}</h2>
        <p>Tu contraseña fue cambiada exitosamente.</p>
      </body>
      </html>`;

    await this.oneSignalService.enviarEmailPersonalizado(
      email,
      emailSubject,
      emailBody,
    );
  }

  private async _generarTokenAcceso(user: ValidatedUser) {
    const id = String(user._id);

    const payload = {
      email: user.email,
      sub: id,
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
        _id: id,
      },
    };
  }

  async generatePasskeyRegistrationOptions(user: ValidatedUser) {
    const usuario = await this.userModel.findById(user._id);
    if (!usuario) throw new NotFoundException('Usuario no encontrado');

    const userPasskeys = usuario.passkeys || [];

    const excludeCredentials = userPasskeys.map(passkey => ({
      type: 'public-key' as const,
      id: Buffer.from(passkey.credentialID, 'base64url'),
      transports: passkey.transports as any[],
    }));

    const options = await generateRegistrationOptions({
      rpName: 'SmartAssistant CRM',
      rpID: this.rpID,
      userID: user._id,
      userName: user.email,
      attestationType: 'none',
      excludeCredentials,
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
    });

    usuario.currentChallenge = options.challenge;
    await usuario.save();

    return options;
  }

  async verifyPasskeyRegistration(user: ValidatedUser, body: any) {
    const usuario = await this.userModel
      .findById(user._id)
      .select('+currentChallenge');

    if (!usuario) throw new NotFoundException('Usuario no encontrado.');

    if (!usuario.currentChallenge) {
      throw new BadRequestException('No hay un desafío activo. Por favor, genera nuevas opciones de registro.');
    }

    let verification;
    try {
      verification = await verifyRegistrationResponse({
        response: body,
        expectedChallenge: usuario.currentChallenge,
        expectedOrigin: this.origin,
        expectedRPID: this.rpID,
      });
    } catch (error) {
      this.logger.error('Passkey verification failed', error);
      throw new BadRequestException('Verificación de Passkey fallida');
    }

    if (verification.verified && verification.registrationInfo) {
      const { credentialPublicKey, credentialID, counter } =
        verification.registrationInfo;

      const newPasskey = {
        credentialID: Buffer.from(credentialID as any).toString('base64url'),
        credentialPublicKey: Buffer.from(credentialPublicKey as any).toString('base64url'),
        counter,
        transports: body?.response?.transports,
      };

      if (!usuario.passkeys) usuario.passkeys = [];
      usuario.passkeys.push(newPasskey);

      usuario.currentChallenge = undefined;
      await usuario.save();

      return { verified: true };
    }

    throw new BadRequestException('No se pudo verificar la passkey');
  }

  async verifyPasskeyLogin(email: string, body: any) {
    const user = await this.userModel.findOne({ email }).select('+currentChallenge');
    if (!user) throw new NotFoundException('Usuario no encontrado.');

    if (!user.passkeys)
      throw new UnauthorizedException('Este usuario no tiene passkeys.');

    if (!user.currentChallenge) {
      throw new BadRequestException('No hay un desafío activo. Por favor, genera nuevas opciones de autenticación.');
    }

    const passkey = user.passkeys.find(key => key.credentialID === body.id);
    if (!passkey) throw new UnauthorizedException('Passkey no conocida para este usuario.');

    let verification;

    try {
      const publicKey = Buffer.from(passkey.credentialPublicKey, 'base64url');
      const credentialID = Buffer.from(passkey.credentialID, 'base64url');

      verification = await verifyAuthenticationResponse({
        response: body,
        expectedChallenge: user.currentChallenge,
        expectedOrigin: this.origin,
        expectedRPID: this.rpID,
        authenticator: {
          credentialID,
          credentialPublicKey: publicKey,
          counter: passkey.counter,
        },
      });
    } catch (error) {
      this.logger.error(error);
      throw new UnauthorizedException('Fallo en verificación WebAuthn');
    }

    if (verification.verified) {
      const { authenticationInfo } = verification;

      passkey.counter = authenticationInfo.newCounter;
      user.markModified('passkeys');
      user.currentChallenge = undefined;
      await user.save();

      return this._generarTokenAcceso(user.toObject() as ValidatedUser);
    }

    throw new UnauthorizedException('Verificación fallida');
  }

  async generatePasskeyLoginOptions(email: string) {
    const user = await this.userService.findByEmail(email);
    if (!user) throw new NotFoundException('Usuario no encontrado.');

    const allowCredentials = (user.passkeys || []).map(key => ({
      type: 'public-key' as const,
      id: Buffer.from(key.credentialID, 'base64url'),
      transports: key.transports as any[],
    }));

    const options = await generateAuthenticationOptions({
      rpID: this.rpID,
      allowCredentials,
    });

    user.currentChallenge = options.challenge;
    await user.save();

    return options;
  }
}