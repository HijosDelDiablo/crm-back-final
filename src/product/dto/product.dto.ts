import { PartialType } from '@nestjs/mapped-types';
import {
  IsString,
  IsNumber,
  IsNotEmpty,
  IsOptional,
  IsUrl,
  Min,
  Max,
  IsEnum,
  Length,
} from 'class-validator';

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  marca: string;

  @IsString()
  @IsNotEmpty()
  modelo: string;

  @IsNumber()
  @Min(1900)
  @Max(2099)
  ano: number;

  @IsNumber()
  @Min(0)
  precioBase: number;

  @IsNumber()
  @Min(0)
  kilometraje: number;

  @IsString()
  @IsNotEmpty()
  descripcion: string;

  @IsString()
  @IsNotEmpty()
  @IsEnum(['Nuevo', 'Usado'])
  condicion: string;
  
  @IsString()
  @IsNotEmpty()
  tipo: string;

  @IsString()
  @IsNotEmpty()
  transmision: string;

  @IsString()
  @IsNotEmpty()
  motor: string;
  
  @IsString()
  @IsNotEmpty()
  color: string;

  @IsNumber()
  @IsOptional()
  numPuertas?: number;

  @IsString()
  @IsNotEmpty()
  @Length(17, 17, { message: 'El VIN debe tener exactamente 17 caracteres' })
  vin: string;
}

export class UpdateProductDto extends PartialType(CreateProductDto) {
  @IsString()
  @IsUrl()
  @IsOptional()
  imageUrl?: string;
}