import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { GastosService } from './gastos.service';
import { CreateGastoDto, UpdateGastoDto } from './dto/gasto.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { Rol } from '../auth/enums/rol.enum';
import type { ValidatedUser } from '../user/schemas/user.schema';

@ApiTags('Gastos')
@Controller('gastos')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Rol.ADMIN, Rol.VENDEDOR)
@ApiBearerAuth()
export class GastosController {
  constructor(private readonly gastosService: GastosService) {}

  @Post()
  @ApiOperation({ summary: 'Create gasto (Admin, Vendedor)' })
  @ApiResponse({ status: 201, description: 'Gasto created' })
  @ApiBody({ type: CreateGastoDto })
  create(
    @Body() createGastoDto: CreateGastoDto,
    @GetUser() user: ValidatedUser,
  ) {
    return this.gastosService.create(createGastoDto, user._id.toString());
  }

  @Get()
  @ApiOperation({ summary: 'Get all gastos (Admin, Vendedor)' })
  @ApiResponse({ status: 200, description: 'Return all gastos' })
  findAll() {
    return this.gastosService.findAll();
  }

  @Get('rango-fechas')
  @ApiOperation({ summary: 'Get gastos by date range (Admin, Vendedor)' })
  @ApiQuery({ name: 'startDate', required: true })
  @ApiQuery({ name: 'endDate', required: true })
  @ApiResponse({ status: 200, description: 'Return gastos in range' })
  findByDateRange(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.gastosService.findByDateRange(
      new Date(startDate),
      new Date(endDate),
    );
  }

  @Get('categoria/:categoria')
  @ApiOperation({ summary: 'Get gastos by category (Admin, Vendedor)' })
  @ApiParam({ name: 'categoria', description: 'Category name' })
  @ApiResponse({ status: 200, description: 'Return gastos in category' })
  findByCategoria(@Param('categoria') categoria: string) {
    return this.gastosService.findByCategoria(categoria);
  }

  @Get('resumen-categorias')
  @ApiOperation({ summary: 'Get expenses summary by category (Admin, Vendedor)' })
  @ApiQuery({ name: 'startDate', required: true })
  @ApiQuery({ name: 'endDate', required: true })
  @ApiResponse({ status: 200, description: 'Return summary' })
  getResumenPorCategoria(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.gastosService.getResumenPorCategoria(
      new Date(startDate),
      new Date(endDate),
    );
  }

  @Get('total')
  @ApiOperation({ summary: 'Get total expenses (Admin, Vendedor)' })
  @ApiQuery({ name: 'startDate', required: true })
  @ApiQuery({ name: 'endDate', required: true })
  @ApiResponse({ status: 200, description: 'Return total' })
  getTotalGastos(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.gastosService.getTotalGastos(
      new Date(startDate),
      new Date(endDate),
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get gasto by ID (Admin, Vendedor)' })
  @ApiParam({ name: 'id', description: 'Gasto ID' })
  @ApiResponse({ status: 200, description: 'Return gasto' })
  findOne(@Param('id') id: string) {
    return this.gastosService.findById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update gasto (Admin, Vendedor)' })
  @ApiParam({ name: 'id', description: 'Gasto ID' })
  @ApiBody({ type: UpdateGastoDto })
  update(@Param('id') id: string, @Body() updateGastoDto: UpdateGastoDto) {
    return this.gastosService.update(id, updateGastoDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete gasto (Admin, Vendedor)' })
  @ApiParam({ name: 'id', description: 'Gasto ID' })
  remove(@Param('id') id: string) {
    return this.gastosService.remove(id);
  }

  @Patch(':id/pagar')
  @ApiOperation({ summary: 'Mark gasto as paid (Admin, Vendedor)' })
  @ApiParam({ name: 'id', description: 'Gasto ID' })
  marcarComoPagado(@Param('id') id: string) {
    return this.gastosService.marcarComoPagado(id);
  }
}