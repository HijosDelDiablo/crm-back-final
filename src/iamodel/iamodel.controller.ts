import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { IamodelService } from './iamodel.service';
import { IaQueryDto } from './dto/ia-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import type { ValidatedUser } from '../user/schemas/user.schema';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Rol } from '../auth/enums/rol.enum';

@Controller('iamodel')
@UseGuards(JwtAuthGuard, RolesGuard)
export class IamodelController {
  constructor(private readonly iamodelService: IamodelService) {}

  @Post('query')
  @Roles(Rol.VENDEDOR, Rol.ADMIN, Rol.CLIENTE)
  async query(@Body() dto: IaQueryDto, @GetUser() user: ValidatedUser) {
    return this.iamodelService.processQuery(dto.prompt, user._id);
  }
}