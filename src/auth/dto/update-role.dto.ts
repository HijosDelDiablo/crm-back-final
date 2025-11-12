import { IsEnum, IsString, IsNotEmpty } from 'class-validator';
import { Rol } from '../enums/rol.enum';

export class UpdateRoleDto {
  @IsString()
  @IsNotEmpty()
  @IsEnum(Rol)
  rol: Rol;
}