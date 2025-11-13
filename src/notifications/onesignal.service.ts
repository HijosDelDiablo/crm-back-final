import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class OneSignalService {
  private readonly logger = new Logger(OneSignalService.name);
  private readonly ONESIGNAL_APP_ID: string;
  private readonly ONESIGNAL_API_KEY: string;
  private readonly EMAIL_FROM: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.ONESIGNAL_APP_ID = this.configService.get<string>('ONESIGNAL_APP_ID')!;
    this.ONESIGNAL_API_KEY = this.configService.get<string>('ONESIGNAL_API_KEY')!;
    this.EMAIL_FROM = this.configService.get<string>('EMAIL_FROM')!;
  }

  async sendPushNotificationToPlayerIds(
    playerIds: string[],
    heading: string,
    message: string,
  ) {
    if (playerIds.length === 0) {
      this.logger.log('No hay Player IDs de Vendedor para notificar.');
      return;
    }

    const headers = {
      'Content-Type': 'application/json; charset=utf-8',
      'Authorization': `Basic ${this.ONESIGNAL_API_KEY}`,
    };

    const payload = {
      app_id: this.ONESIGNAL_APP_ID,
      include_player_ids: playerIds,
      headings: { en: heading, es: heading },
      contents: { en: message, es: message },
      // Opcional: URL de "deep link" para abrir la app de Flutter
      // app_url: 'smartassistant://cotizacion/nueva' 
    };

    try {
      const request = this.httpService.post(
        'https://onesignal.com/api/v1/notifications',
        payload,
        { headers },
      );
      await firstValueFrom(request);
      this.logger.log(`Notificación Push enviada a ${playerIds.length} vendedores.`);
    } catch (error) {
      this.logger.error(`Error al enviar Push Notification: ${error.message}`, error.stack);
      if (error.response) {
        this.logger.error('Respuesta de OneSignal:', error.response.data);
      }
    }
  }

  async enviarCodigo2FA(email: string, code: string) {
    const headers = {
      'Content-Type': 'application/json; charset=utf-8',
      'Authorization': `Basic ${this.ONESIGNAL_API_KEY}`,
    };

    const payload = {
      app_id: this.ONESIGNAL_APP_ID,
      include_email_tokens: [email],
      email_subject: 'Tu Código de Verificación 2FA',
      email_body: `
        <html>
        <head>
          <style> body { font-family: Arial, sans-serif; } </style>
        </head>
        <body>
          <h2>Código de Verificación de SmartAssistant</h2>
          <p>Hola,</p>
          <p>Tu código de verificación de dos pasos es:</p>
          <h1 style="font-size: 48px; letter-spacing: 5px; margin: 20px 0;">${code}</h1>
          <p>Este código expirará en 10 minutos.</p>
          <p>Si no solicitaste este código, puedes ignorar este correo.</p>
        </body>
        </html>
      `,
    };

    try {
      await this.httpService.axiosRef.post(
        'https://onesignal.com/api/v1/notifications',
        payload,
        { headers },
      );
      this.logger.log(`Correo 2FA enviado exitosamente a ${email}`);
    } catch (error) {
      this.logger.error(`Error al enviar correo 2FA: ${error.message}`, error.stack);
      if (error.response) {
        this.logger.error('Respuesta de OneSignal:', error.response.data);
      }
      throw error;
    }
  }

  async enviarEmailPersonalizado(email: string, subject: string, body: string): Promise<void> {
    const headers = {
      'Content-Type': 'application/json; charset=utf-8',
      'Authorization': `Basic ${this.ONESIGNAL_API_KEY}`,
    };

    const payload = {
      app_id: this.ONESIGNAL_APP_ID,
      include_email_tokens: [email],
      email_subject: subject,
      email_body: body,
      email_from_name: 'SmartAssistant CRM',
    };

    try {
      await this.httpService.axiosRef.post(
        'https://onesignal.com/api/v1/notifications',
        payload,
        { headers },
      );
      this.logger.log(`Email personalizado enviado a: ${email}`);
    } catch (error) {
      this.logger.error(`Error enviando email personalizado a ${email}:`, error.message);
      if (error.response) {
        this.logger.error('Respuesta de OneSignal:', error.response.data);
      }
      throw error;
    }
  }
}