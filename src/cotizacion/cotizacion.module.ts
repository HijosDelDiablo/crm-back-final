import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CotizacionService } from './cotizacion.service';
import { CotizacionController } from './cotizacion.controller';
import { Cotizacion, CotizacionSchema } from './schemas/cotizacion.schema';
import { Product, ProductSchema } from '../product/schemas/product.schema';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Cotizacion.name, schema: CotizacionSchema },
      { name: Product.name, schema: ProductSchema },
    ]),
    EmailModule,
  ],
  controllers: [CotizacionController],
  providers: [CotizacionService],
})
export class CotizacionModule {}