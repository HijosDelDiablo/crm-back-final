import { 
  Controller, 
  Post, 
  Body, 
  UseGuards, 
  Get, 
  Patch, 
  Param,
  Query 
} from '@nestjs/common';
import { CompraService } from './compra.service';
import { CreateCompraDto } from './dto/create-compra.dto';
import { AprobarCompraDto } from './dto/approval.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Rol } from '../auth/enums/rol.enum';
import { GetUser } from '../auth/decorators/get-user.decorator';
import type { ValidatedUser } from '../user/schemas/user.schema';

@Controller('compra')
@UseGuards(JwtAuthGuard)
export class CompraController {
  constructor(private readonly compraService: CompraService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Rol.CLIENTE)
  iniciarProcesoCompra(
    @Body() createCompraDto: CreateCompraDto,
    @GetUser() user: ValidatedUser,
  ) {
    return this.compraService.iniciarProcesoCompra(user, createCompraDto);
  }

  @Get('mis-compras')
  @UseGuards(RolesGuard)
  @Roles(Rol.CLIENTE)
  getMisCompras(@GetUser() user: ValidatedUser) {
    return this.compraService.getComprasPorCliente(user._id.toString());
  }

  @Get('pendientes')
  @UseGuards(RolesGuard)
  @Roles(Rol.VENDEDOR, Rol.ADMIN)
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
  evaluarFinanciamiento(
    @Param('id') compraId: string,
    @GetUser() user: ValidatedUser,
  ) {
    return this.compraService.evaluarFinanciamiento(compraId, user);
  }

  @Patch(':id/aprobar')
  @UseGuards(RolesGuard)
  @Roles(Rol.VENDEDOR, Rol.ADMIN)
  aprobarCompra(
    @Param('id') compraId: string,
    @Body() aprobarCompraDto: AprobarCompraDto,
    @GetUser() user: ValidatedUser,
  ) {
    return this.compraService.aprobarCompra(compraId, aprobarCompraDto, user);
  }

  @Get(':id')
  getCompraById(@Param('id') compraId: string) {
    return this.compraService.getCompraById(compraId);
  }
}