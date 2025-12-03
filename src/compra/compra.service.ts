import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Compra, CompraDocument, StatusCompra } from './schemas/compra.schema';
import { Cotizacion, CotizacionDocument } from '../cotizacion/schemas/cotizacion.schema';
import { User, UserDocument, ValidatedUser } from '../user/schemas/user.schema';
import { Product, ProductDocument } from '../product/schemas/product.schema';
import { CreateCompraDto } from './dto/create-compra.dto';
import { AprobarCompraDto } from './dto/approval.dto';
import { SimulacionService } from './services/simulacion.service';
import { OneSignalService } from '../notifications/onesignal.service';

interface ResultadoBanco {
  aprobado: boolean;
  montoAprobado?: number;
  tasaInteres?: number;
  plazoAprobado?: number;
  pagoMensual?: number;
  capacidadPago?: number;
  ratioDeuda?: number;
  motivoRechazo?: string;
  sugerencias?: string[];
  fechaAprobacion?: Date;
  condiciones?: string[];
}

@Injectable()
export class CompraService {

  private readonly logger = new Logger(CompraService.name);

  constructor(
    @InjectModel(Compra.name) private compraModel: Model<CompraDocument>,
    @InjectModel(Cotizacion.name) private cotizacionModel: Model<CotizacionDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    private readonly simulacionService: SimulacionService,
    private readonly oneSignalService: OneSignalService,
  ) { }
  /**
     * Crea una Compra asociada a una Cotizacion si no existe ya.
     * @param cotizacion CotizacionDocument
     * @returns CompraDocument | null (si ya existe)
     */
  async createFromCotizacion(cotizacion: CotizacionDocument): Promise<CompraDocument | null> {
    // Verificar si ya existe una Compra para esta cotización
    const compraExistente = await this.compraModel.findOne({ cotizacion: cotizacion._id });
    if (compraExistente) {
      return null;
    }

    // Inicializar saldoPendiente con solo los pagos mensuales (sin enganche)
    const saldoPendiente = parseFloat((cotizacion.pagoMensual * cotizacion.plazoMeses).toFixed(2));

    const nuevaCompra = new this.compraModel({
      cotizacion: cotizacion._id,
      cliente: cotizacion.cliente,
      vendedor: cotizacion.vendedor,
      status: StatusCompra.PENDIENTE,
      saldoPendiente,
      montoTotalCredito: saldoPendiente, // Campo informativo opcional
    });
    return await nuevaCompra.save();
  }

  async getVentasPeriodo(filter) {
    try {
      const ventas = await this.compraModel.find(filter).populate({
        path: 'cotizacion',
        select: 'totalPagado'
      });
      return ventas;
    } catch (error) {
      this.logger.error('Error obteniendo ventas con filtro:', error);
      throw new Error('No se pudo obtener ventas con filtro.');
    }
  }

