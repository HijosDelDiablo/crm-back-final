import { 
  Injectable, 
  NotFoundException, 
  BadRequestException,
  Logger
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
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
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
          $inc: {
            stock: -1,
            vecesVendido: 1
          },
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

    const subject = resultadoBanco.aprobado
      ? '¡Felicidades! Tu financiamiento ha sido aprobado'
      : 'Resultado de tu solicitud de financiamiento';

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
          body { font-family: Arial, sans-serif; }
        </style>
      </head>
      <body>
        <h2>Hola ${cliente.nombre},</h2>
        Hemos recibido tu solicitud de compra.
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

    return `
      <html><body>
      <h1>Financiamiento Aprobado</h1>
      Hola ${cliente.nombre}
      </body></html>
    `;
  }

  private generarEmailRechazo(compra: CompraDocument): string {
    const cliente = compra.cliente as any;
    const resultadoBanco = compra.resultadoBanco as ResultadoBanco;

    return `
      <html><body>
      <h1>Financiamiento Rechazado</h1>
      Hola ${cliente.nombre}
      </body></html>
    `;
  }

  private generarEmailCompletada(compra: CompraDocument): string {
    const cliente = compra.cliente as any;

    return `
      <html><body>
      <h1>Compra Completada</h1>
      Hola ${cliente.nombre}
      </body></html>
    `;
  }
}