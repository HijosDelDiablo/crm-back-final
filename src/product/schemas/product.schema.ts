import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from '../../user/schemas/user.schema';

export type ProductDocument = Product & Document;

@Schema({ timestamps: true })
export class Product {
  @Prop({ required: true, trim: true })
  marca: string;

  @Prop({ required: true, trim: true })
  modelo: string;

  @Prop({ required: true })
  ano: number;

  @Prop({ required: true })
  precioBase: number;

  @Prop({ required: true, default: 0 })
  kilometraje: number;

  @Prop({
    required: true,
    unique: true,
    trim: true,
    uppercase: true,
    maxlength: 17,
  })
  vin: string;

  @Prop({ required: true, trim: true })
  descripcion: string;

  @Prop({ required: true, trim: true })
  condicion: string;

  @Prop({ required: true, trim: true })
  tipo: string;

  @Prop({ required: true, trim: true })
  transmision: string;

  @Prop({ required: true, trim: true })
  motor: string;

  @Prop({ required: true, trim: true })
  color: string;

  @Prop({ required: true, default: 4 })
  numPuertas: number;

  @Prop({ trim: true })
  imageUrl?: string;

  @Prop({ default: 1 })
  stock: number;

  @Prop({ default: true })
  disponible: boolean;

  @Prop({ type: Types.ObjectId, ref: 'Proveedor' })
  proveedor?: Types.ObjectId;

  @Prop({ default: 0 })
  costoCompra: number;

  @Prop({ type: Date })
  fechaCompra?: Date;

  @Prop({ type: Types.ObjectId, ref: User.name })
  compradoPor?: Types.ObjectId;

  @Prop({ default: 0 })
  vecesVendido: number;

  @Prop({ default: true })
  activo: boolean;
}

export const ProductSchema = SchemaFactory.createForClass(Product);