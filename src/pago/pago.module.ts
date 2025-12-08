import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Pago, PagoSchema } from './schemas/pago.schema';
import { PagoService } from './pago.service';
import { PagoController } from './pago.controller';
import { Compra, CompraSchema } from '../compra/schemas/compra.schema';
import { Cotizacion, CotizacionSchema } from '../cotizacion/schemas/cotizacion.schema';
import { ProductModule } from '../product/product.module';
import { EmailModulePersonal } from '../email-module/email-module.module';
import { CompraModule } from '../compra/compra.module';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Pago.name, schema: PagoSchema },
            { name: Compra.name, schema: CompraSchema },
            { name: Cotizacion.name, schema: CotizacionSchema },
        ]),
        ProductModule,
        EmailModulePersonal,
        forwardRef(() => CompraModule),
    ],
    providers: [PagoService],
    controllers: [PagoController],
    exports: [PagoService],
})
export class PagoModule { }
