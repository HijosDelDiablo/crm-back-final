import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';
import { Rol } from '../auth/enums/rol.enum';

@Injectable()
export class UserService {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

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
    if (select) {
      query.select(select);
    }
    return query.exec();
  }

  async create(userData: Partial<User>): Promise<UserDocument> {
    const newUser = new this.userModel(userData);
    return newUser.save();
  }

  async update(id: string, updates: Partial<User>): Promise<UserDocument | null> {
    return this.userModel.findByIdAndUpdate(id, updates, { new: true }).exec();
  }

  async findAllUsers(): Promise<UserDocument[]> {
    return this.userModel.find().select('-password').sort({ nombre: 1 }).exec();
  }

  async updateUserRole(userId: string, newRole: Rol): Promise<UserDocument> {
    if (!Object.values(Rol).includes(newRole)) {
      throw new BadRequestException(`Rol "${newRole}" no es válido.`);
    }

    const updatedUser = await this.userModel
      .findByIdAndUpdate(
        userId,
        { rol: newRole },
        { new: true },
      )
      .select('-password');

    if (!updatedUser) {
      throw new NotFoundException(`Usuario con ID "${userId}" no encontrado.`);
    }

    return updatedUser;
  }

  async findAllClients(): Promise<UserDocument[]> {
    return this.userModel.find({ rol: Rol.CLIENTE }).select('-password').exec();
  }

  async findAllVendedores(): Promise<UserDocument[]> {
    return this.userModel.find({ rol: Rol.VENDEDOR }).select('-password').exec();
  }

  async updatePlayerId(userId: string, playerId: string): Promise<UserDocument> {
    const updatedUser = await this.userModel.findByIdAndUpdate(
      userId,
      { oneSignalPlayerId: playerId },
      { new: true },
    );

    if (!updatedUser) {
      throw new NotFoundException(`Usuario con ID "${userId}" no encontrado.`);
    }

    return updatedUser;
  }

  async getVendedorPlayerIds(): Promise<string[]> {
    const vendedores = await this.userModel.find({
      rol: Rol.VENDEDOR,
      oneSignalPlayerId: { $exists: true, $ne: null }
    }).select('oneSignalPlayerId').exec();
    
    return vendedores
      .map(v => v.oneSignalPlayerId)
      .filter((playerId): playerId is string => playerId !== null && playerId !== undefined);
  }
}