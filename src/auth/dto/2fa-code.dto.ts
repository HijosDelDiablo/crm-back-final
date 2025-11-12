import { IsNotEmpty, IsString, Length } from 'class-validator';

export class TwoFactorCodeDto {
  @IsString()
  @IsNotEmpty()
  @Length(6, 6, { message: 'El código debe tener 6 dígitos' })
  code: string;
}