import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FavoritesSchema } from './schemas/favorites.schema';
import { FavoritesUserController } from './favorites-user.controller';
import { FavoritesUserService } from './favorites-user.service';
import { StatisticsModule } from 'src/statistics/statistics.module';

@Module({
    imports: [
      MongooseModule.forFeature([{ name: 'Favorites', schema: FavoritesSchema }]),
      StatisticsModule,
    ],
  controllers: [FavoritesUserController],
  providers: [FavoritesUserService],
})
export class FavoritesUserModule {}
