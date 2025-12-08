import { Controller, Post, Body, Req, UseGuards, Get, Param, ForbiddenException } from '@nestjs/common';
import { PagoService } from './pago.service';
import { CompraService } from '../compra/compra.service';
import { ValidatedUser } from '../user/schemas/user.schema';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Rol } from '../auth/enums/rol.enum';
import { IsString, IsNumber, IsOptional, IsPositive, IsNotEmpty } from 'class-validator';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiParam, ApiBearerAuth } from '@nestjs/swagger';

export class RegistrarPagoDto {
    @IsString()
    @IsNotEmpty()
    compraId: string;

    @IsNumber()
    @IsPositive()
    monto: number;

    @IsOptional()
    @IsString()
    metodoPago?: string;

    @IsOptional()
    @IsString()
    notas?: string;
}

@ApiTags('Pagos')
@Controller('pagos')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PagoController {
    constructor(
        private readonly pagoService: PagoService,
        private readonly compraService: CompraService,
    ) { }

    @ApiOperation({
        summary: 'Registrar pago (Vendedor/Admin)',
        description: `
        Permite registrar un pago para una compra específica.
        
        **Proceso:**
        - Valida que la compra exista y esté aprobada
        - Registra el pago con monto, método y notas
        - Actualiza el saldo pendiente de la compra
        
        **Validaciones:**
        - Solo vendedores o admins pueden registrar pagos
        - La compra debe existir y estar en estado válido
        - El monto debe ser positivo
        `
    })
    @ApiBody({
        type: RegistrarPagoDto,
        description: 'Datos del pago a registrar',
        examples: {
            'pago_enganche': {
                summary: 'Pago de enganche',
                value: {
                    compraId: "507f1f77bcf86cd799439015",
                    monto: 5000,
                    metodoPago: "Transferencia bancaria",
                    notas: "Pago inicial de enganche"
                }
            },
            'pago_mensual': {
                summary: 'Pago mensual',
                value: {
                    compraId: "507f1f77bcf86cd799439015",
                    monto: 687.50,
                    metodoPago: "Débito automático",
                    notas: "Pago mensual correspondiente a enero 2024"
                }
            }
        }
    })
    @ApiResponse({
        status: 201,
        description: 'Pago registrado exitosamente',
        schema: {
            example: {
                message: 'Pago registrado correctamente',
                pago: {
                    "_id": "507f1f77bcf86cd799439016",
                    "compra": "507f1f77bcf86cd799439015",
                    "monto": 5000,
                    "metodoPago": "Transferencia bancaria",
                    "notas": "Pago inicial de enganche",
                    "registradoPor": "507f1f77bcf86cd799439014",
                    "fechaPago": "2024-01-15T14:00:00.000Z",
                    "createdAt": "2024-01-15T14:00:00.000Z"
                }
            }
        }
    })
    @ApiResponse({ status: 400, description: 'Datos inválidos o compra no válida' })
    @ApiResponse({ status: 403, description: 'No autorizado para registrar pagos' })
    @ApiResponse({ status: 404, description: 'Compra no encontrada' })
    @Roles(Rol.VENDEDOR, Rol.ADMIN, Rol.CLIENTE)
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Post()
    async registrarPago(
        @Body() dto: RegistrarPagoDto,
        @Req() req: any,
    ) {
        const usuarioActual: ValidatedUser = req.user;
        const pago = await this.pagoService.registrarPago(dto, usuarioActual);
        return {
            message: 'Pago registrado correctamente',
            pago,
        };
    }

    @ApiOperation({
        summary: 'Obtener pagos por compra (Admin/Cliente/Vendedor)',
        description: `
        Retorna el historial completo de pagos de una compra específica.
        
        **Permisos:**
        - Admin: Puede ver pagos de cualquier compra
        - Cliente: Solo puede ver pagos de sus propias compras
        - Vendedor: Solo puede ver pagos de compras que le están asignadas
        
        **Validaciones:**
        - La compra debe existir
        - El usuario debe tener permisos para ver esa compra
        `
    })
    @ApiParam({ name: 'compraId', description: 'ID de la compra' })
    @ApiResponse({
        status: 200,
        description: 'Historial de pagos obtenido correctamente',
        schema: {
            example: {
                message: 'Historial de pagos obtenido correctamente',
                pagos: [
                    {
                        "_id": "507f1f77bcf86cd799439016",
                        "compra": "507f1f77bcf86cd799439015",
                        "monto": 5000,
                        "metodoPago": "Transferencia bancaria",
                        "notas": "Pago inicial de enganche",
                        "registradoPor": {
                            "_id": "507f1f77bcf86cd799439014",
                            "nombre": "María García"
                        },
                        "fechaPago": "2024-01-15T14:00:00.000Z",
                        "createdAt": "2024-01-15T14:00:00.000Z"
                    },
                    {
                        "_id": "507f1f77bcf86cd799439017",
                        "compra": "507f1f77bcf86cd799439015",
                        "monto": 687.50,
                        "metodoPago": "Débito automático",
                        "notas": "Pago mensual enero 2024",
                        "registradoPor": {
                            "_id": "507f1f77bcf86cd799439014",
                            "nombre": "María García"
                        },
                        "fechaPago": "2024-02-15T14:00:00.000Z",
                        "createdAt": "2024-02-15T14:00:00.000Z"
                    }
                ]
            }
        }
    })
    @ApiResponse({ status: 403, description: 'No tienes permiso para ver los pagos de esta compra' })
    @ApiResponse({ status: 404, description: 'Compra no encontrada' })
    @Roles(Rol.ADMIN, Rol.CLIENTE, Rol.VENDEDOR)
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Get('por-compra/:compraId')
    async getPagosPorCompra(
        @Param('compraId') compraId: string,
        @Req() req: any,
    ) {
        const usuarioActual: ValidatedUser = req.user;

        // Obtener la compra
        const compra = await this.compraService.findCompraById(compraId);

        // Validar permisos
        if (usuarioActual.rol === 'ADMIN') {
            // ADMIN puede ver cualquier compra
        } else if (usuarioActual.rol === 'CLIENTE') {
            if (compra.cliente._id.toString() !== usuarioActual._id.toString()) {
                throw new ForbiddenException('No tienes permiso para ver los pagos de esta compra');
            }
        } else if (usuarioActual.rol === 'VENDEDOR') {
            if (!compra.vendedor || compra.vendedor._id.toString() !== usuarioActual._id.toString()) {
                throw new ForbiddenException('No tienes permiso para ver los pagos de esta compra');
            }
        } else {
            throw new ForbiddenException('Rol no autorizado');
        }

        // Obtener los pagos
        const pagos = await this.pagoService.getPagosByCompraId(compraId);

        return {
            message: 'Historial de pagos obtenido correctamente',
            pagos,
        };
    }

    @ApiOperation({
        summary: 'Obtener mis pagos (Cliente)',
        description: 'Retorna todos los pagos realizados por el cliente autenticado en sus diferentes compras.'
    })
    @ApiResponse({
        status: 200,
        description: 'Lista de pagos del cliente',
        schema: {
            example: {
                total: 5,
                pagos: [
                    {
                        "_id": "507f1f77bcf86cd799439016",
                        "compra": {
                            "_id": "507f1f77bcf86cd799439015",
                            "cotizacion": {
                                "coche": {
                                    "marca": "Toyota",
                                    "modelo": "Corolla",
                                    "ano": 2022
                                }
                            }
                        },
                        "monto": 5000,
                        "metodoPago": "Transferencia bancaria",
                        "notas": "Pago inicial de enganche",
                        "fechaPago": "2024-01-15T14:00:00.000Z",
                        "createdAt": "2024-01-15T14:00:00.000Z"
                    },
                    {
                        "_id": "507f1f77bcf86cd799439017",
                        "compra": {
                            "_id": "507f1f77bcf86cd799439015",
                            "cotizacion": {
                                "coche": {
                                    "marca": "Toyota",
                                    "modelo": "Corolla",
                                    "ano": 2022
                                }
                            }
                        },
                        "monto": 687.50,
                        "metodoPago": "Débito automático",
                        "notas": "Pago mensual enero 2024",
                        "fechaPago": "2024-02-15T14:00:00.000Z",
                        "createdAt": "2024-02-15T14:00:00.000Z"
                    }
                ]
            }
        }
    })
    @ApiResponse({ status: 401, description: 'No autorizado' })
    @Roles(Rol.CLIENTE)
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Get('mis-pagos')
    async getMisPagos(@Req() req: any) {
        const usuarioActual: ValidatedUser = req.user;

        const pagos = await this.pagoService.getPagosByClienteId(usuarioActual._id);

        return {
            total: pagos.length,
            pagos,
        };
    }

    @ApiOperation({
        summary: 'Obtener pagos por cotización (Cliente/Admin)',
        description: `
        Retorna el historial de pagos de una cotización específica.
        
        **Funcionamiento:**
        - Busca la compra asociada a la cotización
        - Retorna todos los pagos de esa compra
        
        **Permisos:**
        - Cliente: Solo pagos de sus propias cotizaciones
        - Admin: Pagos de cualquier cotización
        
        **Uso típico:**
        - Desde el detalle de cotización, ver historial de pagos sin necesidad de conocer el ID de compra
        `
    })
    @ApiParam({ name: 'cotizacionId', description: 'ID de la cotización' })
    @ApiResponse({
        status: 200,
        description: 'Historial de pagos obtenido correctamente',
        schema: {
            example: {
                message: 'Historial de pagos obtenido correctamente',
                pagos: [
                    {
                        "_id": "507f1f77bcf86cd799439016",
                        "compra": "507f1f77bcf86cd799439015",
                        "monto": 5000,
                        "metodoPago": "Transferencia bancaria",
                        "notas": "Pago inicial de enganche",
                        "fechaPago": "2024-01-15T14:00:00.000Z"
                    }
                ]
            }
        }
    })
    @ApiResponse({ status: 403, description: 'No tienes permiso para ver los pagos de esta cotización' })
    @ApiResponse({ status: 404, description: 'Cotización o compra no encontrada' })
    @Roles(Rol.ADMIN, Rol.CLIENTE)
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Get('por-cotizacion/:cotizacionId')
    async getPagosPorCotizacion(
        @Param('cotizacionId') cotizacionId: string,
        @Req() req: any,
    ) {
        const usuarioActual: ValidatedUser = req.user;
        const pagos = await this.pagoService.getPagosByCotizacionId(cotizacionId, usuarioActual);

        return {
            message: 'Historial de pagos obtenido correctamente',
            pagos,
        };
    }
}
