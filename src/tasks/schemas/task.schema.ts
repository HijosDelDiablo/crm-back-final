import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from '../../user/schemas/user.schema';

export type TaskDocument = Task & Document;

@Schema({ timestamps: true })
export class Task {
  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ trim: true })
  notes?: string;

  @Prop({ required: true })
  dueDate: Date;

  @Prop({ default: false })
  isCompleted: boolean;

  @Prop({ type: Types.ObjectId, ref: User.name, required: true })
  vendedor: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: User.name })
  cliente?: Types.ObjectId;
}

export const TaskSchema = SchemaFactory.createForClass(Task);