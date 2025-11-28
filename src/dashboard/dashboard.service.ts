import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Product } from '../product/schemas/product.schema';
import { User } from '../user/schemas/user.schema';
import { Cotizacion } from '../cotizacion/schemas/cotizacion.schema'; 
import { CotizacionService } from '../cotizacion/cotizacion.service';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    private cotizacionService: CotizacionService,
    @InjectModel(Cotizacion.name) private cotizacionModel: Model<Cotizacion>,
    @InjectModel(Product.name) private productModel: Model<Product>,
    @InjectModel(User.name) private userModel: Model<User>,
  ) {}

  async getReporteVentas(startDate: Date, endDate: Date) {
    this.logger.log(`Generando reporte de cotizaciones de ${startDate} a ${endDate}`);
    
    try {
      const cotizacionesAprobadas = await this.cotizacionModel.find({
        status: 'Aprobada',
        createdAt: {
          $gte: startDate,
          $lte: endDate,
        },
      });

      const totalCotizaciones = cotizacionesAprobadas.length;
      const montoTotal = cotizacionesAprobadas.reduce((sum, cot) => sum + cot.totalPagado, 0);

      return {
        totalCotizaciones,
        montoTotal,
      };
    } catch (error) {
      this.logger.error('Error generando reporte de ventas:', error);
      throw new Error('No se pudo generar el reporte.');
    }
  }

  async getTopProductos() {
    this.logger.log('Obteniendo top productos cotizados');
    try {
      return await this.cotizacionService.getTopProductos();
    } catch (error) {
      this.logger.error('Error obteniendo top productos:', error);
      throw new Error('No se pudo obtener top productos.');
    }
  }

  async getTopVendedores() {
    this.logger.log('Obteniendo top vendedores');
    try {
      const topVendedores = await this.cotizacionModel.aggregate([
        { $match: { status: 'Aprobada', vendedor: { $ne: null } } },
        { $group: { _id: '$vendedor', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'vendedorDetalles',
          },
        },
        { $unwind: '$vendedorDetalles' },
        {
          $project: {
            _id: 0,
            nombre: "$vendedorDetalles.nombre",
            email: "$vendedorDetalles.email",
            count: 1,
          },
        },
      ]);
      return topVendedores;
    } catch (error) {
      this.logger.error('Error obteniendo top vendedores:', error);
      throw new Error('No se pudo obtener top vendedores.');
    }
  }
}