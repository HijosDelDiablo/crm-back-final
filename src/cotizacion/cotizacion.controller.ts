import { 
  Controller, 
  Post, 
  Body, 
  UseGuards, 
  Get, 
  Patch, 
  Param,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe 
} from '@nestjs/common';
import { CotizacionService } from './cotizacion.service';
import { 
  CreateCotizacionDto, 
  UpdateCotizacionStatusDto, 
  UpdateNotasVendedorDto 
} from './dto/cotizacion.dto';
import { VendedorCreateCotizacionDto } from './dto/vendedor-cotizacion.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Rol } from '../auth/enums/rol.enum';
import { GetUser } from '../auth/decorators/get-user.decorator';
import type { ValidatedUser } from '../user/schemas/user.schema';

@Controller('cotizacion')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CotizacionController {
  constructor(private readonly cotizacionService: CotizacionService) {}

  @Post()
  @Roles(Rol.CLIENTE)
  @HttpCode(HttpStatus.CREATED)
  async generarCotizacion(
    @Body() dto: CreateCotizacionDto,
    @GetUser() user: ValidatedUser,
  ) {
    return await this.cotizacionService.generarCotizacion(
      user,
      dto.cocheId,
      dto.enganche,
      dto.plazoMeses,
    );
  }

  @Post('vendedor-create')
  @Roles(Rol.VENDEDOR)
  @HttpCode(HttpStatus.CREATED)
  async vendedorGenerarCotizacion(
    @Body() dto: VendedorCreateCotizacionDto,
  ) {
    return await this.cotizacionService.vendedorGenerarCotizacion(dto);
  }
  
  @Get('pendientes')
  @Roles(Rol.VENDEDOR, Rol.ADMIN)
  async getCotizacionesPendientes() {
    return await this.cotizacionService.getCotizacionesPendientes();
  }

  @Get('aprobadas')
  @Roles(Rol.VENDEDOR, Rol.ADMIN)
  async getCotizacionesAprovadas() {
    return await this.cotizacionService.getCotizacionesAprovadas();
  }
  
  @Patch(':id/status')
  @Roles(Rol.VENDEDOR, Rol.ADMIN)
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateCotizacionStatusDto,
    @GetUser() user: ValidatedUser,
  ) {
    return await this.cotizacionService.updateCotizacionStatus(
      id, 
      user,
      dto.status
    );
  }

  @Patch(':id/notas')
  @Roles(Rol.VENDEDOR, Rol.ADMIN)
  async updateNotas(
    @Param('id') id: string,
    @Body() dto: UpdateNotasVendedorDto,
  ) {
    return await this.cotizacionService.updateNotasVendedor(
      id, 
      dto.notasVendedor || ''
    );
  }
}