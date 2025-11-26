import { Controller, Post, Body, UseGuards, Get, Patch, Param } from '@nestjs/common';
import { CotizacionService } from './cotizacion.service';
import { CreateCotizacionDto, UpdateCotizacionStatusDto } from './dto/cotizacion.dto';
import { VendedorCreateCotizacionDto } from './dto/vendedor-cotizacion.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Rol } from '../auth/enums/rol.enum';
import { GetUser } from '../auth/decorators/get-user.decorator';
import type { ValidatedUser } from '../user/schemas/user.schema';

@Controller('cotizacion')
@UseGuards(JwtAuthGuard)
export class CotizacionController {
  constructor(private readonly cotizacionService: CotizacionService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Rol.CLIENTE)
  generarCotizacion(
    @Body() dto: CreateCotizacionDto,
    @GetUser() user: ValidatedUser,
  ) {
    return this.cotizacionService.generarCotizacion(
      user,
      dto.cocheId,
      dto.enganche,
      dto.plazoMeses,
    );
  }

  @Post('vendedor-create')
  @UseGuards(RolesGuard)
  @Roles(Rol.VENDEDOR)
  vendedorGenerarCotizacion(
    @Body() dto: VendedorCreateCotizacionDto,
  ) {
    return this.cotizacionService.vendedorGenerarCotizacion(dto);
  }
  
  @Get('pendientes')
  @UseGuards(RolesGuard)
  @Roles(Rol.VENDEDOR, Rol.ADMIN)
  getCotizacionesPendientes() {
    return this.cotizacionService.getCotizacionesPendientes();
  }

  @Get('all')
  @UseGuards(RolesGuard)
  @Roles(Rol.VENDEDOR, Rol.ADMIN)
  getCotizaciones() {
    return this.cotizacionService.getCotizacionesAll();
  }
  
  @Patch(':id/status')
  @UseGuards(RolesGuard)
  @Roles(Rol.VENDEDOR, Rol.ADMIN)
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateCotizacionStatusDto,
    @GetUser() user: ValidatedUser,
  ) {
    return this.cotizacionService.updateCotizacionStatus(
      id, 
      user,
      dto.status as 'Aprobada' | 'Rechazada'
    );
  }
}