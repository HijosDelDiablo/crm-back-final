import { 
  IsString, 
  IsNotEmpty, 
  IsEmail, 
  IsBoolean, 
  IsOptional, 
  IsArray,
  IsMongoId 
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateProveedorDto {
  @ApiProperty({ example: 'Proveedor XYZ', description: 'Nombre del proveedor' })
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @ApiProperty({ example: 'Juan Pérez', description: 'Nombre del contacto principal' })
  @IsString()
  @IsNotEmpty()
  contacto: string;

  @ApiProperty({ example: '+52 55 1234 5678', description: 'Número de teléfono del proveedor' })
  @IsString()
  @IsNotEmpty()
  telefono: string;

  @ApiProperty({ example: 'proveedor@ejemplo.com', description: 'Correo electrónico del proveedor' })
  @IsString()
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Calle Ficticia 123, Ciudad, País', description: 'Dirección del proveedor' })
  @IsString()
  @IsNotEmpty()
  direccion: string;

  @ApiProperty({ example: 'RFC123456789', description: 'RFC del proveedor' })
  @IsString()
  @IsNotEmpty()
  rfc: string;

  @ApiPropertyOptional({ example: 'Notas adicionales sobre el proveedor', description: 'Notas opcionales' })
  @IsString()
  @IsOptional()
  notas?: string;

  @ApiPropertyOptional({ example: ['507f1f77bcf86cd799439011', '507f191e810c19729de860ea'], description: 'Lista de IDs de productos suministrados', type: [String] })
  @IsArray()
  @IsOptional()
  @IsMongoId({ each: true }) // Validar que cada elemento sea un ObjectId válido
  productosSuministrados?: string[];
}

export class UpdateProveedorDto {
  @ApiPropertyOptional({ example: 'Proveedor XYZ Actualizado', description: 'Nombre del proveedor' })
  @IsString()
  @IsOptional()
  nombre?: string;

  @ApiPropertyOptional({ example: 'Juan Pérez', description: 'Nombre del contacto principal' })
  @IsString()
  @IsOptional()
  contacto?: string;

  @ApiPropertyOptional({ example: '+52 55 1234 5678', description: 'Número de teléfono del proveedor' })
  @IsString()
  @IsOptional()
  telefono?: string;

  @ApiPropertyOptional({ example: 'proveedor@ejemplo.com', description: 'Correo electrónico del proveedor' })
  @IsString()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: 'Calle Ficticia 123, Ciudad, País', description: 'Dirección del proveedor' })
  @IsString()
  @IsOptional()
  direccion?: string;

  @ApiPropertyOptional({ example: 'RFC123456789', description: 'RFC del proveedor' })
  @IsString()
  @IsOptional()
  rfc?: string;

  @ApiPropertyOptional({ example: true, description: 'Estado activo del proveedor' })
  @IsBoolean()
  @IsOptional()
  activo?: boolean;

  @ApiPropertyOptional({ example: 'Notas adicionales sobre el proveedor', description: 'Notas opcionales' })
  @IsString()
  @IsOptional()
  notas?: string;

  @ApiPropertyOptional({ example: ['507f1f77bcf86cd799439011', '507f191e810c19729de860ea'], description: 'Lista de IDs de productos suministrados', type: [String] })
  @IsArray()
  @IsOptional()
  @IsMongoId({ each: true })
  productosSuministrados?: string[];
}