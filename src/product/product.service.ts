import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Product } from './schemas/product.schema';
import { CreateProductDto, UpdateProductDto } from './dto/product.dto';

@Injectable()
export class ProductService {
  constructor(@InjectModel(Product.name) private productModel: Model<Product>) {}

  async create(dto: CreateProductDto): Promise<Product> {
    const newProduct = new this.productModel(dto);
    return newProduct.save();
  }

  async findAllAvailable(): Promise<Product[]> {
    return this.productModel.find({ stock: { $gt: 0 } }).exec();
  }

  async findById(id: string): Promise<Product> {
    const product = await this.productModel.findById(id).exec();
    if (!product) {
      throw new NotFoundException(`Producto con ID "${id}" no encontrado.`);
    }
    return product;
  }

  async update(id: string, dto: UpdateProductDto): Promise<Product> {
    const updatedProduct = await this.productModel
      .findByIdAndUpdate(id, dto, { new: true })
      .exec();
    if (!updatedProduct) {
      throw new NotFoundException(`Producto con ID "${id}" no encontrado.`);
    }
    return updatedProduct;
  }

  async delete(id: string): Promise<{ message: string }> {
    const result = await this.productModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException(`Producto con ID "${id}" no encontrado.`);
    }
    return { message: `Producto con ID "${id}" eliminado exitosamente.` };
  }

  async findAllForAdmin(): Promise<Product[]> {
    return this.productModel.find().sort({ nombre: 1 }).exec(); // Ordena alfabéticamente
  }
}