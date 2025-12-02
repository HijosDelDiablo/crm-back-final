import { IsMongoId, IsNotEmpty } from 'class-validator';
import { CreateCotizacionDto } from './cotizacion.dto';
import { ApiProperty } from '@nestjs/swagger';

export class VendedorCreateCotizacionDto extends CreateCotizacionDto {
  @ApiProperty({ example: '507f1f77bcf86cd799439012', description: 'ID del cliente para quien se genera la cotización' })
  @IsMongoId()
  @IsNotEmpty()
  clienteId: string;
}