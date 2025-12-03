import { Controller, Post, Body, Req, UseGuards } from '@nestjs/common';
import { PagoService } from './pago.service';
import { ValidatedUser } from '../user/schemas/user.schema';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

class RegistrarPagoDto {
    compraId: string;
    monto: number;
    metodoPago?: string;
    notas?: string;
}

@Controller('pagos')
export class PagoController {
    constructor(private readonly pagoService: PagoService) { }

    @UseGuards(JwtAuthGuard)
    @Post()
    async registrarPago(
        @Body() dto: RegistrarPagoDto,
        @Req() req: any,
    ) {
        const usuarioActual: ValidatedUser = req.user;
        return await this.pagoService.registrarPago(dto, usuarioActual);
    }
}
