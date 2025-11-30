import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Product, ProductDocument } from '../product/schemas/product.schema';
import { User, UserDocument } from '../user/schemas/user.schema';
import { ValidatedUser } from '../user/schemas/user.schema';
import { UserService } from '../user/user.service';
import { OneSignalService } from '../notifications/onesignal.service';
import { Cotizacion, CotizacionDocument } from './schemas/cotizacion.schema';

@Injectable()
export class CotizacionService {
  private readonly TASA_INTERES_ANUAL = 0.15;

  constructor(
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    @InjectModel(Cotizacion.name)
    private cotizacionModel: Model<CotizacionDocument>,
    private readonly oneSignalService: OneSignalService,
    private readonly userService: UserService,
  ) {}

  async generarCotizacion(
    cliente: ValidatedUser,
    cocheId: string,
    enganche: number,
    plazoMeses: number,
  ): Promise<CotizacionDocument> {
    const coche: ProductDocument | null = await this.productModel.findById(cocheId);
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
    if (clienteDoc) {
        await this.enviarCorreoCotizacionOneSignal(
          clienteDoc as any,
          coche,
          cotizacionGuardada,
        );
    }

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
    
    const cliente = await this.userService.findById(dto.clienteId);
    if (!cliente) {
      throw new NotFoundException('El cliente seleccionado no existe.');
    }

    return this.generarCotizacion(
      cliente as ValidatedUser,
      dto.cocheId,
      dto.enganche,
      dto.plazoMeses,
    );
  }
  
  async getCotizacionesPendientes(): Promise<CotizacionDocument[]> {
    return this.cotizacionModel
      .find({ status: 'Pendiente' })
      .populate('cliente', 'nombre email telefono')
      .populate('coche', 'marca modelo ano precioBase')
      .exec();
  }
  async getCotizacionesAll(): Promise<CotizacionDocument[]> {
    return this.cotizacionModel
      .find({})
      .populate('cliente', 'nombre email telefono fotoPerfil')
      .populate('vendedor', 'nombre email telefono fotoPerfil')
      .populate('coche', 'imageUrl marca modelo ano precioBase descripcion condicion tipo transmision motor')
      .exec();
  }

  async setSellerToPricing(idPricing: string, idSeller: string) {    
    const cotizacion = await this.cotizacionModel.findById(idPricing).exec();
    
    if (!cotizacion) {
      throw new NotFoundException('Cotización no encontrada.');
    }
    cotizacion.set('vendedor', idSeller);
    return cotizacion.save();
  }
  
  async updateCotizacionStatus(
    id: string,
    vendedor: ValidatedUser, 
    status: 'Aprobada' | 'Rechazada',
  ): Promise<CotizacionDocument> {
    
    const cotizacion = await this.cotizacionModel
      .findById(id)
      .populate<{ cliente: UserDocument }>('cliente')
      .populate<{ coche: ProductDocument }>('coche')
      .exec();

    if (!cotizacion) {
      throw new NotFoundException('Cotización no encontrada.');
    }

    cotizacion.status = status;
    cotizacion.set('vendedor', vendedor._id);

    const cotizacionActualizada = await cotizacion.save();
    
    await this.enviarCorreoResultadoCotizacionOneSignal(
      cotizacion.cliente,
      cotizacion.coche,
      cotizacionActualizada as any,
    );

    return cotizacionActualizada as any as CotizacionDocument;
  }

  private async enviarCorreoCotizacionOneSignal(
    cliente: User, 
    coche: Product, 
    cotizacion: Cotizacion
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

    await this.oneSignalService.enviarEmailPersonalizado(
      cliente.email,
      subject,
      htmlBody
    );
  }

  private async enviarCorreoResultadoCotizacionOneSignal(
    cliente: User, 
    coche: Product, 
    cotizacion: Cotizacion
  ): Promise<void> {
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

    await this.oneSignalService.enviarEmailPersonalizado(
      cliente.email,
      subject,
      htmlBody
    );
  }

  async getTopProductos() {
    try {
      const topProductos = await this.cotizacionModel.aggregate([
        { $match: { status: 'Aprobada'} },
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
}