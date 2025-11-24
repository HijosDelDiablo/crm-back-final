import { Controller, Delete, Get, Query, Post, UseGuards, Param } from '@nestjs/common';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { type ValidatedUser } from '../user/schemas/user.schema';
import { StatisticsService } from './statistics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Rol } from '../auth/enums/rol.enum';
import { Roles } from '../auth/decorators/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Rol.ADMIN, Rol.CLIENTE, Rol.VENDEDOR)
@Controller('statistics')
export class StatisticsController {
    constructor(private readonly statisticsService: StatisticsService) {}

@Post("activity-user")
  async heartbeat(@GetUser() user: ValidatedUser) {
    return this.statisticsService.registerHeartbeat(user);
  }

  @Get('favorites/top')
async getTopFavorites(
  @Query('year') year: 2025,
  @Query('startWeek') startWeek: 1,
  @Query('endWeek') endWeek: 52,
  @Query('limit') limit = 10
) {
  return this.statisticsService.getTopFavorites(year, startWeek, endWeek, limit);
}

@Get('favorite/history/:productId')
async getHistory(@Param('productId') productId: string) {
  return this.statisticsService.getHistory(productId);
}

@Get('seller-with-more-activity')
async getSellerWithMoreActivity(){
  return this.statisticsService.getSellerWithMoreActivity();
}




}