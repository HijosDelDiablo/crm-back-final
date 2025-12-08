import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from '../../user/schemas/user.schema';
import { Product } from '../../product/schemas/product.schema';

export type CotizacionDocument = Cotizacion & Document;

export enum StatusCotizacion {
  PENDIENTE = "Pendiente",
  EN_REVISION = 'En Revision',
  APROBADA = 'Aprobada',
  RECHAZADA = 'Rechazada',
  COMPLETADA = 'Completada'
}

@Schema({ timestamps: true })
export class Cotizacion {
  @Prop({ type: Types.ObjectId, ref: User.name, required: true })
  cliente: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: Product.name, required: true })
  coche: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: User.name, required: false })
  vendedor?: Types.ObjectId;

  @Prop({ required: true })
  precioCoche: number;

  @Prop({ required: true })
  enganche: number;

  @Prop({ required: true })
  plazoMeses: number;

  @Prop({ required: true })
  tasaInteres: number;

  @Prop({ required: true })
  pagoMensual: number;

  @Prop({ required: true })
  montoFinanciado: number;

  @Prop({ required: true })
  totalPagado: number;

  @Prop({
    type: String,
    enum: StatusCotizacion,
    default: StatusCotizacion.PENDIENTE
  })
  status: StatusCotizacion;

  @Prop({ type: String, default: '' })
  notasVendedor?: string;
}

export const CotizacionSchema = SchemaFactory.createForClass(Cotizacion);