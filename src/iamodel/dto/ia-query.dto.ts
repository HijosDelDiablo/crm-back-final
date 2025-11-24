import { IsNotEmpty, IsString } from 'class-validator';

export class IaQueryDto {
  @IsString()
  @IsNotEmpty()
  prompt: string;
}