import { Module } from '@nestjs/common';
import { EmailModuleService } from './email-module.service';
import { MailerModule } from '@nestjs-modules/mailer';
import { PugAdapter } from '@nestjs-modules/mailer/dist/adapters/pug.adapter';
import { EmailModuleController } from './email-module.controller';

const SMTP_HOST =  process.env.PERSONAL_EMAIL 
const SMTP_PORT = Number(process.env.PERSONAL_EMAIL_PORT );
// For this personal email module prefer PERSONAL_EMAIL credentials
const SMTP_USER = process.env.PERSONAL_EMAIL
const SMTP_PASS = process.env.PERSONAL_GOOGLE;

@Module({
  imports: [
    MailerModule.forRoot({
      transport: {
        host: SMTP_HOST,
        port: SMTP_PORT,
        secure: SMTP_PORT === 465, // true for 465, false for other ports
        auth: {
          user: SMTP_USER,
          pass: SMTP_PASS,
        },
      },
      template: {
        adapter: new PugAdapter({ inlineCssEnabled: true }),
        options: {
          strict: true,
        },
      },
    }),
  ],
  controllers: [EmailModuleController],
  providers: [EmailModuleService],
  exports: [EmailModuleService],
})
export class EmailModulePersonal {}