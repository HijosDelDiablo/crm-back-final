import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type GastoDocument = Gasto & Document;

export enum CategoriaGasto {
  COMPRA_VEHICULOS = 'Compra de Vehículos',
  MANTENIMIENTO = 'Mantenimiento',
  COMBUSTIBLE = 'Combustible',
  NOMINAS = 'Nóminas',
  RENTA = 'Renta',
  SERVICIOS = 'Servicios',
  PUBLICIDAD = 'Publicidad',
  IMPUESTOS = 'Impuestos',
  OTROS = 'Otros'
}

export enum EstadoGasto {
  PENDIENTE = 'Pendiente',
  PAGADO = 'Pagado',
  CANCELADO = 'Cancelado'
}

@Schema({ timestamps: true })
export class Gasto {
  @Prop({ required: true, trim: true })
  concepto: string;

  @Prop({ required: true })
  monto: number;

  @Prop({ type: String, enum: CategoriaGasto, required: true })
  categoria: CategoriaGasto;

  @Prop({ type: String, enum: EstadoGasto, default: EstadoGasto.PENDIENTE })
  estado: EstadoGasto;

  @Prop({ required: true })
  fechaGasto: Date;

  @Prop({ type: Date })
  fechaPago?: Date;

  @Prop({ type: Types.ObjectId, ref: 'Proveedor' })
  proveedor?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  registradoPor: Types.ObjectId;

  @Prop({ type: String })
  comprobante?: string;

  @Prop({ type: String })
  notas?: string;

  @Prop({ type: Types.ObjectId, ref: 'Product' })
  productoRelacionado?: Types.ObjectId;
}

export const GastoSchema = SchemaFactory.createForClass(Gasto);