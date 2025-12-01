import { Controller, Delete, Get, Query, Post, UseGuards, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery, ApiParam } from '@nestjs/swagger';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { type ValidatedUser } from '../user/schemas/user.schema';
import { StatisticsService } from './statistics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Rol } from '../auth/enums/rol.enum';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Statistics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Rol.ADMIN, Rol.CLIENTE, Rol.VENDEDOR)
@ApiBearerAuth()
@Controller('statistics')
export class StatisticsController {
    constructor(private readonly statisticsService: StatisticsService) {}

@Post("activity-user")
@ApiOperation({ summary: 'Register user activity' })
@ApiResponse({ status: 200, description: 'Activity registered' })
  async heartbeat(@GetUser() user: ValidatedUser) {
    return this.statisticsService.registerHeartbeat(user);
  }

  @Get('favorites/top')
  @ApiOperation({ summary: 'Get top favorites' })
  @ApiQuery({ name: 'year', required: false })
  @ApiQuery({ name: 'startWeek', required: false })
  @ApiQuery({ name: 'endWeek', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiResponse({ status: 200, description: 'Return top favorites' })
async getTopFavorites(
  @Query('year') year: 2025,
  @Query('startWeek') startWeek: 1,
  @Query('endWeek') endWeek: 52,
  @Query('limit') limit = 10
) {
  return this.statisticsService.getTopFavorites(year, startWeek, endWeek, limit);
}

@Get('favorite/history/:productId')
@ApiOperation({ summary: 'Get favorite history for product' })
@ApiParam({ name: 'productId', description: 'Product ID' })
@ApiResponse({ status: 200, description: 'Return history' })
async getHistory(@Param('productId') productId: string) {
  return this.statisticsService.getHistory(productId);
}

@Get('seller-with-more-activity')
@ApiOperation({ summary: 'Get seller with most activity' })
@ApiResponse({ status: 200, description: 'Return seller' })
async getSellerWithMoreActivity(){
  return this.statisticsService.getSellerWithMoreActivity();
}




}