import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { firstValueFrom } from 'rxjs';
import { Cotizacion, CotizacionDocument } from '../cotizacion/schemas/cotizacion.schema';
import { Product, ProductDocument } from '../product/schemas/product.schema';
import { User, UserDocument } from '../user/schemas/user.schema';
import { Task, TaskDocument } from '../tasks/schemas/task.schema';
import { Gasto, GastoDocument } from '../gastos/schemas/gasto.schema';
import { IaResponse } from './schemas/ia-response.interface';

const BASE_CONTEXT = `
DATOS DE LA EMPRESA:
- Nombre: Autobots (CRM Automotriz del Bajío).
- Ubicación: Blvd. Adolfo López Mateos 123, León, Gto.
- Horario: L-V 9am-7pm, Sáb 9am-2pm.
- Contacto Soporte: soporte@autobots.mx (Ext 505).
- Misión: Proveer soluciones automotrices con excelencia y transparencia.
- Valores: Honestidad, Innovación, Servicio Personalizado, Compromiso.
- Redes sociales: @AutobotsCRM (Facebook, Instagram, LinkedIn)
`;

const VENDOR_CONTEXT = `
ROL: Asistente Avanzado de Ventas.
OBJETIVO: Ayudar al vendedor a cerrar tratos, revisar inventario rápido y redactar correos.
TONO: Profesional, conciso, orientado a la acción, motivador.

PARA CLIENTES (cuando el vendedor pregunta como cliente):
- Si pregunta "ver autos" o "autos disponibles": mostrar inventario
- Si pregunta "financiamiento": calcular financiamiento
- Si pregunta "prueba de manejo": agendar prueba
- Si pregunta "soporte": dar información de contacto
- Si pregunta "mensajes": explicar comunicaciones de seguimiento

PARA TAREAS INTERNAS:
- Si pregunta "mis tareas": mostrar tareas del vendedor
- Si pregunta "cotizaciones": mostrar cotizaciones pendientes
- Si pregunta "reportes": mostrar ventas del mes
- Si pregunta "clientes": mostrar lista de clientes
`;

const CLIENT_CONTEXT = `
ROL: Concierge Virtual de Lujo.
OBJETIVO: Enamorar al cliente de los autos, explicar financiamiento de forma sencilla y agendar citas.
TONO: Amable, entusiasta, servicial, paciente, empático.

RESPUESTAS ESPECÍFICAS PARA CLIENTES:
1. "autos disponibles" → Mostrar inventario con vehículos en stock
2. "financiamiento" → Calcular financiamiento con ejemplo de $300,000
3. "prueba de manejo" → Ofrecer horarios y proceso de agendamiento
4. "soporte" → Dar información de contacto directa
5. "mensajes" → Explicar cómo funciona el seguimiento de ventas
6. "ubicación" → Dar dirección y horarios

PROHIBIDO PARA CLIENTES:
- No mencionar tareas internas del personal
- No mostrar reportes de ventas
- No mostrar cotizaciones pendientes de otros
- No usar lenguaje técnico interno
`;

const ADMIN_CONTEXT = `
ROL: Gerente General / Administrador del CRM.
OBJETIVO: Supervisar el rendimiento global, gestionar usuarios, inventario crítico y finanzas.
TONO: Ejecutivo, directivo, estratégico, analítico, decisivo.

RESPUESTAS ESPECÍFICAS PARA ADMIN:
1. "inventario" → Mostrar análisis completo de inventario
2. "ventas" → Reporte detallado con KPIs
3. "gastos" → Análisis de gastos por categoría
4. "equipo" → Rendimiento del equipo de ventas
5. "clientes" → Base de datos de clientes con filtros
6. "cotizaciones" → Estado de todas las cotizaciones
`;

