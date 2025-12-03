import {
  Controller,
  Post,
  Body,
  UseGuards,
  Get,
  Patch,
  Param,
  Query,
  Req
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { CompraService } from './compra.service';
import { CreateCompraDto } from './dto/create-compra.dto';
import { AprobarCompraDto } from './dto/approval.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Rol } from '../auth/enums/rol.enum';
import { GetUser } from '../auth/decorators/get-user.decorator';
import type { ValidatedUser } from '../user/schemas/user.schema';
import { ForbiddenException } from '@nestjs/common';

@ApiTags('Compras')
@Controller('compra')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CompraController {
  constructor(private readonly compraService: CompraService) { }

  @ApiOperation({
    summary: 'Iniciar proceso de compra (Cliente)',
    description: `
    Permite a un cliente iniciar el proceso de compra de un vehículo.
    
    **Proceso:**
    1. Se valida que la cotización esté aprobada
    2. Se crea el registro de compra con status "Pendiente"
    3. Se asigna automáticamente el vendedor de la cotización
    4. El vendedor podrá evaluar el financiamiento posteriormente
    
    **Validaciones:**
    - Usuario debe tener rol CLIENTE
    - La cotización debe existir y estar aprobada
    - No debe existir una compra activa para esa cotización
    `
  })
  @ApiBody({
    type: CreateCompraDto,
    description: 'Datos para iniciar la compra',
    examples: {
      'compra_basica': {
        summary: 'Compra básica',
        value: {
          cotizacionId: "507f1f77bcf86cd799439011"
        }
      }
    }
  })
  @ApiResponse({
    status: 201,
    description: 'Proceso de compra iniciado exitosamente',
    schema: {
      example: {
        "_id": "507f1f77bcf86cd799439015",
        "cliente": "507f1f77bcf86cd799439012",
        "cotizacion": "507f1f77bcf86cd799439011",
        "vendedor": "507f1f77bcf86cd799439014",
        "status": "Pendiente",
        "createdAt": "2024-01-15T10:30:00.000Z"
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Datos inválidos o cotización no aprobada' })
  @ApiResponse({ status: 404, description: 'Cotización no encontrada' })
  @ApiResponse({ status: 409, description: 'Ya existe una compra activa para esta cotización' })
  @Post()
  @UseGuards(RolesGuard)
  @Roles(Rol.CLIENTE)
  iniciarProcesoCompra(
    @Body() createCompraDto: CreateCompraDto,
    @GetUser() user: ValidatedUser,
  ) {
    return this.compraService.iniciarProcesoCompra(user, createCompraDto);
  }

  @ApiOperation({
    summary: 'Obtener mis compras (Cliente)',
    description: 'Retorna todas las compras realizadas por el cliente autenticado, incluyendo su historial completo de procesos de compra.'
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de compras del cliente',
    schema: {
      example: [
        {
          "_id": "507f1f77bcf86cd799439015",
          "cliente": {
            "_id": "507f1f77bcf86cd799439012",
            "nombre": "Juan Pérez",
            "email": "juan@email.com"
          },
          "cotizacion": {
            "_id": "507f1f77bcf86cd799439011",
            "coche": {
              "marca": "Toyota",
              "modelo": "Corolla",
              "ano": 2022
            },
            "precioCoche": 25000,
            "enganche": 5000
          },
          "vendedor": {
            "_id": "507f1f77bcf86cd799439014",
            "nombre": "María García"
          },
          "status": "En_Revision",
          "createdAt": "2024-01-15T10:30:00.000Z"
        }
      ]
    }
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  @Get('mis-compras')
  @UseGuards(RolesGuard)
  @Roles(Rol.CLIENTE)
  getMisCompras(@GetUser() user: ValidatedUser) {
    return this.compraService.getComprasPorCliente(user._id.toString());
  }

  @ApiOperation({
    summary: 'Obtener compras pendientes (Vendedor/Admin)',
    description: 'Retorna todas las compras que están en estado "Pendiente" y requieren evaluación inicial por parte del vendedor.'
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de compras pendientes',
    schema: {
      example: [
        {
          "_id": "507f1f77bcf86cd799439015",
          "cliente": {
            "_id": "507f1f77bcf86cd799439012",
            "nombre": "Juan Pérez",
            "email": "juan@email.com"
          },
          "cotizacion": {
            "_id": "507f1f77bcf86cd799439011",
            "coche": {
              "marca": "Toyota",
              "modelo": "Corolla",
              "ano": 2022,
              "precioBase": 25000
            },
            "precioCoche": 25000,
            "enganche": 5000,
            "plazoMeses": 36
          },
          "status": "Pendiente",
          "createdAt": "2024-01-15T10:30:00.000Z"
        }
      ]
    }
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  @ApiResponse({ status: 403, description: 'Rol insuficiente' })
  @Get('pendientes')
  @UseGuards(RolesGuard)
  @Roles(Rol.VENDEDOR, Rol.ADMIN)
  getComprasPendientes() {
    return this.compraService.getComprasPendientes();
  }

  @ApiOperation({
    summary: 'Obtener compras en revisión (Vendedor/Admin)',
    description: 'Retorna todas las compras que están siendo evaluadas por el departamento de financiamiento.'
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de compras en revisión',
    schema: {
      example: [
        {
          "_id": "507f1f77bcf86cd799439015",
          "cliente": {
            "_id": "507f1f77bcf86cd799439012",
            "nombre": "Juan Pérez",
            "email": "juan@email.com"
          },
          "cotizacion": {
            "_id": "507f1f77bcf86cd799439011",
            "coche": {
              "marca": "Toyota",
              "modelo": "Corolla",
              "ano": 2022
            },
            "precioCoche": 25000,
            "enganche": 5000
          },
          "status": "En_Revision",
          "evaluadoPor": {
            "_id": "507f1f77bcf86cd799439014",
            "nombre": "María García"
          },
          "fechaEvaluacion": "2024-01-15T11:00:00.000Z"
        }
      ]
    }
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  @ApiResponse({ status: 403, description: 'Rol insuficiente' })
  @Get('en-revision')
  @UseGuards(RolesGuard)
  @Roles(Rol.VENDEDOR, Rol.ADMIN)
  getComprasEnRevision() {
    return this.compraService.getComprasEnRevision();
  }

  @ApiOperation({
    summary: 'Obtener compras aprobadas (Vendedor/Admin)',
    description: 'Retorna todas las compras que han sido aprobadas y están listas para finalizar el proceso de venta.'
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de compras aprobadas',
    schema: {
      example: [
        {
          "_id": "507f1f77bcf86cd799439015",
          "cliente": {
            "_id": "507f1f77bcf86cd799439012",
            "nombre": "Juan Pérez",
            "email": "juan@email.com"
          },
          "cotizacion": {
            "_id": "507f1f77bcf86cd799439011",
            "coche": {
              "marca": "Toyota",
              "modelo": "Corolla",
              "ano": 2022
            },
            "precioCoche": 25000,
            "enganche": 5000
          },
          "status": "Aprobada",
          "aprobadaPor": {
            "_id": "507f1f77bcf86cd799439014",
            "nombre": "María García"
          },
          "fechaAprobacion": "2024-01-15T12:00:00.000Z",
          "notasAprobacion": "Cliente aprobado para financiamiento. Documentos completos."
        }
      ]
    }
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  @ApiResponse({ status: 403, description: 'Rol insuficiente' })
  @Get('aprobadas')
  @UseGuards(RolesGuard)
  @Roles(Rol.VENDEDOR, Rol.ADMIN)
  getComprasAprobadas() {
    return this.compraService.getComprasAprobadas();
  }

  @ApiOperation({
    summary: 'Obtener compra por cotización (Cliente/Admin)',
    description: `
    Retorna la compra asociada a una cotización específica.
    
    **Permisos:**
    - Cliente: Solo puede ver compras de sus propias cotizaciones
    - Admin: Puede ver cualquier compra
    
    **Uso típico:**
    - Desde el detalle de una cotización, obtener la compra relacionada para ver pagos
    `
  })
  @ApiParam({ name: 'cotizacionId', description: 'ID de la cotización' })
  @ApiResponse({
    status: 200,
    description: 'Compra encontrada',
    schema: {
      example: {
        "_id": "507f1f77bcf86cd799439015",
        "cliente": {
          "_id": "507f1f77bcf86cd799439012",
          "nombre": "Juan Pérez",
          "email": "juan@email.com"
        },
        "cotizacion": {
          "_id": "507f1f77bcf86cd799439011",
          "coche": {
            "marca": "Toyota",
            "modelo": "Corolla",
            "ano": 2022
          }
        },
        "vendedor": {
          "_id": "507f1f77bcf86cd799439014",
          "nombre": "María García"
        },
        "status": "Aprobada",
        "saldoPendiente": 22250,
        "fechaAprobacion": "2024-01-15T12:00:00.000Z"
      }
    }
  })
  @ApiResponse({ status: 403, description: 'No tienes permiso para ver esta compra' })
  @ApiResponse({ status: 404, description: 'Compra no encontrada para esta cotización' })
  @Get('por-cotizacion/:cotizacionId')
  @UseGuards(RolesGuard)
  @Roles(Rol.CLIENTE, Rol.ADMIN)
  async getCompraPorCotizacion(
    @Param('cotizacionId') cotizacionId: string,
    @GetUser() user: ValidatedUser
  ) {
    return await this.compraService.getCompraPorCotizacion(cotizacionId, user);
  }

  @ApiOperation({
    summary: 'Evaluar financiamiento (Vendedor/Admin)',
    description: `
    Permite a un vendedor o admin evaluar la solicitud de financiamiento de una compra.
    
    **Proceso:**
    - Cambia el status de "Pendiente" a "En_Revision"
    - Registra quién realizó la evaluación
    - Marca la fecha de evaluación
    - Prepara la compra para aprobación final
    
    **Validaciones:**
    - La compra debe estar en status "Pendiente"
    - Solo vendedores o admins pueden evaluar
    `
  })
  @ApiParam({ name: 'id', description: 'ID de la compra a evaluar' })
  @ApiResponse({
    status: 200,
    description: 'Compra evaluada exitosamente',
    schema: {
      example: {
        "_id": "507f1f77bcf86cd799439015",
        "status": "En_Revision",
        "evaluadoPor": "507f1f77bcf86cd799439014",
        "fechaEvaluacion": "2024-01-15T11:00:00.000Z",
        "updatedAt": "2024-01-15T11:00:00.000Z"
      }
    }
  })
  @ApiResponse({ status: 400, description: 'La compra no está en estado pendiente' })
  @ApiResponse({ status: 404, description: 'Compra no encontrada' })
  @ApiResponse({ status: 403, description: 'No autorizado para evaluar esta compra' })
  @Patch(':id/evaluar')
  @UseGuards(RolesGuard)
  @Roles(Rol.VENDEDOR, Rol.ADMIN)
  evaluarFinanciamiento(
    @Param('id') compraId: string,
    @GetUser() user: ValidatedUser,
  ) {
    return this.compraService.evaluarFinanciamiento(compraId, user);
  }

  @ApiOperation({
    summary: 'Aprobar compra (Vendedor/Admin)',
    description: `
    Aprueba definitivamente una compra que ha sido evaluada.
    
    **Proceso:**
    - Cambia el status a "Aprobada"
    - Registra quién aprobó y cuándo
    - Permite agregar notas de aprobación
    - La compra queda lista para finalización
    
    **Validaciones:**
    - La compra debe estar en status "En_Revision"
    - Solo vendedores o admins pueden aprobar
    `
  })
  @ApiParam({ name: 'id', description: 'ID de la compra a aprobar' })
  @ApiBody({
    type: AprobarCompraDto,
    description: 'Datos de aprobación',
    examples: {
      'aprobacion_basica': {
        summary: 'Aprobación básica',
        value: {
          notasAprobacion: "Cliente aprobado. Documentos verificados."
        }
      }
    }
  })
  @ApiResponse({
    status: 200,
    description: 'Compra aprobada exitosamente',
    schema: {
      example: {
        "_id": "507f1f77bcf86cd799439015",
        "status": "Aprobada",
        "aprobadaPor": "507f1f77bcf86cd799439014",
        "fechaAprobacion": "2024-01-15T12:00:00.000Z",
        "notasAprobacion": "Cliente aprobado. Documentos verificados.",
        "updatedAt": "2024-01-15T12:00:00.000Z"
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Datos inválidos o compra no está en revisión' })
  @ApiResponse({ status: 404, description: 'Compra no encontrada' })
  @ApiResponse({ status: 403, description: 'No autorizado para aprobar esta compra' })
  @Patch(':id/aprobar')
  @UseGuards(RolesGuard)
  @Roles(Rol.VENDEDOR, Rol.ADMIN)
  aprobarCompra(
    @Param('id') compraId: string,
    @Body() aprobarCompraDto: AprobarCompraDto,
    @GetUser() user: ValidatedUser,
  ) {
    return this.compraService.aprobarCompra(compraId, aprobarCompraDto, user);
  }

  @ApiOperation({
    summary: 'Obtener compra por ID',
    description: 'Retorna los detalles completos de una compra específica por su ID.'
  })
  @ApiParam({ name: 'id', description: 'ID de la compra' })
  @ApiResponse({
    status: 200,
    description: 'Detalles de la compra',
    schema: {
      example: {
        "_id": "507f1f77bcf86cd799439015",
        "cliente": {
          "_id": "507f1f77bcf86cd799439012",
          "nombre": "Juan Pérez",
          "email": "juan@email.com",
          "telefono": "555-1234"
        },
        "cotizacion": {
          "_id": "507f1f77bcf86cd799439011",
          "coche": {
            "marca": "Toyota",
            "modelo": "Corolla",
            "ano": 2022,
            "precioBase": 25000,
            "imageUrl": "https://example.com/image.jpg"
          },
          "precioCoche": 25000,
          "enganche": 5000,
          "plazoMeses": 36,
          "pagoMensual": 687.5
        },
        "vendedor": {
          "_id": "507f1f77bcf86cd799439014",
          "nombre": "María García",
          "email": "maria@email.com"
        },
        "status": "En_Revision",
        "evaluadoPor": "507f1f77bcf86cd799439014",
        "fechaEvaluacion": "2024-01-15T11:00:00.000Z",
        "createdAt": "2024-01-15T10:30:00.000Z",
        "updatedAt": "2024-01-15T11:00:00.000Z"
      }
    }
  })
  @ApiResponse({ status: 404, description: 'Compra no encontrada' })
  @Get(':id')
  getCompraById(@Param('id') compraId: string) {
    return this.compraService.getCompraById(compraId);
  }

  @ApiOperation({
    summary: 'Obtener compras por cliente (Admin/Cliente)',
    description: `
    Retorna todas las compras de un cliente específico.
    
    **Permisos:**
    - Admin: Puede ver compras de cualquier cliente
    - Cliente: Solo puede ver sus propias compras
    
    **Validaciones:**
    - Si es cliente, el clienteId debe coincidir con el usuario autenticado
    `
  })
  @ApiParam({ name: 'clienteId', description: 'ID del cliente' })
  @ApiResponse({
    status: 200,
    description: 'Lista de compras del cliente',
    schema: {
      example: [
        {
          "_id": "507f1f77bcf86cd799439015",
          "cliente": "507f1f77bcf86cd799439012",
          "cotizacion": {
            "_id": "507f1f77bcf86cd799439011",
            "coche": {
              "marca": "Toyota",
              "modelo": "Corolla",
              "ano": 2022
            }
          },
          "status": "Aprobada",
          "createdAt": "2024-01-15T10:30:00.000Z"
        }
      ]
    }
  })
  @ApiResponse({ status: 403, description: 'No tienes permiso para ver las compras de este cliente' })
  @ApiResponse({ status: 404, description: 'Cliente no encontrado' })
  @Get('por-cliente/:clienteId')
  @UseGuards(RolesGuard)
  @Roles(Rol.ADMIN, Rol.CLIENTE)
  async getComprasPorCliente(
    @Param('clienteId') clienteId: string,
    @Req() req: any,
  ) {
    const usuarioActual: ValidatedUser = req.user;
    if (usuarioActual.rol === Rol.CLIENTE && usuarioActual._id.toString() !== clienteId) {
      throw new ForbiddenException('No tienes permiso para ver las compras de este cliente');
    }
    return this.compraService.findByClienteId(clienteId);
  }

  @ApiOperation({
    summary: 'Obtener compras por vendedor (Admin/Vendedor)',
    description: `
    Retorna todas las compras asignadas a un vendedor específico.
    
    **Permisos:**
    - Admin: Puede ver compras de cualquier vendedor
    - Vendedor: Solo puede ver sus propias compras asignadas
    
    **Validaciones:**
    - Si es vendedor, el vendedorId debe coincidir con el usuario autenticado
    `
  })
  @ApiParam({ name: 'vendedorId', description: 'ID del vendedor' })
  @ApiResponse({
    status: 200,
    description: 'Lista de compras del vendedor',
    schema: {
      example: [
        {
          "_id": "507f1f77bcf86cd799439015",
          "cliente": {
            "_id": "507f1f77bcf86cd799439012",
            "nombre": "Juan Pérez"
          },
          "cotizacion": {
            "_id": "507f1f77bcf86cd799439011",
            "coche": {
              "marca": "Toyota",
              "modelo": "Corolla",
              "ano": 2022
            }
          },
          "vendedor": "507f1f77bcf86cd799439014",
          "status": "En_Revision",
          "createdAt": "2024-01-15T10:30:00.000Z"
        }
      ]
    }
  })
  @ApiResponse({ status: 403, description: 'No tienes permiso para ver las compras de este vendedor' })
  @ApiResponse({ status: 404, description: 'Vendedor no encontrado' })
  @Get('por-vendedor/:vendedorId')
  @UseGuards(RolesGuard)
  @Roles(Rol.ADMIN, Rol.VENDEDOR)
  async getComprasPorVendedor(
    @Param('vendedorId') vendedorId: string,
    @Req() req: any,
  ) {
    const usuarioActual: ValidatedUser = req.user;
    if (usuarioActual.rol === Rol.VENDEDOR && usuarioActual._id.toString() !== vendedorId) {
      throw new ForbiddenException('No tienes permiso para ver las compras de este vendedor');
    }
    return this.compraService.findByVendedorId(vendedorId);
  }
}