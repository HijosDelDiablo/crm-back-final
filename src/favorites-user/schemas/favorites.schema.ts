import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Types } from 'mongoose';
import { Product } from 'src/product/schemas/product.schema';
import { User } from 'src/user/schemas/user.schema';

@Schema({ timestamps: true })
export class Favorites {
  @Prop({ type: Types.ObjectId, ref: User.name, required: true })
  userId: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: Product.name, required: true })
  productId: Types.ObjectId;
  @Prop({ type: Date, default: Date.now })
  addedAt: Date;
  @Prop({ type: Date, default: null })
  deletedAt: Date | null;  
}

export type FavoritesDocument = mongoose.HydratedDocument<Favorites>;
export const FavoritesSchema = SchemaFactory.createForClass(Favorites);