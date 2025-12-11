import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Pago extends Document {
    @Prop({ type: Types.ObjectId, ref: 'Compra', required: true })
    compra: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'User', required: true })
    cliente: Types.ObjectId;

    @Prop({ type: Number, required: true, min: 0.01 })
    monto: number;

    @Prop({ type: Date, default: Date.now })
    fecha: Date;

    @Prop({ type: String, default: 'efectivo' })
    metodoPago: string;

    @Prop({ type: String, default: 'REGISTRADO' })
    status: string;

    @Prop({ type: String })
    notas?: string;

    @Prop({ type: String })
    comprobante?: string;

    @Prop({ type: Types.ObjectId, ref: 'User' })
    registradoPor?: Types.ObjectId;
}

export type PagoDocument = Pago & Document;

export const PagoSchema = SchemaFactory.createForClass(Pago);
