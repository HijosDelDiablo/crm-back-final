import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { Cotizacion, CotizacionSchema } from '../cotizacion/schemas/cotizacion.schema';
import { Product, ProductSchema } from '../product/schemas/product.schema';
import { User, UserSchema } from '../user/schemas/user.schema';
import { CotizacionModule } from '../cotizacion/cotizacion.module';
import { CompraModule } from 'src/compra/compra.module';

@Module({
  imports: [
    CotizacionModule,
    CompraModule,
    MongooseModule.forFeature([
      { name: Cotizacion.name, schema: CotizacionSchema }, 
      { name: Product.name, schema: ProductSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}