import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Types } from 'mongoose';
import { User } from 'src/user/schemas/user.schema';

@Schema({ timestamps: true })
export class ActivityUser {
  @Prop({ type: Types.ObjectId, ref: User.name, required: true })
  userId: Types.ObjectId;
  @Prop({ required: true })
  year: number
  @Prop({ required: true })
  week: number
  @Prop({ default: 0 })
  totalActiveSeconds: number
  @Prop({ default: null })
  lastHeartbeatAt: Date
}

export type ActivityUserDocument = mongoose.HydratedDocument<ActivityUser>;
export const ActivityUserSchema = SchemaFactory.createForClass(ActivityUser);