  async iniciarProcesoCompra(
    cliente: ValidatedUser,
    createCompraDto: CreateCompraDto,
  ): Promise<CompraDocument> {
    const cotizacion = await this.cotizacionModel
      .findOne({
        _id: new Types.ObjectId(createCompraDto.cotizacionId),
        cliente: new Types.ObjectId(cliente._id),
      })
      .populate('coche')
      .exec();

    if (!cotizacion) {
      throw new NotFoundException('Cotización no encontrada o no pertenece al usuario');
    }

    if (cotizacion.status !== 'Aprobada') {
      throw new BadRequestException('La cotización debe estar aprobada para iniciar el proceso de compra');
    }

    const compraExistente = await this.compraModel.findOne({
      cotizacion: new Types.ObjectId(createCompraDto.cotizacionId),
    });

    if (compraExistente) {
      throw new BadRequestException('Ya existe un proceso de compra para esta cotización');
    }

    this.logger.log(`Iniciando consulta a buró de crédito para: ${cliente.email}`);

    const resultadoBuro = await this.simulacionService.consultarBuroCredito(
      cliente.email,
      cliente.nombre
    );

    const capacidadPago =
      createCompraDto.datosFinancieros.ingresoMensual +
      createCompraDto.datosFinancieros.otrosIngresos -
      createCompraDto.datosFinancieros.gastosMensuales -
      createCompraDto.datosFinancieros.deudasActuales;

    const nuevaCompra = new this.compraModel({
      cotizacion: new Types.ObjectId(createCompraDto.cotizacionId),
      cliente: new Types.ObjectId(cliente._id),
      status: StatusCompra.EN_REVISION,
      datosFinancieros: {
        ...createCompraDto.datosFinancieros,
        capacidadPago,
      },
      resultadoBuro,
      saldoPendiente: cotizacion.totalPagado - cotizacion.enganche, // Saldo pendiente inicial: total a pagar menos enganche
      totalPagado: cotizacion.enganche, // El enganche se considera pagado al iniciar la compra
    });

    const compraGuardada = await nuevaCompra.save();

    await this.notificarNuevaSolicitud(compraGuardada);
    await this.enviarEmailConfirmacionSolicitud(cliente, compraGuardada, cotizacion);

    return compraGuardada;
  }

  async evaluarFinanciamiento(compraId: string, analista: ValidatedUser): Promise<CompraDocument> {
    const compra = await this.compraModel
      .findById(compraId)
      .populate('cotizacion')
      .populate('cliente')
      .exec();

    if (!compra) {
      throw new NotFoundException('Proceso de compra no encontrado');
    }

    if (compra.status !== StatusCompra.EN_REVISION) {
      throw new BadRequestException('El proceso de compra no está en estado de revisión');
    }

    const cotizacion = compra.cotizacion as any;
    const montoFinanciar = cotizacion.montoFinanciado;

    const resultadoBanco = await this.simulacionService.evaluarFinanciamiento(
      compra.datosFinancieros,
      compra.resultadoBuro,
      montoFinanciar,
      cotizacion.plazoMeses
    );

    compra.resultadoBanco = resultadoBanco;
    compra.analistaCredito = new Types.ObjectId(analista._id);

    if (resultadoBanco.aprobado) {
      compra.status = StatusCompra.APROBADA;
      compra.fechaAprobacion = new Date();
    } else {
      compra.status = StatusCompra.RECHAZADA;
    }

    const compraActualizada = await compra.save();
    await this.notificarResultadoFinanciamiento(compraActualizada);

    return compraActualizada;
  }

  async aprobarCompra(
    compraId: string,
    aprobarCompraDto: AprobarCompraDto,
    vendedor: ValidatedUser,
  ): Promise<CompraDocument> {
    const compra = await this.compraModel
      .findById(compraId)
      .populate('cotizacion')
      .populate('cliente')
      .exec();

    if (!compra) {
      throw new NotFoundException('Proceso de compra no encontrado');
    }

    if (compra.status !== StatusCompra.APROBADA) {
      throw new BadRequestException('Solo se pueden aprobar compras con financiamiento aprobado');
    }

    const cotizacion = compra.cotizacion as any;
    const producto = await this.productModel.findById(cotizacion.coche._id);

    if (!producto) {
      throw new NotFoundException('Producto no encontrado');
    }

    if (producto.stock < 1) {
      throw new BadRequestException('Stock insuficiente para completar la compra');
    }

    compra.status = aprobarCompraDto.status as StatusCompra;
    compra.vendedor = new Types.ObjectId(vendedor._id);
    compra.comentariosAnalista = aprobarCompraDto.comentarios;

    if (aprobarCompraDto.status === StatusCompra.COMPLETADA) {
      compra.fechaEntrega = new Date();

      await this.productModel.findByIdAndUpdate(
        cotizacion.coche._id,
        {
          $inc: { stock: -1, vecesVendido: 1 },
          disponible: false
        }
      );

      this.logger.log(`Stock descontado para producto: ${cotizacion.coche._id}`);
    }

    const compraActualizada = await compra.save();

    if (aprobarCompraDto.status === StatusCompra.COMPLETADA) {
      await this.notificarCompraCompletada(compraActualizada);
    }

    return compraActualizada;
  }

