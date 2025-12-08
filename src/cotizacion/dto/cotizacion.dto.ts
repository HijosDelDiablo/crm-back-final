import { IsMongoId, IsNumber, IsPositive, Min, Max, IsString, IsEnum, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StatusCotizacion } from '../schemas/cotizacion.schema';

export class CreateCotizacionDto {
  @ApiProperty({ example: '507f1f77bcf86cd799439011', description: 'ID del coche (ObjectId) para el que se solicita cotización' })
  @IsMongoId()
  cocheId: string;

  @ApiProperty({ example: 20000, description: 'Enganche en la moneda local', minimum: 0 })
  @IsNumber()
  @IsPositive()
  enganche: number;

  @ApiProperty({ example: 36, description: 'Plazo en meses', minimum: 12, maximum: 72 })
  @IsNumber()
  @Min(12)
  @Max(72)
  plazoMeses: number;
}

export class UpdateCotizacionStatusDto {
  @ApiProperty({ example: 'Aprobada', description: "Nuevo estado de la cotización", enum: [StatusCotizacion.APROBADA, StatusCotizacion.RECHAZADA] })
  @IsEnum([StatusCotizacion.APROBADA, StatusCotizacion.RECHAZADA])
  status: StatusCotizacion.APROBADA | StatusCotizacion.RECHAZADA;
}

export class UpdateNotasVendedorDto {
  @ApiPropertyOptional({ example: 'Cliente muy interesado, pedir llamada mañana', description: 'Notas internas del vendedor sobre la cotización' })
  @IsString()
  @IsOptional()
  notasVendedor?: string;
}