import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CotizacionService } from './cotizacion.service';
import { CompraModule } from '../compra/compra.module';
import { CotizacionController } from './cotizacion.controller';
import { Cotizacion, CotizacionSchema } from './schemas/cotizacion.schema';
import { Product, ProductSchema } from '../product/schemas/product.schema';
import { UserModule } from '../user/user.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { EmailModulePersonal } from '../email-module/email-module.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Cotizacion.name, schema: CotizacionSchema },
      { name: Product.name, schema: ProductSchema },
    ]),
    UserModule,
    NotificationsModule,
    CompraModule,
    EmailModulePersonal,
  ],
  controllers: [CotizacionController],
  providers: [CotizacionService],
  exports: [CotizacionService],
})
export class CotizacionModule { }