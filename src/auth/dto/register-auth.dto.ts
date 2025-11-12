import { IsEmail, IsNotEmpty, IsString, MinLength, IsOptional, IsPhoneNumber } from 'class-validator';

export class RegisterAuthDto {
  @IsNotEmpty({ message: 'El nombre es obligatorio.' })
  @IsString()
  nombre: string;

  @IsNotEmpty({ message: 'El email es obligatorio.' })
  @IsEmail({}, { message: 'El email no es válido.' })
  email: string;

  @IsNotEmpty({ message: 'La contraseña es obligatoria.' })
  @IsString()
  @MinLength(6, { message: 'La contraseña debe tener al menos 6 caracteres.' })
  password: string;

  @IsOptional()
  @IsPhoneNumber('MX', {
    message: 'Ingresa un número de teléfono válido (incluye código de país, ej. +52...).',
  })
  telefono?: string;
}