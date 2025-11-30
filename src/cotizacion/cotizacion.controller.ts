import { Controller, Post, Body, UseGuards, Get, Patch, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { CotizacionService } from './cotizacion.service';
import { CreateCotizacionDto, UpdateCotizacionStatusDto } from './dto/cotizacion.dto';
import { VendedorCreateCotizacionDto } from './dto/vendedor-cotizacion.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Rol } from '../auth/enums/rol.enum';
import { GetUser } from '../auth/decorators/get-user.decorator';
import type { ValidatedUser } from '../user/schemas/user.schema';

@ApiTags('Cotizaciones')
@Controller('cotizacion')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CotizacionController {
  constructor(private readonly cotizacionService: CotizacionService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Rol.CLIENTE)
  @ApiOperation({ summary: 'Generate cotizacion (Cliente)' })
  @ApiResponse({ status: 201, description: 'Cotizacion generated' })
  @ApiBody({ type: CreateCotizacionDto })
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
  @ApiOperation({ summary: 'Generate cotizacion (Vendedor)' })
  @ApiResponse({ status: 201, description: 'Cotizacion generated' })
  @ApiBody({ type: VendedorCreateCotizacionDto })
  vendedorGenerarCotizacion(
    @Body() dto: VendedorCreateCotizacionDto,
  ) {
    return this.cotizacionService.vendedorGenerarCotizacion(dto);
  }
  
  @Get('pendientes')
  @UseGuards(RolesGuard)
  @Roles(Rol.VENDEDOR, Rol.ADMIN)
  @ApiOperation({ summary: 'Get pending cotizaciones (Vendedor, Admin)' })
  @ApiResponse({ status: 200, description: 'Return pending cotizaciones' })
  getCotizacionesPendientes() {
    return this.cotizacionService.getCotizacionesPendientes();
  }

  @Get('all')
  @UseGuards(RolesGuard)
  @Roles(Rol.VENDEDOR, Rol.ADMIN)
  @ApiOperation({ summary: 'Get all cotizaciones (Vendedor, Admin)' })
  @ApiResponse({ status: 200, description: 'Return all cotizaciones' })
  getCotizaciones() {
    return this.cotizacionService.getCotizacionesAll();
  }
  
  @Patch(':id/status')
  @UseGuards(RolesGuard)
  @Roles(Rol.VENDEDOR, Rol.ADMIN)
  @ApiOperation({ summary: 'Update cotizacion status (Vendedor, Admin)' })
  @ApiParam({ name: 'id', description: 'Cotizacion ID' })
  @ApiBody({ type: UpdateCotizacionStatusDto })
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
  @Patch(':idPricing/set-seller-to-pricing/:idSeller')
  @UseGuards(RolesGuard)
  @Roles(Rol.ADMIN)
  @ApiOperation({ summary: 'Update cotizacion seller ( Admin)' })
  @ApiParam({ name: 'idPricing', description: 'Cotizacion ID' })
  @ApiParam({ name: 'idSeller', description: 'Vendedor ID' })
  setSellerToPricing(
    @Param('idPricing') idPricing: string,
    @Param('idSeller') idSeller: string,
  ) {
    return this.cotizacionService.setSellerToPricing(idPricing, idSeller);
  }
}