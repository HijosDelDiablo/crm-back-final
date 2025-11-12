import { SetMetadata } from '@nestjs/common';
import { Rol } from '../enums/rol.enum';

// Esta es la clave que usaremos para guardar y leer los metadatos
export const ROLES_KEY = 'roles';

// Este es el decorador que se usará en los controladores:
// Ejemplo: @Roles(Rol.ADMIN, Rol.VENDEDOR)
export const Roles = (...roles: Rol[]) => SetMetadata(ROLES_KEY, roles);