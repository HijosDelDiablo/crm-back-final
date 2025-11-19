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
import { ProveedoresService } from './proveedores.service';
import { CreateProveedorDto, UpdateProveedorDto } from './dto/proveedor.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Rol } from '../auth/enums/rol.enum';

@Controller('proveedores')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Rol.ADMIN)
export class ProveedoresController {
  constructor(private readonly proveedoresService: ProveedoresService) {}

  @Post()
  create(@Body() createProveedorDto: CreateProveedorDto) {
    return this.proveedoresService.create(createProveedorDto);
  }

  @Get()
  findAll() {
    return this.proveedoresService.findAll();
  }

  @Get('activos')
  findActive() {
    return this.proveedoresService.findActive();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.proveedoresService.findById(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateProveedorDto: UpdateProveedorDto) {
    return this.proveedoresService.update(id, updateProveedorDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.proveedoresService.remove(id);
  }

  @Patch(':id/toggle-active')
  toggleActive(@Param('id') id: string) {
    return this.proveedoresService.toggleActive(id);
  }

  @Post(':id/productos/:productoId')
  addProducto(@Param('id') id: string, @Param('productoId') productoId: string) {
    return this.proveedoresService.addProducto(id, productoId);
  }

  @Delete(':id/productos/:productoId')
  removeProducto(@Param('id') id: string, @Param('productoId') productoId: string) {
    return this.proveedoresService.removeProducto(id, productoId);
  }
}