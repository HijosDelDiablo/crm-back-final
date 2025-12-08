import { Controller, Post, Body, Logger } from '@nestjs/common';
import { EmailModuleService } from './email-module.service';
import { EmailTestDto } from './dto/email-test.dto';

@Controller('emailPersonal')
export class EmailModuleController {
  constructor(private readonly emailService: EmailModuleService) {}
   private readonly logger = new Logger(EmailModuleService.name);

  /**
   * POST /emailPersonal/test
   * Body: { to?: string, name?: string }
   * If `to` is not provided, will use TEST_EMAIL or EMAIL_FROM or PERSONAL_EMAIL from env.
   */
  @Post('test')
  async testEmail(@Body() body: EmailTestDto) {
    const { to, name, subject, message } = body || {};
    const recipient = to || process.env.PERSONAL_EMAIL;
    this.logger.debug(`Using recipient: ${recipient}`);
    if (!recipient) {
      return { ok: false, message: 'No recipient specified and no TEST_EMAIL/EMAIL_FROM/PERSONAL_EMAIL set' };
    }

    if (message) {
      // send custom message
      const useSubject = subject || 'Mensaje desde SmartAssistant';
      await this.emailService.sendSimpleEmail(recipient, useSubject, message, `<p>${message}</p>`);
      return { ok: true, to: recipient, subject: useSubject };
    }

    // fallback to default confirmation
    await this.emailService.sendUserConfirmation(recipient, name);
    return { ok: true, to: recipient };
  }
}
