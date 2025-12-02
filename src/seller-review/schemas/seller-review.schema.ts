import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from '../../user/schemas/user.schema';

@Schema({ timestamps: true })
export class SellerReview extends Document {
  @Prop({ type: Types.ObjectId, ref: User.name, required: true })
  vendedorId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: User.name, required: true })
  clienteId: Types.ObjectId;

  @Prop({ required: true })
  mensaje: string;

  @Prop({ required: true, min: 1, max: 5 })
  puntuacion: number;

  @Prop({ type: Date, default: Date.now })
  fecha: Date;
}

export type SellerReviewDocument = SellerReview & Document;
export const SellerReviewSchema = SchemaFactory.createForClass(SellerReview);
