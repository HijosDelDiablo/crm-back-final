import { 
  Injectable, 
  NotFoundException, 
  BadRequestException,
  Logger,
  ForbiddenException 
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Compra, CompraDocument, StatusCompra } from './schemas/compra.schema';
import { Cotizacion, CotizacionDocument } from '../cotizacion/schemas/cotizacion.schema';
import { User, UserDocument } from '../user/schemas/user.schema';
import { CreateCompraDto } from './dto/create-compra.dto';
import { AprobarCompraDto } from './dto/approval.dto';
import { SimulacionService } from './services/simulacion.service';
import { ValidatedUser } from '../user/schemas/user.schema';
import { EmailService } from '../email/email.service';
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
    private readonly simulacionService: SimulacionService,
    private readonly emailService: EmailService,
    private readonly oneSignalService: OneSignalService,
  ) {}

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

    const capacidadPago = createCompraDto.datosFinancieros.ingresoMensual + 
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

    compra.status = aprobarCompraDto.status as StatusCompra;
    compra.vendedor = new Types.ObjectId(vendedor._id);
    compra.comentariosAnalista = aprobarCompraDto.comentarios;

    if (aprobarCompraDto.status === StatusCompra.COMPLETADA) {
      compra.fechaEntrega = new Date();
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
      .find({ status: { $in: [StatusCompra.EN_REVISION, StatusCompra.APROBADA] } })
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

    if (!compra) {
      throw new NotFoundException('Compra no encontrada');
    }

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
    const aprobado = resultadoBanco?.aprobado;

    const subject = aprobado 
      ? '¡Felicidades! Tu financiamiento ha sido aprobado'
      : 'Resultado de tu solicitud de financiamiento';

    const body = aprobado
      ? this.generarEmailAprobacion(compra)
      : this.generarEmailRechazo(compra);

    await this.oneSignalService.enviarEmailPersonalizado(
      cliente.email,
      subject,
      body
    );
  }

  private async notificarCompraCompletada(compra: CompraDocument): Promise<void> {
    const cliente = compra.cliente as any;
    
    await this.oneSignalService.enviarEmailPersonalizado(
      cliente.email,
      '¡Compra Completada!',
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
            <p>Hemos recibido tu solicitud de compra y estamos procesando tu financiamiento.</p>
            
            <h3>Detalles de tu solicitud:</h3>
            <ul>
              <li><strong>Vehículo:</strong> ${cotizacion.coche.marca} ${cotizacion.coche.modelo}</li>
              <li><strong>Monto a financiar:</strong> $${cotizacion.montoFinanciado.toLocaleString()}</li>
              <li><strong>Plazo:</strong> ${cotizacion.plazoMeses} meses</li>
              <li><strong>Score crediticio:</strong> ${compra.resultadoBuro.score}</li>
            </ul>
            
            <p>Te notificaremos en cuanto tengamos los resultados de la evaluación.</p>
          </div>
          <div class="footer">
            <p>Este es un email automático, por favor no respondas a este mensaje.</p>
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
    const cotizacion = compra.cotizacion as any;
    const cliente = compra.cliente as any;
    const resultadoBanco = compra.resultadoBanco as ResultadoBanco;
    
    const montoAprobado = resultadoBanco.montoAprobado ?? 0;
    const tasaInteres = resultadoBanco.tasaInteres ?? 0;
    const pagoMensual = resultadoBanco.pagoMensual ?? 0;
    const plazoAprobado = resultadoBanco.plazoAprobado ?? 0;

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #10b981; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .approval-details { background: #d1fae5; padding: 20px; border-radius: 6px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>¡Financiamiento Aprobado!</h1>
          </div>
          <div class="content">
            <h2>Hola ${cliente.nombre},</h2>
            <p>Nos complace informarte que tu solicitud de financiamiento ha sido <strong>APROBADA</strong>.</p>
            
            <div class="approval-details">
              <h3>Detalles de tu financiamiento:</h3>
              <ul>
                <li><strong>Monto aprobado:</strong> $${montoAprobado.toLocaleString()}</li>
                <li><strong>Tasa de interés:</strong> ${(tasaInteres * 100).toFixed(1)}%</li>
                <li><strong>Pago mensual:</strong> $${pagoMensual.toLocaleString()}</li>
                <li><strong>Plazo:</strong> ${plazoAprobado} meses</li>
              </ul>
            </div>
            
            <p>Un asesor se pondrá en contacto contigo para coordinar la entrega del vehículo.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private generarEmailRechazo(compra: CompraDocument): string {
    const cliente = compra.cliente as any;
    const resultadoBanco = compra.resultadoBanco as ResultadoBanco;
    
    const motivoRechazo = resultadoBanco.motivoRechazo ?? 'No especificado';
    const sugerencias = resultadoBanco.sugerencias ?? ['Contacta a un asesor para más información'];

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #ef4444; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .suggestions { background: #fef3c7; padding: 20px; border-radius: 6px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Resultado de Financiamiento</h1>
          </div>
          <div class="content">
            <h2>Hola ${cliente.nombre},</h2>
            <p>Lamentamos informarte que tu solicitud de financiamiento no pudo ser aprobada en este momento.</p>
            
            <p><strong>Motivo:</strong> ${motivoRechazo}</p>
            
            <div class="suggestions">
              <h3>Sugerencias:</h3>
              <ul>
                ${sugerencias.map(sug => `<li>${sug}</li>`).join('')}
              </ul>
            </div>
            
            <p>Puedes contactar a un asesor para explorar otras opciones de financiamiento.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private generarEmailCompletada(compra: CompraDocument): string {
    const cliente = compra.cliente as any;
    const cotizacion = compra.cotizacion as any;
    
    const fechaEntrega = compra.fechaEntrega ? compra.fechaEntrega.toLocaleDateString() : 'No especificada';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #8b5cf6; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>¡Compra Completada!</h1>
          </div>
          <div class="content">
            <h2>¡Felicidades ${cliente.nombre}!</h2>
            <p>Tu compra ha sido completada exitosamente.</p>
            
            <h3>Resumen de tu compra:</h3>
            <ul>
              <li><strong>Vehículo:</strong> ${cotizacion.coche.marca} ${cotizacion.coche.modelo}</li>
              <li><strong>Fecha de entrega:</strong> ${fechaEntrega}</li>
              <li><strong>Financiamiento:</strong> $${cotizacion.montoFinanciado.toLocaleString()}</li>
              <li><strong>Pago mensual:</strong> $${cotizacion.pagoMensual.toLocaleString()}</li>
            </ul>
            
            <p>Gracias por confiar en nosotros. ¡Disfruta tu nuevo vehículo!</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}