import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { User } from '../user/schemas/user.schema';
import { Product } from '../product/schemas/product.schema';
import { Cotizacion } from '../cotizacion/schemas/cotizacion.schema';

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

  async enviarCorreoCotizacion(cliente: User, coche: Product, cotizacion: Cotizacion) {
    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: cliente.email,
      subject: 'Tu cotización ha sido generada',
      html: `
        <h2>Hola ${cliente.nombre},</h2>
        <p>Tu cotización para el coche <b>${coche.marca} ${coche.modelo}</b> ha sido generada exitosamente.</p>
        <p><b>Pago mensual estimado:</b> $${cotizacion.pagoMensual}</p>
        <p><b>Plazo:</b> ${cotizacion.plazoMeses} meses</p>
        <p>Gracias por tu interés en nuestros vehículos.</p>
      `,
    };

    await this.transporter.sendMail(mailOptions);
    this.logger.log(`Correo de cotización enviado a ${cliente.email}`);
  }

  async enviarCorreoResultadoCotizacion(cliente: User, coche: Product, cotizacion: Cotizacion) {
    const aprobado = cotizacion.status === 'Aprobada';
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
}