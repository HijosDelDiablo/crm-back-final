import { IsString, IsNotEmpty, IsInt, Min, Max, IsMongoId } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateSellerReviewDto {
  @ApiProperty({
    description: 'ID del vendedor que se está evaluando',
    example: '507f1f77bcf86cd799439011'
  })
  @IsMongoId({ message: 'El vendedorId debe ser un ID de MongoDB válido' })
  @IsNotEmpty({ message: 'El vendedorId es requerido' })
  vendedorId: string;

  @ApiProperty({
    description: 'Mensaje de la reseña',
    example: 'Excelente atención, muy profesional'
  })
  @IsString({ message: 'El mensaje debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El mensaje es requerido' })
  mensaje: string;

  @ApiProperty({
    description: 'Puntuación de 1 a 5 estrellas',
    minimum: 1,
    maximum: 5,
    example: 5
  })
  @IsInt({ message: 'La puntuación debe ser un número entero' })
  @Min(1, { message: 'La puntuación mínima es 1' })
  @Max(5, { message: 'La puntuación máxima es 5' })
  puntuacion: number;
}
