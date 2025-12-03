import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Product, ProductDocument } from './schemas/product.schema';
import { Proveedor, ProveedorDocument } from '../proveedores/schemas/proveedor.schema';
import { CreateProductDto, UpdateProductDto } from './dto/product.dto';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { extname } from 'path';

@Injectable()
export class ProductService {
  constructor(
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    @InjectModel(Proveedor.name) private proveedorModel: Model<ProveedorDocument>,
  ) { }

  private readonly s3Client = new S3Client({ region: 'us-east-2' });
  private readonly s3BucketName = 'hijosdeldiablo-smartassistant-uploads';

  async create(dto: CreateProductDto): Promise<Product> {
    const productData: any = {
      ...dto,
      vin: dto.vin.toUpperCase(),
      stock: dto.stock || 1, // Cantidad en stock, default 1
    };

    if (dto.proveedor) {
      // Validar que el proveedor existe
      const proveedor = await this.proveedorModel.findById(dto.proveedor);
      if (!proveedor) {
        throw new NotFoundException('Proveedor no encontrado');
      }
      productData.proveedor = new Types.ObjectId(dto.proveedor);
    }

    const newProduct = new this.productModel(productData);
    return newProduct.save();
  }

  async findAllAvailable(): Promise<Product[]> {
    return this.productModel
      .find({ disponible: true, activo: true, stock: { $gt: 0 } })
      .populate('proveedor', 'nombre contacto')
      .exec();
  }

  async findById(id: string): Promise<Product> {
    const product = await this.productModel
      .findById(id)
      .populate('proveedor', 'nombre contacto email telefono')
      .exec();
    if (!product) {
      throw new NotFoundException(`Producto con ID "${id}" no encontrado.`);
    }
    return product;
  }

  async update(id: string, dto: UpdateProductDto): Promise<Product> {
    const updateData = { ...dto };
    if (dto.vin) {
      updateData.vin = dto.vin.toUpperCase();
    }

    if (dto.proveedor !== undefined) {
      if (dto.proveedor) {
        // Validar que el proveedor existe
        const proveedor = await this.proveedorModel.findById(dto.proveedor);
        if (!proveedor) {
          throw new NotFoundException('Proveedor no encontrado');
        }
        updateData.proveedor = new Types.ObjectId(dto.proveedor);
      } else {
        // Si viene vacío, quitar el proveedor
        updateData.proveedor = null;
      }
    }

    const updatedProduct = await this.productModel
      .findByIdAndUpdate(id, { $set: updateData }, { new: true })
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
    return this.productModel
      .find()
      .populate('proveedor', 'nombre contacto email telefono')
      .sort({ marca: 1, modelo: 1 })
      .exec();
  }

