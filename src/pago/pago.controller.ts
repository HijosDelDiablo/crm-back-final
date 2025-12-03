import { Controller, Post, Body, Req, UseGuards } from '@nestjs/common';
import { PagoService } from './pago.service';
import { ValidatedUser } from '../user/schemas/user.schema';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Rol } from '../auth/enums/rol.enum';

class RegistrarPagoDto {
    compraId: string;
    monto: number;
    metodoPago?: string;
    notas?: string;
}

@Controller('pagos')
export class PagoController {
    constructor(private readonly pagoService: PagoService) { }

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
}
