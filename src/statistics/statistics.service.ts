import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import { ActivityUser, ActivityUserDocument } from './schemas/activity_user.schema';
import { FavoriteStats, FavoriteStatsDocument } from './schemas/favorite-stats.schema';
import { UserService } from '../user/user.service';
import { ProductService } from '../product/product.service';

dayjs.extend(isoWeek);

@Injectable()
export class StatisticsService {
  constructor(
    @InjectModel(ActivityUser.name) private activityModel: Model<ActivityUserDocument>,
    @InjectModel(FavoriteStats.name) private favoriteStatsModel: Model<FavoriteStatsDocument>,
    private readonly userService: UserService,
    private readonly productService: ProductService,
  ) { }

  async registerHeartbeat(user: any) {

    // 1️⃣ Obtener semana y año actuales
    const now = dayjs();
    const year = now.year();
    const week = now.isoWeek();

    // 2️⃣ Buscar registro de actividad del usuario para la semana
    let activity = await this.activityModel.findOne({
      userId: user._id,
      year,
      week,
    });

    if (!activity) {
      // Crear si no existe
      activity = await this.activityModel.create({
        userId: user._id,
        year,
        week,
        totalActiveSeconds: 0,
        lastHeartbeatAt: now.toDate(),
      });

      return { ok: true, created: true };
    }

    // 3️⃣ Si existe, calcular diferencia desde el último heartbeat
    const last = dayjs(activity.lastHeartbeatAt);
    const diffSeconds = now.diff(last, 'seconds');

    // Evitar valores absurdos (por conexiones perdidas)
    const safeSeconds = Math.min(diffSeconds, 120); // máximo 2 min

    if (safeSeconds > 0) {
      activity.totalActiveSeconds += safeSeconds;
    }

    activity.lastHeartbeatAt = now.toDate();

    await activity.save();

    return { ok: true, addedSeconds: safeSeconds };
  }


  async addFavoritePoint(productId: Types.ObjectId) {
    const now = dayjs();
    const year = now.year();
    const week = now.isoWeek();
    let stats = await this.favoriteStatsModel.findOne({ productId, year, week });

    if (!stats) {
      stats = await this.favoriteStatsModel.create({
        productId,
        year,
        week,
        totalFavorites: 0,
        lastUpdatedAt: new Date(),
      });
    }
  }
  async getTopFavorites(year: number, weekStart: number, weekEnd: number, limit: number) {
    year = year ? year : dayjs().year();
    weekStart = weekStart ? weekStart : 1;
    weekEnd = weekEnd ? weekEnd : 52;
    limit = limit ? limit : 10;

    const aggResults: Array<{ _id: any; totalFavorites: number }> = await this.favoriteStatsModel.aggregate([
      { $match: { year, week: { $gte: weekStart, $lte: weekEnd } } },
      {
        $group: {
          _id: '$productId',
          totalFavorites: { $sum: '$totalFavorites' },
        },
      },
      { $sort: { totalFavorites: -1 } },
      { $limit: limit },
    ]);

    const results = await Promise.all(
      aggResults.map(async (row) => {
        try {
          const product = await this.productService.findById(row._id.toString());
          return { product, totalFavorites: row.totalFavorites };
        } catch (err) {
          return { productId: row._id, totalFavorites: row.totalFavorites };
        }
      }),
    );

    return results;
  }

  async getHistory(productId: string) {
    return this.favoriteStatsModel
      .find({ productId })
      .sort({ year: 1, week: 1 })
      .lean();
  }

  async getSellerWithMoreActivity() {
    const userActivity = await this.activityModel.aggregate([
      {
        $group: {
          _id: "$userId",
          totalActiveSeconds: { $sum: "$totalActiveSeconds" },
        }
      },
      {
        $sort: { totalActiveSeconds: -1 } // el mayor primero
      },
      {
        $limit: 1
      }
    ]);

    if (userActivity.length === 0) throw new InternalServerErrorException('No se encontró actividad de usuarios.');
    const userInfo = await this.userService.findById(userActivity[0]._id);
    if (!userInfo) throw new InternalServerErrorException('No se encontró el usuario con más actividad.');
    return userInfo;

  }


}
