import { IsString, IsNotEmpty, MinLength, IsEmail } from 'class-validator';

export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty()
  token: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6, { message: 'La contraseña debe tener al menos 6 caracteres' })
  newPassword: string;
}

export class ForgotPasswordDto {
  @IsString()
  @IsNotEmpty()
  @IsEmail({}, { message: 'El email debe ser válido' })
  email: string;
}