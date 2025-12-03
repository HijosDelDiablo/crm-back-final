import { Controller, Post, Body, Req, UseGuards, Get, Param, ForbiddenException } from '@nestjs/common';
import { PagoService } from './pago.service';
import { CompraService } from '../compra/compra.service';
import { ValidatedUser } from '../user/schemas/user.schema';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Rol } from '../auth/enums/rol.enum';
import { IsString, IsNumber, IsOptional, IsPositive, IsNotEmpty } from 'class-validator';

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

@Controller('pagos')
export class PagoController {
    constructor(
        private readonly pagoService: PagoService,
        private readonly compraService: CompraService,
    ) { }

    @Roles(Rol.VENDEDOR, Rol.ADMIN)
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
}
