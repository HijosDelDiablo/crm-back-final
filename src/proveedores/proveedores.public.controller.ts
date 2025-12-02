import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ProveedoresService } from './proveedores.service';

@ApiTags('Proveedores')
@Controller('proveedores')
export class ProveedoresPublicController {
  constructor(private readonly proveedoresService: ProveedoresService) {}

  @Get('list')
  @ApiOperation({ summary: 'Get active proveedores (public)' })
  @ApiResponse({ status: 200, description: 'Return active proveedores' })
  // This endpoint is public (no auth) to allow front-end forms to fetch proveedores
  findActivePublic() {
    return this.proveedoresService.findActive();
  }
}
