import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Product, ProductDocument } from '../product/schemas/product.schema';
import { UserDocument, ValidatedUser } from '../user/schemas/user.schema';
import { EmailService } from '../email/email.service';
import { Cotizacion, CotizacionDocument } from './schemas/cotizacion.schema';

@Injectable()
export class CotizacionService {
  private readonly TASA_INTERES_ANUAL = 0.15;

  constructor(
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    @InjectModel(Cotizacion.name)
    private cotizacionModel: Model<CotizacionDocument>,
    private readonly emailService: EmailService,
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
    
    const clienteDoc = await this.productModel.findById(cliente._id);
    if (clienteDoc) {
        await this.emailService.enviarCorreoCotizacion(
          clienteDoc as any,
          coche,
          cotizacionGuardada,
        );
    }

    return cotizacionGuardada;
  }
  
  async getCotizacionesPendientes(): Promise<CotizacionDocument[]> {
    return this.cotizacionModel
      .find({ status: 'Pendiente' })
      .populate('cliente', 'nombre email telefono')
      .populate('coche', 'marca modelo ano precioBase')
      .exec();
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
    
    await this.emailService.enviarCorreoResultadoCotizacion(
      cotizacion.cliente,
      cotizacion.coche,
      cotizacionActualizada as any,
    );

    return cotizacionActualizada as any as CotizacionDocument;
  }
}