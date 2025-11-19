import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CompraService } from './compra.service';
import { CompraController } from './compra.controller';
import { Compra, CompraSchema } from './schemas/compra.schema';
import { Cotizacion, CotizacionSchema } from '../cotizacion/schemas/cotizacion.schema';
import { User, UserSchema } from '../user/schemas/user.schema';
import { SimulacionService } from './services/simulacion.service';
import { EmailModule } from '../email/email.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Compra.name, schema: CompraSchema },
      { name: Cotizacion.name, schema: CotizacionSchema },
      { name: User.name, schema: UserSchema },
    ]),
    EmailModule,
    NotificationsModule,
  ],
  controllers: [CompraController],
  providers: [CompraService, SimulacionService],
  exports: [CompraService],
})
export class CompraModule {}