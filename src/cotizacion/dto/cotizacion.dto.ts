import { IsMongoId, IsNumber, IsPositive, Min, Max, IsString, IsEnum, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateCotizacionDto {
  @IsMongoId()
  cocheId: string;

  @IsNumber()
  @IsPositive()
  enganche: number;

  @IsNumber()
  @Min(12)
  @Max(72) 
  plazoMeses: number;
}

export class UpdateCotizacionStatusDto {
  @IsString()
  @IsNotEmpty()
  @IsEnum(['Aprobada', 'Rechazada'])
  status: string;
}

export class UpdateNotasVendedorDto {
  @IsString()
  @IsOptional()
  notasVendedor?: string;
}