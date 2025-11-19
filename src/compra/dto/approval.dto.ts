import { IsEnum, IsNumber, IsOptional, IsPositive } from 'class-validator';

export class AprobarCompraDto {
  @IsEnum(['Aprobada', 'Rechazada', 'Pendiente'])
  status: string;

  @IsNumber()
  @IsPositive()
  @IsOptional()
  montoAprobado?: number;

  @IsNumber()
  @IsPositive()
  @IsOptional()
  tasaInteresAprobada?: number;

  @IsOptional()
  comentarios?: string;
}