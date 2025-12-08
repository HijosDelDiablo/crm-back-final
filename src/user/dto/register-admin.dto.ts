import { IsString, IsEmail, IsNotEmpty, IsOptional } from 'class-validator';

export class RegisterAdminDto {
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;

  @IsOptional()
  @IsString()
  telefono?: string;
}