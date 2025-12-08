import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { User } from '../user/schemas/user.schema';
import { Product } from '../product/schemas/product.schema';
import { Cotizacion, StatusCotizacion } from '../cotizacion/schemas/cotizacion.schema';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_SERVER,
      port: parseInt(process.env.SMTP_PORT ?? '587'),
      secure: false,
      auth: {
        user: process.env.EMAIL_FROM,
        pass: process.env.EMAIL_PASSWORD,
      },
    });
  }

  // Métodos existentes de cotización
  async enviarCorreoCotizacion(cliente: User, coche: Product, cotizacion: Cotizacion) {
    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: cliente.email,
      subject: 'Tu cotización ha sido generada',
      html: `
        <h2>Hola ${cliente.nombre},</h2>
        <p>Tu cotización para el coche <b>${coche.marca} ${coche.modelo}</b> ha sido generada exitosamente.</p>
        <p><b>Pago mensual estimado:</b> ${cotizacion.pagoMensual}</p>
        <p><b>Plazo:</b> ${cotizacion.plazoMeses} meses</p>
        <p>Gracias por tu interés en nuestros vehículos.</p>
      `,
    };

    await this.transporter.sendMail(mailOptions);
    this.logger.log(`Correo de cotización enviado a ${cliente.email}`);
  }

  async enviarCorreoResultadoCotizacion(cliente: User, coche: Product, cotizacion: Cotizacion) {
    const aprobado = cotizacion.status === StatusCotizacion.APROBADA;
    const asunto = aprobado
      ? '¡Tu solicitud ha sido aprobada!'
      : 'solicitud rechazada';
    const mensaje = aprobado
      ? `
        <p>Nos complace informarte que tu solicitud para el coche <b>${coche.marca} ${coche.modelo}</b> ha sido <b>APROBADA</b>.</p>
        <p>Un asesor se pondrá en contacto contigo para continuar con el proceso.</p>
      `
      : `
        <p>Lamentamos informarte que tu solicitud para el coche <b>${coche.marca} ${coche.modelo}</b> ha sido <b>RECHAZADA</b>.</p>
        <p>Si deseas revisar otras opciones de financiamiento, contáctanos.</p>
      `;

    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: cliente.email,
      subject: asunto,
      html: `
        <h2>Hola ${cliente.nombre},</h2>
        ${mensaje}
        <br/>
        <p>Gracias por confiar en nosotros.</p>
        <p><i>Atentamente,<br/>El equipo de Ventas</i></p>
      `,
    };

    await this.transporter.sendMail(mailOptions);
    this.logger.log(`Correo de resultado (${cotizacion.status}) enviado a ${cliente.email}`);
  }

  async enviarCodigo2FA(email: string, code: string): Promise<void> {
    try {
      const mailOptions = {
        from: process.env.EMAIL_FROM,
        to: email,
        subject: 'Tu Código de Verificación 2FA - SmartAssistant',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { 
                font-family: Arial, sans-serif; 
                line-height: 1.6; 
                color: #333;
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
              }
              .container {
                background: #f9fafb;
                border-radius: 8px;
                padding: 30px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
              }
              .header {
                background: #2563eb;
                color: white;
                padding: 20px;
                text-align: center;
                border-radius: 8px 8px 0 0;
                margin: -30px -30px 20px -30px;
              }
              .code-box {
                background: white;
                border: 2px solid #2563eb;
                border-radius: 8px;
                padding: 20px;
                text-align: center;
                margin: 30px 0;
              }
              .code {
                font-size: 48px;
                font-weight: bold;
                letter-spacing: 8px;
                color: #2563eb;
                font-family: 'Courier New', monospace;
              }
              .warning {
                background: #fef3c7;
                border-left: 4px solid #f59e0b;
                padding: 12px;
                margin: 20px 0;
                border-radius: 4px;
              }
              .footer {
                margin-top: 30px;
                padding-top: 20px;
                border-top: 1px solid #e5e7eb;
                color: #6b7280;
                font-size: 14px;
                text-align: center;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1 style="margin: 0;">🔐 SmartAssistant CRM</h1>
                <p style="margin: 10px 0 0 0;">Código de Verificación 2FA</p>
              </div>
              
              <p>Hola,</p>
              <p>Has solicitado activar la autenticación de dos factores en tu cuenta.</p>
              
              <div class="code-box">
                <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 14px;">Tu código de verificación es:</p>
                <div class="code">${code}</div>
              </div>
              
              <div class="warning">
                <strong>⚠️ Importante:</strong>
                <ul style="margin: 10px 0 0 0; padding-left: 20px;">
                  <li>Este código expirará en <strong>10 minutos</strong></li>
                  <li>No compartas este código con nadie</li>
                  <li>Si no solicitaste este código, ignora este email</li>
                </ul>
              </div>
              
              <div class="footer">
                <p>Este es un email automático, por favor no respondas a este mensaje.</p>
                <p>© ${new Date().getFullYear()} SmartAssistant CRM. Todos los derechos reservados.</p>
              </div>
            </div>
          </body>
          </html>
        `,
      };

      await this.transporter.sendMail(mailOptions);
      this.logger.log(`✅ Código 2FA enviado exitosamente a ${email}`);
    } catch (error) {
      this.logger.error(`❌ Error enviando código 2FA a ${email}:`, error.message);
      this.logger.error('Stack trace:', error.stack);
      throw error;
    }
  }

  async enviarEmailPersonalizado(
    email: string,
    subject: string,
    body: string,
  ): Promise<void> {
    try {
      const mailOptions = {
        from: process.env.EMAIL_FROM,
        to: email,
        subject: subject,
        html: body,
      };

      await this.transporter.sendMail(mailOptions);
      this.logger.log(`✅ Email personalizado enviado a ${email}`);
    } catch (error) {
      this.logger.error(`❌ Error enviando email a ${email}:`, error.message);
      throw error;
    }
  }
}