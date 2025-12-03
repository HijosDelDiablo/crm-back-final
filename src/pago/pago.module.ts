import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Pago, PagoSchema } from './schemas/pago.schema';
import { PagoService } from './pago.service';
import { PagoController } from './pago.controller';
import { Compra, CompraSchema } from '../compra/schemas/compra.schema';
import { CompraModule } from '../compra/compra.module';
import { Cotizacion, CotizacionSchema } from '../cotizacion/schemas/cotizacion.schema';
import { CotizacionModule } from '../cotizacion/cotizacion.module';
import { ProductModule } from '../product/product.module';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Pago.name, schema: PagoSchema },
            { name: Compra.name, schema: CompraSchema },
            { name: Cotizacion.name, schema: CotizacionSchema },
        ]),
        CompraModule,
        CotizacionModule,
        ProductModule,
    ],
    providers: [PagoService],
    controllers: [PagoController],
    exports: [PagoService],
})
export class PagoModule { }
