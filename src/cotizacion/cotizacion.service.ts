import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Product, ProductDocument } from '../product/schemas/product.schema';
import { User, UserDocument } from '../user/schemas/user.schema';
import { ValidatedUser } from '../user/schemas/user.schema';
import { UserService } from '../user/user.service';
import { Cotizacion, CotizacionDocument } from './schemas/cotizacion.schema';
import { CompraService } from '../compra/compra.service';
import { EmailModuleService } from '../email-module/email-module.service';
import { Rol } from '../auth/enums/rol.enum';
import * as puppeteer from 'puppeteer';

interface CotizacionWithCliente extends Omit<CotizacionDocument, 'cliente'> {
  cliente: UserDocument;
}

interface CotizacionWithClienteAndCoche extends Omit<CotizacionDocument, 'cliente' | 'coche'> {
  cliente: UserDocument;
  coche: ProductDocument;
}

@Injectable()
export class CotizacionService {
  private readonly TASA_INTERES_ANUAL = 0.15;
  private readonly logger = new Logger(CotizacionService.name);

  constructor(
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Cotizacion.name)
    private cotizacionModel: Model<CotizacionDocument>,
    private readonly userService: UserService,
    private readonly compraService: CompraService,
    private readonly emailService: EmailModuleService,
  ) { }

  async generarCotizacion(
    cliente: ValidatedUser,
    cocheId: string,
    enganche: number,
    plazoMeses: number,
  ): Promise<CotizacionDocument> {
    this.logger.log(`🚀 Iniciando generación de cotización para cliente ${cliente._id} - Coche ID: ${cocheId}`);

    const coche = await this.productModel.findById(cocheId);
    if (!coche) {
      this.logger.error(`❌ Coche con ID ${cocheId} no encontrado`);
      throw new NotFoundException('El coche solicitado no existe.');
    }
    this.logger.log(`✅ Coche encontrado: ${coche.marca} ${coche.modelo} - Precio: $${coche.precioBase}`);

    const precio = coche.precioBase;
    if (enganche >= precio) {
      this.logger.warn(`⚠️ Enganche inválido: $${enganche} >= $${precio}`);
      throw new BadRequestException(
        'El enganche debe ser menor al precio del coche.',
      );
    }

    const montoAFinanciar = precio - enganche;
    const tasaInteresMensual = this.TASA_INTERES_ANUAL / 12;

    const i = tasaInteresMensual;
    const n = plazoMeses;
    const pagoMensual =
      (montoAFinanciar * (i * Math.pow(1 + i, n))) /
      (Math.pow(1 + i, n) - 1);

    const totalPagado = pagoMensual * plazoMeses + enganche;

    this.logger.log(`📊 Cálculos realizados:
      - Precio coche: $${precio}
      - Enganche: $${enganche}
      - Monto a financiar: $${montoAFinanciar}
      - Plazo: ${plazoMeses} meses
      - Tasa anual: ${(this.TASA_INTERES_ANUAL * 100).toFixed(2)}%
      - Pago mensual: $${parseFloat(pagoMensual.toFixed(2))}
      - Total a pagar: $${parseFloat(totalPagado.toFixed(2))}`);

    const nuevaCotizacion = new this.cotizacionModel({
      cliente: cliente._id,
      coche: coche._id,
      precioCoche: precio,
      enganche: enganche,
      plazoMeses: plazoMeses,
      tasaInteres: this.TASA_INTERES_ANUAL,
      pagoMensual: parseFloat(pagoMensual.toFixed(2)),
      montoFinanciado: montoAFinanciar,
      totalPagado: parseFloat(totalPagado.toFixed(2)),
      status: 'Pendiente',
    });

    const cotizacionGuardada = await nuevaCotizacion.save();
    this.logger.log(`💾 Cotización guardada exitosamente - ID: ${cotizacionGuardada._id}`);

    const clienteDoc = await this.userService.findById(cliente._id.toString());
    if (clienteDoc) {
      await this.enviarCorreoCotizacion(
        clienteDoc,
        coche,
        cotizacionGuardada,
      );
      this.logger.log(`📧 Correo de cotización enviado a ${clienteDoc.email}`);

      // Generar y enviar PDF
      await this.enviarCotizacionPDF(clienteDoc, coche, cotizacionGuardada, montoAFinanciar, tasaInteresMensual, plazoMeses, pagoMensual);
      this.logger.log(`📄 PDF de cotización generado y enviado`);
    } else {
      this.logger.warn(`⚠️ No se pudo encontrar el documento del cliente para envío de notificaciones`);
    }

    return cotizacionGuardada;
  }



  async generarCotizacionCliente(
    cliente: ValidatedUser,
    cocheId: string,
    enganche: number,
    plazoMeses: number,
  ): Promise<CotizacionDocument> {
    const coche = await this.productModel.findById(cocheId);
    if (!coche) {
      throw new NotFoundException('El coche solicitado no existe.');
    }

    const precio = coche.precioBase;
    if (enganche >= precio) {
      throw new BadRequestException(
        'El enganche debe ser menor al precio del coche.',
      );
    }

    const montoAFinanciar = precio - enganche;
    const tasaInteresMensual = this.TASA_INTERES_ANUAL / 12;

    const i = tasaInteresMensual;
    const n = plazoMeses;
    const pagoMensual =
      (montoAFinanciar * (i * Math.pow(1 + i, n))) /
      (Math.pow(1 + i, n) - 1);

    const totalPagado = pagoMensual * plazoMeses + enganche;

    const nuevaCotizacion = new this.cotizacionModel({
      cliente: cliente._id,
      coche: coche._id,
      precioCoche: precio,
      enganche: enganche,
      plazoMeses: plazoMeses,
      tasaInteres: this.TASA_INTERES_ANUAL,
      pagoMensual: parseFloat(pagoMensual.toFixed(2)),
      montoFinanciado: montoAFinanciar,
      totalPagado: parseFloat(totalPagado.toFixed(2)),
      status: 'Pendiente',
    });

    const cotizacionGuardada = await nuevaCotizacion.save();

    const clienteDoc = await this.userService.findById(cliente._id.toString());

    return cotizacionGuardada;
  }

  async vendedorGenerarCotizacion(
    dto: {
      cocheId: string,
      clienteId: string,
      enganche: number,
      plazoMeses: number
    },
  ): Promise<CotizacionDocument> {
    this.logger.log(`👨‍💼 Vendedor generando cotización - Cliente ID: ${dto.clienteId}, Coche ID: ${dto.cocheId}`);

    const cliente = await this.userService.findById(dto.clienteId);
    if (!cliente) {
      this.logger.error(`❌ Cliente con ID ${dto.clienteId} no encontrado`);
      throw new NotFoundException('El cliente seleccionado no existe.');
    }
    this.logger.log(`✅ Cliente encontrado: ${cliente.nombre} (${cliente.email})`);

    const validatedUser: ValidatedUser = {
      _id: cliente._id.toString(),
      nombre: cliente.nombre,
      email: cliente.email,
      rol: cliente.rol
    };

    return this.generarCotizacion(
      validatedUser,
      dto.cocheId,
      dto.enganche,
      dto.plazoMeses,
    );
  }

  async getCotizacionesPendientes(user: ValidatedUser): Promise<CotizacionDocument[]> {
    this.logger.log(`📋 Obteniendo cotizaciones pendientes para vendedor ${user._id}`);

    const data: CotizacionDocument[] = await this.cotizacionModel
      .find({ status: 'Pendiente', vendedor: new Types.ObjectId(user._id) })
      .populate('cliente', 'nombre email telefono')
      .populate('coche', 'marca modelo ano precioBase')
      .exec();
    this.logger.log(`✅ Encontradas ${data.length} cotizaciones pendientes`);
    return data;
  }

  async getCotizacionesAprovadas(): Promise<CotizacionDocument[]> {
    return this.cotizacionModel
      .find({ status: 'Aprobada' })
      .populate('cliente', 'nombre email telefono')
      .populate('coche', 'marca modelo ano precioBase')
      .exec();
  }

  async getCotizacionesAprobadasCliente(clienteId: string): Promise<CotizacionDocument[]> {
    return this.cotizacionModel
      .find({
        status: 'Aprobada',
        cliente: new Types.ObjectId(clienteId)
      })
      .populate('cliente', 'nombre email telefono')
      .populate('coche', 'marca modelo ano precioBase imageUrl condicion transmision kilometraje')
      .exec();
  }

  async getMisCotizaciones(user: ValidatedUser, status?: string): Promise<CotizacionDocument[]> {
    const filter: any = { cliente: new Types.ObjectId(user._id) };
    if (status) {
      filter.status = status;
    }
    return this.cotizacionModel
      .find(filter)
      .populate('cliente', 'nombre email telefono')
      .populate('coche', 'marca modelo ano precioBase imageUrl condicion transmision kilometraje')
      .sort({ createdAt: -1 })
      .exec();
  }

  async getCotizacionById(id: string, user: ValidatedUser): Promise<any> {
    const cotizacion = await this.cotizacionModel
      .findById(id)
      .populate('cliente', 'nombre email telefono documents')
      .populate('coche', 'marca modelo ano precioBase imageUrl condicion transmision descripcion')
      .populate('vendedor', 'nombre email telefono')
      .exec();

    if (!cotizacion) {
      throw new NotFoundException('Cotización no encontrada');
    }

    // Verificar permisos: cliente solo sus propias cotizaciones, admin todas
    if (user.rol === Rol.CLIENTE && cotizacion.cliente._id.toString() !== user._id.toString()) {
      throw new ForbiddenException('No tienes permiso para ver esta cotización');
    }

    // Si es vendedor asignado o admin, incluir estado de documentos del cliente
    let documentosCliente = null;
    if (user.rol === Rol.ADMIN || (user.rol === Rol.VENDEDOR && cotizacion.vendedor?._id.toString() === user._id.toString())) {
      documentosCliente = await this.userService.getDocumentStatus(cotizacion.cliente._id.toString());
    }

    return {
      ...cotizacion.toObject(),
      documentosCliente,
    };
  }

  async updateNotasVendedor(
    id: string,
    notasVendedor: string,
  ): Promise<CotizacionDocument> {
    const cotizacion = await this.cotizacionModel.findById(id);

    if (!cotizacion) {
      throw new NotFoundException('Cotización no encontrada.');
    }

    cotizacion.notasVendedor = notasVendedor;
    return await cotizacion.save();
  }


  async getCotizacionesAll(user: ValidatedUser): Promise<CotizacionDocument[]> {
    // Si es admin, ver todas las cotizaciones
    if (user.rol === Rol.ADMIN) {
      return this.cotizacionModel
        .find({})
        .populate('cliente', 'nombre email telefono fotoPerfil')
        .populate('vendedor', 'nombre email telefono fotoPerfil')
        .populate('coche', 'imageUrl marca modelo ano precioBase descripcion condicion tipo transmision motor')
        .exec();
    }

    // Si es vendedor, ver solo las cotizaciones asignadas a él
    if (user.rol === Rol.VENDEDOR) {
      return this.cotizacionModel
        .find({ vendedor: user._id })
        .populate('cliente', 'nombre email telefono fotoPerfil')
        .populate('vendedor', 'nombre email telefono fotoPerfil')
        .populate('coche', 'imageUrl marca modelo ano precioBase descripcion condicion tipo transmision motor')
        .exec();
    }

    // Fallback (no debería llegar aquí por los guards)
    return [];
  }

  async setSellerToPricing(idPricing: string, idSeller: string) {
    this.logger.log(`👤 Asignando vendedor ${idSeller} a cotización ${idPricing}`);

    const cotizacion = await this.cotizacionModel.findById(idPricing).exec();

    if (!cotizacion) {
      this.logger.error(`❌ Cotización ${idPricing} no encontrada`);
      throw new InternalServerErrorException('Cotización no encontrada.');
    }

    cotizacion.vendedor = new Types.ObjectId(idSeller);
    cotizacion.status = 'En Revision';

    const result = await cotizacion.save();
    this.logger.log(`✅ Vendedor asignado y status cambiado a 'En Revision'`);

    return result;
  }

  async updateCotizacionStatus(
    id: string,
    vendedor: ValidatedUser,
    status: 'Aprobada' | 'Rechazada',
  ): Promise<CotizacionDocument> {
    this.logger.log(`🔄 Actualizando status de cotización ${id} a '${status}' por vendedor ${vendedor._id}`);

    const cotizacion = await this.cotizacionModel
      .findById(id)
      .populate<{ cliente: UserDocument }>('cliente')
      .populate<{ coche: ProductDocument }>('coche')
      .exec() as unknown as CotizacionWithClienteAndCoche;

    if (!cotizacion) {
      this.logger.error(`❌ Cotización ${id} no encontrada`);
      throw new NotFoundException('Cotización no encontrada.');
    }
    this.logger.log(`✅ Cotización encontrada - Cliente: ${cotizacion.cliente.nombre}, Coche: ${cotizacion.coche.marca} ${cotizacion.coche.modelo}`);

    cotizacion.status = status;
    cotizacion.vendedor = new Types.ObjectId(vendedor._id.toString());

    const cotizacionActualizada = await cotizacion.save();
    this.logger.log(`💾 Status actualizado exitosamente`);

    // Si la cotización fue aprobada, crear Compra si no existe
    if (status === 'Aprobada') {
      this.logger.log(`🛒 Creando compra desde cotización aprobada`);
      await this.compraService.createFromCotizacion(cotizacionActualizada);
      this.logger.log(`✅ Compra creada exitosamente`);
    }

    try {
      await this.enviarCorreoResultadoCotizacion(
        cotizacion.cliente,
        cotizacion.coche,
        cotizacionActualizada,
      );
      this.logger.log(`📧 Correo de resultado enviado a ${cotizacion.cliente.email}`);
    } catch (emailError) {
      this.logger.error(`❌ Error enviando email: ${emailError.message}`);
    }

    return cotizacionActualizada;
  }

  private calculateDocumentStatus(documents?: any) {
    if (!documents) return {};

    const now = new Date();
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // Aproximadamente 1 mes

    const result: any = {};
    for (const key in documents) {
      if (documents[key]) {
        const uploadedAt = new Date(documents[key].uploadedAt);
        result[key] = {
          ...documents[key],
          status: uploadedAt < oneMonthAgo ? 'pasado' : 'actual',
        };
      }
    }
    return result;
  }

  async assignVendedor(
    id: string,
    vendedorId: string,
  ): Promise<CotizacionDocument> {
    const cotizacion = await this.cotizacionModel.findById(id);

    if (!cotizacion) {
      throw new NotFoundException('Cotización no encontrada.');
    }

    if (cotizacion.status !== 'Pendiente') {
      throw new BadRequestException('Solo se pueden asignar cotizaciones pendientes.');
    }

    cotizacion.vendedor = new Types.ObjectId(vendedorId);
    cotizacion.status = 'En Revision';

    return cotizacion.save();
  }

  private async enviarCorreoCotizacion(
    cliente: UserDocument,
    coche: ProductDocument,
    cotizacion: CotizacionDocument
  ): Promise<void> {
    const subject = 'Tu cotización ha sido generada - SmartAssistant CRM';
    const htmlBody = `
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
            <p>Cotización Generada</p>
          </div>
          <div class="content">
            <h2>Hola ${cliente.nombre},</h2>
            <p>Tu cotización para el coche <b>${coche.marca} ${coche.modelo}</b> ha sido generada exitosamente.</p>
            
            <div class="highlight">
              <p><b>Pago mensual estimado:</b> $${cotizacion.pagoMensual.toFixed(2)}</p>
              <p><b>Plazo:</b> ${cotizacion.plazoMeses} meses</p>
              <p><b>Enganche:</b> $${cotizacion.enganche.toFixed(2)}</p>
              <p><b>Total a pagar:</b> $${cotizacion.totalPagado.toFixed(2)}</p>
            </div>
            
            <p>Un asesor se pondrá en contacto contigo para revisar los detalles.</p>
            <p>Gracias por tu interés en nuestros vehículos.</p>
          </div>
          <div class="footer">
            <p>Este es un email automático, por favor no respondas a este mensaje.</p>
            <p>© ${new Date().getFullYear()} SmartAssistant CRM. Todos los derechos reservados.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await this.emailService.sendSimpleEmail(
      cliente.email,
      subject,
      undefined, // text version not needed
      htmlBody
    );
  }

  private async enviarCorreoResultadoCotizacion(
    cliente: UserDocument,
    coche: ProductDocument,
    cotizacion: CotizacionDocument
  ): Promise<void> {
    try {
      const aprobado = cotizacion.status === 'Aprobada';
      const subject = aprobado
        ? '¡Tu solicitud ha sido aprobada! - SmartAssistant CRM'
        : 'Resultado de tu solicitud - SmartAssistant CRM';

      const mensaje = aprobado
        ? `
          <p>Nos complace informarte que tu solicitud para el coche <b>${coche.marca} ${coche.modelo}</b> ha sido <b style="color: #10b981;">APROBADA</b>.</p>
          <p>Un asesor se pondrá en contacto contigo para continuar con el proceso.</p>
        `
        : `
          <p>Lamentamos informarte que tu solicitud para el coche <b>${coche.marca} ${coche.modelo}</b> ha sido <b style="color: #ef4444;">RECHAZADA</b>.</p>
          <p>Si deseas revisar otras opciones de financiamiento, contáctanos.</p>
        `;

      const htmlBody = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: ${aprobado ? '#10b981' : '#ef4444'}; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
            .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>SmartAssistant CRM</h1>
              <p>${aprobado ? 'Solicitud Aprobada' : 'Solicitud Rechazada'}</p>
            </div>
            <div class="content">
              <h2>Hola ${cliente.nombre},</h2>
              ${mensaje}
              <br/>
              <p>Gracias por confiar en nosotros.</p>
              <p><i>Atentamente,<br/>El equipo de Ventas</i></p>
            </div>
            <div class="footer">
              <p>Este es un email automático, por favor no respondas a este mensaje.</p>
              <p>© ${new Date().getFullYear()} SmartAssistant CRM. Todos los derechos reservados.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      // Si está aprobado, generar y adjuntar PDF de pagos
      if (aprobado) {
        await this.enviarPDFPagosAprobacion(cliente, coche, cotizacion);
      } else {
        await this.emailService.sendSimpleEmail(
          cliente.email,
          subject,
          undefined, // text version not needed
          htmlBody
        );
      }

      console.log(`Email de ${cotizacion.status} enviado exitosamente a ${cliente.email}`);
    } catch (error) {
      console.error('Error enviando correo de resultado:', error);
      throw new Error(`No se pudo enviar el email: ${error.message}`);
    }
  }

  async getTopProductos() {
    try {
      const topProductos = await this.cotizacionModel.aggregate([
        { $match: { status: 'Aprobada' } },
        { $group: { _id: '$coche', count: { $sum: 1 } } },

        { $sort: { count: -1 } },
        { $limit: 5 },
        {
          $lookup: {
            from: 'products',
            localField: '_id',
            foreignField: '_id',
            as: 'cocheDetalles',
          },
        },
        { $unwind: '$cocheDetalles' },
        {
          $project: {
            _id: 0,
            nombre: { $concat: ["$cocheDetalles.marca", " ", "$cocheDetalles.modelo"] },
            imagenUrl: "$cocheDetalles.imageUrl",
            count: 1,
          },
        },
      ]);
      return topProductos;
    } catch (error) {
      throw new Error('No se pudo obtener top productos.');
    }
  }

  private async enviarCotizacionPDF(
    cliente: UserDocument,
    coche: ProductDocument,
    cotizacion: CotizacionDocument,
    montoFinanciado: number,
    tasaMensual: number,
    plazo: number,
    pagoMensual: number,
  ): Promise<void> {
    const amortizacionTable = this.generarTablaAmortizacion(
      montoFinanciado,
      tasaMensual,
      plazo,
      pagoMensual,
    );

    const html = `
      <html>
        <head>
          <meta charset="UTF-8" />
          <style>
            body { font-family: Arial, sans-serif; margin: 24px; color: #111827; }
            h1, h2, h3 { margin: 0 0 8px 0; }
            h1 { font-size: 24px; }
            h2 { font-size: 20px; margin-top: 24px; }
            p { margin: 4px 0; }
            .section { margin-bottom: 16px; }
            .card {
              background: #f9fafb;
              border-radius: 8px;
              padding: 12px 16px;
              border: 1px solid #e5e7eb;
              margin-top: 8px;
            }
            .summary-grid {
              display: grid;
              grid-template-columns: repeat(2, minmax(0, 1fr));
              gap: 4px 16px;
              font-size: 14px;
            }
            .summary-item { display: flex; flex-direction: column; }
            .summary-item span.label { font-weight: 600; color: #374151; }
            .summary-item span.value { font-weight: 500; color: #111827; }
            table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 12px; }
            th, td { border: 1px solid #e5e7eb; padding: 6px 8px; text-align: right; }
            th { background-color: #f3f4f6; text-align: center; }
            .footer {
              margin-top: 24px;
              padding-top: 12px;
              border-top: 1px solid #e5e7eb;
              font-size: 10px;
              color: #6b7280;
            }
          </style>
        </head>
        <body>
          <h1>Cotización de Crédito Automotriz</h1>

          <div class="section">
            <h2>Datos del Cliente</h2>
            <div class="card">
              <p><strong>Nombre:</strong> ${cliente.nombre}</p>
              <p><strong>Email:</strong> ${cliente.email}</p>
            </div>
          </div>

          <div class="section">
            <h2>Datos del Vehículo</h2>
            <div class="card">
              <p><strong>Vehículo:</strong> ${coche.marca} ${coche.modelo} ${coche.ano}</p>
              <p><strong>Precio de Contado:</strong> $${cotizacion.precioCoche.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              <p><strong>Enganche:</strong> $${cotizacion.enganche.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
          </div>

          <div class="section">
            <h2>Resumen del Financiamiento</h2>
            <div class="card">
              <div class="summary-grid">
                <div class="summary-item">
                  <span class="label">Monto Financiado:</span>
                  <span class="value">$${montoFinanciado.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div class="summary-item">
                  <span class="label">Plazo:</span>
                  <span class="value">${plazo} meses</span>
                </div>
                <div class="summary-item">
                  <span class="label">Tasa de Interés Anual:</span>
                  <span class="value">${(cotizacion.tasaInteres * 100).toFixed(2)}%</span>
                </div>
                <div class="summary-item">
                  <span class="label">Pago Mensual Estimado:</span>
                  <span class="value">$${pagoMensual.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div class="summary-item">
                  <span class="label">Total a Pagar (incluye enganche):</span>
                  <span class="value">$${cotizacion.totalPagado.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>
          </div>

          <div class="section">
            <h2>Calendario de Pagos</h2>
            <p>A continuación encontrarás el detalle completo de cada uno de tus pagos mensuales:</p>
            ${amortizacionTable}
          </div>

          <div class="footer">
            <p>Esta cotización es válida por 30 días a partir de la fecha de emisión.</p>
            <p>© ${new Date().getFullYear()} SmartAssistant CRM - Todos los derechos reservados.</p>
          </div>
        </body>
      </html>
    `;

    try {
      const browser = await puppeteer.launch({
        headless: true,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const buffer = await page.pdf({ format: 'A4' });
      await browser.close();

      // Enviar email con PDF adjunto
      this.emailService.sendSimpleEmail(
        cliente.email,
        'Cotización Generada - SmartAssistant CRM',
        'Adjunto encontrarás el PDF con los detalles de tu cotización.',
        undefined,
        [{ filename: 'cotizacion.pdf', content: buffer }]
      );
    } catch (error) {
      console.error('Error generando PDF:', error);
    }
  }

  private generarTablaAmortizacion(
    monto: number,
    tasa: number,
    plazo: number,
    pago: number,
  ): string {
    let saldo = monto;
    let table = '<table><tr><th>Mes</th><th>Pago</th><th>Interés</th><th>Capital</th><th>Saldo</th></tr>';

    for (let mes = 1; mes <= plazo; mes++) {
      const interes = parseFloat((saldo * tasa).toFixed(2));
      let capital = parseFloat((pago - interes).toFixed(2));

      // Ajuste en el último mes para evitar saldo residual por redondeos
      if (mes === plazo) {
        capital = parseFloat(saldo.toFixed(2));
      }

      const pagoReal = parseFloat((capital + interes).toFixed(2));
      saldo = parseFloat((saldo - capital).toFixed(2));
      if (saldo < 0) saldo = 0;

      table += `<tr>
        <td style="text-align:center;">${mes}</td>
        <td>$${pagoReal.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        <td>$${interes.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        <td>$${capital.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        <td>$${saldo.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      </tr>`;
    }

    table += '</table>';
    return table;
  }

  private async enviarPDFPagosAprobacion(
    cliente: UserDocument,
    coche: ProductDocument,
    cotizacion: CotizacionDocument
  ): Promise<void> {
    // Calcular monto financiado
    const montoFinanciado = cotizacion.precioCoche - cotizacion.enganche;
    const tasaMensual = cotizacion.tasaInteres / 12;

    const amortizacionTable = this.generarTablaAmortizacion(
      montoFinanciado,
      tasaMensual,
      cotizacion.plazoMeses,
      cotizacion.pagoMensual
    );

    const html = `
      <html>
        <head>
          <meta charset="UTF-8" />
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; color: #111827; }
            h1 { color: #10b981; text-align: center; margin-bottom: 16px; }
            h2 { color: #111827; border-bottom: 2px solid #10b981; padding-bottom: 8px; margin-top: 24px; }
            p { margin: 4px 0; }
            .info-section { background: #f9fafb; padding: 15px; margin: 16px 0; border-radius: 8px; border: 1px solid #e5e7eb; }
            .info-item { margin: 6px 0; }
            .highlight { background: #dbeafe; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #bfdbfe; }
            table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 12px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: right; }
            th { background-color: #10b981; color: white; text-align: center; }
            tr:nth-child(even) { background-color: #f9fafb; }
            .footer { margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 10px; text-align: center; }
          </style>
        </head>
        <body>
          <h1>🎉 ¡Felicitaciones! Tu Financiamiento ha sido Aprobado</h1>

          <div class="info-section">
            <h2>Información del Cliente</h2>
            <div class="info-item"><strong>Nombre:</strong> ${cliente.nombre}</div>
            <div class="info-item"><strong>Email:</strong> ${cliente.email}</div>
            ${cliente.telefono ? `<div class="info-item"><strong>Teléfono:</strong> ${cliente.telefono}</div>` : ''}
          </div>

          <div class="info-section">
            <h2>Detalles del Vehículo</h2>
            <div class="info-item"><strong>Vehículo:</strong> ${coche.marca} ${coche.modelo} ${coche.ano}</div>
            <div class="info-item"><strong>Precio Total:</strong> $${cotizacion.precioCoche.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <div class="info-item"><strong>Enganche:</strong> $${cotizacion.enganche.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          </div>

          <div class="highlight">
            <h2>📋 Resumen de tu Financiamiento</h2>
            <div class="info-item"><strong>Monto Financiado:</strong> $${montoFinanciado.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <div class="info-item"><strong>Plazo:</strong> ${cotizacion.plazoMeses} meses</div>
            <div class="info-item"><strong>Tasa de Interés Anual:</strong> ${(cotizacion.tasaInteres * 100).toFixed(2)}%</div>
            <div class="info-item"><strong>Pago Mensual:</strong> $${cotizacion.pagoMensual.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <div class="info-item"><strong>Total a Pagar (incluye enganche):</strong> $${cotizacion.totalPagado.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          </div>

          <h2>📅 Calendario de Pagos</h2>
          <p>A continuación encontrarás el detalle completo de cada uno de tus pagos mensuales:</p>
          ${amortizacionTable}

          <div class="footer">
            <p><strong>Importante:</strong> Los pagos deben realizarse puntualmente el día 1 de cada mes, salvo acuerdo distinto con tu asesor.</p>
            <p>Este documento es oficial y confirma la aprobación de tu financiamiento.</p>
            <p>© ${new Date().getFullYear()} SmartAssistant CRM - Todos los derechos reservados.</p>
          </div>
        </body>
      </html>
    `;

    const htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8" />
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #10b981; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>SmartAssistant CRM</h1>
            <p>Solicitud Aprobada</p>
          </div>
          <div class="content">
            <h2>Hola ${cliente.nombre},</h2>
            <p>Nos complace informarte que tu solicitud para el coche <b>${coche.marca} ${coche.modelo}</b> ha sido <b style="color: #10b981;">APROBADA</b>.</p>
            <p>En el PDF adjunto encontrarás el calendario completo de pagos que deberás realizar.</p>
            <p>Un asesor se pondrá en contacto contigo para continuar con el proceso de entrega del vehículo.</p>
            <br/>
            <p>Gracias por confiar en nosotros.</p>
            <p><i>Atentamente,<br/>El equipo de Ventas</i></p>
          </div>
          <div class="footer">
            <p>Este es un email automático, por favor no respondas a este mensaje.</p>
            <p>© ${new Date().getFullYear()} SmartAssistant CRM. Todos los derechos reservados.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return new Promise(async (resolve, reject) => {
      try {
        const browser = await puppeteer.launch({
          headless: true,
          executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
          args: ['--no-sandbox', '--disable-setuid-sandbox'],
        });
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'networkidle0' });
        const buffer = await page.pdf({
          format: 'A4',
          margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' },
        });
        await browser.close();

        const subject = '¡Tu solicitud ha sido aprobada! - SmartAssistant CRM';

        this.emailService
          .sendSimpleEmail(
            cliente.email,
            subject,
            'Adjunto encontrarás el PDF con el calendario completo de pagos para tu financiamiento aprobado.',
            htmlBody,
            [{ filename: 'calendario-pagos-aprobado.pdf', content: buffer }],
          )
          .then(() => {
            console.log(`PDF de pagos enviado exitosamente a ${cliente.email}`);
            resolve();
          })
          .catch((error) => {
            console.error('Error enviando email con PDF:', error);
            reject(error);
          });
      } catch (error) {
        console.error('Error generando PDF con Puppeteer:', error);
        reject(error);
      }
    });
  }
}