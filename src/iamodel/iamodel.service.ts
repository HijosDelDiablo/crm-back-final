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

const COMPANY_CONTEXT = `
DATOS DE LA EMPRESA:
- Nombre: Autobots (CRM Automotriz del Bajío).
- Ubicación: Blvd. Adolfo López Mateos 123, León, Gto.
- Horario: L-V 9am-7pm, Sáb 9am-2pm.
- Contacto Soporte: soporte@autobots.mx (Ext 505).

PERSONALIDAD:
- Eres "SmartAssistant".
- Actúa como un vendedor experto: servicial, rápido y con conocimiento de autos.
- NO SALUDES si el usuario no te saluda. Ve al grano.
- Si piden ver autos, muéstralos, no preguntes "¿en qué puedo ayudar?".
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
    const intent = await this.classifyIntentRobust(prompt);
    this.logger.log(`Intent Detectado: ${intent.action} | Prompt: "${prompt}"`);

    try {
      switch (intent.action) {
        case 'get_products':
          return this.getProductsGeneral();
        case 'get_pending_quotes':
          return this.getPendingQuotes();
        case 'search_cars':
          return this.searchCars(intent.params?.keywords || prompt);
        case 'get_clients':
          return this.getClients();
        case 'get_my_tasks':
          return this.getMyTasks(userId);
        case 'get_sales_report':
          return this.getSalesReport();
        case 'get_expenses':
          return this.getExpenses(intent.params?.status);
        case 'get_profile':
          return this.getUserProfile(userId);
        case 'company_info':
          return this.getCompanyInfo();
        case 'chat':
        default:
          return this.chatWithAi(prompt, userId);
      }
    } catch (error) {
      this.logger.error(`Error: ${error.message}`);
      return { 
        message: "Tuve un error interno conectando con la base de datos.", 
        type: 'text' 
      };
    }
  }

  private async classifyIntentRobust(userPrompt: string): Promise<{ action: string; params?: any }> {
    const cleanPrompt = userPrompt.toLowerCase().trim();

    if (cleanPrompt.match(/(dame|muestra|enseña|ver|listar|lista|muestrame) (los |las )?(autos|carros|coches|productos|vehiculos|inventario|catalogo)/)) {
        return { action: 'get_products' };
    }
    if (cleanPrompt.match(/^(inventario|catalogo|productos|autos|coches|carros|ver todo)$/)) {
        return { action: 'get_products' };
    }
    if (cleanPrompt.match(/^(si|sí|claro|ver|dale|simon|por favor)$/)) {
        return { action: 'get_products' };
    }

    const brands = "mazda|honda|toyota|nissan|ford|chevrolet|vw|volkswagen|audi|bmw|kia|seat|volvo|mercedes|jeep|hyundai|renault|peugeot|tesla|porsche";
    
    if (cleanPrompt.match(/busca|buscar|tienes|quiero|necesito|precio|cuanto cuesta/)) {
        return { action: 'search_cars', params: { keywords: userPrompt } };
    }
    
    const brandRegex = new RegExp(`(${brands})`, 'i');
    if (brandRegex.test(cleanPrompt)) {
        return { action: 'search_cars', params: { keywords: userPrompt } };
    }

    if (cleanPrompt.match(/tarea|agenda|pendiente|hacer|recordatorio/)) return { action: 'get_my_tasks' };
    if (cleanPrompt.match(/venta|reporte|ganancia|mes|vendido|estadistica|kpi/)) return { action: 'get_sales_report' };
    if (cleanPrompt.match(/gasto|pago|luz|agua|renta|nomine/)) return { action: 'get_expenses' };
    if (cleanPrompt.match(/cotiza|aprobacion|autoriza|descuento/)) return { action: 'get_pending_quotes' };
    if (cleanPrompt.match(/cliente|comprador|usuario/)) return { action: 'get_clients' };
    if (cleanPrompt.match(/quien soy|mi perfil|mi cuenta/)) return { action: 'get_profile' };

    if (cleanPrompt.match(/(dónde|donde|ubicaci[oó]n|direcci[oó]n|local|sucursal|horario|tel[ée]fono|contacto|correo|email|soporte|empresa|oficina|lugar)/)) {
        return { action: 'company_info' };
    }

    if (cleanPrompt.match(/^(hola|buenos dias|buenas tardes|que tal|saludos|hey)$/)) return { action: 'chat' };

    return { action: 'chat' }; 
  }

  private async getCompanyInfo(): Promise<IaResponse> {
    const companyInfo = `
**Autobots - CRM Automotriz del Bajío**

**Ubicación:** 
Blvd. Adolfo López Mateos 123, León, Guanajuato

**Horario:**
Lunes a Viernes: 9:00 AM - 7:00 PM
Sábados: 9:00 AM - 2:00 PM

**Contacto de Soporte:**
soporte@autobots.mx (Extensión 505)

