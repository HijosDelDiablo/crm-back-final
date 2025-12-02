import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SellerReview, SellerReviewDocument } from './schemas/seller-review.schema';
import { CreateSellerReviewDto } from './dto/create-seller-review.dto';
import { UserService } from '../user/user.service';
import { Rol } from '../auth/enums/rol.enum';

@Injectable()
export class SellerReviewService {
  constructor(
    @InjectModel(SellerReview.name) private sellerReviewModel: Model<SellerReviewDocument>,
    private readonly userService: UserService,
  ) {}

  async create(createSellerReviewDto: CreateSellerReviewDto, clienteId: string): Promise<SellerReviewDocument> {
    // Validar que el vendedor existe y tiene rol VENDEDOR
    const vendedor = await this.userService.findById(createSellerReviewDto.vendedorId);
    if (!vendedor) {
      throw new NotFoundException(`Vendedor con ID "${createSellerReviewDto.vendedorId}" no encontrado.`);
    }
    if (vendedor.rol !== Rol.VENDEDOR) {
      throw new BadRequestException('El usuario especificado no es un vendedor.');
    }

    // Validar que el cliente existe y tiene rol CLIENTE
    const cliente = await this.userService.findById(clienteId);
    if (!cliente) {
      throw new NotFoundException(`Cliente con ID "${clienteId}" no encontrado.`);
    }
    if (cliente.rol !== Rol.CLIENTE) {
      throw new BadRequestException('Solo los clientes pueden crear reseñas.');
    }

    // Validar que el cliente está asignado a este vendedor
    if (!cliente.vendedorQueAtiende || cliente.vendedorQueAtiende.toString() !== createSellerReviewDto.vendedorId) {
      throw new BadRequestException('Solo puedes crear reseñas para el vendedor que te atiende.');
    }

    // Crear la reseña
    const newReview = new this.sellerReviewModel({
      ...createSellerReviewDto,
      clienteId,
      fecha: new Date(),
    });

    return newReview.save();
  }

  async findAll(): Promise<SellerReviewDocument[]> {
    return this.sellerReviewModel
      .find()
      .populate('vendedorId', 'nombre email fotoPerfil')
      .populate('clienteId', 'nombre email fotoPerfil')
      .sort({ fecha: -1 })
      .exec();
  }

  async findByVendedor(vendedorId: string): Promise<SellerReviewDocument[]> {
    // Validar que el vendedor existe
    const vendedor = await this.userService.findById(vendedorId);
    if (!vendedor) {
      throw new NotFoundException(`Vendedor con ID "${vendedorId}" no encontrado.`);
    }

    return this.sellerReviewModel
      .find({ vendedorId })
      .populate('clienteId', 'nombre email fotoPerfil')
      .sort({ fecha: -1 })
      .exec();
  }
}