  async getComprasPorCliente(clienteId: string): Promise<CompraDocument[]> {
    return this.compraModel
      .find({ cliente: new Types.ObjectId(clienteId) })
      .populate('cotizacion')
      .populate('vendedor', 'nombre email')
      .populate('analistaCredito', 'nombre email')
      .sort({ createdAt: -1 })
      .exec();
  }

  async getComprasPendientes(): Promise<CompraDocument[]> {
    return this.compraModel
      .find({ status: StatusCompra.PENDIENTE })
      .populate('cotizacion')
      .populate('cliente', 'nombre email telefono')
      .populate('vendedor', 'nombre email')
      .sort({ createdAt: -1 })
      .exec();
  }

  async getComprasEnRevision(): Promise<CompraDocument[]> {
    return this.compraModel
      .find({ status: StatusCompra.EN_REVISION })
      .populate('cotizacion')
      .populate('cliente', 'nombre email telefono')
      .populate('vendedor', 'nombre email')
      .sort({ createdAt: -1 })
      .exec();
  }

  async getComprasAprobadas(): Promise<CompraDocument[]> {
    return this.compraModel
      .find({ status: StatusCompra.APROBADA })
      .populate('cotizacion')
      .populate('cliente', 'nombre email telefono')
      .populate('vendedor', 'nombre email')
      .sort({ createdAt: -1 })
      .exec();
  }

  async getCompraById(compraId: string): Promise<CompraDocument> {
    const compra = await this.compraModel
      .findById(compraId)
      .populate('cotizacion')
      .populate('cliente')
      .populate('vendedor')
      .populate('analistaCredito')
      .exec();

    if (!compra) throw new NotFoundException('Compra no encontrada');
    return compra;
  }

  private async notificarNuevaSolicitud(compra: CompraDocument): Promise<void> {
    try {
      const vendedores = await this.userModel.find({ rol: 'VENDEDOR' }).exec();

      const playerIds = vendedores
        .map(v => v.oneSignalPlayerId)
        .filter((id): id is string => id !== null && id !== undefined);

      if (playerIds.length > 0) {
        await this.oneSignalService.sendPushNotificationToPlayerIds(
          playerIds,
          'Nueva Solicitud de Compra',
          'Hay una nueva solicitud de compra pendiente de revisión'
        );
      }
    } catch (error) {
      this.logger.error('Error enviando notificación push:', error);
    }
  }

  private async notificarResultadoFinanciamiento(compra: CompraDocument): Promise<void> {
    const cliente = compra.cliente as any;
    const resultadoBanco = compra.resultadoBanco as ResultadoBanco;

    const subject = resultadoBanco.aprobado
      ? '¡Felicidades! Tu financiamiento ha sido aprobado - SmartAssistant CRM'
      : 'Resultado de tu solicitud de financiamiento - SmartAssistant CRM';

    const body = resultadoBanco.aprobado
      ? this.generarEmailAprobacion(compra)
      : this.generarEmailRechazo(compra);

    await this.oneSignalService.enviarEmailPersonalizado(
      cliente.email,
      subject,
      body
    );
  }

  private async notificarCompraCompletada(compra: CompraDocument): Promise<void> {
    if (this.configService.get('DISABLE_EMAILS') === 'true') {
      console.log('Emails disabled, skipping email send');
      return;
    }

    const cliente = compra.cliente as any;

    await this.oneSignalService.enviarEmailPersonalizado(
      cliente.email,
      '¡Compra Completada! - SmartAssistant CRM',
      this.generarEmailCompletada(compra)
    );
  }

