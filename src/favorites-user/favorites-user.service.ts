import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import  dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import { Favorites, FavoritesDocument } from './schemas/favorites.schema';
import { StatisticsService } from '../statistics/statistics.service';

dayjs.extend(isoWeek);

@Injectable()
export class FavoritesUserService {
  constructor(
    @InjectModel(Favorites.name) private favoriteModel: Model<FavoritesDocument>,
    private readonly statisticsService: StatisticsService,
  ) {}


  async addToFavorites(userId: string, productId: string) {
  // 1. Registrar favorito del usuario
  const favorite = await this.favoriteModel.findOne({ userId, productId });

  if (favorite && !favorite.deletedAt) {
    return { message: 'Already in favorites' };
  }

  if (favorite && favorite.deletedAt) {
    // reactivate
    favorite.deletedAt = null;
    favorite.addedAt = new Date();
    await favorite.save();
  } else {
    await this.favoriteModel.create({
      userId,
      productId,
      addedAt: new Date(),
      deletedAt: null,
    });
  }

  // 2. Registrar estadística semanal
  await this.statisticsService.addFavoritePoint(productId);

  return { message: 'Added to favorites' };
}

async removeFavorite(userId: string, productId: string) {
  return this.favoriteModel.updateOne(
    { userId, productId, deletedAt: null },
    { $set: { deletedAt: new Date() } }
  );
}

async getFavorites(userId: string) {
  return this.favoriteModel.find({ userId, deletedAt: null });
}

}
