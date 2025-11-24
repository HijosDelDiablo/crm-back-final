import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
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
    const intent = await this.classifyIntent(prompt);
    this.logger.log(`Intención IA: ${intent.action} | Usuario: ${userId}`);

    switch (intent.action) {
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
  }

  private async classifyIntent(userPrompt: string): Promise<{ action: string; params?: any }> {
    const systemPrompt = `
      Eres el sistema operativo de un CRM automotriz. Analiza el prompt del usuario y devuelve un JSON.
      
      ACCIONES DISPONIBLES:
      - "get_my_tasks": Si pregunta: "¿Qué tengo que hacer hoy?", "mis tareas", "recordatorios", "agenda".
      - "get_sales_report": Si pregunta: "¿Cómo vamos de ventas?", "resumen del mes", "cuánto hemos vendido", "ganancias".
      - "get_expenses": Si pregunta: "Ver gastos", "gastos pendientes", "¿cuánto gastamos en luz?", "pagos por hacer".
      - "get_pending_quotes": Si busca "cotizaciones", "clientes interesados", "pendientes de cierre".
      - "search_cars": Si menciona buscar coches, inventario, modelos específicos (ej. "Busca un Mazda rojo").
      - "get_clients": Si quiere ver lista de clientes.
      - "sales_advice": Si pide ayuda para vender, tips de negociación.
      - "chat": Saludos o preguntas fuera de contexto.

      FORMATO JSON RESPUESTA:
      {"action": "nombre_accion", "params": {"keywords": "mazda rojo"}}
    `;

    try {
      const response = await this.callOllama(systemPrompt, userPrompt, true);
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) return JSON.parse(jsonMatch[0]);
      return { action: 'chat' };
    } catch (error) {
      this.logger.error('Fallo en clasificación', error);
      return { action: 'chat' };
    }
  }

  private async getMyTasks(userId: string): Promise<IaResponse> {
    const today = new Date();
    today.setHours(0,0,0,0);

    const tasks = await this.taskModel.find({
      vendedor: new Types.ObjectId(userId),
      isCompleted: false
    })
    .populate('cliente', 'nombre telefono')
    .sort({ dueDate: 1 })
    .limit(10)
    .exec();

    const summary = await this.callOllama(
      "Eres un asistente personal eficiente.", 
      `Tengo ${tasks.length} tareas pendientes. Las primeras vencen el ${tasks[0]?.dueDate}. Dame un resumen de 1 linea animándome a completarlas.`
    );

    return {
      message: summary,
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

    const analysis = await this.callOllama(
      "Eres un analista financiero.",
      `Este mes llevamos ${data.count} ventas por un total de $${data.totalVendido}. Dame una opinión muy breve sobre el rendimiento.`
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
    if (statusFilter) {
      filter.estado = statusFilter;
    } else {
      filter.estado = 'Pendiente';
    }

    const gastos = await this.gastoModel.find(filter)
      .sort({ fechaGasto: -1 })
      .limit(8)
      .exec();

    const total = gastos.reduce((acc, curr) => acc + curr.monto, 0);

    return {
      message: `He encontrado ${gastos.length} gastos pendientes por un total de $${total}.`,
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

    return {
      message: "Aquí tienes las últimas cotizaciones pendientes de aprobación.",
      type: 'cotizaciones_table',
      data: cotizaciones
    };
  }

  private async searchCars(keywords: string): Promise<IaResponse> {
    const regex = new RegExp(keywords, 'i');
    const cars = await this.productModel.find({
      $or: [{ marca: regex }, { modelo: regex }, { tipo: regex }],
      disponible: true
    }).limit(10).exec();

    if (cars.length === 0) {
      return { message: "No encontré vehículos con esas características en inventario.", type: 'text' };
    }

    return {
      message: `Encontré ${cars.length} vehículos disponibles que coinciden con "${keywords}".`,
      type: 'products_grid',
      data: cars
    };
  }

  private async getClients(): Promise<IaResponse> {
    const clients = await this.userModel.find({ rol: 'CLIENTE' }).limit(10).exec();
    return {
      message: "Lista de clientes registrados recientemente.",
      type: 'clients_list',
      data: clients
    };
  }

  private async getSalesAdvice(prompt: string): Promise<IaResponse> {
    const txt = await this.callOllama("Eres un mentor de ventas agresivo pero ético.", prompt);
    return { message: txt, type: 'text' };
  }

  private async chatWithAi(prompt: string): Promise<IaResponse> {
    const txt = await this.callOllama("Eres el asistente del CRM SmartAssistant.", prompt);
    return { message: txt, type: 'text' };
  }

  private async callOllama(system: string, user: string, jsonMode: boolean = false): Promise<string> {
    try {
      const payload: any = {
        model: this.model,
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
        stream: false,
      };
      if (jsonMode) payload.format = 'json';
      
      const { data } = await firstValueFrom(
        this.httpService.post(`${this.ollamaHost}/api/chat`, payload)
      );
      return data.message.content;
    } catch (e) {
      this.logger.error(e);
      return "Lo siento, mis sistemas neuronales están reiniciándose. Intenta en un momento.";
    }
  }
}