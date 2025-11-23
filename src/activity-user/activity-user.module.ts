import { Module } from '@nestjs/common';
import { ActivityUserController } from './activity-user.controller';
import { ActivityUserService } from './activity-user.service';
import { MongooseModule } from '@nestjs/mongoose';
import { ActivityUserSchema } from './schemas/activity_user.schema';

@Module({
    imports: [
      MongooseModule.forFeature([{ name: 'ActivityUser', schema: ActivityUserSchema }])
    ],
  controllers: [ActivityUserController],
  providers: [ActivityUserService]
})
export class ActivityUserModule {}
