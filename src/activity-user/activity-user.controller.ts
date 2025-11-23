import { Controller, Post, UseGuards } from '@nestjs/common';
import { GetUser } from './../auth/decorators/get-user.decorator';
import { type ValidatedUser } from '../user/schemas/user.schema';
import { ActivityUserService } from './activity-user.service';
import { JwtAuthGuard } from './../auth/guards/jwt-auth.guard';
import { RolesGuard } from './../auth/guards/roles.guard';
import { Rol } from '../auth/enums/rol.enum';
import { Roles } from '../auth/decorators/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Rol.ADMIN, Rol.CLIENTE, Rol.VENDEDOR)
@Controller('activity-user')
export class ActivityUserController {
    constructor(private readonly activityService: ActivityUserService) {}

@Post()
  async heartbeat(@GetUser() user: ValidatedUser) {
    return this.activityService.registerHeartbeat(user);
  }
}