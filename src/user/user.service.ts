import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';
import { Rol } from '../auth/enums/rol.enum';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class UserService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) { }

  async findByEmailWithPassword(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email }).select('+password').exec();
  }

  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email }).exec();
  }

  async findByGoogleId(googleId: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ googleId }).exec();
  }

  async findById(id: string, select?: string): Promise<UserDocument | null> {
    const query = this.userModel.findById(id);
    if (select) query.select(select);
    return query.exec();
  }

  async create(userData: Partial<User>): Promise<UserDocument> {
    const newUser = new this.userModel(userData);
    return newUser.save();
  }
  async createAdmin(userData: Partial<User>): Promise<UserDocument> {
    const newUser = new this.userModel({  ...userData, rol: Rol.ADMIN });
    return newUser.save();
  }

  async update(id: string, updates: Partial<User>): Promise<UserDocument | null> {
    return this.userModel.findByIdAndUpdate(id, updates, { new: true }).exec();
  }

  async findAllUsers(): Promise<UserDocument[]> {
    return this.userModel.find()
      .select('-password')
      .sort({ nombre: 1 })
      .exec();
  }

  async updateUserRole(userId: string, newRole: Rol): Promise<UserDocument> {
    if (!Object.values(Rol).includes(newRole)) {
      throw new BadRequestException(`Rol "${newRole}" no es válido.`);
    }

    const updatedUser = await this.userModel
      .findByIdAndUpdate(userId, { rol: newRole }, { new: true })
      .select('-password');

    if (!updatedUser) {
      throw new NotFoundException(`Usuario con ID "${userId}" no encontrado.`);
    }

    return updatedUser;
  }

  async findAllVendedores(): Promise<UserDocument[]> {
    return this.userModel.find({ rol: Rol.VENDEDOR })
      .select('-password')
      .exec();
  }

  async getVendedorPlayerIds(): Promise<string[]> {
    const vendedores = await this.userModel.find({
      rol: Rol.VENDEDOR,
      oneSignalPlayerId: { $exists: true, $ne: null }
    }).select('oneSignalPlayerId');

    return vendedores
      .map(v => v.oneSignalPlayerId)
      .filter((id): id is string => id !== null && id !== undefined);
  }

  async findAllClients(): Promise<UserDocument[]> {
    const clients = await this.userModel.find({ rol: Rol.CLIENTE })
      .select('-password -twoFactorSecret -twoFactorTempSecret')
      .populate('vendedorQueAtiende', 'nombre email fotoPerfil')
      .sort({ nombre: 1 })
      .exec();
    return clients;
  }

  async updatePlayerId(userId: string, playerId: string): Promise<UserDocument> {
    const updatedUser = await this.userModel.findByIdAndUpdate(
      userId,
      { oneSignalPlayerId: playerId },
      { new: true }
    );

    if (!updatedUser) {
      throw new NotFoundException(`Usuario con ID "${userId}" no encontrado.`);
    }

    return updatedUser;
  }

  async updateProfile(userId: string, updateProfileDto: UpdateProfileDto): Promise<UserDocument> {
    const updatedUser = await this.userModel
      .findByIdAndUpdate(
        userId,
        { $set: updateProfileDto },
        { new: true }
      )
      .select('-password -twoFactorSecret -twoFactorTempSecret');

    if (!updatedUser) {
      throw new NotFoundException(`Usuario con ID "${userId}" no encontrado.`);
    }

    return updatedUser;
  }

  async uploadProfilePhoto(userId: string, imageUrl: string): Promise<UserDocument> {
    const updatedUser = await this.userModel
      .findByIdAndUpdate(
        userId,
        { fotoPerfil: imageUrl },
        { new: true }
      )
      .select('-password');

    if (!updatedUser) {
      throw new NotFoundException(`Usuario con ID "${userId}" no encontrado.`);
    }

    return updatedUser;
  }

  async getProfile(userId: string): Promise<UserDocument> {
    const user = await this.userModel
      .findById(userId)
      .select('-password -twoFactorSecret -twoFactorTempSecret');

    if (!user) {
      throw new NotFoundException(`Usuario con ID "${userId}" no encontrado.`);
    }

    return user;
  }

  async getVendedoresOrdenadosPorClientes(): Promise<UserDocument[]> {
    try {
      const vendedores = await this.userModel.aggregate([
        {
          $match: { rol: 'VENDEDOR' }
        },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: 'vendedorQueAtiende',
            as: 'clientesAsignados'
          }
        },
        {
          $addFields: {
            cantidadClientes: { $size: '$clientesAsignados' }
          }
        },
        {
          $sort: { cantidadClientes: 1 }
        }
      ]);

      return vendedores;
    } catch (error) {
      //this.logger.error('Error obteniendo vendedores ordenados por clientes:', error);
      throw new Error('No se pudo obtener la lista de vendedores.');
    }
  }
  async findAllClientsOfSeller(idSeller: string): Promise<UserDocument[]> {
    const clients = await this.userModel.find({ rol: Rol.CLIENTE, vendedorQueAtiende: idSeller })
      .select('-password -twoFactorSecret -twoFactorTempSecret')
      .sort({ nombre: 1 })
      .exec();
    return clients;
  }
  async setSellerToClient(clientId: string, sellerId: string): Promise<UserDocument> {
    const updatedClient = await this.userModel
      .findByIdAndUpdate(
        clientId,
        { vendedorQueAtiende: sellerId },
        { new: true }
      )
      .select('-password -twoFactorSecret -twoFactorTempSecret');
    if (!updatedClient) {
      throw new NotFoundException(`Cliente con ID "${clientId}" no encontrado.`);
    }
    return updatedClient;
  }
  async updateSellerToClient(clientId: string, sellerId: string): Promise<UserDocument> {
    const updatedClient = await this.userModel
      .findByIdAndUpdate(
        clientId,
        { vendedorQueAtiende: sellerId },
        { new: false }
      )
      .select('-password -twoFactorSecret -twoFactorTempSecret');
    if (!updatedClient) {
      throw new NotFoundException(`Cliente con ID "${clientId}" no encontrado.`);
    }
    return updatedClient;
  }

  async getVendedoresConResenas(): Promise<any[]> {
    try {
      const vendedores = await this.userModel.aggregate([
        {
          $match: { rol: 'VENDEDOR' }
        },
        {
          $lookup: {
            from: 'sellerreviews',
            localField: '_id',
            foreignField: 'vendedorId',
            as: 'resenas'
          }
        },
        {
          $lookup: {
            from: 'users',
            let: { vendedorId: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$rol', 'CLIENTE'] },
                      { $eq: ['$vendedorQueAtiende', '$$vendedorId'] }
                    ]
                  }
                }
              },
              { $limit: 3 },
              {
                $project: {
                  _id: 1,
                  nombre: 1,
                  email: 1,
                  fotoPerfil: 1,
                  telefono: 1
                }
              }
            ],
            as: 'clientesMuestra'
          }
        },
        {
          $addFields: {
            totalResenas: { $size: '$resenas' },
            promedioEstrellas: {
              $cond: {
                if: { $gt: [{ $size: '$resenas' }, 0] },
                then: { $avg: '$resenas.puntuacion' },
                else: 0
              }
            }
          }
        },
        {
          $project: {
            _id: 1,
            activo: 1,
            nombre: 1,
            email: 1,
            fotoPerfil: 1,
            telefono: 1,
            fechaNacimiento: 1,
            totalResenas: 1,
            promedioEstrellas: 1,
            resenas: {
              _id: 1,
              mensaje: 1,
              puntuacion: 1,
              fecha: 1,
              clienteId: 1
            },
            clientesMuestra: 1
          }
        },
        {
          $sort: { promedioEstrellas: -1 }
        }
      ]);

      // Populate clienteId in resenas
      for (const vendedor of vendedores) {
        if (vendedor.resenas && vendedor.resenas.length > 0) {
          await this.userModel.populate(vendedor.resenas, {
            path: 'clienteId',
            select: 'nombre email fotoPerfil'
          });
        }
      }

      return vendedores;
    } catch (error) {
      throw new Error('No se pudo obtener la lista de vendedores con reseñas.');
    }
  }

  async desactivateSeller(sellerId: string): Promise<{ message: string }> {
    const updatedSeller = await this.userModel
      .findByIdAndUpdate(
        sellerId,
        { activo: false },
        { new: true }
      )
      .select('-password');
    if (!updatedSeller) {
      throw new NotFoundException(`Vendedor con ID "${sellerId}" no encontrado.`);
    }
    return { message: `Vendedor con ID "${sellerId}" desactivado correctamente.` };
  }
  async activateSeller(sellerId: string): Promise<{ message: string }> {
    const updatedSeller = await this.userModel
      .findByIdAndUpdate(
        sellerId,
        { activo: true },
        { new: true }
      )
      .select('-password');
    if (!updatedSeller) {
      throw new NotFoundException(`Vendedor con ID "${sellerId}" no encontrado.`);
    }
    return { message: `Vendedor con ID "${sellerId}" activado correctamente.` };
  }
}