const nodemailer = require('nodemailer');
const winston = require('winston');
require('dotenv').config();

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(
      ({ timestamp, level, message }) => `${timestamp} [${level.toUpperCase()}]: ${message}`
    )
  ),
  transports: [
    new winston.transports.Console(),
  ],
});

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT, 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    this.transporter.verify((error, success) => {
      if (error) {
        logger.error(`SMTP connection error: ${error.message}`);
      } else {
        logger.info('SMTP server is ready to take messages');
      }
    });
  }

  async sendSupportEmail(options) {
    const supportEmails = process.env.SUPPORT_EMAIL
      ? process.env.SUPPORT_EMAIL.split(',').map(email => email.trim())
      : [];

    if (supportEmails.length === 0) {
      logger.warn('No SUPPORT_EMAIL defined in environment variables.');
      return false;
    }

    const supportMailOptions = {
      from: `"RifasCAI Support" <${process.env.SMTP_USER}>`,
      to: supportEmails,
      subject: options.subject,
      html: options.html,
    };

    try {
      await this.transporter.sendMail(supportMailOptions);
      logger.info(`Support email sent to: ${supportEmails.join(', ')}`);
      return true;
    } catch (error) {
      logger.error(`Error sending support email: ${error.message}`);
      return false;
    }
  }

  async sendPaymentVerificationEmail(userEmail, fullName) {
    const userMailOptions = {
      from: `"RifasCAI Support" <${process.env.SMTP_USER}>`,
      to: userEmail,
      subject: 'Verificación de Pago en Proceso',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
          <!-- Header with Logo -->
          <div style="background-color: #6a1b9a; padding: 20px; text-align: center;">
            <img src="https://rifascai.com/cailogo.png" alt="RifasCAI Logo" style="max-width: 200px; height: auto;"/>
          </div>
          
          <!-- Email Content -->
          <div style="padding: 30px;">
            <h2 style="color: #6a1b9a; margin-bottom: 20px;">Verificación de Pago en Proceso</h2>
            <p>Estimado/a ${fullName},</p>
            <p>Hemos recibido su pago y actualmente está siendo verificado por nuestro equipo.</p>
            <p>Le enviaremos otro correo electrónico una vez que la verificación esté completa.</p>
            <p>Si tiene alguna pregunta, no dude en contactar a nuestro equipo de soporte.</p>
            
            <div style="margin: 20px 0; padding: 15px; background-color: #f3f4f6; border-radius: 8px;">
              <p style="margin: 0; color: #4b5563;">Estado: Verificación en Proceso</p>
            </div>
          </div>
          
          <!-- Footer -->
          <div style="background-color: #f3f4f6; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
            <p style="margin: 0; color: #6b7280; font-size: 14px;">© ${new Date().getFullYear()} RifasCAI. Todos los derechos reservados.</p>
            <div style="margin-top: 10px;">
              <a href="#" style="color: #6a1b9a; text-decoration: none; margin: 0 10px;">Sitio Web</a> |
              <a href="#" style="color: #6a1b9a; text-decoration: none; margin: 0 10px;">Contacto</a> |
              <a href="#" style="color: #6a1b9a; text-decoration: none; margin: 0 10px;">Términos y Condiciones</a>
            </div>
          </div>
        </div>
      `,
    };

    const supportMailOptions = {
      subject: `Nuevo Pago Recibido de ${fullName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Nuevo Pago Recibido</h2>
          <p>Usuario <strong>${fullName}</strong> (${userEmail}) ha enviado un pago y está esperando verificación.</p>
          <p>Por favor, inicie sesión en el panel de administración para verificar y confirmar el pago.</p>
          <p>Saludos cordiales,<br>Sistema RifasCAI</p>
        </div>
      `,
    };

    try {
      await this.transporter.sendMail(userMailOptions);
      logger.info(`Verification email sent to: ${userEmail}`);
      await this.sendSupportEmail(supportMailOptions);
      return true;
    } catch (error) {
      logger.error(`Error sending payment verification email: ${error.message}`);
      return false;
    }
  }

  async sendPaymentConfirmationEmail(userEmail, fullName, selectedNumbers, raffleDetails) {
    const productName = raffleDetails.productName || 'Nuestra Emocionante Rifa';
    const drawDate = raffleDetails.drawDate
      ? new Date(raffleDetails.drawDate).toLocaleDateString()
      : 'Por anunciar';

    // Format numbers to ensure 3 digits with leading zeros
    const formattedNumbers = selectedNumbers.map(num => 
      num.toString().padStart(3, '0')
    );

    const userMailOptions = {
      from: `"RifasCAI Support" <${process.env.SMTP_USER}>`,
      to: userEmail,
      subject: '¡Pago Confirmado - Sus Boletos Están Listos!',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
          <!-- Header with Logo -->
          <div style="background-color: #059669; padding: 20px; text-align: center;">
            <img src="https://rifascai.com/cailogo.png" alt="RifasCAI Logo" style="max-width: 200px; height: auto;"/>
          </div>
          
          <!-- Email Content -->
          <div style="padding: 30px;">
            <h2 style="color: #059669; margin-bottom: 20px;">¡Pago Confirmado Exitosamente!</h2>
            <p>Estimado/a ${fullName},</p>
            <p>¡Excelentes noticias! Su pago ha sido confirmado y sus boletos están ahora registrados.</p>
            
            <div style="margin: 20px 0; padding: 15px; background-color: #dcfce7; border-radius: 8px;">
              <h3 style="margin: 0 0 10px 0; color: #065f46;">Sus Números de Boleto:</h3>
              <p style="margin: 0; font-family: monospace; font-size: 16px; color: #059669;">
                ${formattedNumbers.join(', ')}
              </p>
            </div>
            
            <div style="margin: 20px 0; padding: 15px; background-color: #f3f4f6; border-radius: 8px;">
              <h3 style="margin: 0 0 10px 0; color: #374151;">Detalles del Sorteo:</h3>
              <p style="margin: 0; color: #4b5563;">${productName}</p>
              <p style="margin: 5px 0 0 0; color: #6b7280;">
                Fecha del Sorteo: ${drawDate}
              </p>
            </div>
            
            <p>Conserve este correo electrónico para sus registros. También puede ver sus boletos en el panel de control de su cuenta.</p>
          </div>
          
          <!-- Footer -->
          <div style="background-color: #f3f4f6; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
            <p style="margin: 0; color: #6b7280; font-size: 14px;">© ${new Date().getFullYear()} RifasCAI. Todos los derechos reservados.</p>
            <div style="margin-top: 10px;">
              <a href="#" style="color: #059669; text-decoration: none; margin: 0 10px;">Sitio Web</a> |
              <a href="#" style="color: #059669; text-decoration: none; margin: 0 10px;">Contacto</a> |
              <a href="#" style="color: #059669; text-decoration: none; margin: 0 10px;">Términos y Condiciones</a>
            </div>
          </div>
        </div>
      `,
    };

    const supportMailOptions = {
      subject: `Pago Confirmado para ${fullName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Pago Confirmado</h2>
          <p>El pago del usuario <strong>${fullName}</strong> (${userEmail}) ha sido confirmado.</p>
          <p>Sus números de boleto seleccionados son: ${formattedNumbers.join(', ')}</p>
          <p>Detalles del Sorteo:</p>
          <ul>
            <li>Nombre del Producto: ${productName}</li>
            <li>Fecha del Sorteo: ${drawDate}</li>
          </ul>
          <p>Saludos cordiales,<br>Sistema RifasCAI</p>
        </div>
      `,
    };

    try {
      await this.transporter.sendMail(userMailOptions);
      logger.info(`Confirmation email sent to: ${userEmail}`);
      await this.sendSupportEmail(supportMailOptions);
      return true;
    } catch (error) {
      logger.error(`Error sending payment confirmation email: ${error.message}`);
      return false;
    }
  }

  async sendPaymentRejectionEmail(userEmail, fullName, reason) {
    const userMailOptions = {
      from: `"RifasCAI Support" <${process.env.SMTP_USER}>`,
      to: userEmail,
      subject: 'Actualización del Estado de Pago - Acción Requerida',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
          <!-- Header with Logo -->
          <div style="background-color: #dc2626; padding: 20px; text-align: center;">
            <img src="https://rifascai.com/cailogo.png" alt="RifasCAI Logo" style="max-width: 200px; height: auto;"/>
          </div>
          
          <!-- Email Content -->
          <div style="padding: 30px;">
            <h2 style="color: #dc2626; margin-bottom: 20px;">Actualización del Estado de Pago - Acción Requerida</h2>
            <p>Estimado/a ${fullName},</p>
            <p>No pudimos verificar su pago reciente por el siguiente motivo:</p>
            
            <div style="margin: 20px 0; padding: 15px; background-color: #fee2e2; border-radius: 8px;">
              <p style="margin: 0; color: #991b1b;">${reason || 'El pago no pudo ser verificado.'}</p>
            </div>
            
            <p>Por favor, realice un nuevo pago o contacte a nuestro equipo de soporte para obtener ayuda.</p>
            
            <div style="margin: 20px 0; padding: 15px; background-color: #f3f4f6; border-radius: 8px;">
              <p style="margin: 0;">¿Necesita ayuda? Contáctenos:</p>
              <p style="margin: 5px 0 0 0;">Correo electrónico: support@rifascai.com</p>
            </div>
          </div>
          
          <!-- Footer -->
          <div style="background-color: #f3f4f6; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
            <p style="margin: 0; color: #6b7280; font-size: 14px;">© ${new Date().getFullYear()} RifasCAI. Todos los derechos reservados.</p>
            <div style="margin-top: 10px;">
              <a href="#" style="color: #dc2626; text-decoration: none; margin: 0 10px;">Sitio Web</a> |
              <a href="#" style="color: #dc2626; text-decoration: none; margin: 0 10px;">Contacto</a> |
              <a href="#" style="color: #dc2626; text-decoration: none; margin: 0 10px;">Términos y Condiciones</a>
            </div>
          </div>
        </div>
      `,
    };

    const supportMailOptions = {
      subject: `Pago Rechazado para ${fullName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Pago Rechazado</h2>
          <p>El pago del usuario <strong>${fullName}</strong> (${userEmail}) ha sido rechazado.</p>
          <p>Motivo: ${reason || 'El pago no pudo ser verificado.'}</p>
          <p>Por favor, dar seguimiento con el usuario según sea necesario.</p>
          <p>Saludos cordiales,<br>Sistema RifasCAI</p>
        </div>
      `,
    };

    try {
      await this.transporter.sendMail(userMailOptions);
      logger.info(`Rejection email sent to: ${userEmail}`);
      await this.sendSupportEmail(supportMailOptions);
      return true;
    } catch (error) {
      logger.error(`Error sending payment rejection email: ${error.message}`);
      return false;
    }
  }

  async sendAccountCreationEmail(userEmail, fullName) {
    const userMailOptions = {
      from: `"RifasCAI Support" <${process.env.SMTP_USER}>`,
      to: userEmail,
      subject: '¡Bienvenido/a a RifasCAI!',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
          <!-- Header with Logo -->
          <div style="background-color: #3b82f6; padding: 20px; text-align: center;">
            <img src="https://rifascai.com/cailogo.png" alt="RifasCAI Logo" style="max-width: 200px; height: auto;"/>
          </div>
          
          <!-- Email Content -->
          <div style="padding: 30px;">
            <h2 style="color: #3b82f6; margin-bottom: 20px;">¡Bienvenido/a a RifasCAI, ${fullName}!</h2>
            <p>Gracias por crear una cuenta con nosotros. Estamos emocionados de tenerle a bordo.</p>
            <p>Ahora puede participar en rifas, comprar boletos y mantenerse actualizado con los últimos sorteos.</p>
            
            <div style="margin: 20px 0; padding: 15px; background-color: #eff6ff; border-radius: 8px;">
              <h3 style="margin: 0 0 10px 0; color: #1e40af;">Próximos Pasos:</h3>
              <ul style="margin: 0; padding-left: 20px; color: #1e40af;">
                <li>Complete su perfil</li>
                <li>Explore las rifas activas</li>
                <li>Compre sus primeros boletos</li>
              </ul>
            </div>
            
            <p>Si tiene alguna pregunta, no dude en contactar a nuestro equipo de soporte.</p>
          </div>
          
          <!-- Footer -->
          <div style="background-color: #f3f4f6; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
            <p style="margin: 0; color: #6b7280; font-size: 14px;">© ${new Date().getFullYear()} RifasCAI. Todos los derechos reservados.</p>
            <div style="margin-top: 10px;">
              <a href="#" style="color: #3b82f6; text-decoration: none; margin: 0 10px;">Sitio Web</a> |
              <a href="#" style="color: #3b82f6; text-decoration: none; margin: 0 10px;">Contacto</a> |
              <a href="#" style="color: #3b82f6; text-decoration: none; margin: 0 10px;">Términos y Condiciones</a>
            </div>
            <div style="margin-top: 20px;">
              <a href="#" style="margin: 0 10px;"><img src="/api/placeholder/24/24" alt="Facebook" style="width: 24px; height: 24px;"/></a>
              <a href="#" style="margin: 0 10px;"><img src="/api/placeholder/24/24" alt="Twitter" style="width: 24px; height: 24px;"/></a>
              <a href="#" style="margin: 0 10px;"><img src="/api/placeholder/24/24" alt="Instagram" style="width: 24px; height: 24px;"/></a>
            </div>
          </div>
        </div>
      `,
    };

    const supportMailOptions = {
      subject: `Nueva Cuenta Creada: ${fullName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Nuevo Registro de Usuario</h2>
          <p>Un nuevo usuario ha creado una cuenta.</p>
          <p><strong>Nombre:</strong> ${fullName}</p>
          <p><strong>Correo:</strong> ${userEmail}</p>
          <p>Por favor, asegúrese de que todos los detalles del usuario sean correctos y asístale según sea necesario.</p>
          <p>Saludos cordiales,<br>Sistema RifasCAI</p>
        </div>
      `,
    };

    try {
      await this.transporter.sendMail(userMailOptions);
      logger.info(`Account creation email sent to: ${userEmail}`);
      await this.sendSupportEmail(supportMailOptions);
      return true;
    } catch (error) {
      logger.error(`Error sending account creation email: ${error.message}`);
      return false;
    }
  }
}

// Export an instance of EmailService
module.exports = new EmailService();
