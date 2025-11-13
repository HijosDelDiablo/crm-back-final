import { IsMongoId, IsNotEmpty } from 'class-validator';
import { CreateCotizacionDto } from './cotizacion.dto';

export class VendedorCreateCotizacionDto extends CreateCotizacionDto {
  @IsMongoId()
  @IsNotEmpty()
  clienteId: string;
}