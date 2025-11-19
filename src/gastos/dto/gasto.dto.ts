import { 
  IsString, 
  IsNotEmpty, 
  IsNumber, 
  IsPositive, 
  IsEnum, 
  IsDateString, 
  IsOptional, 
  IsMongoId,
  IsDate 
} from 'class-validator';
import { Type } from 'class-transformer';
import { CategoriaGasto, EstadoGasto } from '../schemas/gasto.schema';

export class CreateGastoDto {
  @IsString()
  @IsNotEmpty()
  concepto: string;

  @IsNumber()
  @IsPositive()
  monto: number;

  @IsEnum(CategoriaGasto)
  categoria: CategoriaGasto;

  @IsDate()
  @Type(() => Date)
  fechaGasto: Date;

  @IsOptional()
  @IsMongoId()
  proveedor?: string;

  @IsOptional()
  @IsString()
  comprobante?: string;

  @IsOptional()
  @IsString()
  notas?: string;

  @IsOptional()
  @IsMongoId()
  productoRelacionado?: string;
}

export class UpdateGastoDto {
  @IsString()
  @IsOptional()
  concepto?: string;

  @IsNumber()
  @IsPositive()
  @IsOptional()
  monto?: number;

  @IsEnum(CategoriaGasto)
  @IsOptional()
  categoria?: CategoriaGasto;

  @IsEnum(EstadoGasto)
  @IsOptional()
  estado?: EstadoGasto;

  @IsDate()
  @Type(() => Date)
  @IsOptional()
  fechaGasto?: Date;

  @IsDate()
  @Type(() => Date)
  @IsOptional()
  fechaPago?: Date;

  @IsOptional()
  @IsMongoId()
  proveedor?: string;

  @IsOptional()
  @IsString()
  comprobante?: string;

  @IsOptional()
  @IsString()
  notas?: string;

  @IsOptional()
  @IsMongoId()
  productoRelacionado?: string;
}