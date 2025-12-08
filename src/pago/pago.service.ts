import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Pago, PagoDocument } from './schemas/pago.schema';
import { Compra, CompraDocument, StatusCompra } from '../compra/schemas/compra.schema';
import { Cotizacion, CotizacionDocument } from '../cotizacion/schemas/cotizacion.schema';
import { ValidatedUser } from '../user/schemas/user.schema';
import { ProductService } from '../product/product.service';
import { EmailModuleService } from '../email-module/email-module.service';

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
        @InjectModel(Cotizacion.name) private cotizacionModel: Model<CotizacionDocument>,
        private readonly productService: ProductService,
        private readonly emailService: EmailModuleService,
    ) { }

    async registrarPago(
        dto: RegistrarPagoDto,
        usuarioActual: ValidatedUser,
    ): Promise<PagoDocument> {
        // Validar roles
        if (usuarioActual.rol !== 'VENDEDOR' && usuarioActual.rol !== 'ADMIN') {
            throw new ForbiddenException('Solo vendedores o administradores pueden registrar pagos');
        }

        // Validar que el compraId sea un ObjectId válido
        if (!Types.ObjectId.isValid(dto.compraId)) {
            throw new BadRequestException('El ID de la compra no es válido');
        }

        // Buscar la Compra
        const compra = await this.compraModel.findById(dto.compraId).populate('cotizacion').populate('cliente');
        if (!compra) {
            throw new NotFoundException('Compra no encontrada');
        }

        // Normalizar valores monetarios para evitar problemas de precisión
        (compra as any).saldoPendiente = parseFloat(((compra as any).saldoPendiente || 0).toFixed(2));
        (compra as any).totalPagado = parseFloat(((compra as any).totalPagado || 0).toFixed(2));

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
        dto.monto = parseFloat(dto.monto.toFixed(2)); // Redondear a 2 decimales
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
        await this.actualizarSaldoYStatus(compra, dto.monto);
        (compra as any).totalPagado = parseFloat(((compra as any).totalPagado + dto.monto).toFixed(2)); // Incrementar el total pagado
        await compra.save();

        // Guardar y devolver el Pago
        const pagoGuardado = await pago.save();

        // Enviar email de notificación
        await this.enviarEmailPago(compra, pagoGuardado);

        return pagoGuardado;
    }

    private async enviarEmailPago(compra: CompraDocument, pago: PagoDocument): Promise<void> {
        try {
            const cliente = compra.cliente as any; // Assuming populated
            const cotizacion = compra.cotizacion as any; // Assuming populated
            const coche = cotizacion?.coche || {};

            const subject = 'Pago Registrado - SmartAssistant CRM';
            const body = `
                <html>
                    <body>
                        <h2>Pago Registrado Exitosamente</h2>
                        <p>Hola ${cliente.nombre},</p>
                        <p>Se ha registrado un pago en tu compra.</p>
                        <p><strong>Detalles del Pago:</strong></p>
                        <ul>
                            <li><strong>Monto:</strong> $${pago.monto.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</li>
                            <li><strong>Método de Pago:</strong> ${pago.metodoPago}</li>
                            <li><strong>Fecha:</strong> ${pago.fechaPago.toLocaleDateString('es-MX')}</li>
                            ${pago.notas ? `<li><strong>Notas:</strong> ${pago.notas}</li>` : ''}
                        </ul>
                        <p><strong>Vehículo:</strong> ${coche.marca || 'N/A'} ${coche.modelo || ''} ${coche.ano || ''}</p>
                        <p><strong>Saldo Pendiente Actual:</strong> $${(compra as any).saldoPendiente.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                        <p>Gracias por tu pago.</p>
                        <p>SmartAssistant CRM</p>
                    </body>
                </html>
            `;

            await this.emailService.sendSimpleEmail(
                cliente.email,
                subject,
                body
            );
        } catch (error) {
            console.error('Error enviando email de pago:', error);
            // No throw error to avoid breaking payment registration
        }
    }

    private async actualizarSaldoYStatus(compra: CompraDocument, monto: number): Promise<void> {
        (compra as any).saldoPendiente = Math.round((((compra as any).saldoPendiente || 0) - monto) * 100) / 100;
        (compra as any).saldoPendiente = Math.max(0, (compra as any).saldoPendiente);
        if ((compra as any).saldoPendiente === 0) {
            compra.status = StatusCompra.COMPLETADA;
            // Actualizar el estatus de la cotización asociada
            if (compra.cotizacion) {
                await this.cotizacionModel.findByIdAndUpdate(compra.cotizacion, { status: 'Completada' }).exec();
            }
            // Decrementar stock del producto
            if (compra.cotizacion && (compra.cotizacion as any).coche) {
                await this.productService.decrementStock((compra.cotizacion as any).coche.toString(), 1);
            }
        }
    }

    async getPagosByCompraId(compraId: string): Promise<PagoDocument[]> {
        if (!Types.ObjectId.isValid(compraId)) {
            throw new BadRequestException('El ID de la compra no es válido');
        }
        return this.pagoModel
            .find({ compra: compraId })
            .populate('cliente', 'nombre email')
            .populate('registradoPor', 'nombre email')
            .sort({ fecha: 1 }) // Orden ascendente por fecha
            .exec();
    }

    async getPagosByClienteId(clienteId: string): Promise<PagoDocument[]> {
        return this.pagoModel
            .find({ cliente: clienteId })
            .populate('compra', 'status saldoPendiente createdAt')
            .populate('registradoPor', 'nombre email')
            .sort({ fecha: -1 }) // Orden descendente por fecha (más reciente primero)
            .exec();
    }

    async getPagosByCotizacionId(cotizacionId: string, user: ValidatedUser): Promise<PagoDocument[]> {
        if (!Types.ObjectId.isValid(cotizacionId)) {
            throw new BadRequestException('El ID de la cotización no es válido');
        }
        // Verificar que la cotización existe y el usuario tiene permisos
        const cotizacion = await this.cotizacionModel.findById(cotizacionId);
        if (!cotizacion) {
            throw new NotFoundException('Cotización no encontrada');
        }

        // Verificar permisos: cliente solo sus propias cotizaciones
        if (user.rol === 'CLIENTE' && cotizacion.cliente.toString() !== user._id.toString()) {
            throw new ForbiddenException('No tienes permiso para ver los pagos de esta cotización');
        }

        // Buscar la compra asociada
        const compra = await this.compraModel.findOne({ cotizacion: new Types.ObjectId(cotizacionId) });
        if (!compra) {
            throw new NotFoundException('Compra no encontrada para esta cotización');
        }

        // Obtener los pagos de esa compra
        return this.pagoModel
            .find({ compra: compra._id })
            .populate('compra', 'status saldoPendiente')
            .populate('registradoPor', 'nombre email')
            .sort({ fecha: -1 })
            .exec();
    }
}
