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
    this.logger.log(`🧠 Estrategia seleccionada: ${intent.action} (Params: ${JSON.stringify(intent.params)}) | Usuario: ${userId}`);

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

        case 'sales_advice':
          return this.getSalesAdvice(prompt);

        default:
          return this.chatWithAi(prompt);
      }
    } catch (error) {
      this.logger.error(`Error procesando la acción ${intent.action}: ${error.message}`);
      return { 
        message: "Tuve un problema interno procesando esos datos. Intenta de nuevo.", 
        type: 'text' 
      };
    }
  }

  private async classifyIntentRobust(userPrompt: string): Promise<{ action: string; params?: any }> {
    const cleanPrompt = userPrompt.toLowerCase().trim();

    const systemPrompt = `
      Eres una API que clasifica intenciones. Responde SOLO un objeto JSON.
      Input: "${userPrompt}"
      
      Opciones JSON:
      - Tareas/Agenda: {"action": "get_my_tasks"}
      - Ventas/Reporte/Ganancias: {"action": "get_sales_report"}
      - Gastos/Pagos: {"action": "get_expenses"}
      - Cotizaciones pendientes: {"action": "get_pending_quotes"}
      - Buscar auto (ej: mazda): {"action": "search_cars", "params": {"keywords": "mazda"}}
      - Clientes: {"action": "get_clients"}
      - Consejo ventas: {"action": "sales_advice"}
      - Saludo/Otro: {"action": "chat"}
    `;

    try {
      const aiResponse = await this.callOllama(systemPrompt, userPrompt, true);
      const parsed = this.extractJson(aiResponse);
      
      if (parsed && parsed.action) {
        return parsed;
      }
    } catch (e) {
      this.logger.warn(`⚠️ Falló clasificación IA, usando Plan B (Keywords). Error: ${e.message}`);
    }

    if (cleanPrompt.match(/tarea|agenda|pendiente|hacer/)) return { action: 'get_my_tasks' };
    if (cleanPrompt.match(/venta|reporte|ganancia|mes|vendido/)) return { action: 'get_sales_report' };
    if (cleanPrompt.match(/gasto|pago|luz|agua|renta/)) return { action: 'get_expenses' };
    if (cleanPrompt.match(/cotiza|aprobacion|cliente interesado/)) return { action: 'get_pending_quotes' };
    if (cleanPrompt.match(/cliente|lista|directorio/)) return { action: 'get_clients' };
    if (cleanPrompt.match(/busca|coche|auto|carro|modelo|marca/)) {
      return { action: 'search_cars', params: { keywords: userPrompt } };
    }
    if (cleanPrompt.match(/consejo|tip|ayuda|vender/)) return { action: 'sales_advice' };

    return { action: 'chat' };
  }

  private async getMyTasks(userId: string): Promise<IaResponse> {
    const tasks = await this.taskModel.find({
      vendedor: new Types.ObjectId(userId),
      isCompleted: false
    })
    .populate('cliente', 'nombre telefono')
    .sort({ dueDate: 1 })
    .limit(10)
    .exec();

    if (!tasks || tasks.length === 0) {
      return {
        message: "¡Todo limpio! No tienes tareas pendientes por ahora.",
        type: 'text'
      };
    }

    const summary = await this.callOllama(
      "Eres un asistente útil.", 
      `Resume: Tengo ${tasks.length} tareas. La más urgente es "${tasks[0].title}". Dilo en una frase motivadora corta.`
    );

    return {
      message: summary.replace(/"/g, ''),
      type: 'tasks_list',
      data: tasks
    };
  }

  private async getSalesReport(): Promise<IaResponse> {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0,0,0,0);

    const stats = await this.cotizacionModel.aggregate([
      { $match: { status: 'Aprobada', createdAt: { $gte: startOfMonth } } },
      { $group: { 
          _id: null, 
          totalVendido: { $sum: '$totalPagado' },
          count: { $sum: 1 },
          avgTicket: { $avg: '$totalPagado' }
      }}
    ]);

    const data = stats[0] || { totalVendido: 0, count: 0, avgTicket: 0 };

    if (data.count === 0) {
      return {
        message: "Aún no hay ventas registradas este mes. ¡Es momento de cerrar el primer trato!",
        type: 'kpi_dashboard',
        data: { period: 'Mes Actual', totalSales: 0, salesCount: 0, average: 0 }
      };
    }

    const analysis = await this.callOllama(
      "Eres un analista de negocios.",
      `Datos: ${data.count} ventas, Total: $${data.totalVendido}. Dame una frase corta de feedback positivo.`
    );

    return {
      message: analysis,
      type: 'kpi_dashboard',
      data: {
        period: 'Mes Actual',
        totalSales: data.totalVendido,
        salesCount: data.count,
        average: data.avgTicket
      }
    };
  }

  private async getExpenses(statusFilter?: string): Promise<IaResponse> {
    const filter: any = {};
    if (statusFilter) filter.estado = statusFilter;
    else filter.estado = 'Pendiente';

    const gastos = await this.gastoModel.find(filter)
      .sort({ fechaGasto: -1 })
      .limit(8)
      .exec();

    if (gastos.length === 0) {
      return { message: "No encontré gastos pendientes registrados.", type: 'text' };
    }

    const total = gastos.reduce((acc, curr) => acc + curr.monto, 0);

    return {
      message: `Tienes ${gastos.length} gastos pendientes. Total acumulado: $${total}.`,
      type: 'expenses_table',
      data: gastos
    };
  }

  private async getPendingQuotes(): Promise<IaResponse> {
    const cotizaciones = await this.cotizacionModel.find({ status: 'Pendiente' })
      .populate('cliente', 'nombre email telefono')
      .populate('coche', 'marca modelo precioBase imageUrl')
      .sort({ createdAt: -1 })
      .limit(5)
      .exec();

    if (cotizaciones.length === 0) {
      return { message: "No tienes cotizaciones pendientes de revisión.", type: 'text' };
    }

    return {
      message: "Aquí están las cotizaciones más recientes que requieren tu aprobación.",
      type: 'cotizaciones_table',
      data: cotizaciones
    };
  }

  private async searchCars(keywords: string): Promise<IaResponse> {
    const safeKeywords = keywords.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); 
    const regex = new RegExp(safeKeywords, 'i');
    
    const cars = await this.productModel.find({
      $or: [{ marca: regex }, { modelo: regex }, { tipo: regex }, { color: regex }],
      disponible: true
    }).limit(10).exec();

    if (cars.length === 0) {
      return { message: `No encontré vehículos coincidentes con "${keywords}" en el inventario.`, type: 'text' };
    }

    return {
      message: `He encontrado ${cars.length} coincidencias en inventario.`,
      type: 'products_grid',
      data: cars
    };
  }

  private async getClients(): Promise<IaResponse> {
    const clients = await this.userModel.find({ rol: 'CLIENTE' })
      .select('nombre email telefono')
      .sort({ createdAt: -1 })
      .limit(10)
      .exec();
      
    return {
      message: "Estos son tus clientes registrados más recientes.",
      type: 'clients_list',
      data: clients
    };
  }

  private async getSalesAdvice(prompt: string): Promise<IaResponse> {
    const txt = await this.callOllama(
      "Eres un mentor de ventas experto. Responde en español, sé breve, directo y motivador.", 
      prompt
    );
    return { message: txt, type: 'text' };
  }

  private async getProductsGeneral(): Promise<IaResponse> {
    const products = await this.productModel.find({
      disponible: true,
      stock: { $gt: 0 }
    })
    .populate('proveedor', 'nombre')
    .sort({ createdAt: -1 })
    .limit(20)
    .exec();

    if (!products || products.length === 0) {
      return {
        message: "Actualmente no veo productos disponibles en el inventario general.",
        type: 'text'
      };
    }

    return {
      message: `Aquí tienes un listado de los ${products.length} productos más recientes disponibles en inventario.`,
      type: 'products_grid',
      data: products
    };
  }

  private async chatWithAi(prompt: string): Promise<IaResponse> {
    const txt = await this.callOllama(
      "Eres el asistente del CRM SmartAssistant. Responde en español, sé amable, profesional y muy breve (máximo 2 frases).", 
      prompt
    );
    return { message: txt, type: 'text' };
  }

  private async callOllama(system: string, user: string, jsonMode: boolean = false): Promise<string> {
    try {
      const payload: any = {
        model: this.model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user }
        ],
        stream: false,
        options: {
          num_predict: 150,
          temperature: 0.1,
        }
      };
      if (jsonMode) payload.format = 'json';

      const { data } = await firstValueFrom(
        this.httpService.post(`${this.ollamaHost}/api/chat`, payload, { timeout: 120000 })
      );
      
      return data.message.content;
    } catch (e) {
      this.logger.error(`Error Ollama: ${e.message}`);
      if (e.response) {
        this.logger.error(`Status: ${e.response.status} | Data: ${JSON.stringify(e.response.data)}`);
      }
      return "Lo siento, mi conexión neuronal es inestable. ¿Podrías intentarlo de nuevo?";
    }
  }

  private extractJson(text: string): any {
    try {
      return JSON.parse(text);
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          return JSON.parse(match[0]);
        } catch { return null; }
      }
      return null;
    }
  }
}
