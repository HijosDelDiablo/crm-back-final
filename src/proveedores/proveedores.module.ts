import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ProveedoresService } from './proveedores.service';
import { ProveedoresController } from './proveedores.controller';
import { ProveedoresPublicController } from './proveedores.public.controller';
import { Proveedor, ProveedorSchema } from './schemas/proveedor.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Proveedor.name, schema: ProveedorSchema },
    ]),
  ],
  controllers: [ProveedoresController, ProveedoresPublicController],
  providers: [ProveedoresService],
  exports: [ProveedoresService],
})
export class ProveedoresModule {}