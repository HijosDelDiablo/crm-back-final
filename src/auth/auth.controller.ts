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

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterAuthDto) {
    return this.authService.register(dto);
  }

  @HttpCode(HttpStatus.OK)
  @UseGuards(LocalAuthGuard)
  @Post('login')
  login(@GetUser() user: ValidatedUser) {
    return this.authService.loginConCredenciales(user);
  }

  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleAuth(@Req() req) {}

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleAuthRedirect(@Req() req, @Res() res) {
    const result = await this.authService.loginConGoogle(req.user);
    return res.redirect(result.url);
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  profile(@GetUser() user: ValidatedUser) {
    return user;
  }

  @Post('2fa/generate')
  @UseGuards(JwtAuthGuard)
  generate2FA(@GetUser() user: ValidatedUser) {
    return this.authService.generarSecreto2FA(user);
  }

  @Post('2fa/turn-on')
  @UseGuards(JwtAuthGuard)
  turnOn2FA(@GetUser() user: ValidatedUser, @Body() dto: TwoFactorCodeDto) {
    return this.authService.activar2FA(user, dto);
  }

  @Post('2fa/authenticate')
  @HttpCode(HttpStatus.OK)
  authenticate2FA(@Body() dto: { userId: string; code: string }) {
    return this.authService.autenticarCon2FA(dto.userId, dto.code);
  }

  @Post('2fa/turn-off')
  @UseGuards(JwtAuthGuard)
  turnOff2FA(@GetUser() user: ValidatedUser) {
    return this.authService.desactivar2FA(user._id);
  }

  @Patch('admin/assign-role/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Rol.ADMIN)
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
  deleteUser(
    @Param('id') targetUserId: string,
    @GetUser() admin: ValidatedUser,
  ) {
    return this.authService.deleteUser(targetUserId, admin);
  }
}