  private async enviarEmailConfirmacionSolicitud(
    cliente: ValidatedUser,
    compra: CompraDocument,
    cotizacion: any
  ): Promise<void> {
    const emailBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px; }
          .highlight { background: #dbeafe; padding: 15px; border-radius: 8px; margin: 15px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>SmartAssistant CRM</h1>
            <p>Solicitud de Compra Recibida</p>
          </div>
          <div class="content">
            <h2>Hola ${cliente.nombre},</h2>
            <p>Hemos recibido tu solicitud de compra y estamos procesando tu información.</p>
            
            <div class="highlight">
              <p><b>Vehículo:</b> ${cotizacion.coche.marca} ${cotizacion.coche.modelo}</p>
              <p><b>Pago mensual estimado:</b> $${cotizacion.pagoMensual.toFixed(2)}</p>
              <p><b>Plazo:</b> ${cotizacion.plazoMeses} meses</p>
            </div>
            
            <p>Nuestro equipo de análisis crediticio revisará tu solicitud y te notificaremos el resultado en un plazo máximo de 48 horas.</p>
            <p>Puedes consultar el estado de tu solicitud desde tu panel de cliente.</p>
          </div>
          <div class="footer">
            <p>Este es un email automático, por favor no respondas.</p>
            <p>© ${new Date().getFullYear()} SmartAssistant CRM</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await this.oneSignalService.enviarEmailPersonalizado(
      cliente.email,
      'Solicitud de Compra Recibida - SmartAssistant CRM',
      emailBody
    );
  }

