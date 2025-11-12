import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from './schemas/user.schema';
import { Rol } from '../auth/enums/rol.enum';

@Injectable()
export class UserService {
  constructor(@InjectModel(User.name) private userModel: Model<User>) {}

  async findByEmailWithPassword(email: string): Promise<User | null> {
    return this.userModel.findOne({ email }).select('+password').exec();
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userModel.findOne({ email }).exec();
  }

  async findByGoogleId(googleId: string): Promise<User | null> {
    return this.userModel.findOne({ googleId }).exec();
  }

  async findById(id: string, select?: string): Promise<User | null> {
    const query = this.userModel.findById(id);
    if (select) {
      query.select(select);
    }
    return query.exec();
  }

  async create(userData: Partial<User>): Promise<User> {
    const newUser = new this.userModel(userData);
    return newUser.save();
  }

  async update(id: string, updates: Partial<User>): Promise<User | null> {
    return this.userModel.findByIdAndUpdate(id, updates, { new: true }).exec();
  }

  async findAllUsers(): Promise<User[]> {
    return this.userModel.find().select('-password').sort({ nombre: 1 }).exec();
  }

  async updateUserRole(userId: string, newRole: Rol): Promise<User> {
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

  async findAllClients(): Promise<User[]> {
    return this.userModel.find({ rol: Rol.CLIENTE }).select('-password').exec();
  }

  async findAllVendedores(): Promise<User[]> {
    return this.userModel.find({ rol: Rol.VENDEDOR }).select('-password').exec();
  }
}
