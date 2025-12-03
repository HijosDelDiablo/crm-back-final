import {
  Controller,
  Post,
  Body,
  UseGuards,
  Get,
  Patch,
  Param,
  Query,
  Req
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { CompraService } from './compra.service';
import { CreateCompraDto } from './dto/create-compra.dto';
import { AprobarCompraDto } from './dto/approval.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Rol } from '../auth/enums/rol.enum';
import { GetUser } from '../auth/decorators/get-user.decorator';
import type { ValidatedUser } from '../user/schemas/user.schema';
import { ForbiddenException } from '@nestjs/common';

@ApiTags('Compras')
@Controller('compra')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CompraController {
  constructor(private readonly compraService: CompraService) { }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Rol.CLIENTE)
  @ApiOperation({ summary: 'Start purchase process (Cliente)' })
  @ApiResponse({ status: 201, description: 'Purchase process started' })
  @ApiBody({ type: CreateCompraDto })
  iniciarProcesoCompra(
    @Body() createCompraDto: CreateCompraDto,
    @GetUser() user: ValidatedUser,
  ) {
    return this.compraService.iniciarProcesoCompra(user, createCompraDto);
  }

  @Get('mis-compras')
  @UseGuards(RolesGuard)
  @Roles(Rol.CLIENTE)
  @ApiOperation({ summary: 'Get my purchases (Cliente)' })
  @ApiResponse({ status: 200, description: 'Return my purchases' })
  getMisCompras(@GetUser() user: ValidatedUser) {
    return this.compraService.getComprasPorCliente(user._id.toString());
  }

  @Get('pendientes')
  @UseGuards(RolesGuard)
  @Roles(Rol.VENDEDOR, Rol.ADMIN)
  @ApiOperation({ summary: 'Get pending purchases (Vendedor, Admin)' })
  @ApiResponse({ status: 200, description: 'Return pending purchases' })
  getComprasPendientes() {
    return this.compraService.getComprasPendientes();
  }

  @Get('en-revision')
  @UseGuards(RolesGuard)
  @Roles(Rol.VENDEDOR, Rol.ADMIN)
  getComprasEnRevision() {
    return this.compraService.getComprasEnRevision();
  }

  @Get('aprobadas')
  @UseGuards(RolesGuard)
  @Roles(Rol.VENDEDOR, Rol.ADMIN)
  getComprasAprobadas() {
    return this.compraService.getComprasAprobadas();
  }

  @Patch(':id/evaluar')
  @UseGuards(RolesGuard)
  @Roles(Rol.VENDEDOR, Rol.ADMIN)
  @ApiOperation({ summary: 'Evaluate financing (Vendedor, Admin)' })
  @ApiParam({ name: 'id', description: 'Purchase ID' })
  evaluarFinanciamiento(
    @Param('id') compraId: string,
    @GetUser() user: ValidatedUser,
  ) {
    return this.compraService.evaluarFinanciamiento(compraId, user);
  }

  @Patch(':id/aprobar')
  @UseGuards(RolesGuard)
  @Roles(Rol.VENDEDOR, Rol.ADMIN)
  @ApiOperation({ summary: 'Approve purchase (Vendedor, Admin)' })
  @ApiParam({ name: 'id', description: 'Purchase ID' })
  @ApiBody({ type: AprobarCompraDto })
  aprobarCompra(
    @Param('id') compraId: string,
    @Body() aprobarCompraDto: AprobarCompraDto,
    @GetUser() user: ValidatedUser,
  ) {
    return this.compraService.aprobarCompra(compraId, aprobarCompraDto, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get purchase by ID' })
  @ApiParam({ name: 'id', description: 'Purchase ID' })
  @ApiResponse({ status: 200, description: 'Return purchase' })
  getCompraById(@Param('id') compraId: string) {
    return this.compraService.getCompraById(compraId);
  }

  @Get('por-cliente/:clienteId')
  @UseGuards(RolesGuard)
  @Roles(Rol.ADMIN, Rol.CLIENTE)
  @ApiOperation({ summary: 'Get purchases by client ID (Admin or Client)' })
  @ApiParam({ name: 'clienteId', description: 'Client ID' })
  @ApiResponse({ status: 200, description: 'Return purchases for the client' })
  async getComprasPorCliente(
    @Param('clienteId') clienteId: string,
    @Req() req: any,
  ) {
    const usuarioActual: ValidatedUser = req.user;
    if (usuarioActual.rol === Rol.CLIENTE && usuarioActual._id.toString() !== clienteId) {
      throw new ForbiddenException('No tienes permiso para ver las compras de este cliente');
    }
    return this.compraService.findByClienteId(clienteId);
  }

  @Get('por-vendedor/:vendedorId')
  @UseGuards(RolesGuard)
  @Roles(Rol.ADMIN, Rol.VENDEDOR)
  @ApiOperation({ summary: 'Get purchases by seller ID (Admin or Seller)' })
  @ApiParam({ name: 'vendedorId', description: 'Seller ID' })
  @ApiResponse({ status: 200, description: 'Return purchases for the seller' })
  async getComprasPorVendedor(
    @Param('vendedorId') vendedorId: string,
    @Req() req: any,
  ) {
    const usuarioActual: ValidatedUser = req.user;
    if (usuarioActual.rol === Rol.VENDEDOR && usuarioActual._id.toString() !== vendedorId) {
      throw new ForbiddenException('No tienes permiso para ver las compras de este vendedor');
    }
    return this.compraService.findByVendedorId(vendedorId);
  }
}