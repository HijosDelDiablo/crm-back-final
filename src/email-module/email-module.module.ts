import { Module } from '@nestjs/common';
import { EmailModuleService } from './email-module.service';
import { EmailModuleController } from './email-module.controller';

@Module({
  imports: [],
  controllers: [EmailModuleController],
  providers: [EmailModuleService],
  exports: [EmailModuleService],
})
export class EmailModulePersonal {}