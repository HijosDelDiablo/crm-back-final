import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Pago, PagoSchema } from './schemas/pago.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: Pago.name, schema: PagoSchema }])],
  exports: [MongooseModule],
})
export class PagoModule {}
