import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Pago, PagoSchema } from './schemas/pago.schema';
import { PagoService } from './pago.service';
import { PagoController } from './pago.controller';
import { Compra, CompraSchema } from '../compra/schemas/compra.schema';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Pago.name, schema: PagoSchema },
            { name: Compra.name, schema: CompraSchema },
        ]),
    ],
    providers: [PagoService],
    controllers: [PagoController],
    exports: [PagoService],
})
export class PagoModule { }
