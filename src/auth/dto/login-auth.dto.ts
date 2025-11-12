import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class LoginAuthDto {
  @IsNotEmpty({ message: 'El email es obligatorio.' })
  @IsEmail()
  email: string;

  @IsNotEmpty({ message: 'La contraseña es obligatoria.' })
  @IsString()
  password: string;
}