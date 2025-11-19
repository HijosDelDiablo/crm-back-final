import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Proveedor, ProveedorDocument } from './schemas/proveedor.schema';
import { CreateProveedorDto } from './dto/proveedor.dto';
import { UpdateProveedorDto } from './dto/proveedor.dto';

@Injectable()
export class ProveedoresService {
  constructor(
    @InjectModel(Proveedor.name) private proveedorModel: Model<ProveedorDocument>,
  ) {}

  async create(createProveedorDto: CreateProveedorDto): Promise<ProveedorDocument> {
    const existingProveedor = await this.proveedorModel.findOne({
      rfc: createProveedorDto.rfc,
    });

    if (existingProveedor) {
      throw new ConflictException('Ya existe un proveedor con este RFC');
    }

    const proveedorData: any = {
      ...createProveedorDto,
    };

    if (createProveedorDto.productosSuministrados) {
      proveedorData.productosSuministrados = createProveedorDto.productosSuministrados.map(
        id => new Types.ObjectId(id),
      );
    }

    const newProveedor = new this.proveedorModel(proveedorData);
    return newProveedor.save();
  }

  async findAll(): Promise<ProveedorDocument[]> {
    return this.proveedorModel
      .find()
      .populate('productosSuministrados', 'marca modelo ano precioBase')
      .sort({ nombre: 1 })
      .exec();
  }

  async findActive(): Promise<ProveedorDocument[]> {
    return this.proveedorModel
      .find({ activo: true })
      .populate('productosSuministrados', 'marca modelo ano precioBase')
      .sort({ nombre: 1 })
      .exec();
  }

  async findById(id: string): Promise<ProveedorDocument> {
    const proveedor = await this.proveedorModel
      .findById(id)
      .populate('productosSuministrados')
      .exec();

    if (!proveedor) {
      throw new NotFoundException(`Proveedor con ID "${id}" no encontrado.`);
    }

    return proveedor;
  }

  async update(id: string, updateProveedorDto: UpdateProveedorDto): Promise<ProveedorDocument> {
    const updateData: any = {};

    if (updateProveedorDto.nombre !== undefined) updateData.nombre = updateProveedorDto.nombre;
    if (updateProveedorDto.contacto !== undefined) updateData.contacto = updateProveedorDto.contacto;
    if (updateProveedorDto.telefono !== undefined) updateData.telefono = updateProveedorDto.telefono;
    if (updateProveedorDto.email !== undefined) updateData.email = updateProveedorDto.email;
    if (updateProveedorDto.direccion !== undefined) updateData.direccion = updateProveedorDto.direccion;
    if (updateProveedorDto.rfc !== undefined) updateData.rfc = updateProveedorDto.rfc;
    if (updateProveedorDto.activo !== undefined) updateData.activo = updateProveedorDto.activo;
    if (updateProveedorDto.notas !== undefined) updateData.notas = updateProveedorDto.notas;

    if (updateProveedorDto.productosSuministrados !== undefined) {
      updateData.productosSuministrados = updateProveedorDto.productosSuministrados.map(
        id => new Types.ObjectId(id),
      );
    }

    const updatedProveedor = await this.proveedorModel
      .findByIdAndUpdate(id, { $set: updateData }, { new: true })
      .populate('productosSuministrados')
      .exec();

    if (!updatedProveedor) {
      throw new NotFoundException(`Proveedor con ID "${id}" no encontrado.`);
    }

    return updatedProveedor;
  }

  async remove(id: string): Promise<{ message: string }> {
    const result = await this.proveedorModel.findByIdAndDelete(id).exec();

    if (!result) {
      throw new NotFoundException(`Proveedor con ID "${id}" no encontrado.`);
    }

    return { message: `Proveedor con ID "${id}" eliminado exitosamente.` };
  }

  async toggleActive(id: string): Promise<ProveedorDocument> {
    const proveedor = await this.findById(id);
    const updatedProveedor = await this.proveedorModel
      .findByIdAndUpdate(
        id,
        { activo: !proveedor.activo },
        { new: true },
      )
      .exec();

    if (!updatedProveedor) {
      throw new NotFoundException(`Proveedor con ID "${id}" no encontrado.`);
    }

    return updatedProveedor;
  }

  async addProducto(id: string, productoId: string): Promise<ProveedorDocument> {
    const proveedor = await this.proveedorModel.findByIdAndUpdate(
      id,
      { $addToSet: { productosSuministrados: new Types.ObjectId(productoId) } },
      { new: true },
    ).populate('productosSuministrados').exec();

    if (!proveedor) {
      throw new NotFoundException(`Proveedor con ID "${id}" no encontrado.`);
    }

    return proveedor;
  }

  async removeProducto(id: string, productoId: string): Promise<ProveedorDocument> {
    const proveedor = await this.proveedorModel.findByIdAndUpdate(
      id,
      { $pull: { productosSuministrados: new Types.ObjectId(productoId) } },
      { new: true },
    ).populate('productosSuministrados').exec();

    if (!proveedor) {
      throw new NotFoundException(`Proveedor con ID "${id}" no encontrado.`);
    }

    return proveedor;
  }
}