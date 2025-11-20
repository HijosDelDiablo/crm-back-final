import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Gasto, GastoDocument, EstadoGasto } from './schemas/gasto.schema';
import { CreateGastoDto } from './dto/gasto.dto';
import { UpdateGastoDto } from './dto/gasto.dto';

@Injectable()
export class GastosService {
  constructor(
    @InjectModel(Gasto.name) private gastoModel: Model<GastoDocument>,
  ) {}

  async create(createGastoDto: CreateGastoDto, userId: string): Promise<GastoDocument> {
    const gastoData: any = {
      ...createGastoDto,
      registradoPor: new Types.ObjectId(userId),
    };

    if (createGastoDto.proveedor) {
      gastoData.proveedor = new Types.ObjectId(createGastoDto.proveedor);
    }

    if (createGastoDto.productoRelacionado) {
      gastoData.productoRelacionado = new Types.ObjectId(createGastoDto.productoRelacionado);
    }

    const newGasto = new this.gastoModel(gastoData);
    return newGasto.save();
  }

  async findAll(): Promise<GastoDocument[]> {
    return this.gastoModel
      .find()
      .populate('proveedor', 'nombre contacto')
      .populate('registradoPor', 'nombre email')
      .populate('productoRelacionado', 'marca modelo ano')
      .sort({ fechaGasto: -1, createdAt: -1 })
      .exec();
  }

  async findByDateRange(startDate: Date, endDate: Date): Promise<GastoDocument[]> {
    return this.gastoModel
      .find({
        fechaGasto: {
          $gte: startDate,
          $lte: endDate,
        },
      })
      .populate('proveedor', 'nombre contacto')
      .populate('registradoPor', 'nombre email')
      .populate('productoRelacionado', 'marca modelo ano')
      .sort({ fechaGasto: -1 })
      .exec();
  }

  async findByCategoria(categoria: string): Promise<GastoDocument[]> {
    return this.gastoModel
      .find({ categoria })
      .populate('proveedor', 'nombre contacto')
      .populate('registradoPor', 'nombre email')
      .populate('productoRelacionado', 'marca modelo ano')
      .sort({ fechaGasto: -1 })
      .exec();
  }

  async findById(id: string): Promise<GastoDocument> {
    const gasto = await this.gastoModel
      .findById(id)
      .populate('proveedor')
      .populate('registradoPor')
      .populate('productoRelacionado')
      .exec();

    if (!gasto) {
      throw new NotFoundException(`Gasto con ID "${id}" no encontrado.`);
    }

    return gasto;
  }

  async update(id: string, updateGastoDto: UpdateGastoDto): Promise<GastoDocument> {
    const updateData: any = {};

    if (updateGastoDto.concepto !== undefined) updateData.concepto = updateGastoDto.concepto;
    if (updateGastoDto.monto !== undefined) updateData.monto = updateGastoDto.monto;
    if (updateGastoDto.categoria !== undefined) updateData.categoria = updateGastoDto.categoria;
    if (updateGastoDto.estado !== undefined) updateData.estado = updateGastoDto.estado;
    if (updateGastoDto.fechaGasto !== undefined) updateData.fechaGasto = updateGastoDto.fechaGasto;
    if (updateGastoDto.fechaPago !== undefined) updateData.fechaPago = updateGastoDto.fechaPago;
    if (updateGastoDto.comprobante !== undefined) updateData.comprobante = updateGastoDto.comprobante;
    if (updateGastoDto.notas !== undefined) updateData.notas = updateGastoDto.notas;

    if (updateGastoDto.proveedor !== undefined) {
      updateData.proveedor = updateGastoDto.proveedor 
        ? new Types.ObjectId(updateGastoDto.proveedor)
        : null;
    }

    if (updateGastoDto.productoRelacionado !== undefined) {
      updateData.productoRelacionado = updateGastoDto.productoRelacionado
        ? new Types.ObjectId(updateGastoDto.productoRelacionado)
        : null;
    }

    if (updateGastoDto.estado === EstadoGasto.PAGADO && !updateGastoDto.fechaPago) {
      updateData.fechaPago = new Date();
    }

    const updatedGasto = await this.gastoModel
      .findByIdAndUpdate(id, { $set: updateData }, { new: true })
      .populate('proveedor')
      .populate('registradoPor')
      .populate('productoRelacionado')
      .exec();

    if (!updatedGasto) {
      throw new NotFoundException(`Gasto con ID "${id}" no encontrado.`);
    }

    return updatedGasto;
  }

  async remove(id: string): Promise<{ message: string }> {
    const result = await this.gastoModel.findByIdAndDelete(id).exec();

    if (!result) {
      throw new NotFoundException(`Gasto con ID "${id}" no encontrado.`);
    }

    return { message: `Gasto con ID "${id}" eliminado exitosamente.` };
  }

  async marcarComoPagado(id: string): Promise<GastoDocument> {
    const gasto = await this.gastoModel.findByIdAndUpdate(
      id,
      {
        estado: EstadoGasto.PAGADO,
        fechaPago: new Date(),
      },
      { new: true },
    ).populate('proveedor').exec();

    if (!gasto) {
      throw new NotFoundException(`Gasto con ID "${id}" no encontrado.`);
    }

    return gasto;
  }

  async getResumenPorCategoria(startDate: Date, endDate: Date): Promise<any> {
    const result = await this.gastoModel.aggregate([
      {
        $match: {
          fechaGasto: {
            $gte: startDate,
            $lte: endDate,
          },
          estado: EstadoGasto.PAGADO,
        },
      },
      {
        $group: {
          _id: '$categoria',
          total: { $sum: '$monto' },
          count: { $sum: 1 },
        },
      },
      {
        $sort: { total: -1 },
      },
    ]);

    return result;
  }

  async getTotalGastos(startDate: Date, endDate: Date): Promise<number> {
    const result = await this.gastoModel.aggregate([
      {
        $match: {
          fechaGasto: {
            $gte: startDate,
            $lte: endDate,
          },
          estado: EstadoGasto.PAGADO,
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$monto' },
        },
      },
    ]);

    return result.length > 0 ? result[0].total : 0;
  }
}