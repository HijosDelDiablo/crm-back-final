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
import { GastosService } from './gastos.service';
import { CreateGastoDto, UpdateGastoDto } from './dto/gasto.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { Rol } from '../auth/enums/rol.enum';
import type { ValidatedUser } from '../user/schemas/user.schema';

@Controller('gastos')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Rol.ADMIN, Rol.VENDEDOR)
export class GastosController {
  constructor(private readonly gastosService: GastosService) {}

  @Post()
  create(
    @Body() createGastoDto: CreateGastoDto,
    @GetUser() user: ValidatedUser,
  ) {
    return this.gastosService.create(createGastoDto, user._id.toString());
  }

  @Get()
  findAll() {
    return this.gastosService.findAll();
  }

  @Get('rango-fechas')
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
  findByCategoria(@Param('categoria') categoria: string) {
    return this.gastosService.findByCategoria(categoria);
  }

  @Get('resumen-categorias')
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
  findOne(@Param('id') id: string) {
    return this.gastosService.findById(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateGastoDto: UpdateGastoDto) {
    return this.gastosService.update(id, updateGastoDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.gastosService.remove(id);
  }

  @Patch(':id/pagar')
  marcarComoPagado(@Param('id') id: string) {
    return this.gastosService.marcarComoPagado(id);
  }
}