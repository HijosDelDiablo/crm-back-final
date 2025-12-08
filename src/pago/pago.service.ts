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
        // Validar que el compraId sea un ObjectId válido
        if (!Types.ObjectId.isValid(dto.compraId)) {
            throw new BadRequestException('El ID de la compra no es válido');
        }

        // Buscar la Compra
        const compra = await this.compraModel.findById(dto.compraId).populate({
            path: 'cotizacion',
            populate: { path: 'coche' }
        }).populate('cliente');
        if (!compra) {
            throw new NotFoundException('Compra no encontrada');
        }

        // Validar permisos según rol
        if (usuarioActual.rol === 'CLIENTE') {
            if (compra.cliente._id.toString() !== usuarioActual._id.toString()) {
                throw new ForbiddenException('No tienes permiso para registrar pagos en esta compra');
            }
            // Permitir solo pago con Tarjeta para clientes
            if (!dto.metodoPago || dto.metodoPago.toLowerCase() !== 'tarjeta') {
                throw new BadRequestException('Los clientes solo pueden realizar pagos con Tarjeta');
            }
        } else if (usuarioActual.rol === 'VENDEDOR') {
            if (compra.vendedor && compra.vendedor.toString() !== usuarioActual._id.toString()) {
                throw new ForbiddenException('Solo el vendedor asignado o un administrador pueden registrar pagos para esta compra');
            }
        } else if (usuarioActual.rol !== 'ADMIN') {
            throw new ForbiddenException('Rol no autorizado para registrar pagos');
        }

        // Normalizar valores monetarios para evitar problemas de precisión
        (compra as any).saldoPendiente = parseFloat(((compra as any).saldoPendiente || 0).toFixed(2));
        (compra as any).totalPagado = parseFloat(((compra as any).totalPagado || 0).toFixed(2));

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
            const text = `
Pago Registrado Exitosamente

Hola ${cliente.nombre},

Se ha registrado un pago en tu compra.

Detalles del Pago:
- Monto: $${pago.monto.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
- Método de Pago: ${pago.metodoPago}
- Fecha: ${pago.fecha.toLocaleDateString('es-MX')}
${pago.notas ? `- Notas: ${pago.notas}` : ''}

Vehículo: ${coche.marca || 'N/A'} ${coche.modelo || ''} ${coche.ano || ''}

Saldo Total Restante por Pagar: $${(compra as any).saldoPendiente.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
(Este monto incluye capital e intereses pendientes)

Gracias por tu pago.

SmartAssistant CRM
            `;

            await this.emailService.sendSimpleEmail(
                cliente.email,
                subject,
                text
            );
        } catch (error) {
            console.error('Error enviando email de pago:', error);
            // No throw error to avoid breaking payment registration
        }
    }

    private async enviarEmailVentaCompletada(compra: CompraDocument): Promise<void> {
        try {
            const cliente = compra.cliente as any;
            const cotizacion = compra.cotizacion as any;
            const coche = cotizacion?.coche || {};

            const subject = '¡Felicidades! Tu vehículo es tuyo - SmartAssistant CRM';
            const text = `
¡Felicidades ${cliente.nombre}!

Has completado el pago de tu vehículo.

Vehículo: ${coche.marca || 'N/A'} ${coche.modelo || ''} ${coche.ano || ''}

Ya puedes pasar a recoger tu vehículo y la documentación correspondiente.

¡Gracias por tu compra!

SmartAssistant CRM
            `;

            await this.emailService.sendSimpleEmail(
                cliente.email,
                subject,
                text
            );
        } catch (error) {
            console.error('Error enviando email de venta completada:', error);
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
                const coche = (compra.cotizacion as any).coche;
                const cocheId = coche._id ? coche._id.toString() : coche.toString();
                await this.productService.decrementStock(cocheId, 1);
            }
            // Enviar email de venta completada
            await this.enviarEmailVentaCompletada(compra);
        }
    }

    async getPagosByCompraId(compraId: string): Promise<PagoDocument[]> {
        if (!Types.ObjectId.isValid(compraId)) {
            throw new BadRequestException('El ID de la compra no es válido');
        }
        
        console.log(`🔍 Buscando pagos para compraId: ${compraId}`);
        
        const pagos = await this.pagoModel
            .find({ compra: new Types.ObjectId(compraId) })
            .populate('cliente', 'nombre email')
            .populate('registradoPor', 'nombre email')
            .sort({ fecha: 1 }) // Orden ascendente por fecha
            .exec();
            
        console.log(`✅ Pagos encontrados: ${pagos.length}`);
        return pagos;
    }

    async getPagosByClienteId(clienteId: string, filters?: { compraId?: string; fecha?: Date }): Promise<PagoDocument[]> {
        const query: any = { cliente: clienteId };

        if (filters?.compraId) {
            query.compra = filters.compraId;
        }

        if (filters?.fecha) {
            const startOfDay = new Date(filters.fecha);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(filters.fecha);
            endOfDay.setHours(23, 59, 59, 999);

            query.fecha = {
                $gte: startOfDay,
                $lte: endOfDay
            };
        }

        return this.pagoModel
            .find(query)
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
