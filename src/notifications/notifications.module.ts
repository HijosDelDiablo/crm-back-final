import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { OneSignalService } from './onesignal.service';

@Module({
  imports: [
    HttpModule,
  ],
  providers: [OneSignalService],
  exports: [OneSignalService],
})
export class NotificationsModule {}