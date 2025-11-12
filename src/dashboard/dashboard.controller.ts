import { Controller, Get, UseGuards, Query, ValidationPipe } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Rol } from '../auth/enums/rol.enum';
import { DashboardService } from './dashboard.service';
import { ReporteQueryDto } from './dto/reporte-query.dto';

@Controller('dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Rol.ADMIN)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('reporte-ventas')
  getReporteVentas(
    @Query(new ValidationPipe({ transform: true })) query: ReporteQueryDto,
  ) {
    return this.dashboardService.getReporteVentas(query.startDate, query.endDate);
  }

  @Get('top-productos')
  getTopProductos() {
    return this.dashboardService.getTopProductos();
  }

  @Get('top-vendedores')
  getTopVendedores() {
    return this.dashboardService.getTopVendedores();
  }
}