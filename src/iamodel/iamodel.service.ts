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
- Contacto Soporte: qatesthijosdeldiablo@gmail.com (Ext 505).

REGLAS DE PERSONALIDAD:
- Tú eres "SmartAssistant", un colega útil y eficaz. NO eres un robot aburrido.
- Tu tono debe ser: Profesional pero casual, breve y directo.
- Si te preguntan algo que está en "DATOS DE LA EMPRESA", responde directamente con el dato.
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
    this.logger.log(`🧠 Intent: ${intent.action} | User: ${userId}`);

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
        case 'chat':
        default:
          return this.chatWithAi(prompt, userId);
      }
    } catch (error) {
      this.logger.error(`Error en action ${intent.action}: ${error.message}`);
      return { 
        message: "Tuve un pequeño lapso de memoria. ¿Me lo repites?", 
        type: 'text' 
      };
    }
  }

  private async classifyIntentRobust(userPrompt: string): Promise<{ action: string; params?: any }> {
    const cleanPrompt = userPrompt.toLowerCase().trim();

    if (cleanPrompt.match(/^(si|sí|claro|ver|ver todos|muestralos|dale|simon)$/)) {
        return { action: 'get_products' };
    }

    if (cleanPrompt.match(/donde (estan|están)|ubicacion|direccion|horario|telefono|contacto|soporte|correo|empresa|mision/)) {
        return { action: 'company_info' };
    }

    if (cleanPrompt.match(/tarea|agenda|pendiente|hacer|recordatorio/)) return { action: 'get_my_tasks' };
    if (cleanPrompt.match(/venta|reporte|ganancia|mes|vendido|cuanto vendi/)) return { action: 'get_sales_report' };
    if (cleanPrompt.match(/gasto|pago|luz|agua|renta/)) return { action: 'get_expenses' };
    if (cleanPrompt.match(/cotiza|aprobacion|autoriza/)) return { action: 'get_pending_quotes' };
    if (cleanPrompt.match(/cliente|comprador/)) return { action: 'get_clients' };
    if (cleanPrompt.match(/quien soy|mi nombre|mi perfil/)) return { action: 'get_profile' };

    if (cleanPrompt.match(/tienes|busco|quiero|necesito|interesa|precio/)) {
        if (cleanPrompt.match(/coche|auto|carro|camioneta|suv|honda|mazda|toyota|nissan|chevrolet|ford|vw|volkswagen|audi|bmw|kia|seat/)) {
             return { action: 'search_cars', params: { keywords: userPrompt } };
        }
    }
    if (cleanPrompt.match(/^(mazda|honda|toyota|nissan|ford|chevrolet|vw|audi|bmw|kia)$/)) {
        return { action: 'search_cars', params: { keywords: userPrompt } };
    }

    if (cleanPrompt.match(/hola|buenos dias|buenas tardes|que tal|ssludo|saludo/)) return { action: 'chat' };

    return { action: 'chat' }; 
  }

  private async chatWithAi(prompt: string, userId: string): Promise<IaResponse> {
    const user = await this.userModel.findById(userId).select('nombre rol');
    const userName = user ? user.nombre.split(' ')[0] : 'Compañero'; 

    const systemPrompt = `
      Eres SmartAssistant, parte del equipo de Autobots.
      Tu usuario es: ${userName} (${user?.rol || 'Vendedor'}).

      ${COMPANY_CONTEXT}

      INSTRUCCIONES CLAVE:
      1. **NO te presentes** en cada mensaje. Sé natural.
      2. Si saludan ("Hola", "Ssludo"), responde corto: "¡Hola ${userName}! ¿En qué te ayudo?".
      3. Si preguntan ubicación u horario, COPIA la info del contexto.
      4. Si el mensaje es corto ("ok", "gracias"), cierra con una frase amable corta.
      5. Nunca digas "Como modelo de lenguaje".
      6. Habla español de México, profesional pero relajado.
    `;

    const response = await this.callOllama(systemPrompt, prompt);
    return { message: response, type: 'text' };
  }

  private async getPendingQuotes(): Promise<IaResponse> {
    const cotizaciones = await this.cotizacionModel.find({ status: 'Pendiente' })
      .populate('cliente', 'nombre').populate('coche', 'marca modelo').limit(5);

    if (!cotizaciones.length) return { message: "Estás al día. No hay cotizaciones pendientes.", type: 'text' };
    return { message: "Estas cotizaciones esperan tu revisión:", type: 'cotizaciones_table', data: cotizaciones };
  }

  private async getClients(): Promise<IaResponse> {
    const clients = await this.userModel.find({ rol: 'CLIENTE' }).limit(10);
    return { message: "Listado de clientes recientes:", type: 'clients_list', data: clients };
  }

  private async getMyTasks(userId: string): Promise<IaResponse> {
    const tasks = await this.taskModel.find({
      vendedor: new Types.ObjectId(userId),
      isCompleted: false
    }).populate('cliente', 'nombre').sort({ dueDate: 1 }).limit(10);

    if (!tasks.length) return { message: "¡Todo limpio! No tienes tareas pendientes.", type: 'text' };

    const clientName = (tasks[0].cliente as any)?.nombre || 'tu cliente';
    return {
      message: `Tienes ${tasks.length} tareas. Prioridad: Contactar a ${clientName}.`,
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
      message: `Mes Actual: ${data.count} ventas ($${data.totalVendido.toLocaleString()}).`,
      type: 'kpi_dashboard',
      data: { period: 'Mes Actual', totalSales: data.totalVendido, salesCount: data.count, average: data.avgTicket }
    };
  }

  private async getExpenses(statusFilter?: string): Promise<IaResponse> {
     const filter: any = {};
     if (statusFilter) filter.estado = statusFilter;
     const gastos = await this.gastoModel.find(filter).sort({ fechaGasto: -1 }).limit(8);
     
     if (!gastos.length) return { message: "No encontré gastos registrados.", type: 'text' };
     
     const total = gastos.reduce((acc, curr) => acc + curr.monto, 0);
     return {
       message: `Gastos recientes (Total: $${total.toLocaleString()}):`,
       type: 'expenses_table',
       data: gastos
     };
  }

  private async getUserProfile(userId: string): Promise<IaResponse> {
    const user = await this.userModel.findById(userId).select('-password');
    if (!user) return { message: "No encuentro tus datos.", type: 'text' };
    return {
      message: `Perfil: **${user.nombre}** | Rol: ${user.rol} | Email: ${user.email}`,
      type: 'text'
    };
  }

  private async searchCars(keywords: string): Promise<IaResponse> {
    const safeKeywords = keywords.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const cleanKeys = safeKeywords
        .replace(/busco|un|una|el|la|coche|carro|auto|camioneta|quiero|necesito|tienes|modelo|marca|precio|de|interesa/gi, '')
        .trim();
    
    if (cleanKeys.length < 2) return this.getProductsGeneral();

    const regex = new RegExp(cleanKeys, 'i');
    const cars = await this.productModel.find({
      $or: [{ marca: regex }, { modelo: regex }, { tipo: regex }],
      disponible: true
    }).limit(10);

    if (!cars.length) {
        return { 
            message: `Mmm, no veo ningún "${cleanKeys}" disponible. 😅\n¿Quieres ver todo el inventario?`, 
            type: 'text' 
        };
    }
    return { message: `Encontré ${cars.length} coincidencias para "${cleanKeys}":`, type: 'products_grid', data: cars };
  }

  private async getProductsGeneral(): Promise<IaResponse> {
    const products = await this.productModel.find({ disponible: true }).limit(20);
    return { message: "Aquí tienes todo el inventario disponible:", type: 'products_grid', data: products };
  }

  private async callOllama(system: string, user: string, retries = 1): Promise<string> {
    const payload = {
      model: this.model,
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      stream: false,
      options: { num_predict: 150, temperature: 0.6 }
    };

    for (let i = 0; i <= retries; i++) {
      try {
        const { data } = await firstValueFrom(
          this.httpService.post(`${this.ollamaHost}/api/chat`, payload, { timeout: 60000 })
        );
        return data.message.content;
      } catch (e) {
        if (i === retries) return "Estoy teniendo problemas de conexión. Inténtalo de nuevo.";
      }
    }
    return "Error de servicio.";
  }
}
