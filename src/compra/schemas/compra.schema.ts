import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from '../../user/schemas/user.schema';
import { Cotizacion } from '../../cotizacion/schemas/cotizacion.schema';

export type CompraDocument = Compra & Document;

export enum StatusCompra {
  PENDIENTE = "Pendiente",
  EN_REVISION = 'En revisión',
  APROBADA = 'Aprobada',
  RECHAZADA = 'Rechazada',
  COMPLETADA = 'Completada',
  CANCELADA = 'Cancelada'
}

@Schema({ timestamps: true })
export class Compra {
  @Prop({ type: Types.ObjectId, ref: 'Cotizacion', required: true })
  cotizacion: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: User.name, required: true })
  cliente: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: User.name })
  vendedor?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: User.name })
  analistaCredito?: Types.ObjectId;

  @Prop({
    type: String,
    enum: StatusCompra,
    default: StatusCompra.PENDIENTE
  })
  status: StatusCompra;

  @Prop({ type: Object })
  datosFinancieros: {
    ingresoMensual: number;
    otrosIngresos: number;
    gastosMensuales: number;
    deudasActuales: number;
    capacidadPago: number;
  };

  @Prop({ type: Object })
  resultadoBuro: {
    score: number;
    nivelRiesgo: string;
    detalles: any;
    fechaConsulta: Date;
  };

  @Prop({ type: Object })
  resultadoBanco: {
    aprobado: boolean;
    montoAprobado?: number;
    tasaInteres?: number;
    plazoAprobado?: number;
    motivoRechazo?: string;
    fechaAprobacion?: Date;
  };

  @Prop({ type: String })
  comentariosAnalista?: string;

  @Prop({ type: Date })
  fechaAprobacion?: Date;

  @Prop({ type: Date })
  fechaEntrega?: Date;

  @Prop({ type: Number })
  montoTotalCredito?: number;

  @Prop({ type: Number, default: 0 })
  saldoPendiente?: number;

  @Prop({ type: Number, default: 0 })
  totalPagado?: number;
}

export const CompraSchema = SchemaFactory.createForClass(Compra);