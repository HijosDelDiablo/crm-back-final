import { Module } from '@nestjs/common';
import { IamodelService } from './iamodel.service';
import { IamodelController } from './iamodel.controller';
import { HttpModule } from '@nestjs/axios';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { Cotizacion, CotizacionSchema } from '../cotizacion/schemas/cotizacion.schema';
import { Product, ProductSchema } from '../product/schemas/product.schema';
import { User, UserSchema } from '../user/schemas/user.schema';
import { Task, TaskSchema } from '../tasks/schemas/task.schema';
import { Gasto, GastoSchema } from '../gastos/schemas/gasto.schema';

@Module({
  imports: [
    HttpModule,
    ConfigModule,
    MongooseModule.forFeature([
      { name: Cotizacion.name, schema: CotizacionSchema },
      { name: Product.name, schema: ProductSchema },
      { name: User.name, schema: UserSchema },
      { name: Task.name, schema: TaskSchema },
      { name: Gasto.name, schema: GastoSchema },
    ]),
  ],
  controllers: [IamodelController],
  providers: [IamodelService],
})
export class IamodelModule {}