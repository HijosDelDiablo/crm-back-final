
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
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';


export class CreateProductDto {
  @ApiProperty({ example: 'Toyota', description: 'Marca del vehículo' })
  @IsString()
  @IsNotEmpty()
  marca: string;

  @ApiProperty({ example: 'Corolla', description: 'Modelo del vehículo' })
  @IsString()
  @IsNotEmpty()
  modelo: string;

  @ApiProperty({ example: 2022, description: 'Año del vehículo', minimum: 1900, maximum: 2099 })
  @IsNumber()
  @Min(1900)
  @Max(2099)
  ano: number;

  @ApiProperty({ example: 15000, description: 'Precio base del vehículo', minimum: 0 })
  @IsNumber()
  @Min(0)
  precioBase: number;

  @ApiProperty({ example: 50000, description: 'Kilometraje del vehículo', minimum: 0 })
  @IsNumber()
  @Min(0)
  kilometraje: number;

  @ApiProperty({ example: 'Auto en excelente estado', description: 'Descripción del vehículo' })
  @IsString()
  @IsNotEmpty()
  descripcion: string;

  @ApiProperty({ example: 'Nuevo', description: 'Condición del vehículo', enum: ['Nuevo', 'Usado'] })
  @IsString()
  @IsNotEmpty()
  @IsEnum(['Nuevo', 'Usado'])
  condicion: string;

  @ApiProperty({ example: 'Sedán', description: 'Tipo de vehículo' })
  @IsString()
  @IsNotEmpty()
  tipo: string;

  @ApiProperty({ example: 'Automática', description: 'Tipo de transmisión' })
  @IsString()
  @IsNotEmpty()
  transmision: string;

  @ApiProperty({ example: '1.8L', description: 'Tipo de motor' })
  @IsString()
  @IsNotEmpty()
  motor: string;

  @ApiProperty({ example: 'Rojo', description: 'Color del vehículo' })
  @IsString()
  @IsNotEmpty()
  color: string;

  @ApiPropertyOptional({ example: 4, description: 'Número de puertas' })
  @IsNumber()
  @IsOptional()
  numPuertas?: number;

  @ApiProperty({ example: '1HGCM82633A004352', description: 'VIN del vehículo (17 caracteres)' })
  @IsString()
  @IsNotEmpty()
  @Length(17, 17, { message: 'El VIN debe tener exactamente 17 caracteres' })
  vin: string;
}

export class UpdateProductDto extends PartialType(CreateProductDto) {
  @ApiPropertyOptional({ example: '/uploads/imagen.jpg', description: 'URL de la imagen del producto' })
  @IsString()
  @IsUrl()
  @IsOptional()
  imageUrl?: string;
}