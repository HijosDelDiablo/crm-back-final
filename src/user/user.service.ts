import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';
import { Rol } from '../auth/enums/rol.enum';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UploadService } from '../upload/upload.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UserService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private readonly uploadService: UploadService,
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

  async uploadProfilePhoto(userId: string, file: Express.Multer.File): Promise<UserDocument> {
    const uploadResult = await this.uploadService.handleLocal(file);

    console.log('🔍 UploadResult completo:', JSON.stringify(uploadResult, null, 2));

    // Priorizar URL de UploadThing sobre URL local
    let imageUrl = uploadResult.publicUrl; // fallback a local

    if (uploadResult.uploadThingResult?.success && uploadResult.uploadThingResult?.data) {
      // La respuesta de UploadThing viene envuelta en { data: {...}, error: null }
      const utResponse = uploadResult.uploadThingResult.data;
      console.log('📤 UploadThing response structure:', JSON.stringify(utResponse, null, 2));

      // La data real está en utResponse.data
      if (utResponse.data) {
        const utData = utResponse.data;
        console.log('📤 UploadThing data structure:', JSON.stringify(utData, null, 2));

        // Usar ufsUrl que es la URL recomendada por UploadThing
        if (utData.ufsUrl) {
          imageUrl = utData.ufsUrl;
          console.log('✅ Usando utData.ufsUrl:', imageUrl);
        } else if (utData.url) {
          imageUrl = utData.url;
          console.log('✅ Usando utData.url:', imageUrl);
        } else if (utData.appUrl) {
          imageUrl = utData.appUrl;
          console.log('✅ Usando utData.appUrl:', imageUrl);
        } else {
          console.log('❌ No se encontró URL válida en UploadThing data');
        }
      } else {
        console.log('❌ No hay data en la respuesta de UploadThing');
      }
    } else {
      console.log('⚠️ No hay datos de UploadThing o falló la subida');
    }

    console.log('🎯 Final imageUrl:', imageUrl);

    const updatedUser = await this.userModel
      .findByIdAndUpdate(
        userId,
        {
          fotoPerfil: imageUrl,
          $set: {
            'documents.profilePic': { url: imageUrl, uploadedAt: new Date() }
          }
        },
        { new: true, upsert: true }
      )
      .select('-password');

    if (!updatedUser) {
      throw new NotFoundException(`Usuario con ID "${userId}" no encontrado.`);
    }

    return updatedUser;
  }

  async uploadDocument(userId: string, documentType: 'ine' | 'domicilio' | 'ingresos', file: Express.Multer.File): Promise<UserDocument> {
    const uploadResult = await this.uploadService.handleLocal(file);

    console.log(`🔍 UploadResult para ${documentType}:`, JSON.stringify(uploadResult, null, 2));

    // Priorizar URL de UploadThing sobre URL local
    let fileUrl = uploadResult.publicUrl; // fallback a local

    if (uploadResult.uploadThingResult?.success && uploadResult.uploadThingResult?.data) {
      // La respuesta de UploadThing viene envuelta en { data: {...}, error: null }
      const utResponse = uploadResult.uploadThingResult.data;
      console.log(`📤 UploadThing response structure para ${documentType}:`, JSON.stringify(utResponse, null, 2));

      // La data real está en utResponse.data
      if (utResponse.data) {
        const utData = utResponse.data;
        console.log(`📤 UploadThing data structure para ${documentType}:`, JSON.stringify(utData, null, 2));

        // Usar ufsUrl que es la URL recomendada por UploadThing
        if (utData.ufsUrl) {
          fileUrl = utData.ufsUrl;
          console.log(`✅ Usando utData.ufsUrl para ${documentType}:`, fileUrl);
        } else if (utData.url) {
          fileUrl = utData.url;
          console.log(`✅ Usando utData.url para ${documentType}:`, fileUrl);
        } else if (utData.appUrl) {
          fileUrl = utData.appUrl;
          console.log(`✅ Usando utData.appUrl para ${documentType}:`, fileUrl);
        } else {
          console.log(`❌ No se encontró URL válida en UploadThing data para ${documentType}`);
        }
      } else {
        console.log(`❌ No hay data en la respuesta de UploadThing para ${documentType}`);
      }
    } else {
      console.log(`⚠️ No hay datos de UploadThing o falló la subida para ${documentType}`);
    }

    console.log(`🎯 Final fileUrl para ${documentType}:`, fileUrl);

    const updatePath = `documents.${documentType}`;
    const updatedUser = await this.userModel
      .findByIdAndUpdate(
        userId,
        {
          $set: {
            [updatePath]: { url: fileUrl, uploadedAt: new Date() }
          }
        },
        { new: true, upsert: true }
      )
      .select('-password');

    if (!updatedUser) {
      throw new NotFoundException(`Usuario con ID "${userId}" no encontrado.`);
    }

    return updatedUser;
  }

  async getProfile(userId: string): Promise<any> {
    const user = await this.userModel
      .findById(userId)
      .select('-password -twoFactorSecret -twoFactorTempSecret');

    if (!user) {
      throw new NotFoundException(`Usuario con ID "${userId}" no encontrado.`);
    }

    // Calcular estado de documentos
    const documentsWithStatus = this.calculateDocumentStatus(user.documents);

    return {
      ...user.toObject(),
      documents: documentsWithStatus,
    };
  }

  private calculateDocumentStatus(documents?: any) {
    if (!documents) return {};

    const now = new Date();
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // Aproximadamente 1 mes

    const result: any = {};
    for (const key in documents) {
      if (documents[key]) {
        const uploadedAt = new Date(documents[key].uploadedAt);
        result[key] = {
          ...documents[key],
          status: uploadedAt < oneMonthAgo ? 'pasado' : 'actual',
        };
      }
    }
    return result;
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

  async registerAdmin(dto: { nombre: string; email: string; password: string; telefono?: string }): Promise<UserDocument> {
    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const newAdmin = new this.userModel({
      nombre: dto.nombre,
      email: dto.email,
      password: hashedPassword,
      telefono: dto.telefono,
      rol: Rol.ADMIN,
    });
    return newAdmin.save();
  }

  async getAdmins(): Promise<UserDocument[]> {
    return this.userModel.find({ rol: Rol.ADMIN }).select('-password').exec();
  }
  async getDocumentStatus(userId: string): Promise<any> {
    const user = await this.userModel
      .findById(userId)
      .select('documents');

    if (!user) {
      throw new NotFoundException(`Usuario con ID "${userId}" no encontrado.`);
    }

    const documentsWithStatus = this.calculateDocumentStatus(user.documents);

    return {
      ine: {
        uploaded: !!(user.documents?.ine?.url),
        status: documentsWithStatus.ine?.status || null,
        uploadedAt: user.documents?.ine?.uploadedAt || null,
        url: user.documents?.ine?.url || null
      },
      ingresos: {
        uploaded: !!(user.documents?.ingresos?.url),
        status: documentsWithStatus.ingresos?.status || null,
        uploadedAt: user.documents?.ingresos?.uploadedAt || null,
        url: user.documents?.ingresos?.url || null
      },
      domicilio: {
        uploaded: !!(user.documents?.domicilio?.url),
        status: documentsWithStatus.domicilio?.status || null,
        uploadedAt: user.documents?.domicilio?.uploadedAt || null,
        url: user.documents?.domicilio?.url || null
      }
    };
  }
}
  