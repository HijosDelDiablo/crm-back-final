import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { GastosService } from './gastos.service';
import { GastosController } from './gastos.controller';
import { Gasto, GastoSchema } from './schemas/gasto.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Gasto.name, schema: GastoSchema },
    ]),
  ],
  controllers: [GastosController],
  providers: [GastosService],
  exports: [GastosService],
})
export class GastosModule {}