  private generarEmailAprobacion(compra: CompraDocument): string {
    const cliente = compra.cliente as any;
    const resultadoBanco = compra.resultadoBanco as ResultadoBanco;
    const cotizacion = compra.cotizacion as any;

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #10b981; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px; }
          .highlight { background: #d1fae5; padding: 15px; border-radius: 8px; margin: 15px 0; }
          .conditions { background: #fef3c7; padding: 15px; border-radius: 8px; margin: 15px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>SmartAssistant CRM</h1>
            <p>¡Financiamiento Aprobado!</p>
          </div>
          <div class="content">
            <h2>¡Felicidades ${cliente.nombre}!</h2>
            <p>Tu financiamiento ha sido aprobado.</p>
            
            <div class="highlight">
              <p><b>Vehículo:</b> ${cotizacion.coche.marca} ${cotizacion.coche.modelo}</p>
              <p><b>Monto aprobado:</b> $${resultadoBanco.montoAprobado?.toFixed(2)}</p>
              <p><b>Tasa de interés:</b> ${(resultadoBanco.tasaInteres! * 100).toFixed(2)}%</p>
              <p><b>Pago mensual:</b> $${resultadoBanco.pagoMensual?.toFixed(2)}</p>
              <p><b>Plazo:</b> ${resultadoBanco.plazoAprobado} meses</p>
            </div>

            ${resultadoBanco.condiciones && resultadoBanco.condiciones.length > 0
        ? `
            <div class="conditions">
              <h3>Condiciones del financiamiento:</h3>
              <ul>
                ${resultadoBanco.condiciones.map(c => `<li>${c}</li>`).join('')}
              </ul>
            </div>
            `
        : ''
      }

            <p>Un asesor te contactará para continuar con el proceso.</p>
          </div>

          <div class="footer">
            <p>Este es un email automático.</p>
            <p>© ${new Date().getFullYear()} SmartAssistant CRM</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private generarEmailRechazo(compra: CompraDocument): string {
    const cliente = compra.cliente as any;
    const resultadoBanco = compra.resultadoBanco as ResultadoBanco;

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #ef4444; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px; }
          .info-box { background: #fef3c7; padding: 15px; border-radius: 8px; margin: 15px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>SmartAssistant CRM</h1>
            <p>Resultado de Financiamiento</p>
          </div>
          <div class="content">
            <h2>Hola ${cliente.nombre},</h2>
            <p>Lamentamos informarte que tu financiamiento no fue aprobado.</p>

            <div class="info-box">
              <p><b>Motivo:</b> ${resultadoBanco.motivoRechazo || 'No cumple con los criterios de aprobación'}</p>

              ${resultadoBanco.sugerencias && resultadoBanco.sugerencias.length > 0
        ? `
              <p><b>Sugerencias:</b></p>
              <ul>
                ${resultadoBanco.sugerencias.map(s => `<li>${s}</li>`).join('')}
              </ul>
              `
        : ''
      }
            </div>

            <p>Puedes contactar a un asesor para más opciones.</p>
          </div>
          <div class="footer">
            <p>Este es un email automático.</p>
            <p>© ${new Date().getFullYear()} SmartAssistant CRM</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private generarEmailCompletada(compra: CompraDocument): string {
    const cliente = compra.cliente as any;
    const cotizacion = compra.cotizacion as any;

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #10b981; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px; }
          .highlight { background: #d1fae5; padding: 15px; border-radius: 8px; margin: 15px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>SmartAssistant CRM</h1>
            <p>¡Compra Completada!</p>
          </div>
          <div class="content">
            <h2>¡Felicidades ${cliente.nombre}!</h2>
            <p>Tu compra ha sido completada.</p>

            <div class="highlight">
              <p><b>Vehículo:</b> ${cotizacion.coche.marca} ${cotizacion.coche.modelo}</p>
              <p><b>Fecha de entrega:</b> ${compra.fechaEntrega?.toLocaleDateString()}</p>
              <p><b>Pago mensual:</b> $${cotizacion.pagoMensual.toFixed(2)}</p>
              <p><b>Próximo pago:</b> ${new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString()}</p>
            </div>

            <p>Tu primer pago vence en 30 días.</p>
          </div>
          <div class="footer">
            <p>Este es un email automático.</p>
            <p>© ${new Date().getFullYear()} SmartAssistant CRM</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  async findByClienteId(clienteId: string): Promise<CompraDocument[]> {
    return this.compraModel
      .find({ cliente: new Types.ObjectId(clienteId) })
      .populate('cotizacion')
      .populate('cliente', 'nombre email telefono')
      .populate('vendedor', 'nombre email telefono')
      .sort({ createdAt: -1 })
      .exec();
  }

  async findByVendedorId(vendedorId: string): Promise<CompraDocument[]> {
    return this.compraModel
      .find({ vendedor: new Types.ObjectId(vendedorId) })
      .populate('cotizacion')
      .populate('cliente', 'nombre email telefono')
      .populate('vendedor', 'nombre email telefono')
      .sort({ createdAt: -1 })
      .exec();
  }

  async findCompraById(compraId: string): Promise<CompraDocument> {
    const compra = await this.compraModel
      .findById(compraId)
      .populate('cliente', 'nombre email')
      .populate('vendedor', 'nombre email')
      .exec();

    if (!compra) {
      throw new NotFoundException('Compra no encontrada');
    }

    return compra;
  }

  async getCompraPorCotizacion(cotizacionId: string, user: ValidatedUser): Promise<CompraDocument> {
    // Primero verificar que la cotización existe y el usuario tiene permisos
    const cotizacion = await this.cotizacionModel.findById(cotizacionId);
    if (!cotizacion) {
      throw new NotFoundException('Cotización no encontrada');
    }

    // Verificar permisos: cliente solo sus propias cotizaciones
    if (user.rol === 'CLIENTE' && cotizacion.cliente.toString() !== user._id.toString()) {
      throw new ForbiddenException('No tienes permiso para ver esta compra');
    }

    // Buscar la compra asociada
    const compra = await this.compraModel
      .findOne({ cotizacion: new Types.ObjectId(cotizacionId) })
      .populate('cliente', 'nombre email telefono')
      .populate('vendedor', 'nombre email telefono')
      .populate({
        path: 'cotizacion',
        populate: {
          path: 'coche',
          select: 'marca modelo ano precioBase imageUrl'
        }
      })
      .exec();

    if (!compra) {
      throw new NotFoundException('Compra no encontrada para esta cotización');
    }

    return compra;
  }
}