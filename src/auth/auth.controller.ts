import { 
  Controller, 
  Post, 
  Body, 
  UseGuards, 
  Get, 
  Req, 
  Res, 
  Patch, 
  Param, 
  Delete, 
  HttpCode, 
  HttpStatus, 
  Query
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterAuthDto } from './dto/register-auth.dto';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { GetUser } from './decorators/get-user.decorator';
import { type ValidatedUser } from '../user/schemas/user.schema';
import { AuthGuard } from '@nestjs/passport';
import { TwoFactorCodeDto } from './dto/2fa-code.dto';
import { Roles } from './decorators/roles.decorator';
import { Rol } from './enums/rol.enum';
import { RolesGuard } from './guards/roles.guard';
import { UpdateRoleDto } from './dto/update-role.dto';
import { LoginAuthDto } from './dto/login-auth.dto';
import { ForgotPasswordDto, ResetPasswordDto } from './dto/reset-password.dto';
import type { Response } from 'express';
import { 
  ApiTags, 
  ApiOperation, 
  ApiResponse, 
  ApiBody, 
  ApiBearerAuth,
  ApiQuery,
  ApiParam
} from '@nestjs/swagger';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, description: 'User successfully registered' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiBody({ type: RegisterAuthDto })
  register(@Body() dto: RegisterAuthDto) {
    return this.authService.register(dto);
  }

  @Post('register/admin')
  @ApiOperation({ summary: 'Register a new admin' })
  @ApiResponse({ status: 201, description: 'User successfully registered' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiBody({ type: RegisterAuthDto })
  registerAdmin(@Body() dto: RegisterAuthDto) {
    return this.authService.registerAdmin(dto);
  }


  @Post('register/vendedor')
  registerVendedor(@Body() dto: RegisterAuthDto) {
    return this.authService.registerVendedor(dto);
  }

  @HttpCode(HttpStatus.OK)
  @UseGuards(LocalAuthGuard)
  @Post('login')
  @ApiOperation({ summary: 'Login with credentials' })
  @ApiResponse({ status: 200, description: 'User successfully logged in' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiBody({ type: LoginAuthDto })
  login(@GetUser() user: ValidatedUser) {
    return this.authService.loginConCredenciales(user);
  }

  @Get('google')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Login with Google' })
  async googleAuth(@Req() req) {}

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Google login callback' })
  async googleAuthRedirect(@Req() req, @Res() res) {
    try {
      const result = await this.authService.loginConGoogle(req.user);
      const redirectUrl = result?.deepLink || '/auth/error';
      return res.redirect(redirectUrl);
    } catch (error) {
      console.error('Error en callback de Google:', error);
      return res.redirect('/auth/error');
    }
  }
  @Get('googleInWeb')
  @UseGuards(AuthGuard('googleWeb'))
  @ApiOperation({ summary: 'Login with Google (Web)' })
  async googleAuthWeb(@Req() req) {}

  @Get('google/callback/web')
  @UseGuards(AuthGuard('googleWeb'))
  @ApiOperation({ summary: 'Google login callback (Web)' })
  async googleAuthRedirectWeb(@Req() req, @Res() res) {
    try {
      const result = await this.authService.loginConGoogleWeb(req.user);
      const redirectUrl = result?.deepLink || '/auth/error';
      return res.redirect(redirectUrl);
    } catch (error) {
      console.error('Error en callback de Google:', error);
      return res.redirect('/auth/error');
    }
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user profile' })
  @ApiResponse({ status: 200, description: 'Return user profile' })
  profile(@GetUser() user: ValidatedUser) {
    return user;
  }

  @Post('2fa/generate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Generate 2FA secret' })
  @ApiResponse({ status: 200, description: '2FA secret generated' })
  generate2FA(@GetUser() user: ValidatedUser) {
    return this.authService.generarSecreto2FA(user);
  }

  @Post('2fa/turn-on')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Turn on 2FA' })
  @ApiResponse({ status: 200, description: '2FA enabled' })
  @ApiBody({ type: TwoFactorCodeDto })
  turnOn2FA(@GetUser() user: ValidatedUser, @Body() dto: TwoFactorCodeDto) {
    return this.authService.activar2FA(user, dto);
  }

  @Post('2fa/authenticate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authenticate with 2FA' })
  @ApiResponse({ status: 200, description: 'Authenticated' })
  @ApiBody({ schema: { type: 'object', properties: { userId: { type: 'string' }, code: { type: 'string' } } } })
  authenticate2FA(@Body() dto: { userId: string; code: string }) {
    return this.authService.autenticarCon2FA(dto.userId, dto.code);
  }

  @Post('2fa/turn-off')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Turn off 2FA' })
  @ApiResponse({ status: 200, description: '2FA disabled' })
  turnOff2FA(@GetUser() user: ValidatedUser) {
    return this.authService.desactivar2FA(user._id);
  }

  @Post('forgot-password')
  @ApiOperation({ summary: 'Request password reset' })
  @ApiResponse({ status: 200, description: 'Reset email sent' })
  @ApiBody({ type: ForgotPasswordDto })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.requestPasswordReset(dto.email);
  }

  @Post('reset-password')
  @ApiOperation({ summary: 'Reset password' })
  @ApiResponse({ status: 200, description: 'Password reset successful' })
  @ApiBody({ type: ResetPasswordDto })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.newPassword);
  }

  @Patch('admin/assign-role/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Rol.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Assign role to user (Admin)' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiBody({ type: UpdateRoleDto })
  assignRole(
    @Param('id') targetUserId: string,
    @Body() dto: UpdateRoleDto,
    @GetUser() admin: ValidatedUser,
  ) {
    return this.authService.assignRole(targetUserId, dto.rol, admin);
  }

  @Delete('admin/delete-user/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Rol.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete user (Admin)' })
  @ApiParam({ name: 'id', description: 'User ID' })
  deleteUser(
    @Param('id') targetUserId: string,
    @GetUser() admin: ValidatedUser,
  ) {
    return this.authService.deleteUser(targetUserId, admin);
  }

  @Get('reset-password-page')
  @ApiOperation({ summary: 'Render reset password page' })
  @ApiQuery({ name: 'token', required: true })
  async resetPasswordPage(@Query('token') token: string, @Res() res: Response) {
    if (!token) {
      return res.status(400).send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Error - Token No Proporcionado</title>
            <style>
                body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
                .error { color: #dc2626; background: #fef2f2; padding: 20px; border-radius: 8px; }
            </style>
        </head>
        <body>
            <div class="error">
                <h1>❌ Error</h1>
                <p>No se proporcionó un token válido.</p>
                <p>Por favor, usa el enlace completo del correo electrónico.</p>
            </div>
        </body>
        </html>
      `);
    }

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
          <title>Restablecer Contraseña - SmartAssistant CRM</title>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
              body { 
                  font-family: Arial, sans-serif; 
                  line-height: 1.6; 
                  color: #333; 
                  max-width: 500px; 
                  margin: 0 auto; 
                  padding: 20px;
                  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                  min-height: 100vh;
                  display: flex;
                  align-items: center;
                  justify-content: center;
              }
              .container { 
                  background: white; 
                  padding: 40px; 
                  border-radius: 12px;
                  box-shadow: 0 10px 30px rgba(0,0,0,0.2);
                  text-align: center;
              }
              .logo { 
                  color: #2563eb; 
                  font-size: 28px; 
                  font-weight: bold; 
                  margin-bottom: 20px;
              }
              .token-box { 
                  background: #f3f4f6; 
                  padding: 15px; 
                  border-radius: 8px; 
                  margin: 20px 0;
                  font-family: monospace;
                  word-break: break-all;
                  border: 2px dashed #2563eb;
                  cursor: pointer;
                  transition: all 0.3s ease;
              }
              .token-box:hover {
                  background: #e5e7eb;
                  transform: scale(1.02);
              }
              .instructions { 
                  background: #f0f9ff; 
                  padding: 15px; 
                  border-radius: 8px; 
                  margin: 20px 0;
                  text-align: left;
              }
              .button { 
                  background: #2563eb; 
                  color: white; 
                  padding: 12px 24px; 
                  text-decoration: none; 
                  border-radius: 6px; 
                  display: inline-block;
                  border: none;
                  cursor: pointer;
                  font-size: 16px;
                  margin: 10px;
                  transition: background 0.3s ease;
              }
              .button:hover {
                  background: #1d4ed8;
              }
              .button-copy {
                  background: #059669;
              }
              .button-copy:hover {
                  background: #047857;
              }
              .warning { 
                  background: #fef3c7; 
                  border: 1px solid #f59e0b; 
                  padding: 12px; 
                  border-radius: 6px; 
                  margin: 16px 0; 
              }
              .success { 
                  background: #d1fae5; 
                  border: 1px solid #10b981; 
                  padding: 12px; 
                  border-radius: 6px; 
                  margin: 16px 0; 
                  display: none;
              }
              .step {
                  display: flex;
                  align-items: flex-start;
                  margin: 10px 0;
                  text-align: left;
              }
              .step-number {
                  background: #2563eb;
                  color: white;
                  width: 24px;
                  height: 24px;
                  border-radius: 50%;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  margin-right: 10px;
                  flex-shrink: 0;
              }
          </style>
      </head>
      <body>
          <div class="container">
              <div class="logo">SmartAssistant CRM</div>
              <h1>Restablecer Contraseña</h1>
              
              <div class="instructions">
                  <h3>📱 Para usar en la App Móvil:</h3>
                  <div class="step">
                      <div class="step-number">1</div>
                      <div>Copia el token de abajo</div>
                  </div>
                  <div class="step">
                      <div class="step-number">2</div>
                      <div>Abre la app SmartAssistant CRM en tu teléfono</div>
                  </div>
                  <div class="step">
                      <div class="step-number">3</div>
                      <div>Ve a "Olvidé mi contraseña" o "Restablecer contraseña"</div>
                  </div>
                  <div class="step">
                      <div class="step-number">4</div>
                      <div>Pega el token cuando te lo solicite</div>
                  </div>
              </div>
              
              <div class="warning">
                  <strong>Token de recuperación (haz clic para copiar):</strong>
                  <div class="token-box" id="tokenBox">${token}</div>
                  <p>⏰ Este token expira en 1 hora</p>
              </div>
              
              <div class="success" id="successMessage">
                  ✅ ¡Token copiado al portapapeles!
              </div>
              
              <p>¿Necesitas copiar el token?</p>
              <button class="button button-copy" onclick="copyToken()">
                  📋 Copiar Token
              </button>
              
              <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                  <p style="color: #6b7280; font-size: 14px;">
                      Si no solicitaste este cambio, ignora este mensaje.<br>
                      <strong>Equipo SmartAssistant CRM</strong>
                  </p>
              </div>
          </div>
          
          <script>
              function copyToken() {
                  const token = '${token}';
                  navigator.clipboard.writeText(token).then(() => {
                      showSuccess();
                  }).catch(err => {
                      // Fallback para navegadores antiguos
                      const textArea = document.createElement('textarea');
                      textArea.value = token;
                      document.body.appendChild(textArea);
                      textArea.select();
                      document.execCommand('copy');
                      document.body.removeChild(textArea);
                      showSuccess();
                  });
              }
              
              function showSuccess() {
                  const successEl = document.getElementById('successMessage');
                  successEl.style.display = 'block';
                  setTimeout(() => {
                      successEl.style.display = 'none';
                  }, 3000);
              }
              
              // Copiar al hacer clic en el token
              document.getElementById('tokenBox').addEventListener('click', copyToken);
              
              // Mostrar mensaje de bienvenida en consola para debugging
              console.log('Página de recuperación cargada para token:', '${token}');
          </script>
      </body>
      </html>
    `;

    return res.send(html);
  }
}
