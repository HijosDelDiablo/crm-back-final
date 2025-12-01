import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { ProveedoresService } from './proveedores.service';
import { CreateProveedorDto, UpdateProveedorDto } from './dto/proveedor.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Rol } from '../auth/enums/rol.enum';

@ApiTags('Proveedores')
@Controller('proveedores')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Rol.ADMIN)
@ApiBearerAuth()
export class ProveedoresController {
  constructor(private readonly proveedoresService: ProveedoresService) {}

  @Post()
  @ApiOperation({ summary: 'Create proveedor (Admin)' })
  @ApiResponse({ status: 201, description: 'Proveedor created' })
  @ApiBody({ type: CreateProveedorDto })
  create(@Body() createProveedorDto: CreateProveedorDto) {
    return this.proveedoresService.create(createProveedorDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all proveedores (Admin)' })
  @ApiResponse({ status: 200, description: 'Return all proveedores' })
  findAll() {
    return this.proveedoresService.findAll();
  }

  @Get('activos')
  @ApiOperation({ summary: 'Get active proveedores (Admin)' })
  @ApiResponse({ status: 200, description: 'Return active proveedores' })
  findActive() {
    return this.proveedoresService.findActive();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get proveedor by ID (Admin)' })
  @ApiParam({ name: 'id', description: 'Proveedor ID' })
  @ApiResponse({ status: 200, description: 'Return proveedor' })
  findOne(@Param('id') id: string) {
    return this.proveedoresService.findById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update proveedor (Admin)' })
  @ApiParam({ name: 'id', description: 'Proveedor ID' })
  @ApiBody({ type: UpdateProveedorDto })
  update(@Param('id') id: string, @Body() updateProveedorDto: UpdateProveedorDto) {
    return this.proveedoresService.update(id, updateProveedorDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete proveedor (Admin)' })
  @ApiParam({ name: 'id', description: 'Proveedor ID' })
  remove(@Param('id') id: string) {
    return this.proveedoresService.remove(id);
  }

  @Patch(':id/toggle-active')
  @ApiOperation({ summary: 'Toggle proveedor active status (Admin)' })
  @ApiParam({ name: 'id', description: 'Proveedor ID' })
  toggleActive(@Param('id') id: string) {
    return this.proveedoresService.toggleActive(id);
  }

  @Post(':id/productos/:productoId')
  @ApiOperation({ summary: 'Add product to proveedor (Admin)' })
  @ApiParam({ name: 'id', description: 'Proveedor ID' })
  @ApiParam({ name: 'productoId', description: 'Product ID' })
  addProducto(@Param('id') id: string, @Param('productoId') productoId: string) {
    return this.proveedoresService.addProducto(id, productoId);
  }

  @Delete(':id/productos/:productoId')
  @ApiOperation({ summary: 'Remove product from proveedor (Admin)' })
  @ApiParam({ name: 'id', description: 'Proveedor ID' })
  @ApiParam({ name: 'productoId', description: 'Product ID' })
  removeProducto(@Param('id') id: string, @Param('productoId') productoId: string) {
    return this.proveedoresService.removeProducto(id, productoId);
  }
}