¿Necesitas ayuda con algo específico?
    `;

    return { 
      message: companyInfo, 
      type: 'text' 
    };
  }

  private async searchCars(keywords: string): Promise<IaResponse> {
    const safeKeywords = keywords.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const cleanKeys = safeKeywords
        .replace(/busca|buscar|dame|muestra|enseña|un|una|el|la|coche|carro|auto|camioneta|quiero|necesito|tienes|modelo|marca|precio|de|interesa|x3/gi, '')
        .trim();
    
    if (cleanKeys.length < 2) return this.getProductsGeneral();

    const regex = new RegExp(cleanKeys, 'i');
    
    const cars = await this.productModel.find({
      $or: [{ marca: regex }, { modelo: regex }, { tipo: regex }, { vin: regex }],
      disponible: true,
      activo: true,
      stock: { $gt: 0 }
    })
    .sort({ marca: 1 })
    .limit(10);

    if (!cars.length) {
        return { 
            message: `Busqué "${cleanKeys}" pero no encontré nada en stock activo. 📉\n¿Quieres ver todo el inventario?`, 
            type: 'text' 
        };
    }
    return { message: `Encontré ${cars.length} coincidencias para "${cleanKeys}":`, type: 'products_grid', data: cars };
  }

  private async getProductsGeneral(): Promise<IaResponse> {
    const products = await this.productModel.find({ 
        disponible: true, 
        activo: true, 
        stock: { $gt: 0 } 
    })
    .sort({ createdAt: -1 })
    .limit(20);

    if (!products.length) {
         return { message: "El inventario parece estar vacío por el momento.", type: 'text' };
    }

    return { message: "Aquí tienes los vehículos disponibles en piso:", type: 'products_grid', data: products };
  }

  private async chatWithAi(prompt: string, userId: string): Promise<IaResponse> {
    const user = await this.userModel.findById(userId).select('nombre rol');
    const userName = user ? user.nombre.split(' ')[0] : 'Colega'; 

    const systemPrompt = `
      Eres SmartAssistant del CRM Autobots.
      Usuario: ${userName} (${user?.rol || 'Vendedor'}).
      ${COMPANY_CONTEXT}

      INSTRUCCIONES IMPORTANTES:
      1. Si el usuario dice frases cortas o ambiguas, asume que está ocupado. Sé breve.
      2. **NO te presentes** diciendo "Soy SmartAssistant" si no te lo preguntan.
      3. Si saludan, responde: "¡Hola ${userName}! Listo para trabajar."
      4. Si no entiendes, ofrece opciones: "¿Buscas un auto, ver tareas o reportes?".
    `;

    const response = await this.callOllama(systemPrompt, prompt);
    return { message: response, type: 'text' };
  }

  private async getPendingQuotes(): Promise<IaResponse> {
    const cotizaciones = await this.cotizacionModel.find({ status: 'Pendiente' })
      .populate('cliente', 'nombre').populate('coche', 'marca modelo').limit(5);
    if (!cotizaciones.length) return { message: "No hay cotizaciones pendientes.", type: 'text' };
    return { message: "Cotizaciones por revisar:", type: 'cotizaciones_table', data: cotizaciones };
  }

  private async getClients(): Promise<IaResponse> {
    const clients = await this.userModel.find({ rol: 'CLIENTE' }).limit(10);
    return { message: "Últimos clientes registrados:", type: 'clients_list', data: clients };
  }

  private async getMyTasks(userId: string): Promise<IaResponse> {
    const tasks = await this.taskModel.find({
      vendedor: new Types.ObjectId(userId),
      isCompleted: false
    }).populate('cliente', 'nombre').sort({ dueDate: 1 }).limit(10);

    if (!tasks.length) return { message: "No tienes tareas pendientes. ¡Buen trabajo!", type: 'text' };

    const clientName = (tasks[0].cliente as any)?.nombre || 'Cliente';
    return {
      message: `Tienes ${tasks.length} tareas. Próxima: ${clientName}.`,
      type: 'tasks_list',
      data: tasks
    };
  }

  private async getSalesReport(): Promise<IaResponse> {
    const startOfMonth = new Date(); startOfMonth.setDate(1); startOfMonth.setHours(0,0,0,0);
    const stats = await this.cotizacionModel.aggregate([
      { $match: { status: 'Aprobada', createdAt: { $gte: startOfMonth } } },
      { $group: { _id: null, totalVendido: { $sum: '$totalPagado' }, count: { $sum: 1 }, avgTicket: { $avg: '$totalPagado' } }}
    ]);
    const data = stats[0] || { totalVendido: 0, count: 0, avgTicket: 0 };
    
    return {
      message: `Ventas del Mes: ${data.count} ($${data.totalVendido.toLocaleString()}).`,
      type: 'kpi_dashboard',
      data: { period: 'Mes Actual', totalSales: data.totalVendido, salesCount: data.count, average: data.avgTicket }
    };
  }

  private async getExpenses(statusFilter?: string): Promise<IaResponse> {
     const filter: any = {};
     if (statusFilter) filter.estado = statusFilter;
     const gastos = await this.gastoModel.find(filter).sort({ fechaGasto: -1 }).limit(8);
     
     if (!gastos.length) return { message: "Sin gastos registrados.", type: 'text' };
     
     const total = gastos.reduce((acc, curr) => acc + curr.monto, 0);
     return {
       message: `Gastos (${statusFilter || 'todos'}): $${total.toLocaleString()}`,
       type: 'expenses_table',
       data: gastos
     };
  }

  private async getUserProfile(userId: string): Promise<IaResponse> {
    const user = await this.userModel.findById(userId).select('-password');
    if (!user) return { message: "Usuario no encontrado.", type: 'text' };
    return {
      message: `Sesión: **${user.nombre}** (${user.rol})`,
      type: 'text'
    };
  }

  private async callOllama(system: string, user: string, retries = 1): Promise<string> {
    const payload = {
      model: this.model,
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      stream: false,
      options: { num_predict: 150, temperature: 0.5 }
    };

    for (let i = 0; i <= retries; i++) {
      try {
        const { data } = await firstValueFrom(
          this.httpService.post(`${this.ollamaHost}/api/chat`, payload, { timeout: 60000 })
        );
        return data.message.content;
      } catch (e) {
        if (i === retries) return "Error de conexión con la IA.";
      }
    }
    return "Error desconocido.";
  }
}