  async uploadImageAndUpdateProduct(
    productId: string,
    file: Express.Multer.File,
  ): Promise<Product> {
    if (!file) {
      throw new BadRequestException('No se proporcionó ningún archivo.');
    }

    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = extname(file.originalname);
    const fileKey = `products/${productId}-${uniqueSuffix}${ext}`;

    try {
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.s3BucketName,
          Key: fileKey,
          Body: file.buffer,
          ContentType: file.mimetype,
          ACL: 'public-read',
        }),
      );
    } catch (error) {
      console.error('Error subiendo a S3:', error);
      throw new Error('No se pudo subir la imagen a S3.');
    }

    const imageUrl = `https://${this.s3BucketName}.s3.us-east-2.amazonaws.com/${fileKey}`;

    return this.update(productId, { imageUrl });
  }

  async findByVin(vin: string): Promise<Product> {
    const normalizedVin = vin.trim().toUpperCase();

    const product = await this.productModel
      .findOne({ vin: normalizedVin })
      .exec();

    if (!product) {
      throw new NotFoundException(`Coche con VIN "${vin}" no encontrado.`);
    }

    return product;
  }

  async updateStock(productId: string, newStock: number): Promise<Product> {
    const product = await this.productModel.findById(productId);
    if (!product) {
      throw new NotFoundException(`Producto con ID "${productId}" no encontrado.`);
    }

    const updatedProduct = await this.productModel
      .findByIdAndUpdate(
        productId,
        {
          stock: newStock,
          disponible: newStock > 0,
        },
        { new: true },
      )
      .exec();

    if (!updatedProduct) {
      throw new NotFoundException(`Producto con ID "${productId}" no encontrado.`);
    }

    return updatedProduct;
  }

  async decrementStock(productId: string, quantity: number = 1): Promise<Product> {
    const product = await this.productModel.findById(productId);

    if (!product) {
      throw new NotFoundException(`Producto con ID "${productId}" no encontrado.`);
    }

    if (product.stock < quantity) {
      throw new BadRequestException(
        `Stock insuficiente. Stock actual: ${product.stock}`,
      );
    }

    const newStock = product.stock - quantity;

    const updatedProduct = await this.productModel
      .findByIdAndUpdate(
        productId,
        {
          stock: newStock,
          disponible: newStock > 0,
          $inc: { vecesVendido: quantity },
        },
        { new: true },
      )
      .exec();

    if (!updatedProduct) {
      throw new NotFoundException(`Producto con ID "${productId}" no encontrado.`);
    }

    return updatedProduct;
  }

  async incrementStock(productId: string, quantity: number = 1): Promise<Product> {
    const product = await this.productModel.findById(productId);
    if (!product) {
      throw new NotFoundException(`Producto con ID "${productId}" no encontrado.`);
    }

    const updatedProduct = await this.productModel
      .findByIdAndUpdate(
        productId,
        {
          $inc: { stock: quantity },
          disponible: true,
        },
        { new: true },
      )
      .exec();

    if (!updatedProduct) {
      throw new NotFoundException(`Producto con ID "${productId}" no encontrado.`);
    }

    return updatedProduct;
  }

  async comprarProducto(
    productId: string,
    costoCompra: number,
    proveedorId?: string,
    compradoPor?: string,
  ): Promise<Product> {
    const updateData: any = {
      costoCompra,
      fechaCompra: new Date(),
      $inc: { stock: 1 },
    };

    if (proveedorId) updateData.proveedor = new Types.ObjectId(proveedorId);
    if (compradoPor) updateData.compradoPor = new Types.ObjectId(compradoPor);

    const updatedProduct = await this.productModel
      .findByIdAndUpdate(productId, updateData, { new: true })
      .populate('proveedor')
      .populate('compradoPor')
      .exec();

    if (!updatedProduct) {
      throw new NotFoundException(`Producto con ID "${productId}" no encontrado.`);
    }

    return updatedProduct;
  }

  async getLowStock(threshold: number = 2): Promise<Product[]> {
    return this.productModel
      .find({
        stock: { $lte: threshold },
        activo: true,
      })
      .populate('proveedor', 'nombre contacto')
      .sort({ stock: 1 })
      .exec();
  }

  async getProductStats(): Promise<any> {
    const stats = await this.productModel.aggregate([
      { $match: { activo: true } },
      {
        $group: {
          _id: null,
          totalProductos: { $sum: 1 },
          totalStock: { $sum: '$stock' },
          valorTotalInventario: {
            $sum: { $multiply: ['$stock', '$precioBase'] },
          },
          costoTotalInventario: {
            $sum: { $multiply: ['$stock', '$costoCompra'] },
          },
          productosSinStock: {
            $sum: { $cond: [{ $eq: ['$stock', 0] }, 1, 0] },
          },
          productosBajoStock: {
            $sum: { $cond: [{ $lte: ['$stock', 2] }, 1, 0] },
          },
        },
      },
    ]);

    return stats.length > 0 ? stats[0] : {};
  }

  async asignarProveedor(productId: string, proveedorId: string): Promise<Product> {
    // Validar que el producto existe
    const product = await this.productModel.findById(productId);
    if (!product) {
      throw new NotFoundException('Producto no encontrado');
    }

    // Validar que el proveedor existe
    const proveedor = await this.proveedorModel.findById(proveedorId);
    if (!proveedor) {
      throw new NotFoundException('Proveedor no encontrado');
    }

    // Actualizar el producto
    product.proveedor = new Types.ObjectId(proveedorId);
    await product.save();

    // Retornar con populate
    return this.productModel
      .findById(productId)
      .populate('proveedor', 'nombre contacto email telefono')
      .exec();
  }

  async findByProveedor(proveedorId: string): Promise<Product[]> {
    return this.productModel
      .find({ proveedor: proveedorId })
      .populate('proveedor', 'nombre contacto email telefono')
      .sort({ createdAt: -1 })
      .exec();
  }
}