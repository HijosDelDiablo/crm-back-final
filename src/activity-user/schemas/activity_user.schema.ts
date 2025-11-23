import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose from 'mongoose';

@Schema({ timestamps: true })
export class ActivityUser {
    @Prop({ required: true })
  userId: string
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