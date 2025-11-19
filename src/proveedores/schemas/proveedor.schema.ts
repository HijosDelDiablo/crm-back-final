import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ProveedorDocument = Proveedor & Document;

@Schema({ timestamps: true })
export class Proveedor {
  @Prop({ required: true, trim: true })
  nombre: string;

  @Prop({ required: true, trim: true })
  contacto: string;

  @Prop({ required: true, trim: true })
  telefono: string;

  @Prop({ required: true, trim: true })
  email: string;

  @Prop({ required: true, trim: true })
  direccion: string;

  @Prop({ required: true, trim: true })
  rfc: string;

  @Prop({ default: true })
  activo: boolean;

  @Prop({ type: String })
  notas?: string;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Product' }] })
  productosSuministrados: Types.ObjectId[];
}

export const ProveedorSchema = SchemaFactory.createForClass(Proveedor);