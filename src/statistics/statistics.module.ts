import { Module } from '@nestjs/common';
import { StatisticsController } from './statistics.controller';
import { StatisticsService } from './statistics.service';
import { MongooseModule } from '@nestjs/mongoose';
import { ActivityUserSchema } from './schemas/activity_user.schema';
import { FavoriteStatsSchema } from './schemas/favorite-stats.schema';
import { UserModule } from '../user/user.module';
import { ProductModule } from '../product/product.module';

@Module({
    imports: [
      MongooseModule.forFeature([{ name: 'ActivityUser', schema: ActivityUserSchema }]),
      MongooseModule.forFeature([{ name: 'FavoriteStats', schema: FavoriteStatsSchema }]),
      UserModule,
      ProductModule,
    ],
  controllers: [StatisticsController],
  providers: [StatisticsService],
  exports: [StatisticsService],
})
export class StatisticsModule {}
