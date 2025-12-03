import {
  Controller,
  Post,
  Body,
  UseGuards,
  Get,
  Patch,
  Param,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  ForbiddenException,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { CotizacionService } from './cotizacion.service';
import {
  CreateCotizacionDto,
  UpdateCotizacionStatusDto,
  UpdateNotasVendedorDto
} from './dto/cotizacion.dto';
import { VendedorCreateCotizacionDto } from './dto/vendedor-cotizacion.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Rol } from '../auth/enums/rol.enum';
import { GetUser } from '../auth/decorators/get-user.decorator';
import type { ValidatedUser } from '../user/schemas/user.schema';

@ApiTags('Cotizaciones')
@Controller('cotizaciones')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class CotizacionController {
  constructor(private readonly cotizacionService: CotizacionService) { }

  @Post()
  @Roles(Rol.CLIENTE)
  @ApiOperation({
    summary: 'Generar cotización (Cliente)',
    description: `
    Permite a un cliente generar una cotización para un vehículo específico.
    
    **Cálculo financiero:**
    - Tasa de interés anual: 15%
    - Pago mensual = (montoAFinanciar * tasaMensual * (1 + tasaMensual)^plazo) / ((1 + tasaMensual)^plazo - 1)
    - Monto a financiar = precioCoche - enganche
    - Total pagado = pagoMensual * plazoMeses + enganche
    
    **Validaciones:**
    - El enganche debe ser menor al precio del coche
    - El coche debe existir y estar disponible
    - Usuario debe tener rol CLIENTE
    
    **Notificaciones:**
    - Se envía email de confirmación al cliente (si no está deshabilitado)
    `
  })
  @ApiResponse({
    status: 201,
    description: 'Cotización generada exitosamente',
    schema: {
      example: {
        "_id": "507f1f77bcf86cd799439011",
        "cliente": "507f1f77bcf86cd799439012",
        "coche": "507f1f77bcf86cd799439013",
        "precioCoche": 25000,
        "enganche": 5000,
        "plazoMeses": 36,
        "tasaInteres": 0.15,
        "pagoMensual": 687.5,
        "montoFinanciado": 20000,
        "totalPagado": 27250,
        "status": "Pendiente",
        "createdAt": "2025-12-03T08:00:00.000Z"
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Datos inválidos o enganche >= precio' })
  @ApiResponse({ status: 404, description: 'Coche no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  @ApiBody({ type: CreateCotizacionDto })
  @HttpCode(HttpStatus.CREATED)
  async generarCotizacionCliente(
    @Body() dto: CreateCotizacionDto,
    @GetUser() user: ValidatedUser,
  ) {
    return await this.cotizacionService.generarCotizacionCliente(
      user,
      dto.cocheId,
      dto.enganche,
      dto.plazoMeses,
    );
  }

  @Get('aprobadas-cliente')
  @Roles(Rol.CLIENTE)
  @ApiOperation({
    summary: 'Obtener cotizaciones aprobadas del cliente logueado',
    description: 'Retorna todas las cotizaciones aprobadas del cliente autenticado, incluyendo información del coche.'
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de cotizaciones aprobadas',
    schema: {
      example: [
        {
          "_id": "507f1f77bcf86cd799439011",
          "cliente": {
            "_id": "507f1f77bcf86cd799439012",
            "nombre": "Juan Pérez",
            "email": "juan@email.com"
          },
          "coche": {
            "_id": "507f1f77bcf86cd799439013",
            "marca": "Toyota",
            "modelo": "Corolla",
            "ano": 2022,
            "precioBase": 25000,
            "imageUrl": "https://example.com/image.jpg"
          },
          "precioCoche": 25000,
          "enganche": 5000,
          "plazoMeses": 36,
          "pagoMensual": 687.5,
          "totalPagado": 27250,
          "status": "Aprobada"
        }
      ]
    }
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async getCotizacionesAprobadasCliente(
    @GetUser() user: ValidatedUser,
  ) {
    return await this.cotizacionService.getCotizacionesAprobadasCliente(user._id);
  }

  @ApiOperation({
    summary: 'Obtener cotizaciones aprobadas de un cliente (Cliente/Admin)',
    description: 'Retorna las cotizaciones aprobadas de un cliente específico. Los clientes solo pueden ver sus propias cotizaciones.'
  })
  @ApiParam({ name: 'clienteId', description: 'ID del cliente' })
  @ApiResponse({
    status: 200,
    description: 'Lista de cotizaciones aprobadas del cliente',
    schema: {
      example: [
        {
          "_id": "507f1f77bcf86cd799439011",
          "cliente": {
            "_id": "507f1f77bcf86cd799439012",
            "nombre": "Juan Pérez",
            "email": "juan@email.com"
          },
          "coche": {
            "_id": "507f1f77bcf86cd799439013",
            "marca": "Toyota",
            "modelo": "Corolla",
            "ano": 2022,
            "precioBase": 25000,
            "imageUrl": "https://example.com/image.jpg"
          },
          "precioCoche": 25000,
          "enganche": 5000,
          "plazoMeses": 36,
          "pagoMensual": 687.5,
          "totalPagado": 27250,
          "status": "Aprobada"
        }
      ]
    }
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  @ApiResponse({ status: 403, description: 'No tienes permiso para ver las cotizaciones de este cliente' })
  @Get('aprobadas/:clienteId')
  @UseGuards(RolesGuard)
  @Roles(Rol.CLIENTE, Rol.ADMIN)
  async getCotizacionesAprobadasPorClienteId(
    @Param('clienteId') clienteId: string,
    @GetUser() user: ValidatedUser,
  ) {
    // Validar que el cliente solo pueda ver sus propias cotizaciones
    if (user.rol === Rol.CLIENTE && user._id.toString() !== clienteId) {
      throw new ForbiddenException('No tienes permiso para ver las cotizaciones de este cliente');
    }
    return await this.cotizacionService.getCotizacionesAprobadasCliente(clienteId);
  }

  @ApiOperation({
    summary: 'Obtener mis cotizaciones (Cliente)',
    description: `
    Retorna todas las cotizaciones del cliente autenticado.
    
    **Filtros opcionales:**
    - status: Filtrar por estado (Pendiente, Aprobada, Rechazada)
    
    **Ejemplos de uso:**
    - GET /cotizacion/mis-cotizaciones (todas)
    - GET /cotizacion/mis-cotizaciones?status=Aprobada (solo aprobadas)
    `
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de cotizaciones del cliente',
    schema: {
      example: [
        {
          "_id": "507f1f77bcf86cd799439011",
          "cliente": {
            "_id": "507f1f77bcf86cd799439012",
            "nombre": "Juan Pérez",
            "email": "juan@email.com"
          },
          "coche": {
            "_id": "507f1f77bcf86cd799439013",
            "marca": "Toyota",
            "modelo": "Corolla",
            "ano": 2022,
            "precioBase": 25000
          },
          "precioCoche": 25000,
          "enganche": 5000,
          "plazoMeses": 36,
          "pagoMensual": 687.5,
          "totalPagado": 27250,
          "status": "Pendiente",
          "createdAt": "2024-01-15T10:30:00.000Z"
        }
      ]
    }
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  @Get('mis-cotizaciones')
  @UseGuards(RolesGuard)
  @Roles(Rol.CLIENTE)
  async getMisCotizaciones(
    @GetUser() user: ValidatedUser,
    @Query('status') status?: string
  ) {
    return await this.cotizacionService.getMisCotizaciones(user, status);
  }

  @ApiOperation({
    summary: 'Obtener cotización por ID (Cliente/Admin)',
    description: `
    Retorna los detalles completos de una cotización específica.
    
    **Permisos:**
    - Cliente: Solo puede ver sus propias cotizaciones
    - Admin: Puede ver cualquier cotización
    
    **Datos incluidos:**
    - Información completa del coche
    - Datos del cliente y vendedor
    - Información financiera (enganche, pagos, etc.)
    - Estado actual
    `
  })
  @ApiParam({ name: 'id', description: 'ID de la cotización' })
  @ApiResponse({
    status: 200,
    description: 'Detalles de la cotización',
    schema: {
      example: {
        "_id": "507f1f77bcf86cd799439011",
        "cliente": {
          "_id": "507f1f77bcf86cd799439012",
          "nombre": "Juan Pérez",
          "email": "juan@email.com",
          "telefono": "555-1234"
        },
        "coche": {
          "_id": "507f1f77bcf86cd799439013",
          "marca": "Toyota",
          "modelo": "Corolla",
          "ano": 2022,
          "precioBase": 25000,
          "imageUrl": "/uploads/file-1705320000000-123456789.jpg",
          "condicion": "Nuevo",
          "transmision": "Automática",
          "kilometraje": 0
        },
        "vendedor": {
          "_id": "507f1f77bcf86cd799439014",
          "nombre": "María García"
        },
        "precioCoche": 25000,
        "enganche": 5000,
        "plazoMeses": 36,
        "pagoMensual": 687.5,
        "totalPagado": 27250,
        "status": "Aprobada",
        "notasVendedor": "Cliente interesado en financiar",
        "createdAt": "2024-01-15T10:30:00.000Z",
        "updatedAt": "2024-01-15T12:00:00.000Z"
      }
    }
  })
  @ApiOperation({
    summary: 'Obtener todas las cotizaciones (Vendedor/Admin)',
    description: 'Retorna todas las cotizaciones del sistema. Para vendedores, incluye solo las asignadas a ellos; para admins, incluye todas.'
  })
  @ApiResponse({
    status: 200,
    description: 'Lista completa de cotizaciones',
    schema: {
      example: [
        {
          "_id": "507f1f77bcf86cd799439011",
          "cliente": {
            "_id": "507f1f77bcf86cd799439012",
            "nombre": "Juan Pérez",
            "email": "juan@email.com"
          },
          "coche": {
            "_id": "507f1f77bcf86cd799439013",
            "marca": "Toyota",
            "modelo": "Corolla",
            "ano": 2022,
            "precioBase": 25000
          },
          "precioCoche": 25000,
          "enganche": 5000,
          "plazoMeses": 36,
          "pagoMensual": 687.5,
          "totalPagado": 27250,
          "status": "Pendiente",
          "vendedor": {
            "_id": "507f1f77bcf86cd799439014",
            "nombre": "María García"
          }
        }
      ]
    }
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  @ApiResponse({ status: 403, description: 'Rol insuficiente' })
  @Get('all')
  @UseGuards(RolesGuard)
  @Roles(Rol.VENDEDOR, Rol.ADMIN)
  getCotizaciones() {
    return this.cotizacionService.getCotizacionesAll();
  }

  @ApiResponse({ status: 403, description: 'No tienes permiso para ver esta cotización' })
  @ApiResponse({ status: 404, description: 'Cotización no encontrada' })
  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles(Rol.CLIENTE, Rol.ADMIN, Rol.VENDEDOR)
  async getCotizacionById(
    @Param('id') id: string,
    @GetUser() user: ValidatedUser
  ) {
    return await this.cotizacionService.getCotizacionById(id, user);
  }

  @Post('vendedor-create')
  @Roles(Rol.VENDEDOR)
  @ApiOperation({
    summary: 'Generar cotización (Vendedor)',
    description: `
    Permite a un vendedor generar una cotización para un cliente específico.
    
    **Diferencias con cliente:**
    - Requiere especificar clienteId y vendedorId
    - No requiere autenticación del cliente
    - El vendedor queda asignado automáticamente
    
    **Validaciones:**
    - Cliente debe existir
    - Coche debe existir
    - Usuario debe tener rol VENDEDOR
    `
  })
  @ApiResponse({
    status: 201,
    description: 'Cotización generada exitosamente',
    schema: {
      example: {
        "_id": "507f1f77bcf86cd799439011",
        "cliente": "507f1f77bcf86cd799439012",
        "vendedor": "507f1f77bcf86cd799439014",
        "coche": "507f1f77bcf86cd799439013",
        "precioCoche": 25000,
        "enganche": 5000,
        "plazoMeses": 36,
        "pagoMensual": 687.5,
        "totalPagado": 27250,
        "status": "Pendiente"
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 404, description: 'Cliente o coche no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  @ApiBody({ type: VendedorCreateCotizacionDto })
  @HttpCode(HttpStatus.CREATED)
  async vendedorGenerarCotizacion(
    @Body() dto: VendedorCreateCotizacionDto,
  ) {
    return await this.cotizacionService.vendedorGenerarCotizacion(dto);
  }

  @Get('pendientes')
  @UseGuards(RolesGuard)
  @Roles(Rol.VENDEDOR, Rol.ADMIN)
  @ApiOperation({
    summary: 'Obtener cotizaciones pendientes (Vendedor/Admin)',
    description: 'Retorna todas las cotizaciones con status "Pendiente" asignadas al vendedor logueado (o todas si es admin).'
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de cotizaciones pendientes',
    schema: {
      example: [
        {
          "_id": "507f1f77bcf86cd799439011",
          "cliente": {
            "_id": "507f1f77bcf86cd799439012",
            "nombre": "Juan Pérez",
            "email": "juan@email.com",
            "telefono": "555-1234"
          },
          "coche": {
            "_id": "507f1f77bcf86cd799439013",
            "marca": "Toyota",
            "modelo": "Corolla",
            "ano": 2022,
            "precioBase": 25000
          },
          "precioCoche": 25000,
          "enganche": 5000,
          "plazoMeses": 36,
          "pagoMensual": 687.5,
          "status": "Pendiente"
        }
      ]
    }
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  @ApiResponse({ status: 403, description: 'Rol insuficiente' })
  getCotizacionesPendientes(
    @GetUser() user: ValidatedUser,
  ) {
    return this.cotizacionService.getCotizacionesPendientes(user);
  }

  @ApiOperation({
    summary: 'Obtener cotizaciones aprobadas (Vendedor/Admin)',
    description: 'Retorna todas las cotizaciones con status "Aprobada".'
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de cotizaciones aprobadas',
    schema: {
      example: [
        {
          "_id": "507f1f77bcf86cd799439011",
          "cliente": {
            "_id": "507f1f77bcf86cd799439012",
            "nombre": "Juan Pérez",
            "email": "juan@email.com"
          },
          "coche": {
            "_id": "507f1f77bcf86cd799439013",
            "marca": "Toyota",
            "modelo": "Corolla",
            "ano": 2022,
            "precioBase": 25000
          },
          "status": "Aprobada",
          "vendedor": {
            "_id": "507f1f77bcf86cd799439014",
            "nombre": "María García",
            "email": "maria@email.com"
          }
        }
      ]
    }
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  @ApiResponse({ status: 403, description: 'Rol insuficiente' })
  @Get('aprobadas')
  @Roles(Rol.VENDEDOR, Rol.ADMIN)
  async getCotizacionesAprovadas() {
    return await this.cotizacionService.getCotizacionesAprovadas();
  }

  @ApiOperation({
    summary: 'Obtener todas las cotizaciones (Vendedor/Admin)',
    description: 'Retorna todas las cotizaciones del sistema. Para vendedores, incluye solo las asignadas a ellos; para admins, incluye todas.'
  })
  @ApiResponse({
    status: 200,
    description: 'Lista completa de cotizaciones',
    schema: {
      example: [
        {
          "_id": "507f1f77bcf86cd799439011",
          "cliente": {
            "_id": "507f1f77bcf86cd799439012",
            "nombre": "Juan Pérez",
            "email": "juan@email.com"
          },
          "coche": {
            "_id": "507f1f77bcf86cd799439013",
            "marca": "Toyota",
            "modelo": "Corolla",
            "ano": 2022,
            "precioBase": 25000
          },
          "precioCoche": 25000,
          "enganche": 5000,
          "plazoMeses": 36,
          "pagoMensual": 687.5,
          "totalPagado": 27250,
          "status": "Pendiente",
          "vendedor": {
            "_id": "507f1f77bcf86cd799439014",
            "nombre": "María García"
          }
        }
      ]
    }
  })

  @ApiOperation({
    summary: 'Actualizar estado de cotización (Vendedor/Admin)',
    description: `
    Permite cambiar el estado de una cotización entre: Pendiente, Aprobada, Rechazada.
    
    **Validaciones:**
    - Solo el vendedor asignado o admin puede cambiar el estado
    - Estado debe ser uno de los valores permitidos
    - Si se aprueba, se envía email de confirmación al cliente
    - Si se rechaza, se envía email de rechazo al cliente
    `
  })
  @ApiParam({ name: 'id', description: 'ID de la cotización a actualizar' })
  @ApiBody({
    type: UpdateCotizacionStatusDto,
    description: 'Nuevo estado para la cotización',
    examples: {
      'aprobar': {
        summary: 'Aprobar cotización',
        value: { status: 'Aprobada' }
      },
      'rechazar': {
        summary: 'Rechazar cotización',
        value: { status: 'Rechazada' }
      }
    }
  })
  @ApiResponse({
    status: 200,
    description: 'Estado actualizado exitosamente',
    schema: {
      example: {
        "_id": "507f1f77bcf86cd799439011",
        "status": "Aprobada",
        "updatedAt": "2024-01-15T10:30:00.000Z"
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Estado inválido' })
  @ApiResponse({ status: 403, description: 'No autorizado para modificar esta cotización' })
  @ApiResponse({ status: 404, description: 'Cotización no encontrada' })
  @Patch(':id/status')
  @Roles(Rol.VENDEDOR, Rol.ADMIN)
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateCotizacionStatusDto,
    @GetUser() user: ValidatedUser,
  ) {
    return await this.cotizacionService.updateCotizacionStatus(
      id,
      user,
      dto.status
    );
  }

  @ApiOperation({
    summary: 'Actualizar notas del vendedor (Vendedor/Admin)',
    description: `
    Permite al vendedor o admin agregar notas internas a una cotización.
    
    **Uso típico:**
    - Agregar observaciones sobre el cliente
    - Registrar seguimientos realizados
    - Documentar condiciones especiales
    - Notas de negociación
    `
  })
  @ApiParam({ name: 'id', description: 'ID de la cotización' })
  @ApiBody({
    type: UpdateNotasVendedorDto,
    description: 'Notas del vendedor',
    examples: {
      'notas': {
        summary: 'Agregar notas',
        value: { notasVendedor: 'Cliente interesado en financiar. Llamar mañana para seguimiento.' }
      }
    }
  })
  @ApiResponse({
    status: 200,
    description: 'Notas actualizadas exitosamente',
    schema: {
      example: {
        "_id": "507f1f77bcf86cd799439011",
        "notasVendedor": "Cliente interesado en financiar. Llamar mañana para seguimiento.",
        "updatedAt": "2024-01-15T10:30:00.000Z"
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 404, description: 'Cotización no encontrada' })
  @Patch(':id/notas')
  @Roles(Rol.VENDEDOR, Rol.ADMIN)
  async updateNotas(
    @Param('id') id: string,
    @Body() dto: UpdateNotasVendedorDto,
  ) {
    return await this.cotizacionService.updateNotasVendedor(
      id,
      dto.notasVendedor || ''
    );
  }
  @ApiOperation({
    summary: 'Asignar vendedor a cotización (Admin)',
    description: `
    Permite a un administrador asignar un vendedor específico a una cotización existente.
    
    **Validaciones:**
    - Solo administradores pueden asignar vendedores
    - El vendedor debe existir en el sistema
    - La cotización debe existir
    - Útil para reasignar cotizaciones o asignar vendedores a cotizaciones creadas por clientes
    `
  })
  @ApiParam({ name: 'idPricing', description: 'ID de la cotización' })
  @ApiParam({ name: 'idSeller', description: 'ID del vendedor a asignar' })
  @ApiResponse({
    status: 200,
    description: 'Vendedor asignado exitosamente',
    schema: {
      example: {
        "_id": "507f1f77bcf86cd799439011",
        "vendedor": {
          "_id": "507f1f77bcf86cd799439014",
          "nombre": "María García",
          "email": "maria@email.com"
        },
        "updatedAt": "2024-01-15T10:30:00.000Z"
      }
    }
  })
  @ApiResponse({ status: 403, description: 'Solo administradores pueden asignar vendedores' })
  @ApiResponse({ status: 404, description: 'Cotización o vendedor no encontrado' })
  @Patch(':idPricing/set-seller-to-pricing/:idSeller')
  @UseGuards(RolesGuard)
  @Roles(Rol.ADMIN)
  setSellerToPricing(
    @Param('idPricing') idPricing: string,
    @Param('idSeller') idSeller: string,
  ) {
    return this.cotizacionService.setSellerToPricing(idPricing, idSeller);
  }
}