@Injectable()
export class IamodelService {
  private readonly logger = new Logger(IamodelService.name);
  private readonly ollamaHost: string;
  private readonly model: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    @InjectModel(Cotizacion.name) private cotizacionModel: Model<CotizacionDocument>,
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Task.name) private taskModel: Model<TaskDocument>,
    @InjectModel(Gasto.name) private gastoModel: Model<GastoDocument>,
  ) {
    this.ollamaHost = this.configService.get<string>('OLLAMA_HOST') || 'http://localhost:11434';
    this.model = this.configService.get<string>('OLLAMA_MODEL') || 'llama3';
  }

  async processQuery(prompt: string, userId: string): Promise<IaResponse> {
    try {
      const user = await this.userModel.findById(userId).select('nombre rol');
      const userRole = user?.rol || 'CLIENTE';
      
      // Clasificar intención BASADA EN EL ROL del usuario
      const intent = await this.classifyIntentByRole(prompt, userRole);
      
      this.logger.log(`Usuario: ${user?.nombre} (${userRole}) | Intención: ${intent.action} | Prompt: "${prompt}"`);

      // Procesar según intención detectada
      switch (intent.action) {
        // Intenciones para TODOS los roles
        case 'get_products':
          return await this.handleGetProducts(prompt, userRole);
        
        case 'calculate_financing':
          return await this.calculateFinancing(intent.params);
        
        case 'schedule_test_drive':
          return await this.scheduleTestDrive(userId, userRole);
        
        case 'get_support':
          return await this.getSupportInfo(intent.params?.topic);
        
        case 'company_info':
          return await this.getCompanyInfo(intent.params?.specific);
        
        // Intenciones solo para CLIENTES
        case 'get_messages':
          if (userRole === 'CLIENTE') {
            return await this.getClientMessages(userId);
          }
          // Si no es cliente, redirigir a tareas
          return await this.getMyTasks(userId);
        
        // Intenciones para VENDEDOR/ADMIN
        case 'get_my_tasks':
          if (userRole === 'CLIENTE') {
            // Cliente pregunta por "mis tareas" → Mostrar mensajes
            return await this.getClientMessages(userId);
          }
          return await this.getMyTasks(userId, intent.params?.filter);
        
        case 'get_sales_report':
          if (userRole === 'CLIENTE') {
            return { 
              message: "Los reportes de ventas son información interna de la empresa. ¿En qué más puedo ayudarte?", 
              type: 'text' 
            };
          }
          if (userRole === 'ADMIN') {
            return await this.getSalesReportAdmin(intent.params?.period);
          }
          return await this.getSalesReportVendor(userId, intent.params?.period);
        
        case 'get_pending_quotes':
          if (userRole === 'CLIENTE') {
            return await this.getClientQuotes(userId);
          }
          if (userRole === 'ADMIN') {
            return await this.getPendingQuotesAdmin();
          }
          return await this.getPendingQuotesVendor(userId);
        
        case 'get_clients':
          if (userRole === 'CLIENTE') {
            return { 
              message: "Para consultas sobre otros clientes, contacta al área de servicio al cliente.", 
              type: 'text' 
            };
          }
          if (userRole === 'ADMIN') {
            return await this.getClientsAdmin(intent.params?.filter);
          }
          return await this.getClientsVendor(userId);
        
        case 'get_expenses':
          if (userRole === 'CLIENTE') {
            return { 
              message: "La información de gastos es administrativa y confidencial.", 
              type: 'text' 
            };
          }
          return await this.getExpensesAdmin(intent.params);
        
        case 'get_profile':
          return await this.getUserProfile(userId);
        
        case 'get_performance':
          if (userRole === 'CLIENTE') {
            return { 
              message: "Esta función está disponible solo para el equipo de ventas.", 
              type: 'text' 
            };
          }
          if (userRole === 'ADMIN') {
            return await this.getTeamPerformance();
          }
          return await this.getMyPerformance(userId);
        
        case 'get_inventory_analysis':
          if (userRole === 'CLIENTE') {
            return await this.handleGetProducts(prompt, userRole);
          }
          return await this.getInventoryAnalysis();
        
        case 'search_cars':
          return await this.searchCars(intent.params?.keywords || prompt, userRole);
        
        case 'chat':
        default:
          return await this.chatWithAi(prompt, userId, userRole);
      }
    } catch (error) {
      this.logger.error(`Error procesando consulta: ${error.message}`, error.stack);
      return { 
        message: "Disculpa, encontré un problema técnico. Por favor, intenta de nuevo.", 
        type: 'text'
      };
    }
  }

  private async classifyIntentByRole(userPrompt: string, userRole: string): Promise<{ action: string; params?: any }> {
    const cleanPrompt = userPrompt.toLowerCase().trim();
    
    // Primero, detectar intenciones COMUNES a todos los roles
    if (cleanPrompt.match(/(muestrame|muestra|ver|listar|lista|dame|enseña|quiero ver|necesito ver)(\s+el|\s+los|\s+las|\s+un|\s+una)?\s*(autos?|carros?|coches?|vehiculos?|vehículos?|modelos?|disponibles?|opciones?)/)) {
      return { action: 'get_products' };
    }
    
    if (cleanPrompt.match(/^(inventario|autos?|coches?|carros?|vehiculos?|vehículos?|disponibles?|qu[eé] tienen|qu[eé] hay)$/)) {
      return { action: 'get_products' };
    }
    
    if (cleanPrompt.match(/(financiamiento|cr[eé]dito|enganche|mensualidad|mensualidades|plazo|tasa|inter[eé]s|calcular|simular|cu[aá]nto pagar[ií]a|cu[aá]nto ser[ií]an|cuota mensual|pago mensual)/)) {
      return { action: 'calculate_financing', params: this.extractFinancingParams(cleanPrompt) };
    }
    
    if (cleanPrompt.match(/(prueba de manejo|test drive|probar|manejar|conducir|agendar|reservar|pedir cita|cita para probar)/)) {
      return { action: 'schedule_test_drive' };
    }
    
    if (cleanPrompt.match(/(soporte|ayuda|problema|error|contactar|hablar con|llamar|escribir|correo|whatsapp|tel[eé]fono)/)) {
      return { action: 'get_support', params: { topic: 'general' } };
    }
    
    if (cleanPrompt.match(/(d[oó]nde|ubicaci[oó]n|direcci[oó]n|local|horario|tel[eé]fono|contacto|correo|empresa)/)) {
      return { action: 'company_info' };
    }
    
    // Intenciones ESPECÍFICAS por rol
    if (userRole === 'CLIENTE') {
      // Cliente pregunta por "mensajes" o "tareas" → interpretar como consulta de seguimiento
      if (cleanPrompt.match(/(mensajes?|comunicaciones?|notificaciones?|actualizaciones?|seguimiento|respuesta|me contactaron|me llamaron|estado de mi)/)) {
        return { action: 'get_messages' };
      }
      
      // Cliente pregunta por "mis tareas" → también interpretar como mensajes
      if (cleanPrompt.match(/(mis tareas?|mis pendientes?|mi agenda)/)) {
        return { action: 'get_messages' };
      }
      
    } else {
      // ADMIN/VENDEDOR
      if (cleanPrompt.match(/(mis tareas?|pendientes?|por hacer|actividades|agenda|recordatorios|seguimientos)/)) {
        return { action: 'get_my_tasks', params: { filter: this.extractFilter(cleanPrompt) } };
      }
      
      if (cleanPrompt.match(/(cotizaciones?|presupuestos?)(\s+pendientes?|\s+por aprobar)?/)) {
        return { action: 'get_pending_quotes' };
      }
      
      if (cleanPrompt.match(/(ventas?|reporte|ganancias?|ingresos?|estad[ií]sticas?|kpis?|indicadores?)/)) {
        return { action: 'get_sales_report', params: { period: this.extractPeriod(cleanPrompt) } };
      }
      
      if (cleanPrompt.match(/(clientes?|prospectos?|leads?|contactos?)/)) {
        return { action: 'get_clients' };
      }
      
      if (cleanPrompt.match(/(gastos?|pagos?|luz|agua|renta|n[oó]mina)/)) {
        return { action: 'get_expenses' };
      }
      
      if (cleanPrompt.match(/(rendimiento|desempe[oñ]o|equipo|vendedores?|asesores?|an[aá]lisis de ventas)/)) {
        return { action: 'get_performance' };
      }
      
      if (cleanPrompt.match(/(an[aá]lisis de inventario|inventario lento|inventario viejo|stock muerte)/)) {
        return { action: 'get_inventory_analysis' };
      }
    }
    
    // Búsqueda específica (común)
    if (cleanPrompt.match(/(busca|buscar|encontrar|tienes|hay)(.*)(mazda|honda|toyota|nissan|ford|chevrolet|audi|bmw)/i)) {
      return { action: 'search_cars', params: { keywords: userPrompt } };
    }
    
    if (cleanPrompt.match(/(quien soy|mi perfil|mi cuenta|mis datos)/)) {
      return { action: 'get_profile' };
    }
    
    // Saludos
    if (cleanPrompt.match(/^(hola|buenos|buenas|que tal|saludos)/)) {
      return { action: 'chat' };
    }
    
    // Fallback a chat
    return { action: 'chat' };
  }

  private extractFilter(prompt: string): string {
    if (prompt.includes('hoy')) return 'today';
    if (prompt.includes('semana')) return 'week';
    if (prompt.includes('urgentes') || prompt.includes('urgente')) return 'urgent';
    if (prompt.includes('vencida') || prompt.includes('vencido')) return 'overdue';
    return 'all';
  }

  private extractPeriod(prompt: string): string {
    if (prompt.includes('hoy') || prompt.includes('diario')) return 'day';
    if (prompt.includes('semana') || prompt.includes('semanal')) return 'week';
    if (prompt.includes('mes') || prompt.includes('mensual')) return 'month';
    if (prompt.includes('año') || prompt.includes('anual')) return 'year';
    return 'month';
  }

  private extractFinancingParams(prompt: string): any {
    const params: any = { price: 300000, downPaymentPercent: 20, termMonths: 48 };
    
    const priceMatch = prompt.match(/\$?\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/);
    if (priceMatch) params.price = parseFloat(priceMatch[1].replace(/,/g, ''));
    
    const downMatch = prompt.match(/(enganche|down)\s+(\d{1,3})%/i);
    if (downMatch) params.downPaymentPercent = parseInt(downMatch[2]);
    
    const termMatch = prompt.match(/(\d{1,2})\s*(meses|años)/i);
    if (termMatch) {
      const num = parseInt(termMatch[1]);
      params.termMonths = termMatch[2].toLowerCase().includes('año') ? num * 12 : num;
    }
    
    return params;
  }

  private async handleGetProducts(prompt: string, userRole: string): Promise<IaResponse> {
    try {
      const query: any = { 
        disponible: true,
        activo: true 
      };
      
      if (userRole === 'CLIENTE') {
        query.stock = { $gt: 0 };
      }
      
      const products = await this.productModel.find(query)
        .sort({ createdAt: -1 })
        .limit(userRole === 'CLIENTE' ? 12 : 20);
      
      if (!products.length) {
        const message = userRole === 'CLIENTE' 
          ? "🚗 **Autos Disponibles**\n\nActualmente no tenemos vehículos en exhibición. Te recomendamos:\n\n1. **Visítanos:** Blvd. Adolfo López Mateos 123, León\n2. **Llama:** 477 123 4567 para consultar próximos ingresos\n3. **Solicita información** sobre el modelo que te interesa\n\n¿Te gustaría que te contactemos cuando lleguen nuevas unidades?"
          : "📊 **Inventario**\n\nEl inventario está vacío. ¿Quieres agregar nuevos productos?";
        
        return { 
          message, 
          type: 'text'
        };
      }
      
      const message = userRole === 'CLIENTE'
        ? `🚗 **Tenemos ${products.length} autos disponibles para ti:**\n\nAquí están nuestras mejores opciones en piso:`
        : `📊 **Inventario disponible (${products.length} unidades)**\n\nStock actual:`;
      
      return { 
        message, 
        type: 'products_grid', 
        data: products,
        metadata: {
          userRole,
          total: products.length,
          priceRange: {
            min: Math.min(...products.map(p => p.precioBase)),
            max: Math.max(...products.map(p => p.precioBase))
          }
        }
      };
    } catch (error) {
      this.logger.error(`Error obteniendo productos: ${error.message}`);
      return { 
        message: userRole === 'CLIENTE' 
          ? "🚗 **Autos Disponibles**\n\nEn este momento no puedo mostrar el inventario. Te sugerimos:\n\n• **Visita nuestro local:** Blvd. Adolfo López Mateos 123\n• **Llama al:** 477 123 4567\n• **Horario:** L-V 9am-7pm, Sáb 9am-2pm\n\n¿Te ayudo con otra cosa?"
          : "Error al cargar el inventario. Revisa la conexión a la base de datos.",
        type: 'text'
      };
    }
  }

  private async calculateFinancing(params: any): Promise<IaResponse> {
    const price = params?.price || 300000;
    const downPaymentPercent = params?.downPaymentPercent || 20;
    const termMonths = params?.termMonths || 48;
    const annualRate = 12;
    
    const downPayment = price * (downPaymentPercent / 100);
    const financedAmount = price - downPayment;
    const monthlyRate = annualRate / 12 / 100;
    
    const monthlyPayment = financedAmount * 
      (monthlyRate * Math.pow(1 + monthlyRate, termMonths)) / 
      (Math.pow(1 + monthlyRate, termMonths) - 1);
    
    const totalPaid = monthlyPayment * termMonths;
    const totalInterest = totalPaid - financedAmount;
    
    const calculations = {
      vehiclePrice: price,
      downPaymentPercent,
      downPaymentAmount: downPayment,
      financedAmount,
      termMonths,
      annualRate: `${annualRate}%`,
      monthlyPayment: Math.round(monthlyPayment),
      totalPaid: Math.round(totalPaid),
      totalInterest: Math.round(totalInterest),
      interestToPrincipal: ((totalInterest / financedAmount) * 100).toFixed(1)
    };
    
    let message = `💰 **Simulación de Financiamiento**\n\n`;
    message += `**Precio del vehículo:** $${price.toLocaleString()}\n`;
    message += `**Enganche (${downPaymentPercent}%):** $${downPayment.toLocaleString()}\n`;
    message += `**Monto a financiar:** $${financedAmount.toLocaleString()}\n`;
    message += `**Plazo:** ${termMonths} meses (${Math.floor(termMonths/12)} años)\n`;
    message += `**Tasa anual:** ${annualRate}%\n\n`;
    message += `📈 **Resultados:**\n`;
    message += `• **Pago mensual:** $${calculations.monthlyPayment.toLocaleString()}\n`;
    message += `• **Total a pagar:** $${calculations.totalPaid.toLocaleString()}\n`;
    message += `• **Intereses totales:** $${calculations.totalInterest.toLocaleString()}\n`;
    message += `• **Relación intereses/capital:** ${calculations.interestToPrincipal}%\n\n`;
    message += `**💡 Consejo:** Cada 5% adicional de enganche reduce tu mensualidad aproximadamente un 4%.\n\n`;
    message += `**Nota:** Esta es una simulación ilustrativa. Las tasas finales dependen de tu historial crediticio.`;
    
    return {
      message,
      type: 'financing_calculation',
      data: calculations,
      metadata: {
        isEstimate: true,
        disclaimer: "Consulta con tu asesor para una cotización precisa."
      }
    };
  }

  private async scheduleTestDrive(userId: string, userRole: string): Promise<IaResponse> {
    if (userRole !== 'CLIENTE') {
      return {
        message: "Esta función es para clientes que desean agendar pruebas de manejo.",
        type: 'text'
      };
    }
    
    const user = await this.userModel.findById(userId);
    const userName = user ? user.nombre.split(' ')[0] : 'Cliente';
    
    const availableSlots = [
      "Lunes 10:00 AM", "Lunes 2:00 PM",
      "Martes 11:00 AM", "Martes 4:00 PM",
      "Miércoles 9:00 AM", "Miércoles 3:00 PM",
      "Jueves 10:30 AM", "Jueves 5:00 PM",
      "Viernes 11:30 AM", "Viernes 4:30 PM",
      "Sábado 9:30 AM", "Sábado 11:00 AM"
    ];
    
    return {
      message: `🚗 **Programar Prueba de Manejo**\n\n¡Perfecto ${userName}! Con gusto te ayudo a agendar una prueba de manejo.\n\n**📅 Horarios disponibles esta semana:**\n${availableSlots.map((slot, i) => `${i + 1}. ${slot}`).join('\n')}\n\n**📝 Para reservar:**\n1. Elige el horario que mejor te convenga\n2. Dime qué modelo te interesa probar\n3. Confirmaremos por teléfono\n\n**📍 Lugar:** Blvd. Adolfo López Mateos 123, León\n**📞 Contacto:** 477 123 4567\n\n¿Cuál horario te parece mejor?`,
      type: 'test_drive_slots',
      data: {
        slots: availableSlots,
        user: user?.nombre,
        contact: user?.telefono || user?.email || 'Por confirmar'
      }
    };
  }

  private async getSupportInfo(topic: string = 'general'): Promise<IaResponse> {
    const supportInfo = `❓ **Centro de Ayuda - Autobots**\n\n**¿Cómo podemos ayudarte?**\n\n📞 **Contacto directo:**\n• Teléfono: 477 123 4567\n• Email: soporte@autobots.mx\n• WhatsApp: 477 123 4567\n• Extensión: 505\n\n🕒 **Horarios de atención:**\nLunes a Viernes: 9:00 AM - 7:00 PM\nSábados: 9:00 AM - 2:00 PM\n\n📍 **Visítanos:**\nBlvd. Adolfo López Mateos 123, León, Gto.\n\n**Para asistencia inmediata, te recomendamos llamar.**`;
    
    return {
      message: supportInfo,
      type: 'text',
      metadata: {
        topic,
        contactInfo: {
          phone: '477 123 4567',
          email: 'soporte@autobots.mx',
          extension: '505'
        }
      }
    };
  }

  private async getClientMessages(userId: string): Promise<IaResponse> {
    try {
      const clientQuotes = await this.cotizacionModel.find({
        cliente: new Types.ObjectId(userId)
      })
      .populate('vendedor', 'nombre')
      .populate('coche', 'marca modelo')
      .sort({ createdAt: -1 })
      .limit(5);
      
      if (!clientQuotes.length) {
        return {
          message: "📭 **No tienes mensajes pendientes.**\n\nSi solicitaste información, nuestro equipo te contactará pronto.\n\n**¿Necesitas ayuda con algo más?**",
          type: 'text'
        };
      }
      
      const pendingQuotes = clientQuotes.filter(q => q.status === 'Pendiente');
      const approvedQuotes = clientQuotes.filter(q => q.status === 'Aprobada');
      
      let message = `📬 **Tus comunicaciones recientes**\n\n`;
      
      if (pendingQuotes.length > 0) {
        message += `⏳ **Cotizaciones en revisión (${pendingQuotes.length}):**\n`;
        pendingQuotes.forEach((quote, i) => {
          if (i < 3) {
            const coche = quote.coche as any;
            const vendedor = quote.vendedor as any;
            message += `• ${coche?.marca || ''} ${coche?.modelo || ''} - Asesor: ${vendedor?.nombre || 'Por asignar'}\n`;
          }
        });
        message += `\n`;
      }
      
      if (approvedQuotes.length > 0) {
        message += `✅ **Cotizaciones aprobadas (${approvedQuotes.length}):**\n`;
        approvedQuotes.slice(0, 2).forEach(quote => {
          const coche = quote.coche as any;
          message += `• ${coche?.marca || ''} ${coche?.modelo || ''}\n`;
        });
        message += `\n`;
      }
      
      const lastVendedor = clientQuotes[0]?.vendedor as any;
      message += `**📞 Contacta a tu asesor:**\n`;
      if (lastVendedor?.nombre) {
        message += `• ${lastVendedor.nombre}\n`;
      }
      message += `• Teléfono: 477 123 4567\n`;
      message += `• Email: ventas@autobots.mx\n\n`;
      message += `**¿Quieres más información sobre alguna cotización?**`;
      
      return {
        message,
        type: 'text',
        data: clientQuotes
      };
    } catch (error) {
      this.logger.error(`Error obteniendo mensajes del cliente: ${error.message}`);
      return {
        message: "📭 **Comunicaciones**\n\nPara consultar el estado de tus cotizaciones, contacta al área de ventas:\n\n📞 477 123 4567\n📧 ventas@autobots.mx",
        type: 'text'
      };
    }
  }

  private async getClientQuotes(userId: string): Promise<IaResponse> {
    return this.getClientMessages(userId);
  }

  private async getMyTasks(userId: string, filter: string = 'all'): Promise<IaResponse> {
    try {
      const tasks = await this.taskModel.find({
        vendedor: new Types.ObjectId(userId),
        isCompleted: false
      })
      .populate('cliente', 'nombre telefono')
      .sort({ dueDate: 1 })
      .limit(10);
      
      if (!tasks.length) {
        return {
          message: "✅ **No tienes tareas pendientes.**\n\n¡Excelente trabajo manteniendo todo al día!\n\n**Sugerencia:** Puedes revisar las cotizaciones pendientes o contactar clientes prospecto.",
          type: 'text'
        };
      }
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const overdueTasks = tasks.filter(task => new Date(task.dueDate) < today);
      const todayTasks = tasks.filter(task => {
        const dueDate = new Date(task.dueDate);
        dueDate.setHours(0, 0, 0, 0);
        return dueDate.getTime() === today.getTime();
      });
      
      let message = `📋 **Tus Tareas Pendientes**\n\n`;
      message += `**Total:** ${tasks.length} tareas\n`;
      
      if (overdueTasks.length > 0) {
        message += `⚠️ **Vencidas:** ${overdueTasks.length}\n`;
      }
      
      if (todayTasks.length > 0) {
        message += `📅 **Para hoy:** ${todayTasks.length}\n`;
      }
      
      message += `\n**🔝 Próximas tareas:**\n`;
      
      tasks.slice(0, 3).forEach((task, i) => {
        const dueDate = new Date(task.dueDate);
        const isOverdue = dueDate < today;
        const isToday = dueDate.toDateString() === today.toDateString();
        
        let status = '';
        if (isOverdue) status = ' [VENCIDA]';
        else if (isToday) status = ' [HOY]';
        
        message += `${i + 1}. ${task.title}${status}\n`;
        if (task.cliente) {
          const cliente = task.cliente as any;
          message += `   👤 ${cliente.nombre || 'Cliente'}\n`;
        }
        message += `   📅 Vence: ${dueDate.toLocaleDateString()}\n`;
        
        if (task.priority === 'alta') {
          message += `   🚨 PRIORIDAD ALTA\n`;
        }
        message += `\n`;
      });
      
      if (tasks.length > 3) {
        message += `*... y ${tasks.length - 3} tareas más.*\n`;
      }
      
      return {
        message,
        type: 'tasks_list',
        data: tasks,
        metadata: {
          total: tasks.length,
          overdue: overdueTasks.length,
          today: todayTasks.length,
          nextDue: tasks[0]?.dueDate
        }
      };
    } catch (error) {
      this.logger.error(`Error obteniendo tareas: ${error.message}`);
      return { 
        message: "Error al cargar tus tareas. Intenta de nuevo.", 
        type: 'text' 
      };
    }
  }

  private async getPendingQuotesAdmin(): Promise<IaResponse> {
    try {
      const cotizaciones = await this.cotizacionModel.find({ status: 'Pendiente' })
        .populate('cliente', 'nombre email')
        .populate('coche', 'marca modelo precioBase')
        .populate('vendedor', 'nombre')
        .sort({ createdAt: -1 })
        .limit(10);
      
      if (!cotizaciones.length) {
        return {
          message: "✅ **Todas las cotizaciones están procesadas.**\n\nNo hay cotizaciones pendientes de revisión.",
          type: 'text'
        };
      }
      
      const totalValue = cotizaciones.reduce((sum, quote) => sum + (quote.totalPagado || 0), 0);
      
      let message = `📋 **Cotizaciones Pendientes de Aprobación**\n\n`;
      message += `**Total:** ${cotizaciones.length} cotizaciones\n`;
      message += `**Valor pendiente:** $${totalValue.toLocaleString()}\n\n`;
      
      message += `**📊 Resumen por vendedor:**\n`;
      const byVendor: Record<string, number> = {};
      cotizaciones.forEach(quote => {
        const vendedor = quote.vendedor as any;
        const vendorName = vendedor?.nombre || 'Sin asignar';
        byVendor[vendorName] = (byVendor[vendorName] || 0) + 1;
      });
      
      Object.entries(byVendor).forEach(([vendor, count]) => {
        message += `• ${vendor}: ${count} cotizaciones\n`;
      });
      
      const oldestDate = new Date(Math.min(...cotizaciones.map(q => q.createdAt.getTime())));
      const daysOld = Math.floor((Date.now() - oldestDate.getTime()) / (1000 * 60 * 60 * 24));
      
      message += `\n**⏳ La más antigua tiene:** ${daysOld} días\n`;
      message += `\n**💡 Recomendación:** Revisa primero las más antiguas para mejor servicio.`;
      
      return {
        message,
        type: 'cotizaciones_table',
        data: cotizaciones,
        metadata: {
          count: cotizaciones.length,
          totalValue,
          vendors: Object.keys(byVendor),
          oldest: oldestDate
        }
      };
    } catch (error) {
      this.logger.error(`Error obteniendo cotizaciones: ${error.message}`);
      return { 
        message: "Error al cargar las cotizaciones. Intenta de nuevo.", 
        type: 'text' 
      };
    }
  }

  private async getPendingQuotesVendor(vendorId: string): Promise<IaResponse> {
    try {
      const myPendingQuotes = await this.cotizacionModel.find({
        vendedor: new Types.ObjectId(vendorId),
        status: 'Pendiente'
      })
      .populate('cliente', 'nombre')
      .populate('coche', 'marca modelo')
      .sort({ createdAt: -1 })
      .limit(10);
      
      if (!myPendingQuotes.length) {
        return {
          message: "✅ **No tienes cotizaciones pendientes.**\n\n¡Excelente trabajo manteniendo al día tus procesos!",
          type: 'text'
        };
      }
      
      const oldestDate = new Date(Math.min(...myPendingQuotes.map(q => q.createdAt.getTime())));
      const daysOld = Math.floor((Date.now() - oldestDate.getTime()) / (1000 * 60 * 60 * 24));
      
      return {
        message: `📝 **Tus Cotizaciones Pendientes**\n\nTienes **${myPendingQuotes.length}** cotizaciones pendientes.\nLa más antigua tiene **${daysOld} días**.\n\n**Recomendación:** Contacta a los clientes de las cotizaciones más antiguas.`,
        type: 'cotizaciones_table',
        data: myPendingQuotes,
        metadata: {
          count: myPendingQuotes.length,
          oldestDays: daysOld,
          clientes: myPendingQuotes
            .map(q => {
              const cliente = q.cliente as any;
              return cliente?.nombre;
            })
            .filter(Boolean)
        }
      };
    } catch (error) {
      this.logger.error(`Error obteniendo cotizaciones del vendedor: ${error.message}`);
      return { 
        message: "Error al cargar tus cotizaciones. Intenta de nuevo.", 
        type: 'text' 
      };
    }
  }

  private async getClientsAdmin(filter: string = 'all'): Promise<IaResponse> {
    try {
      let query: any = { rol: 'CLIENTE' };
      let sort: any = { createdAt: -1 };
      let message = "👥 **Base de Clientes**\n\n";
      
      switch(filter) {
        case 'new':
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          query.createdAt = { $gte: thirtyDaysAgo };
          message = "**Clientes Nuevos** (últimos 30 días)\n\n";
          break;
        case 'active':
          query.ultimoContacto = { $gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) };
          message = "**Clientes Activos** (contacto en últimos 90 días)\n\n";
          break;
        case 'inactive':
          query.ultimoContacto = { $lt: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000) };
          message = "**Clientes Inactivos** (sin contacto en 6+ meses)\n\n";
          break;
      }
      
      const clients = await this.userModel.find(query)
        .select('nombre email telefono ciudad createdAt')
        .sort(sort)
        .limit(15);
      
      if (!clients.length) {
        return {
          message: message + "No hay clientes que coincidan con este filtro.",
          type: 'text'
        };
      }
      
      const newClients = clients.filter(client => {
        const createdAt = client.get('createdAt');
        const daysAgo = Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24));
        return daysAgo <= 30;
      });
      
      message += `**Total:** ${clients.length} clientes\n`;
      message += `**Nuevos (30 días):** ${newClients.length}\n\n`;
      message += `**👋 Clientes más recientes:**\n`;
      clients.slice(0, 5).forEach((client, i) => {
        const createdAt = client.get('createdAt');
        const daysAgo = Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24));
        message += `${i + 1}. ${client.nombre}\n`;
        if ((client as any).ciudad) message += `   📍 ${(client as any).ciudad}\n`;
        if (client.telefono) message += `   📞 ${client.telefono}\n`;
        message += `   📅 Registrado hace ${daysAgo} días\n\n`;
      });
      });
      
      if (clients.length > 5) {
        message += `*... y ${clients.length - 5} clientes más.*\n`;
      }
      
      return {
        message,
        type: 'clients_list',
        data: clients,
        metadata: {
          filter,
          total: clients.length,
          newLast30d: newClients.length
        }
      };
    } catch (error) {
      this.logger.error(`Error obteniendo clientes: ${error.message}`);
      return { 
        message: "Error al cargar la lista de clientes. Intenta de nuevo.", 
        type: 'text' 
      };
    }
  }

  private async getClientsVendor(vendorId: string): Promise<IaResponse> {
    try {
      const myClients = await this.cotizacionModel.aggregate([
        {
          $match: {
            vendedor: new Types.ObjectId(vendorId),
            status: { $in: ['Aprobada', 'Pendiente'] }
          }
        },
        {
          $group: {
            _id: '$cliente',
            lastQuote: { $max: '$createdAt' },
            quoteCount: { $sum: 1 },
            totalAmount: { $sum: '$totalPagado' }
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'clienteInfo'
          }
        },
        { $sort: { lastQuote: -1 } },
        { $limit: 15 }
      ]);
      
      if (!myClients.length) {
        return {
          message: "👤 **Tus Clientes**\n\nAún no tienes clientes asignados. Empieza a crear cotizaciones para verlos aquí.",
          type: 'text'
        };
      }
      
      const clientsWithRecentContact = myClients.filter(client => {
        const daysSinceContact = Math.floor((Date.now() - new Date(client.lastQuote).getTime()) / (1000 * 60 * 60 * 24));
        return daysSinceContact <= 30;
      });
      
      return {
        message: `👥 **Tu Lista de Clientes**\n\n**Total:** ${myClients.length} clientes\n**Contacto reciente (30 días):** ${clientsWithRecentContact.length}\n\n**Recomendación:** Contacta a los clientes con más de 30 días sin seguimiento.`,
        type: 'clients_list',
        data: myClients.map(client => ({
          ...client,
          clienteInfo: client.clienteInfo[0]
        })),
        metadata: {
          total: myClients.length,
          active: clientsWithRecentContact.length,
          needsFollowUp: myClients.length - clientsWithRecentContact.length
        }
      };
    } catch (error) {
      this.logger.error(`Error obteniendo clientes del vendedor: ${error.message}`);
      return { 
        message: "Error al cargar tus clientes. Intenta de nuevo.", 
        type: 'text' 
      };
    }
  }

  private async getSalesReportAdmin(period: string = 'month'): Promise<IaResponse> {
    try {
      const now = new Date();
      let startDate: Date;
      let message = "";
      
      switch(period) {
        case 'day':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          message = "📊 **Reporte de Ventas - Hoy**\n\n";
          break;
        case 'week':
          const dayOfWeek = now.getDay();
          const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
          startDate = new Date(now.setDate(diff));
          message = "📊 **Reporte de Ventas - Esta Semana**\n\n";
          break;
        case 'year':
          startDate = new Date(now.getFullYear(), 0, 1);
          message = "📊 **Reporte de Ventas - Este Año**\n\n";
          break;
        default:
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          message = "📊 **Reporte de Ventas - Este Mes**\n\n";
          break;
      }
      
      const salesData = await this.cotizacionModel.aggregate([
        {
          $match: {
            status: 'Aprobada',
            createdAt: { $gte: startDate }
          }
        },
        {
          $group: {
            _id: null,
            totalVendido: { $sum: '$totalPagado' },
            count: { $sum: 1 },
            avgTicket: { $avg: '$totalPagado' }
          }
        }
      ]);
      
      const data = salesData[0] || { 
        totalVendido: 0, 
        count: 0, 
        avgTicket: 0
      };
      
      return {
        message: `${message}**Ventas Totales:** $${data.totalVendido.toLocaleString()}\n**Unidades Vendidas:** ${data.count}\n**Ticket Promedio:** $${Math.round(data.avgTicket).toLocaleString()}`,
        type: 'kpi_dashboard',
        data: {
          period,
          totalSales: data.totalVendido,
          salesCount: data.count,
          averageTicket: data.avgTicket
        }
      };
    } catch (error) {
      this.logger.error(`Error obteniendo reporte de ventas: ${error.message}`);
      return { 
        message: "Error al generar el reporte de ventas. Intenta de nuevo.", 
        type: 'text' 
      };
    }
  }

  private async getSalesReportVendor(vendorId: string, period: string = 'month'): Promise<IaResponse> {
    try {
      const now = new Date();
      let startDate: Date;
      
      switch(period) {
        case 'day':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'week':
          const dayOfWeek = now.getDay();
          const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
          startDate = new Date(now.setDate(diff));
          break;
        case 'year':
          startDate = new Date(now.getFullYear(), 0, 1);
          break;
        default:
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
      }
      
      const mySales = await this.cotizacionModel.aggregate([
        {
          $match: {
            vendedor: new Types.ObjectId(vendorId),
            status: 'Aprobada',
            createdAt: { $gte: startDate }
          }
        },
        {
          $group: {
            _id: null,
            totalVendido: { $sum: '$totalPagado' },
            count: { $sum: 1 },
            avgTicket: { $avg: '$totalPagado' }
          }
        }
      ]);
      
      const data = mySales[0] || { 
        totalVendido: 0, 
        count: 0, 
        avgTicket: 0
      };
      
      return {
        message: `📊 **Tus Ventas (${period})**\n\n**Total Vendido:** $${data.totalVendido.toLocaleString()}\n**Vehículos:** ${data.count}\n**Ticket Promedio:** $${Math.round(data.avgTicket).toLocaleString()}`,
        type: 'kpi_dashboard_vendor',
        data: {
          period,
          totalSales: data.totalVendido,
          salesCount: data.count,
          averageTicket: data.avgTicket
        }
      };
    } catch (error) {
      this.logger.error(`Error obteniendo reporte de ventas del vendedor: ${error.message}`);
      return { 
        message: "Error al cargar tus ventas. Intenta de nuevo.", 
        type: 'text' 
      };
    }
  }

  private async getExpensesAdmin(params: any = {}): Promise<IaResponse> {
    try {
      const { status, category, startDate, endDate } = params;
      
      let query: any = {};
      
      if (status) query.estado = status;
      if (category) query.categoria = category;
      if (startDate || endDate) {
        query.fechaGasto = {};
        if (startDate) query.fechaGasto.$gte = new Date(startDate);
        if (endDate) query.fechaGasto.$lte = new Date(endDate);
      }
      
      const gastos = await this.gastoModel.find(query)
        .sort({ fechaGasto: -1 })
        .limit(10);
      
      if (!gastos.length) {
        return { 
          message: "💰 **Gastos**\n\nNo hay gastos registrados con ese filtro.", 
          type: 'text'
        };
      }
      
      const total = gastos.reduce((acc, curr) => acc + (curr.monto || 0), 0);
      
      let message = `💰 **Reporte de Gastos**\n\n`;
      message += `**Total:** $${total.toLocaleString()}\n`;
      message += `**Registros:** ${gastos.length}\n`;
      
      message += `\n**💡 Recomendación:** `;
      if (total > 50000) {
        message += `Los gastos están altos. Revisa categorías principales.`;
      } else {
        message += `Gastos dentro del presupuesto esperado.`;
      }
      
      return {
        message: message,
        type: 'expenses_table',
        data: gastos,
        metadata: {
          total,
          count: gastos.length
        }
      };
    } catch (error) {
      this.logger.error(`Error obteniendo gastos: ${error.message}`);
      return { 
        message: "Error al cargar los gastos. Intenta de nuevo.", 
        type: 'text' 
      };
    }
  }

  private async getUserProfile(userId: string): Promise<IaResponse> {
    try {
      const user = await this.userModel.findById(userId)
        .select('-password');
      
      if (!user) {
        return {
          message: "Usuario no encontrado. Por favor, verifica tu sesión.",
          type: 'text'
        };
      }
      
      let message = `👤 **Tu Perfil**\n\n`;
      message += `**Nombre:** ${user.nombre}\n`;
      message += `**Rol:** ${user.rol}\n`;
      message += `**Email:** ${user.email}\n`;
      
      if (user.telefono) message += `**Teléfono:** ${user.telefono}\n`;
      
      const createdDate = (user as any).createdAt ? new Date((user as any).createdAt).toLocaleDateString() : 'No disponible';
      message += `**Miembro desde:** ${createdDate}\n`;
      
      if (user.rol === 'VENDEDOR' || user.rol === 'ADMIN') {
        const monthlyStats = await this.cotizacionModel.aggregate([
          {
            $match: {
              vendedor: new Types.ObjectId(userId),
              status: 'Aprobada',
              createdAt: { 
                $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
              }
            }
          },
          {
            $group: {
              _id: null,
              totalSales: { $sum: '$totalPagado' },
              count: { $sum: 1 }
            }
          }
        ]);
        
        const stats = monthlyStats[0] || { totalSales: 0, count: 0 };
        message += `\n**📊 Este mes:**\n`;
        message += `• Ventas: $${stats.totalSales.toLocaleString()}\n`;
        message += `• Vehículos: ${stats.count}\n`;
      }
      
      return {
        message,
        type: 'user_profile',
        data: user
      };
    } catch (error) {
      this.logger.error(`Error obteniendo perfil: ${error.message}`);
      return { 
        message: "Error al cargar tu perfil. Intenta de nuevo.", 
        type: 'text' 
      };
    }
  }

  private async getCompanyInfo(specific?: string): Promise<IaResponse> {
    const companyInfo = `
🏢 **Autobots - CRM Automotriz del Bajío**

📍 **Ubicación:**
Blvd. Adolfo López Mateos 123, León, Guanajuato
(Cerca de Plaza Mayor)

🕒 **Horarios:**
Lunes a Viernes: 9:00 AM - 7:00 PM
Sábados: 9:00 AM - 2:00 PM
Domingos: Cerrado

📞 **Contacto:**
• Teléfono: 477 123 4567
• Soporte: soporte@autobots.mx (Ext. 505)
• Ventas: ventas@autobots.mx (Ext. 501-504)
• WhatsApp: 477 123 4567

🚗 **Servicios:**
1. Venta de autos nuevos y seminuevos
2. Financiamiento automotriz
3. Seguros y garantías
4. Servicio de mantenimiento
5. Evaluación de usados

💡 **¿Necesitas ayuda específica?**
`;

    return { 
      message: companyInfo, 
      type: 'text' 
    };
  }

  private async getTeamPerformance(): Promise<IaResponse> {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const performanceData = await this.cotizacionModel.aggregate([
        {
          $match: {
            status: 'Aprobada',
            createdAt: { $gte: thirtyDaysAgo }
          }
        },
        {
          $group: {
            _id: '$vendedor',
            totalSales: { $sum: '$totalPagado' },
            saleCount: { $sum: 1 },
            avgTicket: { $avg: '$totalPagado' }
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'vendedorInfo'
          }
        },
        { $sort: { totalSales: -1 } }
      ]);
      
      if (!performanceData.length) {
        return {
          message: "📊 **Rendimiento del Equipo**\n\nNo hay datos de ventas en los últimos 30 días.",
          type: 'text'
        };
      }
      
      const totalTeamSales = performanceData.reduce((sum, vendor) => sum + vendor.totalSales, 0);
      const topPerformer = performanceData[0];
      const topName = topPerformer.vendedorInfo?.[0]?.nombre || 'Vendedor';
      
      let message = `🏆 **Rendimiento del Equipo (Últimos 30 días)**\n\n`;
      message += `**Ventas totales del equipo:** $${totalTeamSales.toLocaleString()}\n`;
      message += `**Vendedores activos:** ${performanceData.length}\n\n`;
      message += `**Top Performer:**\n`;
      message += `${topName}\n`;
      message += `• Ventas: $${topPerformer.totalSales.toLocaleString()}\n`;
      message += `• Unidades: ${topPerformer.saleCount}\n`;
      message += `• Ticket promedio: $${Math.round(topPerformer.avgTicket).toLocaleString()}\n`;
      
      return {
        message,
        type: 'team_performance',
        data: performanceData,
        metadata: {
          period: '30_days',
          totalTeamSales,
          averagePerVendor: totalTeamSales / performanceData.length,
          topPerformer: topName
        }
      };
    } catch (error) {
      this.logger.error(`Error obteniendo rendimiento del equipo: ${error.message}`);
      return { 
        message: "Error al cargar el rendimiento del equipo. Intenta de nuevo.", 
        type: 'text' 
      };
    }
  }

  private async getMyPerformance(userId: string): Promise<IaResponse> {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const myStats = await this.cotizacionModel.aggregate([
        {
          $match: {
            vendedor: new Types.ObjectId(userId),
            status: 'Aprobada',
            createdAt: { $gte: thirtyDaysAgo }
          }
        },
        {
          $group: {
            _id: null,
            totalSales: { $sum: '$totalPagado' },
            saleCount: { $sum: 1 },
            avgTicket: { $avg: '$totalPagado' }
          }
        }
      ]);
      
      const stats = myStats[0] || { totalSales: 0, saleCount: 0, avgTicket: 0 };
      
      return {
        message: `📈 **Tu Rendimiento (Últimos 30 días)**\n\n**Ventas Totales:** $${stats.totalSales.toLocaleString()}\n**Vehículos Vendidos:** ${stats.saleCount}\n**Ticket Promedio:** $${Math.round(stats.avgTicket).toLocaleString()}\n\n**💡 Consejo:** Mantén el contacto con clientes prospecto para aumentar tus ventas.`,
        type: 'personal_performance',
        data: stats
      };
    } catch (error) {
      this.logger.error(`Error obteniendo rendimiento personal: ${error.message}`);
      return { 
        message: "Error al cargar tu rendimiento. Intenta de nuevo.", 
        type: 'text' 
      };
    }
  }

  private async getInventoryAnalysis(): Promise<IaResponse> {
    try {
      const inventory = await this.productModel.aggregate([
        {
          $group: {
            _id: '$tipo',
            totalStock: { $sum: '$stock' },
            totalValue: { $sum: { $multiply: ['$precioBase', '$stock'] } },
            count: { $sum: 1 }
          }
        },
        { $sort: { totalValue: -1 } }
      ]);
      
      const totalInventoryValue = inventory.reduce((sum, cat) => sum + cat.totalValue, 0);
      const totalStock = inventory.reduce((sum, cat) => sum + cat.totalStock, 0);
      
      let message = `📦 **Análisis de Inventario**\n\n`;
      message += `**Valor total del inventario:** $${totalInventoryValue.toLocaleString()}\n`;
      message += `**Total de unidades:** ${totalStock}\n\n`;
      message += `**Por Categoría:**\n`;
      
      inventory.forEach(cat => {
        const percentage = (cat.totalValue / totalInventoryValue * 100).toFixed(1);
        message += `• ${cat._id}: ${cat.totalStock} unidades (${percentage}% del valor)\n`;
      });
      
      return {
        message,
        type: 'inventory_analysis',
        data: {
          categories: inventory,
          totals: {
            value: totalInventoryValue,
            stock: totalStock,
            categories: inventory.length
          }
        }
      };
    } catch (error) {
      this.logger.error(`Error obteniendo análisis de inventario: ${error.message}`);
      return { 
        message: "Error al generar el análisis de inventario. Intenta de nuevo.", 
        type: 'text' 
      };
    }
  }

  private async searchCars(keywords: string, userRole: string): Promise<IaResponse> {
    try {
      const safeKeywords = keywords
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        .replace(/busca|buscar|dame|muestra|enseña|un|una|el|la|coche|carro|auto|camioneta|quiero|necesito|tienes|modelo|marca|precio|de|interesa|por favor/gi, '')
        .trim();
      
      if (safeKeywords.length < 2) {
        return this.handleGetProducts(keywords, userRole);
      }
      
      const query: any = {
        $or: [
          { marca: new RegExp(safeKeywords, 'i') },
          { modelo: new RegExp(safeKeywords, 'i') },
          { tipo: new RegExp(safeKeywords, 'i') }
        ]
      };
      
      if (userRole === 'CLIENTE') {
        query.disponible = true;
        query.activo = true;
        query.stock = { $gt: 0 };
      }
      
      const cars = await this.productModel.find(query)
        .sort({ precioBase: 1 })
        .limit(15);
      
      if (!cars.length) {
        return {
          message: `🔍 **No encontré "${safeKeywords}" en stock.**\n\nTe sugiero visitarnos o llamar al 477 123 4567 para consultar disponibilidad.`,
          type: 'text',
          metadata: {
            originalSearch: safeKeywords,
            isAlternative: true,
            userRole
          }
        };
      }
      
      return {
        message: `🎯 **Encontré ${cars.length} resultados para "${safeKeywords}":**`,
        type: 'products_grid',
        data: cars,
        metadata: {
          searchQuery: safeKeywords,
          userRole,
          count: cars.length
        }
      };
    } catch (error) {
      this.logger.error(`Error buscando autos: ${error.message}`);
      return { 
        message: "Error al buscar en el inventario. Intenta de nuevo.", 
        type: 'text' 
      };
    }
  }

  private async chatWithAi(prompt: string, userId: string, userRole: string): Promise<IaResponse> {
    try {
      const user = await this.userModel.findById(userId).select('nombre rol');
      const userName = user ? user.nombre.split(' ')[0] : 'Usuario';
      
      let roleContext = '';
      let systemPrompt = '';
      
      if (userRole === 'ADMIN') {
        roleContext = ADMIN_CONTEXT;
        systemPrompt = `
          ${BASE_CONTEXT}
          ${roleContext}
          
          USUARIO ACTUAL: ${userName} (${userRole}).
          
          RESPUESTAS PARA ADMIN:
          - Sé ejecutivo y directo
          - Enfócate en datos, métricas y KPIs
          - Ofrece recomendaciones estratégicas
          - Usa lenguaje profesional
          
          NO uses emojis excesivos.
        `;
      } else if (userRole === 'VENDEDOR') {
        roleContext = VENDOR_CONTEXT;
        systemPrompt = `
          ${BASE_CONTEXT}
          ${roleContext}
          
          USUARIO ACTUAL: ${userName} (${userRole}).
          
          RESPUESTAS PARA VENDEDOR:
          - Sé práctico y orientado a resultados
          - Sugiere estrategias de venta concretas
          - Ayuda con seguimiento de clientes
          - Mantén energía positiva
          
          Usa algunos emojis relevantes.
        `;
      } else {
        roleContext = CLIENT_CONTEXT;
        systemPrompt = `
          ${BASE_CONTEXT}
          ${roleContext}
          
          USUARIO ACTUAL: ${userName} (Cliente potencial).
          
          RESPUESTAS PARA CLIENTE:
          - Sé amable, entusiasta y servicial
          - Explica cosas en lenguaje simple
          - Ofrece opciones concretas
          - Invita a la acción (visitar, llamar, agendar)
          - NO hables de tareas internas, reportes, o cotizaciones de otros
          
          Usa emojis para hacerlo más cercano 😊
        `;
      }
      
      const response = await this.callOllamaEnhanced(systemPrompt, prompt, userRole);
      return { 
        message: response, 
        type: 'text',
        metadata: {
          userRole,
          userName
        }
      };
    } catch (error) {
      this.logger.error(`Error en chat con IA: ${error.message}`);
      return { 
        message: userRole === 'CLIENTE' 
          ? "Disculpa, estoy teniendo dificultades. ¿Podrías llamar al 477 123 4567 para asistencia inmediata?"
          : "Error de conexión con la IA. Intenta de nuevo o consulta los datos directamente.",
        type: 'text'
      };
    }
  }

  private async callOllamaEnhanced(system: string, user: string, userRole: string): Promise<string> {
    const payload = {
      model: this.model,
      messages: [
        { 
          role: 'system', 
          content: system 
        },
        { 
          role: 'user', 
          content: user 
        }
      ],
      stream: false,
      options: { 
        num_predict: 200,
        temperature: userRole === 'CLIENTE' ? 0.7 : 0.4,
        top_p: 0.9
      }
    };

    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.ollamaHost}/api/chat`, payload, { 
          timeout: 30000 
        })
      );
      
      if (response.data?.message?.content) {
        return response.data.message.content;
      }
      return "Disculpa, no pude procesar tu solicitud. ¿Podrías intentar de nuevo?";
    } catch (error) {
      this.logger.error(`Error calling Ollama: ${error.message}`);
      
      if (userRole === 'CLIENTE') {
        return "Disculpa, estoy teniendo dificultades técnicas. ¿Podrías intentar tu pregunta de nuevo o contactar a nuestro equipo de soporte? 😊";
      } else {
        return "Error de conexión con la IA. Intenta de nuevo o consulta los datos directamente.";
      }
    }
  }
}