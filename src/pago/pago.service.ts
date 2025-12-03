import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
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
        const compra = await this.compraModel.findById(dto.compraId);
        if (!compra) throw new NotFoundException('Compra no encontrada');
        if (compra.status === StatusCompra.COMPLETADA) {
            throw new BadRequestException('La compra ya está completada, no se pueden registrar más pagos');
        }
        if (typeof compra.saldoPendiente !== 'number' || compra.saldoPendiente <= 0) {
            throw new BadRequestException('No hay saldo pendiente para esta compra');
        }
        if (typeof dto.monto !== 'number' || dto.monto <= 0) {
            throw new BadRequestException('El monto debe ser mayor a 0');
        }
        if (dto.monto > compra.saldoPendiente) {
            throw new BadRequestException('El monto del pago no puede ser mayor al saldo pendiente actual');
        }

        const pago = new this.pagoModel({
            compra: compra._id,
            cliente: compra.cliente,
            monto: dto.monto,
            metodoPago: dto.metodoPago || 'efectivo',
            status: 'REGISTRADO',
            notas: dto.notas,
        });
        await pago.save();

        // Actualizar saldo y status de la compra
        compra.saldoPendiente = Math.max(0, compra.saldoPendiente - dto.monto);
        if (compra.saldoPendiente === 0) {
            compra.status = StatusCompra.COMPLETADA;
        }
        await compra.save();

        return pago;
    }
}
