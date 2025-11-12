import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { Rol } from '../enums/rol.enum';
import { type ValidatedUser } from '../../user/schemas/user.schema';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Rol[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user: ValidatedUser = request.user;

    if (!user || !user.rol) {
      throw new ForbiddenException('No tienes permiso para acceder a este recurso.');
    }

    const tienePermiso = requiredRoles.some((role) => user.rol === role);

    if (tienePermiso) {
      return true;
    }

    throw new ForbiddenException(
      `No tienes permiso. Se requiere uno de los siguientes roles: ${requiredRoles.join(', ')}`,
    );
  }
}