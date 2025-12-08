import { MailerService } from '@nestjs-modules/mailer';
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class EmailModuleService {
   private readonly logger = new Logger(EmailModuleService.name);

   constructor(readonly mailerService: MailerService) {}

   /**
    * Send a simple email (text and/or html).
    * Returns the result from MailerService.sendMail
    */
   async sendSimpleEmail(
      to: string,
      subject: string,
      text?: string,
      html?: string,
   ) {
         // Use PERSONAL_EMAIL as sender when available (this module sends from the personal account)
        // Determine sender (prefer PERSONAL_EMAIL for this module)
        const senderEmail = process.env.PERSONAL_EMAIL;
        const senderName = process.env.PERSONAL_NAME || 'SmartAssistant CRM';
        const fromHeader = senderEmail ? `${senderName} <${senderEmail}>` : undefined;
        this.logger.debug(`Using sender: ${fromHeader || '<none>'}`);
      try {
         const result = await this.mailerService.sendMail({
            to,
           // set explicit from header (overrides global default if permitted by SMTP)
           from: fromHeader,
            subject,
            text,
            html,
         });
         this.logger.debug(`Email sent to ${to}: ${subject}`);
         return result;
      } catch (error) {
         this.logger.error('Error sending email', error as any);
         throw error;
      }
   }

   /**
    * Convenience method to send a simple confirmation email.
    */
   async sendUserConfirmation(to: string, name?: string) {
      const subject = 'Confirmación de registro';
      this.logger.debug(`Sending user confirmation to ${to}`);
      const greeting = name ? `Hola ${name},` : 'Hola,';
      const plain = `${greeting}\n\nGracias por registrarte. Este es un correo de confirmación.`;
      const html = `<p>${greeting}</p><p>Gracias por registrarte. Este es un correo de confirmación.</p>`;
      return this.sendSimpleEmail(to, subject, plain, html);
   }
}