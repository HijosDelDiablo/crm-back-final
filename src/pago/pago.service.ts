import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Pago, PagoDocument } from './schemas/pago.schema';
import { Compra, CompraDocument, StatusCompra } from '../compra/schemas/compra.schema';
import { ValidatedUser } from '../user/schemas/user.schema';

interface RegistrarPagoDto {
    compraId: string;
    monto: number;
    metodoPago?: string;
    notas?: string;
}

@Injectable()
export class PagoService {
    constructor(
        @InjectModel(Pago.name) private pagoModel: Model<PagoDocument>,
        @InjectModel(Compra.name) private compraModel: Model<CompraDocument>,
    ) { }

    async registrarPago(
        dto: RegistrarPagoDto,
        usuarioActual: ValidatedUser,
    ): Promise<PagoDocument> {
        // Validar roles
        if (usuarioActual.rol !== 'VENDEDOR' && usuarioActual.rol !== 'ADMIN') {
            throw new ForbiddenException('Solo vendedores o administradores pueden registrar pagos');
        }

        // Buscar la Compra
        const compra = await this.compraModel.findById(dto.compraId);
        if (!compra) {
            throw new NotFoundException('Compra no encontrada');
        }

        // Validación adicional para vendedores
        if (usuarioActual.rol === 'VENDEDOR' && compra.vendedor && compra.vendedor.toString() !== usuarioActual._id.toString()) {
            throw new ForbiddenException('Solo el vendedor asignado o un administrador pueden registrar pagos para esta compra');
        }

        // Verificar si la compra ya está completada
        if (compra.status === StatusCompra.COMPLETADA) {
            throw new BadRequestException('La compra ya está completada, no se pueden registrar más pagos');
        }

        // Validar saldo pendiente
        if (typeof compra.saldoPendiente !== 'number' || compra.saldoPendiente <= 0) {
            throw new BadRequestException('No hay saldo pendiente para esta compra');
        }

        // Validar monto
        if (typeof dto.monto !== 'number' || dto.monto <= 0) {
            throw new BadRequestException('El monto debe ser mayor a 0');
        }
        if (dto.monto > compra.saldoPendiente) {
            throw new BadRequestException('El monto del pago no puede ser mayor al saldo pendiente actual');
        }

        // Crear el Pago
        const pago = new this.pagoModel({
            compra: compra._id,
            cliente: compra.cliente,
            monto: dto.monto,
            metodoPago: dto.metodoPago || 'transferencia',
            status: 'REGISTRADO',
            notas: dto.notas,
            registradoPor: usuarioActual._id,
        });

        // Actualizar la Compra
        this.actualizarSaldoYStatus(compra, dto.monto);
        await compra.save();

        // Guardar y devolver el Pago
        return await pago.save();
    }

    private actualizarSaldoYStatus(compra: CompraDocument, monto: number): void {
        compra.saldoPendiente = Math.max(0, compra.saldoPendiente - monto);
        if (compra.saldoPendiente === 0) {
            compra.status = StatusCompra.COMPLETADA;
        }
    }
}
