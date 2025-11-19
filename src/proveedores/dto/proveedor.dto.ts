import { 
  IsString, 
  IsNotEmpty, 
  IsEmail, 
  IsBoolean, 
  IsOptional, 
  IsArray,
  IsMongoId 
} from 'class-validator';

export class CreateProveedorDto {
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @IsString()
  @IsNotEmpty()
  contacto: string;

  @IsString()
  @IsNotEmpty()
  telefono: string;

  @IsString()
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  direccion: string;

  @IsString()
  @IsNotEmpty()
  rfc: string;

  @IsString()
  @IsOptional()
  notas?: string;

  @IsArray()
  @IsOptional()
  @IsMongoId({ each: true }) // Validar que cada elemento sea un ObjectId válido
  productosSuministrados?: string[];
}

export class UpdateProveedorDto {
  @IsString()
  @IsOptional()
  nombre?: string;

  @IsString()
  @IsOptional()
  contacto?: string;

  @IsString()
  @IsOptional()
  telefono?: string;

  @IsString()
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsString()
  @IsOptional()
  direccion?: string;

  @IsString()
  @IsOptional()
  rfc?: string;

  @IsBoolean()
  @IsOptional()
  activo?: boolean;

  @IsString()
  @IsOptional()
  notas?: string;

  @IsArray()
  @IsOptional()
  @IsMongoId({ each: true })
  productosSuministrados?: string[];
}