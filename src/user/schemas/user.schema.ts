import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Rol } from '../../auth/enums/rol.enum';

@Schema({ timestamps: true })
export class User extends Document {
  @Prop({ unique: true, required: true, trim: true })
  email: string;

  @Prop({ required: true })
  nombre: string;

  @Prop({ required: false, trim: true })
  telefono?: string;

  @Prop({ required: false, select: false })
  password?: string;

  @Prop({ type: String, enum: Rol, default: Rol.CLIENTE })
  rol: Rol;

  @Prop({ default: null })
  googleId?: string;

  @Prop({ default: false })
  twoFactorEnabled: boolean;

  @Prop({ type: String, default: null, select: false })
  twoFactorSecret?: string | null;

  @Prop({ type: String, select: false })
  twoFactorTempSecret?: string;

  @Prop({ type: Date })
  twoFactorTempExpiry?: Date;

  @Prop({ required: false })
  oneSignalPlayerId?: string;

  @Prop({ default: null })
  fotoPerfil?: string;

  @Prop({ default: null })
  direccion?: string;

  @Prop({ default: null })
  fechaNacimiento?: Date;

  @Prop({ default: true })
  activo: boolean;

   @Prop({ type: Types.ObjectId, ref: User.name })
    vendedorQueAtiende?: Types.ObjectId; // Solo aplicable si el rol es CLIENTE
}

export type UserDocument = User & Document;
export const UserSchema = SchemaFactory.createForClass(User);

export interface ValidatedUser {
  _id: string;
  email: string;
  rol: Rol;
  nombre: string;
  twoFactorEnabled?: boolean;

  fotoPerfil?: string;
}
