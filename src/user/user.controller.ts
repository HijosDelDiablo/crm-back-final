import {
  Controller,
  Get,
  UseGuards,
  Patch,
  Param,
  Body,
  ValidationPipe,
} from '@nestjs/common';
import { UserService } from './user.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { Rol } from '../auth/enums/rol.enum';
import type { ValidatedUser } from './schemas/user.schema';
import { IsEnum, IsString, IsNotEmpty } from 'class-validator';

class UpdateRoleDto {
  @IsEnum(Rol, { message: 'El rol debe ser uno de los valores válidos del enum Rol' })
  rol: Rol;
}

class PlayerIdDto {
  @IsString()
  @IsNotEmpty()
  playerId: string;
}

@Controller('user')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('all')
  @Roles(Rol.ADMIN)
  findAll() {
    return this.userService.findAllUsers();
  }

  @Get('clients')
  @Roles(Rol.ADMIN, Rol.VENDEDOR)
  findAllClients() {
    return this.userService.findAllClients();
  }

  @Get('vendedores')
  @Roles(Rol.ADMIN)
  findAllVendedores() {
    return this.userService.findAllVendedores();
  }

  @Patch(':id/role')
  @Roles(Rol.ADMIN)
  updateRole(
    @Param('id') userId: string,
    @Body() updateRoleDto: UpdateRoleDto,
  ) {
    return this.userService.updateUserRole(userId, updateRoleDto.rol);
  }

  @Patch('my-player-id')
  @Roles(Rol.VENDEDOR)
  updatePlayerId(
    @GetUser() user: ValidatedUser,
    @Body(ValidationPipe) dto: PlayerIdDto,
  ) {
    return this.userService.updatePlayerId(user._id, dto.playerId);
  }
}