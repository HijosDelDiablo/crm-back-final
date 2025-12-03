import { Injectable, Logger, NotFoundException } from '@nestjs/common';
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

      const intent = await this.classifyIntentByRole(prompt, userRole);

      this.logger.log(`Usuario: ${user?.nombre} (${userRole}) | Intención: ${intent.action} | Prompt: "${prompt}"`);

      switch (intent.action) {
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

        case 'get_messages':
          if (userRole === 'CLIENTE') {
            return await this.getClientMessages(userId);
          }
          return await this.getMyTasks(userId);

        case 'get_my_tasks':
          if (userRole === 'CLIENTE') {
            return await this.getClientMessages(userId);
          }
          return await this.getMyTasks(userId, intent.params?.filter);

        case 'get_sales_report':
          if (userRole === 'CLIENTE') {
            return {
              message: "Los reportes de ventas son informacion interna de la empresa.",
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
              message: "Para consultas sobre otros clientes, contacta al area de servicio al cliente.",
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
              message: "La informacion de gastos es administrativa y confidencial.",
              type: 'text'
            };
          }
          return await this.getExpensesAdmin(intent.params);

        case 'get_profile':
          return await this.getUserProfile(userId);

        case 'get_performance':
          if (userRole === 'CLIENTE') {
            return {
              message: "Esta funcion esta disponible solo para el equipo de ventas.",
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

        case 'best_sellers':
          return await this.getBestSellers();

        case 'financing_info':
          return await this.getFinancingInfo();

        case 'client_capabilities':
          return await this.getClientCapabilities();

        case 'top_client':
          return await this.getTopClient();

        case 'top_stock_cars':
          return await this.getTopStockCars();

        case 'cars_summary':
          return await this.getCarsSummary();

        case 'employees_summary':
          if (userRole === 'ADMIN') {
            return await this.getEmployeesSummary();
          }
          return { message: "Esta funcion es solo para administradores.", type: 'text' };

        case 'clients_summary':
          return await this.getClientsSummary();

        case 'chat':
        default:
          return {
            message: "De momento no puedo responder esa pregunta. Contacta con: soporte@autobots.mx o llama al 477 123 4567",
            type: 'text'
          };
      }
    } catch (error) {
      this.logger.error(`Error procesando consulta: ${error.message}`, error.stack);
      return {
        message: "Disculpa, encontre un problema tecnico.",
        type: 'text'
      };
    }
  }

  private async classifyIntentByRole(userPrompt: string, userRole: string): Promise<{ action: string; params?: any }> {
    const cleanPrompt = userPrompt.toLowerCase().trim();

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

    if (userRole === 'CLIENTE') {
      if (cleanPrompt.match(/(mensajes?|comunicaciones?|notificaciones?|actualizaciones?|seguimiento|respuesta|me contactaron|me llamaron|estado de mi)/)) {
        return { action: 'get_messages' };
      }

      if (cleanPrompt.match(/(mis tareas?|mis pendientes?|mi agenda)/)) {
        return { action: 'get_messages' };
      }

    } else {
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

    if (cleanPrompt.match(/(busca|buscar|encontrar|tienes|hay)(.*)(mazda|honda|toyota|nissan|ford|chevrolet|audi|bmw)/i)) {
      return { action: 'search_cars', params: { keywords: userPrompt } };
    }

    if (cleanPrompt.match(/(quien soy|mi perfil|mi cuenta|mis datos)/)) {
      return { action: 'get_profile' };
    }

    if (cleanPrompt.match(/(mejores vendedores|top vendedores|vendedores estrella|mejor vendedor)/)) {
      return { action: 'best_sellers' };
    }

    if (cleanPrompt.match(/(como funciona el financiamiento|explicame el financiamiento|financiamiento como funciona)/)) {
      return { action: 'financing_info' };
    }

    if (userRole !== 'CLIENTE') {
      if (cleanPrompt.match(/(que puede hacer el cliente|capacidades del cliente|funciones del cliente)/)) {
        return { action: 'client_capabilities' };
      }

      if (cleanPrompt.match(/(cliente con mas compras|top cliente|cliente estrella|cliente mas fiel)/)) {
        return { action: 'top_client' };
      }

      if (cleanPrompt.match(/(autos con mas stock|stock mas alto|inventario mas grande)/)) {
        return { action: 'top_stock_cars' };
      }

      if (cleanPrompt.match(/(resumen de autos|resumen vehiculos|estadisticas autos)/)) {
        return { action: 'cars_summary' };
      }

      if (cleanPrompt.match(/(resumen de empleados|estadisticas empleados)/) && userRole === 'ADMIN') {
        return { action: 'employees_summary' };
      }

      if (cleanPrompt.match(/(resumen de clientes|estadisticas clientes)/)) {
        return { action: 'clients_summary' };
      }
    }

    if (cleanPrompt.match(/^(hola|buenos|buenas|que tal|saludos)/)) {
      return { action: 'chat' };
    }

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
          ? "Actualmente no tenemos vehiculos en exhibicion."
          : "El inventario esta vacio.";

        return {
          message,
          type: 'text'
        };
      }

      const message = userRole === 'CLIENTE'
        ? `Tenemos ${products.length} autos disponibles para ti.`
        : `Inventario disponible (${products.length} unidades)`;

      return {
        message,
        type: 'products_grid',
        data: products,
        metadata: {
          userRole,
          total: products.length
        }
      };
    } catch (error) {
      this.logger.error(`Error obteniendo productos: ${error.message}`);
      return {
        message: "Error al cargar el inventario.",
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

    let message = `Simulacion de Financiamiento\n\n`;
    message += `Precio del vehiculo: $${price.toLocaleString()}\n`;
    message += `Enganche (${downPaymentPercent}%): $${downPayment.toLocaleString()}\n`;
    message += `Monto a financiar: $${financedAmount.toLocaleString()}\n`;
    message += `Plazo: ${termMonths} meses\n`;
    message += `Tasa anual: ${annualRate}%\n\n`;
    message += `Resultados:\n`;
    message += `Pago mensual: $${calculations.monthlyPayment.toLocaleString()}\n`;
    message += `Total a pagar: $${calculations.totalPaid.toLocaleString()}\n`;
    message += `Intereses totales: $${calculations.totalInterest.toLocaleString()}\n`;

    return {
      message,
      type: 'financing_calculation',
      data: calculations
    };
  }

  private async scheduleTestDrive(userId: string, userRole: string): Promise<IaResponse> {
    if (userRole !== 'CLIENTE') {
      return {
        message: "Esta funcion es para clientes.",
        type: 'text'
      };
    }

    const user = await this.userModel.findById(userId);
    const userName = user ? user.nombre.split(' ')[0] : 'Cliente';

    const availableSlots = [
      "Lunes 10:00 AM", "Lunes 2:00 PM",
      "Martes 11:00 AM", "Martes 4:00 PM",
      "Miercoles 9:00 AM", "Miercoles 3:00 PM",
      "Jueves 10:30 AM", "Jueves 5:00 PM",
      "Viernes 11:30 AM", "Viernes 4:30 PM",
      "Sabado 9:30 AM", "Sabado 11:00 AM"
    ];

    return {
      message: `Programar Prueba de Manejo\n\nHorarios disponibles:\n${availableSlots.map((slot, i) => `${i + 1}. ${slot}`).join('\n')}`,
      type: 'test_drive_slots',
      data: {
        slots: availableSlots,
        user: user?.nombre
      }
    };
  }

  private async getSupportInfo(topic: string = 'general'): Promise<IaResponse> {
    const supportInfo = `Centro de Ayuda\n\nContacto directo:\nTelefono: 477 123 4567\nEmail: soporte@autobots.mx\nWhatsApp: 477 123 4567`;

    return {
      message: supportInfo,
      type: 'text',
      metadata: {
        topic
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
          message: "No tienes mensajes pendientes.",
          type: 'text'
        };
      }

      const pendingQuotes = clientQuotes.filter(q => q.status === 'Pendiente');
      const approvedQuotes = clientQuotes.filter(q => q.status === 'Aprobada');

      let message = `Tus comunicaciones recientes\n\n`;

      if (pendingQuotes.length > 0) {
        message += `Cotizaciones en revision (${pendingQuotes.length}):\n`;
        pendingQuotes.forEach((quote, i) => {
          if (i < 3) {
            const coche = quote.coche as any;
            const vendedor = quote.vendedor as any;
            message += `${coche?.marca || ''} ${coche?.modelo || ''} - Asesor: ${vendedor?.nombre || 'Por asignar'}\n`;
          }
        });
      }

      if (approvedQuotes.length > 0) {
        message += `Cotizaciones aprobadas (${approvedQuotes.length}):\n`;
        approvedQuotes.slice(0, 2).forEach(quote => {
          const coche = quote.coche as any;
          message += `${coche?.marca || ''} ${coche?.modelo || ''}\n`;
        });
      }

      return {
        message,
        type: 'text',
        data: clientQuotes
      };
    } catch (error) {
      this.logger.error(`Error obteniendo mensajes del cliente: ${error.message}`);
      return {
        message: "Para consultar el estado de tus cotizaciones, contacta al area de ventas.",
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
          message: "No tienes tareas pendientes.",
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

      let message = `Tus Tareas Pendientes\n\n`;
      message += `Total: ${tasks.length} tareas\n`;

      if (overdueTasks.length > 0) {
        message += `Vencidas: ${overdueTasks.length}\n`;
      }

      if (todayTasks.length > 0) {
        message += `Para hoy: ${todayTasks.length}\n`;
      }

      message += `Proximas tareas:\n`;

      tasks.slice(0, 3).forEach((task, i) => {
        const dueDate = new Date(task.dueDate);
        message += `${i + 1}. ${task.title}\n`;
        if (task.cliente) {
          const cliente = task.cliente as any;
          message += `   ${cliente.nombre || 'Cliente'}\n`;
        }
        message += `   Vence: ${dueDate.toLocaleDateString()}\n`;
        message += `\n`;
      });

      if (tasks.length > 3) {
        message += `y ${tasks.length - 3} tareas mas.\n`;
      }

      return {
        message,
        type: 'tasks_list',
        data: tasks
      };
    } catch (error) {
      this.logger.error(`Error obteniendo tareas: ${error.message}`);
      return {
        message: "Error al cargar tus tareas.",
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
          message: "Todas las cotizaciones estan procesadas.",
          type: 'text'
        };
      }

      const totalValue = cotizaciones.reduce((sum, quote) => sum + (quote.totalPagado || 0), 0);

      let message = `Cotizaciones Pendientes de Aprobacion\n\n`;
      message += `Total: ${cotizaciones.length} cotizaciones\n`;
      message += `Valor pendiente: $${totalValue.toLocaleString()}\n`;

      // CORRECCIÓN: Usar get() para acceder a propiedades de timestamps
      const dates = cotizaciones.map(q => {
        const createdAt = q.get('createdAt') as Date;
        return createdAt ? createdAt.getTime() : Date.now();
      });

      const oldestDate = new Date(Math.min(...dates));
      const daysOld = Math.floor((Date.now() - oldestDate.getTime()) / (1000 * 60 * 60 * 24));

      message += `La mas antigua tiene: ${daysOld} dias\n`;

      return {
        message,
        type: 'cotizaciones_table',
        data: cotizaciones
      };
    } catch (error) {
      this.logger.error(`Error obteniendo cotizaciones: ${error.message}`);
      return {
        message: "Error al cargar las cotizaciones.",
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
          message: "No tienes cotizaciones pendientes.",
          type: 'text'
        };
      }

      // CORRECCIÓN: Usar get() para acceder a propiedades de timestamps
      const dates = myPendingQuotes.map(q => {
        const createdAt = q.get('createdAt') as Date;
        return createdAt ? createdAt.getTime() : Date.now();
      });

      const oldestDate = new Date(Math.min(...dates));
      const daysOld = Math.floor((Date.now() - oldestDate.getTime()) / (1000 * 60 * 60 * 24));

      return {
        message: `Tus Cotizaciones Pendientes\n\nTienes ${myPendingQuotes.length} cotizaciones pendientes.\nLa mas antigua tiene ${daysOld} dias.`,
        type: 'cotizaciones_table',
        data: myPendingQuotes
      };
    } catch (error) {
      this.logger.error(`Error obteniendo cotizaciones del vendedor: ${error.message}`);
      return {
        message: "Error al cargar tus cotizaciones.",
        type: 'text'
      };
    }
  }

  private async getClientsAdmin(filter: string = 'all'): Promise<IaResponse> {
    try {
      let query: any = { rol: 'CLIENTE' };
      let sort: any = { createdAt: -1 };

      switch (filter) {
        case 'new':
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          query.createdAt = { $gte: thirtyDaysAgo };
          break;
        case 'active':
          query.ultimoContacto = { $gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) };
          break;
        case 'inactive':
          query.ultimoContacto = { $lt: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000) };
          break;
      }

      const clients = await this.userModel.find(query)
        .select('nombre email telefono ciudad createdAt')
        .sort(sort)
        .limit(15);

      if (!clients.length) {
        return {
          message: "No hay clientes que coincidan con este filtro.",
          type: 'text'
        };
      }

      const newClients = clients.filter(client => {
        const createdAt = client.get('createdAt') as Date;
        const daysAgo = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
        return daysAgo <= 30;
      });

      let message = `Base de Clientes\n\n`;
      message += `Total: ${clients.length} clientes\n`;
      message += `Nuevos (30 dias): ${newClients.length}\n\n`;
      message += `Clientes mas recientes:\n`;
      clients.slice(0, 5).forEach((client, i) => {
        const createdAt = client.get('createdAt') as Date;
        const daysAgo = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
        message += `${i + 1}. ${client.nombre}\n`;
        message += `   Registrado hace ${daysAgo} dias\n\n`;
      });

      if (clients.length > 5) {
        message += `y ${clients.length - 5} clientes mas.\n`;
      }

      return {
        message,
        type: 'clients_list',
        data: clients
      };
    } catch (error) {
      this.logger.error(`Error obteniendo clientes: ${error.message}`);
      return {
        message: "Error al cargar la lista de clientes.",
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
          message: "Aun no tienes clientes asignados.",
          type: 'text'
        };
      }

      const clientsWithRecentContact = myClients.filter(client => {
        const daysSinceContact = Math.floor((Date.now() - new Date(client.lastQuote).getTime()) / (1000 * 60 * 60 * 24));
        return daysSinceContact <= 30;
      });

      return {
        message: `Tu Lista de Clientes\n\nTotal: ${myClients.length} clientes\nContacto reciente (30 dias): ${clientsWithRecentContact.length}`,
        type: 'clients_list',
        data: myClients.map(client => ({
          ...client,
          clienteInfo: client.clienteInfo[0]
        }))
      };
    } catch (error) {
      this.logger.error(`Error obteniendo clientes del vendedor: ${error.message}`);
      return {
        message: "Error al cargar tus clientes.",
        type: 'text'
      };
    }
  }

  private async getSalesReportAdmin(period: string = 'month'): Promise<IaResponse> {
    try {
      const now = new Date();
      let startDate: Date;

      switch (period) {
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
        message: `Reporte de Ventas\n\nVentas Totales: $${data.totalVendido.toLocaleString()}\nUnidades Vendidas: ${data.count}\nTicket Promedio: $${Math.round(data.avgTicket).toLocaleString()}`,
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
        message: "Error al generar el reporte de ventas.",
        type: 'text'
      };
    }
  }

  private async getSalesReportVendor(vendorId: string, period: string = 'month'): Promise<IaResponse> {
    try {
      const now = new Date();
      let startDate: Date;

      switch (period) {
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
        message: `Tus Ventas\n\nTotal Vendido: $${data.totalVendido.toLocaleString()}\nVehiculos: ${data.count}\nTicket Promedio: $${Math.round(data.avgTicket).toLocaleString()}`,
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
        message: "Error al cargar tus ventas.",
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
          message: "No hay gastos registrados con ese filtro.",
          type: 'text'
        };
      }

      const total = gastos.reduce((acc, curr) => acc + (curr.monto || 0), 0);

      let message = `Reporte de Gastos\n\n`;
      message += `Total: $${total.toLocaleString()}\n`;
      message += `Registros: ${gastos.length}\n`;

      return {
        message: message,
        type: 'expenses_table',
        data: gastos
      };
    } catch (error) {
      this.logger.error(`Error obteniendo gastos: ${error.message}`);
      return {
        message: "Error al cargar los gastos.",
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
          message: "Usuario no encontrado.",
          type: 'text'
        };
      }

      let message = `Tu Perfil\n\n`;
      message += `Nombre: ${user.nombre}\n`;
      message += `Rol: ${user.rol}\n`;
      message += `Email: ${user.email}\n`;

      if (user.telefono) message += `Telefono: ${user.telefono}\n`;

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
        message += `Este mes:\n`;
        message += `Ventas: $${stats.totalSales.toLocaleString()}\n`;
        message += `Vehiculos: ${stats.count}\n`;
      }

      return {
        message,
        type: 'user_profile',
        data: user
      };
    } catch (error) {
      this.logger.error(`Error obteniendo perfil: ${error.message}`);
      return {
        message: "Error al cargar tu perfil.",
        type: 'text'
      };
    }
  }

  private async getCompanyInfo(specific?: string): Promise<IaResponse> {
    const companyInfo = `Autobots - CRM Automotriz del Bajio\n\nUbicacion:\nBlvd. Adolfo Lopez Mateos 123, Leon, Guanajuato\n\nHorarios:\nLunes a Viernes: 9:00 AM - 7:00 PM\nSabados: 9:00 AM - 2:00 PM\n\nContacto:\nTelefono: 477 123 4567\nSoporte: soporte@autobots.mx`;
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
          message: "No hay datos de ventas en los ultimos 30 dias.",
          type: 'text'
        };
      }

      const totalTeamSales = performanceData.reduce((sum, vendor) => sum + vendor.totalSales, 0);
      const topPerformer = performanceData[0];
      const topName = topPerformer.vendedorInfo?.[0]?.nombre || 'Vendedor';

      let message = `Rendimiento del Equipo (Ultimos 30 dias)\n\n`;
      message += `Ventas totales del equipo: $${totalTeamSales.toLocaleString()}\n`;
      message += `Vendedores activos: ${performanceData.length}\n\n`;
      message += `Top Performer:\n`;
      message += `${topName}\n`;
      message += `Ventas: $${topPerformer.totalSales.toLocaleString()}\n`;

      return {
        message,
        type: 'team_performance',
        data: performanceData
      };
    } catch (error) {
      this.logger.error(`Error obteniendo rendimiento del equipo: ${error.message}`);
      return {
        message: "Error al cargar el rendimiento del equipo.",
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
        message: `Tu Rendimiento (Ultimos 30 dias)\n\nVentas Totales: $${stats.totalSales.toLocaleString()}\nVehiculos Vendidos: ${stats.saleCount}\nTicket Promedio: $${Math.round(stats.avgTicket).toLocaleString()}`,
        type: 'personal_performance',
        data: stats
      };
    } catch (error) {
      this.logger.error(`Error obteniendo rendimiento personal: ${error.message}`);
      return {
        message: "Error al cargar tu rendimiento.",
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

      let message = `Analisis de Inventario\n\n`;
      message += `Valor total del inventario: $${totalInventoryValue.toLocaleString()}\n`;
      message += `Total de unidades: ${totalStock}\n\n`;
      message += `Por Categoria:\n`;

      inventory.forEach(cat => {
        const percentage = (cat.totalValue / totalInventoryValue * 100).toFixed(1);
        message += `${cat._id}: ${cat.totalStock} unidades (${percentage}% del valor)\n`;
      });

      return {
        message,
        type: 'inventory_analysis',
        data: {
          categories: inventory,
          totals: {
            value: totalInventoryValue,
            stock: totalStock
          }
        }
      };
    } catch (error) {
      this.logger.error(`Error obteniendo analisis de inventario: ${error.message}`);
      return {
        message: "Error al generar el analisis de inventario.",
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
          message: `No encontre "${safeKeywords}" en stock.`,
          type: 'text'
        };
      }

      return {
        message: `Encontre ${cars.length} resultados para "${safeKeywords}":`,
        type: 'products_grid',
        data: cars
      };
    } catch (error) {
      this.logger.error(`Error buscando autos: ${error.message}`);
      return {
        message: "Error al buscar en el inventario.",
        type: 'text'
      };
    }
  }

  private async chatWithAi(prompt: string, userId: string, userRole: string): Promise<IaResponse> {
    try {
      const user = await this.userModel.findById(userId).select('nombre rol');
      const userName = user ? user.nombre.split(' ')[0] : 'Usuario';

      let systemPrompt = `Eres un asistente de una concesionaria de autos. Usuario: ${userName} (${userRole}).`;

      const payload = {
        model: this.model,
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        stream: false,
        options: {
          num_predict: 200,
          temperature: 0.7
        }
      };

      const response = await firstValueFrom(
        this.httpService.post(`${this.ollamaHost}/api/chat`, payload, {
          timeout: 30000
        })
      );

      if (response.data?.message?.content) {
        return {
          message: response.data.message.content,
          type: 'text'
        };
      }
      return {
        message: "Disculpa, no pude procesar tu solicitud.",
        type: 'text'
      };
    } catch (error) {
      this.logger.error(`Error en chat con IA: ${error.message}`);
      return {
        message: "Error de conexion con la IA.",
        type: 'text'
      };
    }
  }

  private async getBestSellers(): Promise<IaResponse> {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const bestSellers = await this.cotizacionModel.aggregate([
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
            saleCount: { $sum: 1 }
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
        { $sort: { totalSales: -1 } },
        { $limit: 5 }
      ]);

      if (!bestSellers.length) {
        return {
          message: "No hay datos de ventas en los ultimos 30 dias.",
          type: 'text'
        };
      }

      let message = `Mejores Vendedores (Ultimos 30 dias)\n\n`;
      bestSellers.forEach((seller, i) => {
        const name = seller.vendedorInfo?.[0]?.nombre || 'Vendedor';
        message += `${i + 1}. ${name}\n`;
        message += `   Ventas: $${seller.totalSales.toLocaleString()}\n`;
        message += `   Vehiculos: ${seller.saleCount}\n\n`;
      });

      return {
        message,
        type: 'best_sellers',
        data: bestSellers
      };
    } catch (error) {
      this.logger.error(`Error obteniendo mejores vendedores: ${error.message}`);
      return {
        message: "Error al cargar los mejores vendedores.",
        type: 'text'
      };
    }
  }

  private async getFinancingInfo(): Promise<IaResponse> {
    const financingInfo = `Como Funciona el Financiamiento\n\nEn Autobots, ofrecemos financiamiento flexible para que puedas adquirir tu vehiculo ideal.\n\nProceso:\n1. Elige el vehiculo que te interesa\n2. Selecciona el porcentaje de enganche (minimo 20%)\n3. Elige el plazo (hasta 72 meses)\n4. Calculamos tu mensualidad con tasa fija\n\nBeneficios:\n- Tasas competitivas desde 12% anual\n- Enganches desde 20%\n- Plazos hasta 6 años\n- Aprobacion rapida\n\nPara calcular una mensualidad especifica, dime el precio del vehiculo, enganche y plazo.`;

    return {
      message: financingInfo,
      type: 'text'
    };
  }

  private async getClientCapabilities(): Promise<IaResponse> {
    const capabilities = `Que Puede Hacer un Cliente\n\nComo cliente registrado, puedes:\n\n- Ver autos disponibles en inventario\n- Buscar vehiculos por marca o modelo\n- Calcular financiamiento personalizado\n- Agendar prueba de manejo\n- Ver el estado de tus cotizaciones\n- Contactar con soporte tecnico\n- Obtener informacion de la empresa\n- Ver mejores vendedores\n\nPara cualquier consulta, estoy aqui para ayudarte!`;

    return {
      message: capabilities,
      type: 'text'
    };
  }

  private async getTopClient(): Promise<IaResponse> {
    try {
      const topClients = await this.cotizacionModel.aggregate([
        {
          $match: {
            status: 'Aprobada'
          }
        },
        {
          $group: {
            _id: '$cliente',
            totalPurchases: { $sum: '$totalPagado' },
            purchaseCount: { $sum: 1 }
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
        { $sort: { totalPurchases: -1 } },
        { $limit: 1 }
      ]);

      if (!topClients.length) {
        return {
          message: "No hay datos de compras.",
          type: 'text'
        };
      }

      const topClient = topClients[0];
      const name = topClient.clienteInfo?.[0]?.nombre || 'Cliente';

      return {
        message: `Cliente con Mas Compras\n\n${name}\nTotal Comprado: $${topClient.totalPurchases.toLocaleString()}\nVehiculos Comprados: ${topClient.purchaseCount}`,
        type: 'top_client',
        data: topClient
      };
    } catch (error) {
      this.logger.error(`Error obteniendo top cliente: ${error.message}`);
      return {
        message: "Error al cargar el cliente top.",
        type: 'text'
      };
    }
  }

  private async getTopStockCars(): Promise<IaResponse> {
    try {
      const topStockCars = await this.productModel.find({
        disponible: true,
        activo: true,
        stock: { $gt: 0 }
      })
        .sort({ stock: -1 })
        .limit(5);

      if (!topStockCars.length) {
        return {
          message: "No hay autos en stock.",
          type: 'text'
        };
      }

      let message = `Autos con Mas Stock\n\n`;
      topStockCars.forEach((car, i) => {
        message += `${i + 1}. ${car.marca} ${car.modelo}\n`;
        message += `   Stock: ${car.stock} unidades\n`;
        message += `   Precio: $${car.precioBase.toLocaleString()}\n\n`;
      });

      return {
        message,
        type: 'top_stock_cars',
        data: topStockCars
      };
    } catch (error) {
      this.logger.error(`Error obteniendo autos con mas stock: ${error.message}`);
      return {
        message: "Error al cargar los autos con mas stock.",
        type: 'text'
      };
    }
  }

  private async getCarsSummary(): Promise<IaResponse> {
    try {
      const summary = await this.productModel.aggregate([
        {
          $group: {
            _id: null,
            totalCars: { $sum: 1 },
            totalStock: { $sum: '$stock' },
            totalValue: { $sum: { $multiply: ['$precioBase', '$stock'] } },
            avgPrice: { $avg: '$precioBase' }
          }
        }
      ]);

      if (!summary.length) {
        return {
          message: "No hay autos registrados.",
          type: 'text'
        };
      }

      const data = summary[0];

      return {
        message: `Resumen de Autos\n\nTotal de Modelos: ${data.totalCars}\nTotal en Stock: ${data.totalStock}\nValor Total del Inventario: $${data.totalValue.toLocaleString()}\nPrecio Promedio: $${Math.round(data.avgPrice).toLocaleString()}`,
        type: 'cars_summary',
        data
      };
    } catch (error) {
      this.logger.error(`Error obteniendo resumen de autos: ${error.message}`);
      return {
        message: "Error al cargar el resumen de autos.",
        type: 'text'
      };
    }
  }

  private async getEmployeesSummary(): Promise<IaResponse> {
    try {
      const employees = await this.userModel.find({
        rol: { $in: ['VENDEDOR', 'ADMIN'] }
      }).select('nombre rol');

      const vendors = employees.filter(e => e.rol === 'VENDEDOR');
      const admins = employees.filter(e => e.rol === 'ADMIN');

      return {
        message: `Resumen de Empleados\n\nTotal de Empleados: ${employees.length}\nVendedores: ${vendors.length}\nAdministradores: ${admins.length}`,
        type: 'employees_summary',
        data: {
          total: employees.length,
          vendors: vendors.length,
          admins: admins.length,
          employees
        }
      };
    } catch (error) {
      this.logger.error(`Error obteniendo resumen de empleados: ${error.message}`);
      return {
        message: "Error al cargar el resumen de empleados.",
        type: 'text'
      };
    }
  }

  private async getClientsSummary(): Promise<IaResponse> {
    try {
      const clients = await this.userModel.find({ rol: 'CLIENTE' }).select('nombre email createdAt');

      const newClients = clients.filter(client => {
        const createdAt = client.get('createdAt') as Date;
        const daysAgo = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
        return daysAgo <= 30;
      });

      return {
        message: `Resumen de Clientes\n\nTotal de Clientes: ${clients.length}\nNuevos (30 dias): ${newClients.length}`,
        type: 'clients_summary',
        data: {
          total: clients.length,
          newClients: newClients.length,
          clients
        }
      };
    } catch (error) {
      this.logger.error(`Error obteniendo resumen de clientes: ${error.message}`);
      return {
        message: "Error al cargar el resumen de clientes.",
        type: 'text'
      };
    }
  }
}