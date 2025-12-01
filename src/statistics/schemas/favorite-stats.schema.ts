import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { ObjectId, Types } from 'mongoose';
import { Product } from '../../product/schemas/product.schema';

@Schema({ timestamps: true })
export class FavoriteStats {
  @Prop({ type: Types.ObjectId, ref: Product.name, required: true })
  productId: Types.ObjectId;
  @Prop({ required: true })
  year: number
  @Prop({ required: true })
  week: number
  @Prop({ default: 0 })
  totalFavorites: number
  @Prop({ default: null })
  lastUpdatedAt: Date
}

export type FavoriteStatsDocument = mongoose.HydratedDocument<FavoriteStats>;
export const FavoriteStatsSchema = SchemaFactory.createForClass(FavoriteStats);