import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import  dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import { ActivityUser, ActivityUserDocument } from './schemas/activity_user.schema';

dayjs.extend(isoWeek);

@Injectable()
export class ActivityUserService {
  constructor(
    @InjectModel(ActivityUser.name) private activityModel: Model<ActivityUserDocument>,

  ) {}

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
}
