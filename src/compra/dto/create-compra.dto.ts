import { IsMongoId, IsNotEmpty, IsNumber, IsPositive, Min, IsObject, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class DatosFinancierosDto {
  @IsNumber()
  @IsPositive()
  @Min(0)
  ingresoMensual: number;

  @IsNumber()
  @Min(0)
  otrosIngresos: number;

  @IsNumber()
  @Min(0)
  gastosMensuales: number;

  @IsNumber()
  @Min(0)
  deudasActuales: number;
}

export class CreateCompraDto {
  @IsMongoId()
  @IsNotEmpty()
  cotizacionId: string;

  @IsObject()
  @ValidateNested()
  @Type(() => DatosFinancierosDto)
  datosFinancieros: DatosFinancierosDto;
}