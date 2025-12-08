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
  ParseUUIDPipe,
  ForbiddenException,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
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

@ApiTags('Cotizaciones')
@Controller('cotizaciones')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class CotizacionController {
  constructor(private readonly cotizacionService: CotizacionService) { }

  @Post()
  @Roles(Rol.CLIENTE)
  @ApiOperation({
    summary: 'Generar cotización (Cliente)',
    description: 'Permite a un cliente generar una cotización para un vehículo específico.'
  })
  @ApiResponse({
    status: 201,
    description: 'Cotización generada exitosamente'
  })
  @ApiResponse({ status: 400, description: 'Datos inválidos o enganche >= precio' })
  @ApiResponse({ status: 404, description: 'Coche no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  @ApiBody({ type: CreateCotizacionDto })
  @HttpCode(HttpStatus.CREATED)
  async generarCotizacionCliente(
    @Body() dto: CreateCotizacionDto,
    @GetUser() user: ValidatedUser,
  ) {
    return await this.cotizacionService.generarCotizacionCliente(
      user,
      dto.cocheId,
      dto.enganche,
      dto.plazoMeses,
    );
  }

  @Get('aprobadas-cliente')
  @Roles(Rol.CLIENTE)
  @ApiOperation({
    summary: 'Obtener cotizaciones aprobadas del cliente logueado',
    description: 'Retorna todas las cotizaciones aprobadas del cliente autenticado.'
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de cotizaciones aprobadas'
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async getCotizacionesAprobadasCliente(
    @GetUser() user: ValidatedUser,
  ) {
    return await this.cotizacionService.getCotizacionesAprobadasCliente(user._id);
  }

  @ApiOperation({
    summary: 'Obtener cotizaciones aprobadas de un cliente (Cliente/Admin)',
    description: 'Retorna las cotizaciones aprobadas de un cliente específico.'
  })
  @ApiParam({ name: 'clienteId', description: 'ID del cliente' })
  @ApiResponse({
    status: 200,
    description: 'Lista de cotizaciones aprobadas del cliente'
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  @ApiResponse({ status: 403, description: 'No tienes permiso' })
  @Get('aprobadas/:clienteId')
  @UseGuards(RolesGuard)
  @Roles(Rol.CLIENTE, Rol.ADMIN)
  async getCotizacionesAprobadasPorClienteId(
    @Param('clienteId') clienteId: string,
    @GetUser() user: ValidatedUser,
  ) {
    if (user.rol === Rol.CLIENTE && user._id.toString() !== clienteId) {
      throw new ForbiddenException('No tienes permiso para ver las cotizaciones de este cliente');
    }
    return await this.cotizacionService.getCotizacionesAprobadasCliente(clienteId);
  }

  @ApiOperation({
    summary: 'Obtener mis cotizaciones (Cliente)',
    description: 'Retorna todas las cotizaciones del cliente autenticado.'
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de cotizaciones del cliente'
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  @Get('mis-cotizaciones')
  @UseGuards(RolesGuard)
  @Roles(Rol.CLIENTE)
  async getMisCotizaciones(
    @GetUser() user: ValidatedUser,
    @Query('status') status?: string
  ) {
    return await this.cotizacionService.getMisCotizaciones(user, status);
  }

  @ApiOperation({
    summary: 'Obtener todas las cotizaciones según rol (Cliente/Vendedor/Admin)',
    description: `
    Retorna cotizaciones según el rol del usuario:

    **CLIENTE**: Solo ve sus propias cotizaciones
    **VENDEDOR**: Solo ve cotizaciones asignadas a él
    **ADMIN**: Ve todas las cotizaciones del sistema

    Opcionalmente filtra por status.
    `
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de cotizaciones según permisos del usuario'
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  @ApiResponse({ status: 403, description: 'Rol insuficiente' })
  @Get('all')
  @UseGuards(RolesGuard)
  @Roles(Rol.CLIENTE, Rol.VENDEDOR, Rol.ADMIN)
  getCotizaciones(@GetUser() user: ValidatedUser, @Query('status') status?: string) {
    return this.cotizacionService.getCotizacionesAll(user, status);
  }

  @Post('vendedor-create')
  @Roles(Rol.VENDEDOR)
  @ApiOperation({
    summary: 'Generar cotización (Vendedor)',
    description: 'Permite a un vendedor generar una cotización para un cliente específico.'
  })
  @ApiResponse({
    status: 201,
    description: 'Cotización generada exitosamente'
  })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 404, description: 'Cliente o coche no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  @ApiBody({ type: VendedorCreateCotizacionDto })
  @HttpCode(HttpStatus.CREATED)
  async vendedorGenerarCotizacion(
    @Body() dto: VendedorCreateCotizacionDto,
  ) {
    return await this.cotizacionService.vendedorGenerarCotizacion(dto);
  }

  @Get('pendientes')
  @UseGuards(RolesGuard)
  @Roles(Rol.VENDEDOR, Rol.ADMIN)
  @ApiOperation({
    summary: 'Obtener cotizaciones pendientes (Vendedor/Admin)',
    description: 'Retorna todas las cotizaciones con status Pendiente.'
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de cotizaciones pendientes'
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  @ApiResponse({ status: 403, description: 'Rol insuficiente' })
  getCotizacionesPendientes(
    @GetUser() user: ValidatedUser,
  ) {
    return this.cotizacionService.getCotizacionesPendientes(user);
  }

  @ApiOperation({
    summary: 'Obtener cotizaciones aprobadas (Vendedor/Admin)',
    description: 'Retorna todas las cotizaciones con status Aprobada.'
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de cotizaciones aprobadas'
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  @ApiResponse({ status: 403, description: 'Rol insuficiente' })
  @Get('aprobadas')
  @Roles(Rol.VENDEDOR, Rol.ADMIN)
  async getCotizacionesAprovadas() {
    return await this.cotizacionService.getCotizacionesAprovadas();
  }

  @ApiOperation({
    summary: 'Actualizar estado de cotización (Vendedor/Admin)',
    description: 'Permite cambiar el estado de una cotización.'
  })
  @ApiParam({ name: 'id', description: 'ID de la cotización a actualizar' })
  @ApiBody({
    type: UpdateCotizacionStatusDto,
    description: 'Nuevo estado para la cotización'
  })
  @ApiResponse({
    status: 200,
    description: 'Estado actualizado exitosamente'
  })
  @ApiResponse({ status: 400, description: 'Estado inválido' })
  @ApiResponse({ status: 403, description: 'No autorizado' })
  @ApiResponse({ status: 404, description: 'Cotización no encontrada' })
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

  @ApiOperation({
    summary: 'Actualizar notas del vendedor (Vendedor/Admin)',
    description: 'Permite al vendedor o admin agregar notas internas.'
  })
  @ApiParam({ name: 'id', description: 'ID de la cotización' })
  @ApiBody({
    type: UpdateNotasVendedorDto,
    description: 'Notas del vendedor'
  })
  @ApiResponse({
    status: 200,
    description: 'Notas actualizadas exitosamente'
  })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 404, description: 'Cotización no encontrada' })
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

  @Patch(':id/assign-vendedor')
  @Roles(Rol.ADMIN)
  @ApiOperation({ summary: 'Asignar vendedor a cotización (Admin)' })
  @ApiParam({ name: 'id', description: 'ID de la cotización' })
  @ApiBody({ schema: { type: 'object', properties: { vendedorId: { type: 'string' } } } })
  async assignVendedor(
    @Param('id') id: string,
    @Body('vendedorId') vendedorId: string,
  ) {
    return await this.cotizacionService.assignVendedor(id, vendedorId);
  }

  @ApiOperation({
    summary: 'Asignar vendedor a cotización (Admin)',
    description: 'Permite a un administrador asignar un vendedor específico a una cotización pendiente, cambiando el estado a En Revision.'
  })
  @ApiParam({ name: 'idPricing', description: 'ID de la cotización' })
  @ApiParam({ name: 'idSeller', description: 'ID del vendedor a asignar' })
  @ApiResponse({
    status: 200,
    description: 'Vendedor asignado exitosamente'
  })
  @ApiResponse({ status: 403, description: 'Solo administradores' })
  @ApiResponse({ status: 404, description: 'No encontrado' })
  @Patch(':idPricing/set-seller-to-pricing/:idSeller')
  @UseGuards(RolesGuard)
  @Roles(Rol.ADMIN)
  setSellerToPricing(
    @Param('idPricing') idPricing: string,
    @Param('idSeller') idSeller: string,
  ) {
    return this.cotizacionService.setSellerToPricing(idPricing, idSeller);
  }

  @ApiOperation({
    summary: 'Obtener cotización por ID (Cliente/Admin/Vendedor)',
    description: 'Retorna los detalles completos de una cotización específica. Si es vendedor asignado o admin, incluye el estado de los documentos del cliente.'
  })
  @ApiParam({ name: 'id', description: 'ID de la cotización' })
  @ApiResponse({
    status: 200,
    description: 'Detalles de la cotización'
  })
  @ApiResponse({ status: 403, description: 'No tienes permiso' })
  @ApiResponse({ status: 404, description: 'Cotización no encontrada' })
  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles(Rol.CLIENTE, Rol.ADMIN, Rol.VENDEDOR)
  async getCotizacionById(
    @Param('id') id: string,
    @GetUser() user: ValidatedUser
  ) {
    return await this.cotizacionService.getCotizacionById(id, user);
  }
}
