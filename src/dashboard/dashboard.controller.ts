import { Controller, Get, UseGuards, Query, ValidationPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Rol } from '../auth/enums/rol.enum';
import { DashboardService } from './dashboard.service';
import { ReporteQueryDto } from './dto/reporte-query.dto';

@ApiTags('Dashboard')
@Controller('dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Rol.ADMIN)
@ApiBearerAuth()
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('reporte-ventas')
  @ApiOperation({ summary: 'Get sales report (Admin)' })
  @ApiResponse({ status: 200, description: 'Return sales report' })
  getReporteVentas(
    @Query(new ValidationPipe({ transform: true })) query: ReporteQueryDto,
  ) {
    return this.dashboardService.getReporteVentas(query.startDate, query.endDate);
  }

  @Get('top-productos')
  @ApiOperation({ summary: 'Get top products (Admin)' })
  @ApiResponse({ status: 200, description: 'Return top products' })
  getTopProductos() {
    return this.dashboardService.getTopProductos();
  }

  @Get('top-vendedores')
  @ApiOperation({ summary: 'Get top sellers (Admin)' })
  @ApiResponse({ status: 200, description: 'Return top sellers' })
  getTopVendedores() {
    return this.dashboardService.getTopVendedores();
  }
}