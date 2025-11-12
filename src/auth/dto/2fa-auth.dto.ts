import { IsMongoId, IsNotEmpty, IsString, Length } from 'class-validator';

export class TwoFactorAuthDto {
  @IsString()
  @IsNotEmpty()
  @IsMongoId({ message: 'El ID de usuario no es válido' })
  userId: string;

  @IsString()
  @IsNotEmpty()
  @Length(6, 6, { message: 'El código debe tener 6 dígitos' })
  code: string;
}