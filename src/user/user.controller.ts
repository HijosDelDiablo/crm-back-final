import {
  Controller,
  Get,
  UseGuards,
  Patch,
  Param,
  Body,
  ValidationPipe,
  Post,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { UserService } from './user.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { Rol } from '../auth/enums/rol.enum';
import type { ValidatedUser } from './schemas/user.schema';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { RegisterAdminDto } from './dto/register-admin.dto';
import { IsEnum, IsString, IsNotEmpty } from 'class-validator';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiBearerAuth,
  ApiParam,
  ApiConsumes
} from '@nestjs/swagger';

class UpdateRoleDto {
  @IsEnum(Rol, { message: 'El rol debe ser un valor válido del enum Rol' })
  rol: Rol;
}

class PlayerIdDto {
  @IsString()
  @IsNotEmpty()
  playerId: string;
}

@ApiTags('Users')
@Controller('user')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('all')
  @Roles(Rol.ADMIN)
  @ApiOperation({ summary: 'Get all users (Admin)' })
  @ApiResponse({ status: 200, description: 'Return all users' })
  findAll() {
    return this.userService.findAllUsers();
  }

  @Get('clients')
  @Roles(Rol.ADMIN, Rol.VENDEDOR)
  @ApiOperation({ summary: 'Get all clients (Admin, Vendedor)' })
  @ApiResponse({ status: 200, description: 'Return all clients' })
  findAllClients() {
    return this.userService.findAllClients();
  }
  
  @Get('vendedores')
  @Roles(Rol.ADMIN)
  @ApiOperation({ summary: 'Get all vendedores (Admin)' })
  @ApiResponse({ status: 200, description: 'Return all vendedores' })
  findAllVendedores() {
    return this.userService.findAllVendedores();
  }
  @Get('vendedores-with-num-clients')
  @Roles(Rol.ADMIN)
  @ApiOperation({ summary: 'Get all vendedores (Admin)' })
  @ApiResponse({ status: 200, description: 'Return all vendedores' })
  findAllVendedoresWithNumClients() {
    return this.userService.getVendedoresOrdenadosPorClientes();
  }

  @Patch(':idClient/set-seller-to-client/:idSeller')
  @Roles(Rol.ADMIN)
  @ApiOperation({ summary: 'Update user role (Admin)' })
  @ApiParam({ name: 'idOfClient', description: 'User ID of the client' })
  @ApiParam({ name: 'idOfClient', description: 'User ID of the client' })
  setSellerToClient(
    @Param('idClient') clientId: string,
    @Param('idSeller') sellerId: string,
  ) {
    return this.userService.setSellerToClient(clientId, sellerId);
  }

  @Patch(':id/role')
  @Roles(Rol.ADMIN)
  @ApiOperation({ summary: 'Update user role (Admin)' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiBody({ schema: { type: 'object', properties: { rol: { type: 'string', enum: Object.values(Rol) } } } })
  updateRole(
    @Param('id') userId: string,
    @Body() updateRoleDto: UpdateRoleDto,
  ) {
    return this.userService.updateUserRole(userId, updateRoleDto.rol);
  }
  
  @Patch('admin/:id/activate')
  @Roles(Rol.ADMIN)
  @ApiOperation({ summary: 'Activate user (Admin)' })
  @ApiParam({ name: 'id', description: 'User ID' })
  activateUser(@Param('id') userId: string) {
    return this.userService.update(userId, { activo: true });
  }
  
  @Patch('admin/:id/deactivate')
  @Roles(Rol.ADMIN)
  @ApiOperation({ summary: 'Deactivate user (Admin)' })
  @ApiParam({ name: 'id', description: 'User ID' })
  deactivateUser(@Param('id') userId: string) {
    return this.userService.update(userId, { activo: false });
  }
  
  @Patch('my-player-id')
  @Roles(Rol.VENDEDOR)
  @ApiOperation({ summary: 'Update player ID (Vendedor)' })
  @ApiBody({ schema: { type: 'object', properties: { playerId: { type: 'string' } } } })
  updatePlayerId(
    @GetUser() user: ValidatedUser,
    @Body(ValidationPipe) dto: PlayerIdDto,
  ) {
    return this.userService.updatePlayerId(user._id, dto.playerId);
  }

  @Get('profile')
  @ApiOperation({ summary: 'Get own profile' })
  @ApiResponse({ status: 200, description: 'Return profile' })
  getProfile(@GetUser() user: ValidatedUser) {
    return this.userService.getProfile(user._id.toString());
  }
  
  @Patch('profile')
  @ApiOperation({ summary: 'Update own profile' })
  @ApiBody({ type: UpdateProfileDto })
  updateProfile(
    @GetUser() user: ValidatedUser,
    @Body(ValidationPipe) updateProfileDto: UpdateProfileDto,
  ) {
    return this.userService.updateProfile(user._id.toString(), updateProfileDto);
  }
  
  @Post('profile/upload-photo')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: './uploads/documents',
      filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
      }
    })
  }))
  @ApiOperation({ summary: 'Upload profile photo' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  async uploadProfilePhoto(
    @GetUser() user: ValidatedUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.userService.uploadProfilePhoto(user._id.toString(), file);
  }

  @Post('profile/upload-ine')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: './uploads/documents',
      filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
      }
    })
  }))
  @ApiOperation({ summary: 'Upload INE document' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  async uploadIne(
    @GetUser() user: ValidatedUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.userService.uploadDocument(user._id.toString(), 'ine', file);
  }

  @Post('profile/upload-domicilio')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: './uploads/documents',
      filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
      }
    })
  }))
  @ApiOperation({ summary: 'Upload domicilio document' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  async uploadDomicilio(
    @GetUser() user: ValidatedUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.userService.uploadDocument(user._id.toString(), 'domicilio', file);
  }

  @Post('profile/upload-ingresos')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: './uploads/documents',
      filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
      }
    })
  }))
  @ApiOperation({ summary: 'Upload ingresos document' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  async uploadIngresos(
    @GetUser() user: ValidatedUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.userService.uploadDocument(user._id.toString(), 'ingresos', file);
  }
  
  @Get('complete-info-seller')
  @Roles(Rol.ADMIN, Rol.VENDEDOR, Rol.CLIENTE)
  @ApiOperation({ summary: 'Get all vendedores with their reviews and statistics' })
  @ApiResponse({ 
    status: 200, 
    description: 'Return all vendedores with total reviews and average stars' 
  })
  async getVendedoresConResenas() {
    return this.userService.getVendedoresConResenas();
  }
  
    @Get('clients-of-seller/:sellerId')
    @Roles(Rol.ADMIN, Rol.VENDEDOR)
    @ApiOperation({ summary: 'Get all clients of a seller (Admin, Vendedor)' })
    @ApiResponse({ status: 200, description: 'Return all clients of a seller' })
    findAllClientsOfSeller(
      @Param('sellerId') sellerId: string,
    ) {
      return this.userService.findAllClientsOfSeller(sellerId);
    }
    @Patch(':sellerId/desactivate-seller')
    @Roles(Rol.ADMIN, Rol.VENDEDOR)
    @ApiOperation({ summary: 'Desactivate a seller (Admin)' })
    @ApiResponse({ status: 200, description: 'Return status of operation' })
    desactivateSeller(
      @Param('sellerId') sellerId: string,
    ) {
      return this.userService.desactivateSeller(sellerId);
    }
    @Patch(':sellerId/activate-seller')
    @Roles(Rol.ADMIN, Rol.VENDEDOR)
    @ApiOperation({ summary: 'Activate a seller (Admin)' })
    @ApiResponse({ status: 200, description: 'Return status of operation' })
    activateSeller(
      @Param('sellerId') sellerId: string,
    ) {
      return this.userService.activateSeller(sellerId);
    }

  @Post('register-admin')
  @Roles(Rol.ADMIN)
  @ApiOperation({ summary: 'Register a new admin (Admin only)' })
  @ApiBody({ type: RegisterAdminDto })
  @ApiResponse({ status: 201, description: 'Admin registered successfully' })
  async registerAdmin(@Body(ValidationPipe) dto: RegisterAdminDto) {
    return this.userService.registerAdmin(dto);
  }

  @Get('admins')
  @Roles(Rol.ADMIN)
  @ApiOperation({ summary: 'Get all admins (Admin only)' })
  @ApiResponse({ status: 200, description: 'List of admins' })
  async getAdmins() {
    return this.userService.getAdmins();
  }
}
