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
  Nombre: CRM Automotriz del Bajío (Autobots).
  Misión: Facilitar la compra-venta de autos con confianza y rapidez.
  Ubicación: Blvd. Adolfo López Mateos 123, León, Gto, México.
  Horario: Lunes a Viernes 9am - 7pm, Sábados 9am - 2pm.
  Soporte Técnico: qatesthijosdeldiablo@gmail.com | Ext: 505.
  Reglas de Negocio: 
  - Los vendedores solo pueden ver sus propios leads.
  - Las cotizaciones requieren aprobación del gerente si el descuento supera el 5%.
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
    this.logger.log(`Acción: ${intent.action} | Params: ${JSON.stringify(intent.params)} | User: ${userId}`);

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
          return this.chatWithAi(prompt, userId, true); 

        case 'sales_advice':
          return this.getSalesAdvice(prompt);

        default:
          return this.chatWithAi(prompt, userId);
      }
    } catch (error) {
      this.logger.error(`Error procesando acción ${intent.action}: ${error.message}`);
      return { 
        message: "Ocurrió un error procesando tu solicitud. Por favor intenta reformular la pregunta.", 
        type: 'text' 
      };
    }
  }

  private async classifyIntentRobust(userPrompt: string): Promise<{ action: string; params?: any }> {
    const cleanPrompt = userPrompt.toLowerCase().trim();

    const systemPrompt = `
      Eres el router de una API. Clasifica el input del usuario en un JSON.
      Input: "${userPrompt}"
      
      Categorías Disponibles:
      - Tareas/Agenda: "get_my_tasks"
      - Ventas/Reportes/KPIs: "get_sales_report"
      - Gastos/Finanzas: "get_expenses"
      - Cotizaciones/Aprobaciones: "get_pending_quotes"
      - Buscar Auto (ej: 'tienes mazda?', 'busco camioneta'): "search_cars" -> params: { "keywords": "..." }
      - Clientes: "get_clients"
      - Perfil Usuario (ej: 'quien soy', 'mi rol', 'mis datos'): "get_profile"
      - Info Empresa (ej: 'direccion', 'horario', 'soporte'): "company_info"
      - Consejo Ventas: "sales_advice"
      - Conversación General: "chat"

      Responde SOLO el JSON. Ejemplo: {"action": "search_cars", "params": {"keywords": "civic"}}
    `;

    try {
      const aiResponse = await this.callOllama(systemPrompt, userPrompt, true);
      const parsed = this.extractJson(aiResponse);
      if (parsed && parsed.action) return parsed;
    } catch (e) {
      this.logger.warn(`Clasificación IA falló, usando Regex. Error: ${e.message}`);
    }

    if (cleanPrompt.match(/quien soy|mi nombre|mi rol|mis datos/)) return { action: 'get_profile' };
    if (cleanPrompt.match(/donde estan|ubicacion|horario|telefono|soporte|empresa|mision/)) return { action: 'company_info' };
    if (cleanPrompt.match(/tarea|agenda|pendiente|hacer/)) return { action: 'get_my_tasks' };
    if (cleanPrompt.match(/venta|reporte|ganancia|mes|vendido/)) return { action: 'get_sales_report' };
    if (cleanPrompt.match(/gasto|pago|luz|agua|renta/)) return { action: 'get_expenses' };
    if (cleanPrompt.match(/cotiza|aprobacion/)) return { action: 'get_pending_quotes' };
    if (cleanPrompt.match(/cliente/)) return { action: 'get_clients' };
    if (cleanPrompt.match(/busca|coche|auto|carro|modelo|marca|tienes/)) return { action: 'search_cars', params: { keywords: userPrompt } };
    if (cleanPrompt.match(/consejo|tip|ayuda vender/)) return { action: 'sales_advice' };

    return { action: 'chat' };
  }

  private async getUserProfile(userId: string): Promise<IaResponse> {
    const user = await this.userModel.findById(userId).select('-password');
    if (!user) return { message: "No pude encontrar tu información en la base de datos.", type: 'text' };

    return {
      message: `¡Hola ${user.nombre}! Estás registrado como **${user.rol}**. Tu correo es ${user.email}.`,
      type: 'text'
    };
  }

  private async chatWithAi(prompt: string, userId: string, forceCompanyContext = false): Promise<IaResponse> {
    const user = await this.userModel.findById(userId).select('nombre rol');
    const userName = user ? user.nombre : 'Usuario';
    const userRole = user ? user.rol : 'Vendedor';

    const contextPrompt = `
      Eres "SmartAssistant", el asistente virtual inteligente de la empresa.
      
      CONTEXTO DE LA EMPRESA:
      ${COMPANY_CONTEXT}

      CONTEXTO DEL USUARIO ACTUAL:
      - Nombre: ${userName}
      - Rol: ${userRole}

      INSTRUCCIONES:
      1. Responde en español, tono profesional pero amigable.
      2. Si te preguntan sobre la empresa, usa la información de "CONTEXTO DE LA EMPRESA".
      3. Si te preguntan quién eres, preséntate como SmartAssistant.
      4. Sé conciso (máximo 3 oraciones).
      5. Si no sabes la respuesta, di que pueden contactar a soporte.
    `;

    const response = await this.callOllama(contextPrompt, prompt);
    return { message: response, type: 'text' };
  }

  private async getMyTasks(userId: string): Promise<IaResponse> {
    const tasks = await this.taskModel.find({
      vendedor: new Types.ObjectId(userId),
      isCompleted: false
    }).populate('cliente', 'nombre').sort({ dueDate: 1 }).limit(10);

    if (!tasks.length) return { message: "¡Todo limpio! No tienes tareas pendientes.", type: 'text' };

    const clientName = (tasks[0].cliente as any)?.nombre || 'tu cliente';

    return {
      message: `Tienes ${tasks.length} tareas pendientes. La prioridad es contactar a ${clientName}.`,
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
      message: `Reporte Mensual: ${data.count} ventas cerradas por un total de $${data.totalVendido.toLocaleString()}.`,
      type: 'kpi_dashboard',
      data: { period: 'Mes Actual', totalSales: data.totalVendido, salesCount: data.count, average: data.avgTicket }
    };
  }

  private async getExpenses(statusFilter?: string): Promise<IaResponse> {
     const filter: any = {};
     if (statusFilter) filter.estado = statusFilter;
     const gastos = await this.gastoModel.find(filter).sort({ fechaGasto: -1 }).limit(8);
     
     if (!gastos.length) return { message: "No se encontraron gastos registrados.", type: 'text' };
     
     const total = gastos.reduce((acc, curr) => acc + curr.monto, 0);
     return {
       message: `Visualizando gastos ${statusFilter || 'generales'}. Total en vista: $${total.toLocaleString()}.`,
       type: 'expenses_table',
       data: gastos
     };
  }

  private async getPendingQuotes(): Promise<IaResponse> {
    const cotizaciones = await this.cotizacionModel.find({ status: 'Pendiente' })
      .populate('cliente', 'nombre').populate('coche', 'marca modelo').limit(5);

    if (!cotizaciones.length) return { message: "Estás al día. No hay cotizaciones pendientes.", type: 'text' };

    return { message: "Estas cotizaciones esperan tu revisión:", type: 'cotizaciones_table', data: cotizaciones };
  }

  private async searchCars(keywords: string): Promise<IaResponse> {
    const safeKeywords = keywords.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const cleanKeys = safeKeywords.replace(/busco|un|una|coche|carro|auto|quiero/gi, '').trim();
    
    const regex = new RegExp(cleanKeys, 'i');
    const cars = await this.productModel.find({
      $or: [{ marca: regex }, { modelo: regex }, { tipo: regex }],
      disponible: true
    }).limit(10);

    if (!cars.length) return { message: `No encontré vehículos para "${cleanKeys}".`, type: 'text' };
    return { message: `Encontré ${cars.length} opciones disponibles:`, type: 'products_grid', data: cars };
  }

  private async getClients(): Promise<IaResponse> {
    const clients = await this.userModel.find({ rol: 'CLIENTE' }).limit(10);
    return { message: "Listado de clientes recientes:", type: 'clients_list', data: clients };
  }

  private async getProductsGeneral(): Promise<IaResponse> {
    const products = await this.productModel.find({ disponible: true }).limit(20);
    return { message: "Inventario general disponible:", type: 'products_grid', data: products };
  }

  private async getSalesAdvice(prompt: string): Promise<IaResponse> {
    return {
      message: await this.callOllama("Eres un coach de ventas agresivo pero ético. Dame un consejo breve.", prompt),
      type: 'text'
    };
  }

  private async callOllama(system: string, user: string, jsonMode: boolean = false, retries = 1): Promise<string> {
    const payload: any = {
      model: this.model,
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      stream: false,
      options: { num_predict: 200, temperature: jsonMode ? 0.1 : 0.7 }
    };
    if (jsonMode) payload.format = 'json';

    for (let i = 0; i <= retries; i++) {
      try {
        const { data } = await firstValueFrom(
          this.httpService.post(`${this.ollamaHost}/api/chat`, payload, { timeout: 60000 })
        );
        return data.message.content;
      } catch (e) {
        this.logger.warn(`Intento ${i + 1} fallido con Ollama: ${e.message}`);
        if (i === retries) {
          if (jsonMode) return "{}";
          return "Lo siento, mis sistemas neuronales están respondiendo lento. Intenta en un momento.";
        }
      }
    }
    return "Error de comunicación con IA.";
  }

  private extractJson(text: string): any {
    if (!text) return null;
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