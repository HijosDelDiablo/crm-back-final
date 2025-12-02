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
CAPACIDADES ESPECÍFICAS:
1. ESTRATEGIAS DE VENTAS:
   - Sugerir técnicas de cierre efectivas.
   - Proponer argumentos de venta según el perfil del cliente.
   - Ofrecer alternativas cuando un modelo no está disponible.

2. GESTIÓN DE TAREAS:
   - Priorizar tareas vencidas y próximas a vencer.
   - Sugerir seguimientos a clientes prospecto.
   - Recordatorios de citas y entregas programadas.

3. ANÁLISIS DE INVENTARIO:
   - Identificar vehículos con mayor tiempo en inventario.
   - Sugerir promociones para modelos específicos.
   - Alertar sobre stock bajo de modelos populares.

4. COMUNICACIÓN CLIENTE:
   - Redactar correos profesionales para seguimientos.
   - Sugerir mensajes personalizados para WhatsApp.
   - Plantillas para propuestas comerciales.

RESTRICCIONES:
- No compartir información de comisiones con clientes.
- No prometer descuentos no autorizados.
- Mantener confidencialidad de estrategias internas.
`;

const CLIENT_CONTEXT = `
ROL: Concierge Virtual de Lujo.
OBJETIVO: Enamorar al cliente de los autos, explicar financiamiento de forma sencilla y agendar citas.
TONO: Amable, entusiasta, servicial, paciente, empático.
CAPACIDADES ESPECÍFICAS:

1. ASESORÍA DE COMPRA:
   - Explicar características técnicas en lenguaje simple.
   - Comparar modelos según necesidades específicas.
   - Desglosar costos totales (seguros, impuestos, mantenimiento).

2. FINANCIAMIENTO:
   - Explicar tasas de interés, plazo y enganche de forma clara.
   - Calcular mensualidades aproximadas.
   - Listar documentos necesarios para crédito.

3. SERVICIO POST-VENTA:
   - Informar sobre garantías y servicios incluidos.
   - Agendar citas para prueba de manejo.
   - Conectar con asesor de servicio para mantenimiento.

4. RESOLUCIÓN DE DUDAS:
   - Responder sobre disponibilidad de colores y versiones.
   - Informar tiempos de entrega.
   - Aclarar políticas de devolución y cambios.

FRASES CLAVE A UTILIZAR:
- "Para tu perfil, te recomendaría..."
- "Permíteme calcular una estimación para ti..."
- "¿Te gustaría agendar una prueba de manejo sin compromiso?"
- "Esta versión incluye..."

PROHIBIDO:
- Mencionar márgenes de ganancia o costos internos.
- Comprometer fechas de entrega no confirmadas.
- Ofrecer descuentos no autorizados.
- Comparar negativamente con la competencia.
`;

const ADMIN_CONTEXT = `
ROL: Gerente General / Administrador del CRM.
OBJETIVO: Supervisar el rendimiento global, gestionar usuarios, inventario crítico y finanzas.
TONO: Ejecutivo, directivo, estratégico, analítico, decisivo.
CAPACIDADES ESPECÍFICAS:

1. ANÁLISIS FINANCIERO:
   - Reportes detallados de ingresos vs gastos.
   - Análisis de margen por vehículo vendido.
   - Proyecciones de flujo de efectivo.
   - Alertas sobre gastos atípicos.

2. GESTIÓN DE PERSONAL:
   - KPIs individuales de vendedores (conversión, ticket promedio).
   - Seguimiento de metas y comisiones.
   - Detección de áreas de oportunidad en equipo.
   - Sugerencias de capacitación.

3. OPTIMIZACIÓN DE INVENTARIO:
   - Análisis de rotación por marca y modelo.
   - Sugerencias de reabastecimiento inteligente.
   - Identificación de vehículos "lentos".
   - Estrategias de liquidación de inventario viejo.

4. TOMA DE DECISIONES:
   - Datos para negociar con proveedores.
   - Análisis de rentabilidad por línea de producto.
   - Evaluación de nuevas oportunidades de mercado.
   - Alertas tempranas de riesgos operativos.

ACCESO PERMITIDO:
- Reportes financieros completos.
- Datos sensibles de rendimiento.
- Información de costos y proveedores.
- Análisis competitivo interno.

PRIORIDADES:
1. Rentabilidad
2. Satisfacción del cliente
3. Eficiencia operativa
4. Crecimiento sostenible
`;

const SUPPORT_CONTEXT = `
ROL: Especialista en Soporte CRM.
OBJETIVO: Resolver dudas técnicas del sistema, configuración y reportes.
TONO: Técnico, preciso, paciente, educativo.
CAPACIDADES:
- Guiar en el uso de funciones del CRM.
- Solucionar problemas técnicos comunes.
- Explicar configuración de reportes.
- Conectar con equipo de desarrollo cuando sea necesario.
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
    const user = await this.userModel.findById(userId).select('nombre rol');
    const userRole = user?.rol || 'CLIENTE';
    
    this.logger.log(`Usuario: ${user?.nombre} (${userRole}) | Intención: ${intent.action} | Prompt: "${prompt}"`);

    try {
      switch (intent.action) {
        case 'get_products':
          if (userRole === 'ADMIN') {
            return this.getProductsAdmin(intent.params?.view);
          } else if (userRole === 'VENDEDOR') {
            return this.getProductsVendor(intent.params?.filter);
          }
          return this.getProductsGeneral();
        
        case 'search_cars':
          return this.searchCars(intent.params?.keywords || prompt, userRole);
        
        case 'get_pending_quotes':
          if (userRole === 'ADMIN') {
            return this.getPendingQuotesAdmin();
          }
          return this.getPendingQuotesVendor(userId);
        
        case 'get_clients':
          if (userRole === 'ADMIN') {
            return this.getClientsAdmin(intent.params?.filter);
          }
          return this.getClientsVendor(userId);
        
        case 'get_my_tasks':
          return this.getMyTasks(userId, intent.params?.filter);
        
        case 'get_sales_report':
          if (userRole === 'ADMIN') {
            return this.getSalesReportAdmin(intent.params?.period);
          }
          return this.getSalesReportVendor(userId, intent.params?.period);
        
        case 'get_expenses':
          if (userRole === 'ADMIN') {
            return this.getExpensesAdmin(intent.params);
          }
          return { message: "Esta información está restringida a administradores.", type: 'text' };
        
        case 'get_profile':
          return this.getUserProfile(userId);
        
        case 'company_info':
          return this.getCompanyInfo();
        
        case 'schedule_test_drive':
          return this.scheduleTestDrive(userId, intent.params);
        
        case 'calculate_financing':
          return this.calculateFinancing(intent.params);
        
        case 'get_support':
          return this.getSupportInfo(intent.params?.topic);
        
        case 'get_performance':
          if (userRole === 'ADMIN') {
            return this.getTeamPerformance();
          } else if (userRole === 'VENDEDOR') {
            return this.getMyPerformance(userId);
          }
          return { message: "Esta función está disponible solo para el equipo de ventas.", type: 'text' };
        
        case 'get_inventory_analysis':
          if (userRole === 'ADMIN') {
            return this.getInventoryAnalysis();
          }
          return { message: "Análisis de inventario disponible solo para administradores.", type: 'text' };
        
        case 'chat':
        default:
          return this.chatWithAi(prompt, userId);
      }
    } catch (error) {
      this.logger.error(`Error procesando consulta: ${error.message}`, error.stack);
      return { 
        message: "Disculpa, encontré un problema técnico. Nuestro equipo ya fue notificado. Mientras tanto, ¿puedo ayudarte con algo más?", 
        type: 'text'
      };
    }
  }

  private async classifyIntentRobust(userPrompt: string): Promise<{ action: string; params?: any }> {
    const cleanPrompt = userPrompt.toLowerCase().trim();
    
    const intentPatterns = [
      {
        pattern: /(muestrame|muestra|ver|listar|lista|dame|enseña|quiero ver|necesito ver)(\s+el|\s+los|\s+las|\s+un|\s+una)?\s*(inventario|catalogo|catálogo|coches|carros|autos|vehiculos|vehículos|productos|stock|disponibles|modelos)/,
        action: 'get_products',
        params: { view: 'general' }
      },
      {
        pattern: /^(inventario|catalogo|catálogo|productos|autos|coches|carros|vehiculos|vehículos|stock)$/,
        action: 'get_products'
      },
      
      {
        pattern: /(busca|buscar|encontrar|localizar|tienes|hay|disponible|disponibilidad|quiero|necesito|me interesa|precio de|costo de|valor de|cuanto cuesta|cuánto cuesta|cotizar|cotizacion|cotización)(.*)(mazda|honda|toyota|nissan|ford|chevrolet|vw|volkswagen|audi|bmw|kia|seat|volvo|mercedes|jeep|hyundai|renault|peugeot|tesla|porsche|sedan|suv|camioneta|pickup|eléctrico|eléctrica|hibrido|híbrido)/i,
        action: 'search_cars',
        params: { keywords: userPrompt }
      },
      {
        pattern: /(marca|modelo|año|versión|color)\s+(especifico|especifica|específico|específica|particular)/i,
        action: 'search_cars',
        params: { keywords: userPrompt, precise: true }
      },
      
      {
        pattern: /(mis\s+)?(tareas|pendientes|pendiente|por hacer|actividades|agenda|recordatorios|seguimientos)(\s+para hoy|\s+de hoy|\s+esta semana|\s+urgentes|\s+vencidas)?/i,
        action: 'get_my_tasks',
        params: { filter: this.extractFilter(cleanPrompt) }
      },
      {
        pattern: /(que\s+tengo\s+hoy|agenda\s+de\s+hoy|reuniones\s+hoy|citas\s+hoy)/i,
        action: 'get_my_tasks',
        params: { filter: 'today' }
      },
      
      {
        pattern: /(ventas|venta|reporte\s+de\s+ventas|estadisticas|estadísticas|kpis|indicadores|metricas|métricas|rendimiento|desempeño)(\s+del\s+mes|\s+de\s+este\s+mes|\s+mensual|\s+semanal|\s+diario|\s+anual|\s+del\s+año)?/i,
        action: 'get_sales_report',
        params: { period: this.extractPeriod(cleanPrompt) }
      },
      {
        pattern: /(ganancias|ingresos|facturacion|facturación|tickets|ticket\s+promedio)/i,
        action: 'get_sales_report',
        params: { period: 'month' }
      },
      
      {
        pattern: /(cotizaciones|cotizacion|cotización|presupuestos|presupuesto)(\s+pendientes|\s+por\s+aprobar|\s+aprobadas|\s+rechazadas|\s+en\s+proceso)?/i,
        action: 'get_pending_quotes',
        params: { status: this.extractStatus(cleanPrompt) }
      },
      
      {
        pattern: /(clientes|clientela|prospectos|leads|contactos)(\s+recientes|\s+nuevos|\s+activos|\s+inactivos|\s+potenciales)?/i,
        action: 'get_clients',
        params: { filter: this.extractClientFilter(cleanPrompt) }
      },
      
      {
        pattern: /(financiamiento|crédito|credito|enganche|mensualidad|mensualidades|plazo|tasa\s+de\s+interes|tasa\s+de\s+interés|calcular|simular|simulador)(\s+para|\s+de|\s+con)?/i,
        action: 'calculate_financing',
        params: this.extractFinancingParams(cleanPrompt)
      },
      {
        pattern: /(cuanto\s+serian|cuánto\s+serían|cuanto\s+pagaría|cuánto\s+pagaria|cuota\s+mensual|pago\s+mensual)/i,
        action: 'calculate_financing'
      },
      
      {
        pattern: /(prueba\s+de\s+manejo|test\s+drive|probar\s+el\s+auto|manejar\s+el\s+coche|conducir|agendar\s+una\s+prueba|reservar\s+prueba)/i,
        action: 'schedule_test_drive'
      },
      
      {
        pattern: /(soporte|ayuda|problema|error|falla|no\s+funciona|como\s+hago|como\s+se\s+hace|tutorial|guia|guía|manual|instrucciones)/i,
        action: 'get_support',
        params: { topic: this.extractTopic(cleanPrompt) }
      },
      
      {
        pattern: /(empresa|compañía|compañia|quienes\s+son|quiénes\s+son|misión|mision|visión|vision|valores|historia|acerca\s+de|sobre\s+la\s+empresa)/i,
        action: 'company_info'
      },
      {
        pattern: /(donde\s+estan|dónde\s+están|ubicacion|ubicación|direccion|dirección|local|sucursal|oficina|horario|horarios|telefono|teléfono|contacto|correo|email|whatsapp|redes\s+sociales)/i,
        action: 'company_info',
        params: { specific: this.extractContactInfoType(cleanPrompt) }
      },
      
      {
        pattern: /(rendimiento\s+del\s+equipo|desempeño\s+de\s+vendedores|equipo\s+de\s+ventas|vendedores|asesores|analisis\s+de\s+ventas|análisis\s+de\s+ventas)/i,
        action: 'get_performance'
      },
      {
        pattern: /(mi\s+rendimiento|mis\s+ventas|mis\s+estadisticas|mis\s+estadísticas|mi\s+desempeño|como\s+voy|como\s+me\s+va)/i,
        action: 'get_performance'
      },
      
      {
        pattern: /(analisis\s+de\s+inventario|análisis\s+de\s+inventario|rotacion\s+de\s+inventario|rotación\s+de\s+inventario|inventario\s+lento|inventario\s+viejo|stock\s+muerte|stock\s+muerto)/i,
        action: 'get_inventory_analysis'
      },
      
      {
        pattern: /^(hola|hola!|holaa|hello|hi|buenos\s+dias|buenas\s+tardes|buenas\s+noches|que\s+tal|qué\s+tal|saludos|hey|oye)$/,
        action: 'chat'
      },
      
      {
        pattern: /(gracias|adios|adiós|chao|bye|hasta\s+luego|nos\s+vemos|perfecto|ok|okey|listo)/i,
        action: 'chat'
      }
    ];

    for (const patternConfig of intentPatterns) {
      if (patternConfig.pattern.test(cleanPrompt)) {
        return { 
          action: patternConfig.action, 
          params: { ...patternConfig.params, ...this.extractAdditionalParams(cleanPrompt) }
        };
      }
    }

    return { action: 'chat' };
  }

  private extractFilter(prompt: string): string {
    if (prompt.includes('hoy') || prompt.includes('hoy')) return 'today';
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

  private extractStatus(prompt: string): string {
    if (prompt.includes('pendiente') || prompt.includes('por aprobar')) return 'pending';
    if (prompt.includes('aprobada')) return 'approved';
    if (prompt.includes('rechazada')) return 'rejected';
    return 'pending';
  }

  private extractClientFilter(prompt: string): string {
    if (prompt.includes('nuevo') || prompt.includes('reciente')) return 'new';
    if (prompt.includes('activo')) return 'active';
    if (prompt.includes('inactivo')) return 'inactive';
    if (prompt.includes('potencial')) return 'potential';
    return 'all';
  }

  private extractFinancingParams(prompt: string): any {
    const params: any = {};
    const priceMatch = prompt.match(/\$?\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/);
    if (priceMatch) params.price = parseFloat(priceMatch[1].replace(/,/g, ''));
    
    const downPaymentMatch = prompt.match(/(enganche|down)\s+(del?\s+)?(\d{1,3})%/i);
    if (downPaymentMatch) params.downPaymentPercent = parseInt(downPaymentMatch[3]);
    
    const termMatch = prompt.match(/(plazo|meses|años)\s+(de\s+)?(\d{1,2})/i);
    if (termMatch) params.termMonths = parseInt(termMatch[3]);
    
    return params;
  }

  private extractTopic(prompt: string): string {
    if (prompt.includes('crm') || prompt.includes('sistema')) return 'system';
    if (prompt.includes('reporte') || prompt.includes('estadística')) return 'reports';
    if (prompt.includes('usuario') || prompt.includes('cuenta')) return 'account';
    if (prompt.includes('factura') || prompt.includes('pago')) return 'billing';
    return 'general';
  }

  private extractContactInfoType(prompt: string): string {
    if (prompt.includes('telefono') || prompt.includes('teléfono') || prompt.includes('whatsapp')) return 'phone';
    if (prompt.includes('correo') || prompt.includes('email')) return 'email';
    if (prompt.includes('direccion') || prompt.includes('dirección') || prompt.includes('ubicacion')) return 'address';
    if (prompt.includes('horario')) return 'schedule';
    if (prompt.includes('redes')) return 'social';
    return 'all';
  }

  private extractAdditionalParams(prompt: string): any {
    const params: any = {};
    
    const dateMatch = prompt.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
    if (dateMatch) {
      params.date = new Date(`${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`);
    }
    
    const priceRangeMatch = prompt.match(/\$?\s*(\d+)\s*(a|al?)\s*\$?\s*(\d+)/i);
    if (priceRangeMatch) {
      params.minPrice = parseInt(priceRangeMatch[1]);
      params.maxPrice = parseInt(priceRangeMatch[3]);
    }
    
    const yearMatch = prompt.match(/(año|modelo)\s+(\d{4})/i);
    if (yearMatch) params.year = parseInt(yearMatch[2]);
    
    return params;
  }

  private async getProductsAdmin(view: string = 'general'): Promise<IaResponse> {
    let query: any = {};
    let sort: any = { createdAt: -1 };
    let message = "**Inventario Completo - Vista Administrador**\n\n";
    
    switch(view) {
      case 'slow_moving':
        const sixtyDaysAgo = new Date();
        sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
        query.createdAt = { $lte: sixtyDaysAgo };
        query.stock = { $gt: 0 };
        message = "**Inventario de Lento Movimiento** (más de 60 días)\n\n";
        break;
      case 'low_stock':
        query.stock = { $lt: 3, $gt: 0 };
        message = "**Inventario Bajo** (menos de 3 unidades)\n\n";
        break;
      case 'out_of_stock':
        query.stock = 0;
        message = "**Productos Sin Stock**\n\n";
        break;
    }
    
    const products = await this.productModel.find(query)
      .sort(sort)
      .limit(30);
    
    if (!products.length) {
      return { 
        message: message + "No hay productos que coincidan con este filtro.",
        type: 'text'
      };
    }
    
    const totalValue = products.reduce((sum, prod) => sum + (prod.precioBase * prod.stock), 0);
    
    return {
      message: `${message}**Total:** ${products.length} unidades | **Valor total:** $${totalValue.toLocaleString()}`,
      type: 'products_grid',
      data: products,
      metadata: {
        totalValue,
        averagePrice: totalValue / products.length,
        categories: [...new Set(products.map(p => p.tipo))],
        viewType: view
      }
    };
  }

  private async getProductsVendor(filter: string = 'available'): Promise<IaResponse> {
    let query: any = { 
      disponible: true,
      activo: true,
      stock: { $gt: 0 }
    };
    
    let sort: any = { precioBase: 1 };
    let message = "**Vehículos Disponibles para Venta**\n\n";
    
    if (filter === 'featured') {
      query.destacado = true;
      message = "**Vehículos Destacados**\n\n";
    } else if (filter === 'promotion') {
      query.promocion = { $exists: true, $ne: null };
      message = "**Vehículos en Promoción**\n\n";
    } else if (filter === 'new_arrivals') {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      query.createdAt = { $gte: sevenDaysAgo };
      message = "**Nuevos Ingresos** (últimos 7 días)\n\n";
    }
    
    const products = await this.productModel.find(query)
      .sort(sort)
      .limit(20);
    
    if (!products.length) {
      return { 
        message: "No hay vehículos disponibles con ese filtro.",
        type: 'text',
        suggestion: "Intenta con: /autos o ver todo el inventario"
      };
    }
    
    return {
      message: `${message}**Mostrando:** ${products.length} de ${await this.productModel.countDocuments({ stock: { $gt: 0 } })} unidades disponibles`,
      type: 'products_grid',
      data: products,
      metadata: {
        filtersAvailable: ['available', 'featured', 'promotion', 'new_arrivals'],
        currentFilter: filter
      }
    };
  }

  private async getProductsGeneral(): Promise<IaResponse> {
    return this.getProductsVendor();
  }

  private async searchCars(keywords: string, userRole: string): Promise<IaResponse> {
    const safeKeywords = keywords
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      .replace(/busca|buscar|dame|muestra|enseña|un|una|el|la|coche|carro|auto|camioneta|quiero|necesito|tienes|modelo|marca|precio|de|interesa|x3|por favor|plis/gi, '')
      .trim();
    
    if (safeKeywords.length < 2) {
      return { 
        message: "Por favor, especifica mejor tu búsqueda. Ejemplo: 'Toyota Corolla 2023' o 'SUV familiar'",
        type: 'text'
      };
    }
    
    const searchConditions: any[] = [];

    const words = safeKeywords.split(/\s+/).filter(w => w.length > 2);
    
    words.forEach(word => {
      const regex = new RegExp(word, 'i');
      searchConditions.push(
        { marca: regex },
        { modelo: regex },
        { tipo: regex },
        { descripcion: regex },
        { caracteristicas: regex }
      );
    });
    
    const baseQuery: any = {
      $or: searchConditions.length > 0 ? searchConditions : [{ modelo: new RegExp(safeKeywords, 'i') }]
    };
    
    if (userRole === 'CLIENTE') {
      baseQuery.disponible = true;
      baseQuery.activo = true;
      baseQuery.stock = { $gt: 0 };
    }
    
    const cars = await this.productModel.find(baseQuery)
      .sort({ precioBase: 1 })
      .limit(userRole === 'ADMIN' ? 50 : 15);
    
    if (!cars.length) {
      const suggestions = await this.productModel.aggregate([
        { $match: userRole === 'CLIENTE' ? { disponible: true, stock: { $gt: 0 } } : {} },
        { $sample: { size: 5 } }
      ]);
      
      return {
        message: `No encontré resultados exactos para "${safeKeywords}".\n\n**Sugerencias que podrían interesarte:**`,
        type: 'products_grid',
        data: suggestions,
        metadata: {
          originalSearch: safeKeywords,
          isAlternative: true
        }
      };
    }
    
    const priceRange = cars.length > 0 ? {
      min: Math.min(...cars.map(c => c.precioBase)),
      max: Math.max(...cars.map(c => c.precioBase))
    } : null;
    
    return {
      message: `**Encontré ${cars.length} vehículos para "${safeKeywords}":**\n${priceRange ? `Desde $${priceRange.min.toLocaleString()} hasta $${priceRange.max.toLocaleString()}` : ''}`,
      type: 'products_grid',
      data: cars,
      metadata: {
        searchQuery: safeKeywords,
        priceRange,
        categories: [...new Set(cars.map(c => c.tipo))]
      }
    };
  }

  private async getPendingQuotesAdmin(): Promise<IaResponse> {
    const pendingQuotes = await this.cotizacionModel.find({ status: 'Pendiente' })
      .populate('cliente', 'nombre email telefono')
      .populate('coche', 'marca modelo precioBase')
      .populate({ path: 'vendedor', select: 'nombre' })
      .sort({ createdAt: -1 })
      .limit(20);
    
    if (!pendingQuotes.length) {
      return {
        message: "**Todas las cotizaciones están procesadas.**\n\nNo hay cotizaciones pendientes de revisión.",
        type: 'text',
        metadata: { status: 'all_processed' }
      };
    }
    
    const totalValue = pendingQuotes.reduce((sum, quote) => sum + (quote.totalPagado || 0), 0);
    
    return {
      message: `**Cotizaciones Pendientes de Aprobación**\n\n**Total:** ${pendingQuotes.length} cotizaciones\n**Valor pendiente:** $${totalValue.toLocaleString()}`,
      type: 'cotizaciones_table',
      data: pendingQuotes,
      metadata: {
        count: pendingQuotes.length,
        totalValue,
        vendedores: [...new Set(pendingQuotes.map(q => typeof q.vendedor === 'object' && q.vendedor ? (q.vendedor as any).nombre : undefined).filter(Boolean))],
        oldest: pendingQuotes[pendingQuotes.length - 1]?.get('createdAt')
      }
    };
  }

  private async getPendingQuotesVendor(vendorId: string): Promise<IaResponse> {
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
        message: "**No tienes cotizaciones pendientes.**\n\n¡Excelente trabajo manteniendo al día tus procesos!",
        type: 'text'
      };
    }
    
    const oldestQuote = myPendingQuotes.reduce((oldest, current) => 
      current.get('createdAt') < oldest.get('createdAt') ? current : oldest
    );
    
    const daysOld = Math.floor((Date.now() - oldestQuote.get('createdAt').getTime()) / (1000 * 60 * 60 * 24));
    
    return {
      message: `**Tus Cotizaciones Pendientes**\n\nTienes **${myPendingQuotes.length}** cotizaciones pendientes.\nLa más antigua tiene **${daysOld} días**.\n\n**Recomendación:** Contacta a los clientes de las cotizaciones más antiguas.`,
      type: 'cotizaciones_table',
      data: myPendingQuotes,
      metadata: {
        count: myPendingQuotes.length,
        oldestDays: daysOld,
        clientes: myPendingQuotes
          .map(q => typeof q.cliente === 'object' && q.cliente ? (q.cliente as any).nombre : undefined)
          .filter(Boolean)
      }
    };
  }

  private async getClientsAdmin(filter: string = 'all'): Promise<IaResponse> {
    let query: any = { rol: 'CLIENTE' };
    let sort: any = { createdAt: -1 };
    let message = "👥 **Base de Clientes - Vista Administrador**\n\n";
    
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
      case 'potential':
        query.interesEspecifico = { $exists: true, $ne: null };
        message = "**Clientes Potenciales** (con interés específico)\n\n";
        break;
    }
    
    const clients = await this.userModel.find(query)
      .select('nombre email telefono ciudad ultimoContacto interesEspecifico')
      .sort(sort)
      .limit(25);
    
    if (!clients.length) {
      return {
        message: message + "No hay clientes que coincidan con este filtro.",
        type: 'text',
        suggestion: "Ver todos los clientes: /clientes"
      };
    }
    
    return {
      message: `${message}**Total:** ${clients.length} clientes`,
      type: 'clients_list',
      data: clients,
      metadata: {
        filter,
        totalClients: await this.userModel.countDocuments({ rol: 'CLIENTE' }),
        newClients30d: await this.userModel.countDocuments({ 
          rol: 'CLIENTE', 
          createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } 
        })
      }
    };
  }

  private async getClientsVendor(vendorId: string): Promise<IaResponse> {
    const myClients = await this.userModel.aggregate([
      { $match: { rol: 'CLIENTE' } },
      {
        $lookup: {
          from: 'cotizacions',
          let: { clientId: '$_id' },
          pipeline: [
            { 
              $match: { 
                $expr: { 
                  $and: [
                    { $eq: ['$cliente', '$$clientId'] },
                    { $eq: ['$vendedor', new Types.ObjectId(vendorId)] }
                  ]
                }
              }
            },
            { $sort: { createdAt: -1 } },
            { $limit: 1 }
          ],
          as: 'ultimaCotizacion'
        }
      },
      { $match: { 'ultimaCotizacion.0': { $exists: true } } },
      { $sort: { 'ultimaCotizacion.createdAt': -1 } },
      { $limit: 15 }
    ]);
    
    if (!myClients.length) {
      return {
        message: "👤 **Tus Clientes**\n\nAún no tienes clientes asignados. Empieza a crear cotizaciones para verlos aquí.",
        type: 'text',
        suggestion: "Usa 'crear cotización' para comenzar"
      };
    }
    
    const clientsWithRecentContact = myClients.filter(client => {
      const lastContact = client.ultimaCotizacion?.[0]?.createdAt;
      if (!lastContact) return false;
      const daysSinceContact = Math.floor((Date.now() - new Date(lastContact).getTime()) / (1000 * 60 * 60 * 24));
      return daysSinceContact <= 30;
    });
    
    return {
      message: `👥 **Tu Lista de Clientes**\n\n**Total:** ${myClients.length} clientes\n**Contacto reciente (30 días):** ${clientsWithRecentContact.length}\n\n**Recomendación:** Contacta a los clientes con más de 30 días sin seguimiento.`,
      type: 'clients_list',
      data: myClients,
      metadata: {
        total: myClients.length,
        active: clientsWithRecentContact.length,
        needsFollowUp: myClients.length - clientsWithRecentContact.length
      }
    };
  }

  private async getMyTasks(userId: string, filter: string = 'all'): Promise<IaResponse> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    let query: any = {
      vendedor: new Types.ObjectId(userId),
      isCompleted: false
    };
    
    let sort: any = { dueDate: 1 };
    let message = "**Tus Tareas Pendientes**\n\n";
    
    switch(filter) {
      case 'today':
        query.dueDate = { $gte: today, $lt: tomorrow };
        message = "**Tareas para Hoy**\n\n";
        break;
      case 'overdue':
        query.dueDate = { $lt: today };
        message = "**Tareas Vencidas**\n\n";
        sort = { dueDate: 1 };
        break;
      case 'week':
        const weekFromNow = new Date(today);
        weekFromNow.setDate(weekFromNow.getDate() + 7);
        query.dueDate = { $gte: today, $lt: weekFromNow };
        message = "**Tareas de Esta Semana**\n\n";
        break;
      case 'urgent':
        query.priority = 'alta';
        message = "**Tareas Urgentes**\n\n";
        break;
    }
    
    const tasks = await this.taskModel.find(query)
      .populate('cliente', 'nombre telefono')
      .sort(sort)
      .limit(15);
    
    if (!tasks.length) {
      const completionMessage = filter === 'overdue' 
        ? "¡Excelente! No tienes tareas vencidas." 
        : filter === 'today'
        ? "No tienes tareas programadas para hoy. ¡Buen trabajo!"
        : "No tienes tareas pendientes con este filtro.";
      
      return {
        message: `${completionMessage}`,
        type: 'text',
        suggestion: filter !== 'all' ? "Ver todas las tareas: /tareas" : "Crear nueva tarea: 'nueva tarea'"
      };
    }
    
    const overdueCount = filter === 'all' 
      ? await this.taskModel.countDocuments({ 
          vendedor: new Types.ObjectId(userId), 
          isCompleted: false, 
          dueDate: { $lt: today } 
        })
      : 0;
    
    const todayCount = filter === 'all'
      ? await this.taskModel.countDocuments({
          vendedor: new Types.ObjectId(userId),
          isCompleted: false,
          dueDate: { $gte: today, $lt: tomorrow }
        })
      : 0;
    
    return {
      message: `${message}**Total:** ${tasks.length} tareas${overdueCount > 0 && filter === 'all' ? ` (${overdueCount} vencidas)` : ''}${todayCount > 0 && filter === 'all' ? ` (${todayCount} para hoy)` : ''}`,
      type: 'tasks_list_detailed',
      data: tasks,
      metadata: {
        filter,
        overdueCount,
        todayCount,
        nextDue: tasks[0]?.dueDate
      }
    };
  }

  private async getSalesReportAdmin(period: string = 'month'): Promise<IaResponse> {
    const now = new Date();
    let startDate: Date;
    let message = "";
    
    switch(period) {
      case 'day':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        message = "**Reporte de Ventas - Hoy**\n\n";
        break;
      case 'week':
        const dayOfWeek = now.getDay();
        const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
        startDate = new Date(now.setDate(diff));
        message = "**Reporte de Ventas - Esta Semana**\n\n";
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        message = "**Reporte de Ventas - Este Año**\n\n";
        break;
      case 'month':
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        message = "**Reporte de Ventas - Este Mes**\n\n";
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
          avgTicket: { $avg: '$totalPagado' },
          minTicket: { $min: '$totalPagado' },
          maxTicket: { $max: '$totalPagado' }
        }
      }
    ]);
    
    const byVendor = await this.cotizacionModel.aggregate([
      {
        $match: {
          status: 'Aprobada',
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: '$vendedor',
          total: { $sum: '$totalPagado' },
          count: { $sum: 1 }
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
      { $sort: { total: -1 } },
      { $limit: 5 }
    ]);
    
    const data = salesData[0] || { 
      totalVendido: 0, 
      count: 0, 
      avgTicket: 0, 
      minTicket: 0, 
      maxTicket: 0 
    };
    
    const prevStartDate = new Date(startDate);
    if (period === 'month') {
      prevStartDate.setMonth(prevStartDate.getMonth() - 1);
    } else if (period === 'week') {
      prevStartDate.setDate(prevStartDate.getDate() - 7);
    } else if (period === 'year') {
      prevStartDate.setFullYear(prevStartDate.getFullYear() - 1);
    }
    
    const prevData = await this.cotizacionModel.aggregate([
      {
        $match: {
          status: 'Aprobada',
          createdAt: { $gte: prevStartDate, $lt: startDate }
        }
      },
      {
        $group: {
          _id: null,
          totalVendido: { $sum: '$totalPagado' },
          count: { $sum: 1 }
        }
      }
    ]);
    
    const prevStats = prevData[0] || { totalVendido: 0, count: 0 };
    const growth = prevStats.totalVendido > 0 
      ? ((data.totalVendido - prevStats.totalVendido) / prevStats.totalVendido * 100).toFixed(1)
      : '100';
    
    return {
      message: `${message}**Ventas Totales:** $${data.totalVendido.toLocaleString()}\n**Unidades Vendidas:** ${data.count}\n**Ticket Promedio:** $${data.avgTicket.toLocaleString(undefined, { maximumFractionDigits: 0 })}\n**Crecimiento vs anterior:** ${growth}%`,
      type: 'kpi_dashboard_admin',
      data: {
        period,
        totalSales: data.totalVendido,
        salesCount: data.count,
        averageTicket: data.avgTicket,
        minTicket: data.minTicket,
        maxTicket: data.maxTicket,
        topVendors: byVendor,
        previousPeriod: prevStats,
        growthPercentage: parseFloat(growth)
      }
    };
  }

  private async getSalesReportVendor(vendorId: string, period: string = 'month'): Promise<IaResponse> {
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
          avgTicket: { $avg: '$totalPagado' },
          comisionGenerada: { $sum: { $multiply: ['$totalPagado', 0.03] } } // Ejemplo: 3% de comisión
        }
      }
    ]);
    
    const data = mySales[0] || { 
      totalVendido: 0, 
      count: 0, 
      avgTicket: 0, 
      comisionGenerada: 0 
    };
    
    const teamStats = await this.cotizacionModel.aggregate([
      {
        $match: {
          status: 'Aprobada',
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: '$vendedor',
          total: { $sum: '$totalPagado' }
        }
      },
      { $sort: { total: -1 } }
    ]);
    
    const myRank = teamStats.findIndex(stat => stat._id.toString() === vendorId) + 1;
    const totalVendors = teamStats.length;
    
    let performanceMessage = "";
    if (totalVendors > 0) {
      const avgTeamSales = teamStats.reduce((sum, stat) => sum + stat.total, 0) / totalVendors;
      if (data.totalVendido > avgTeamSales * 1.2) {
        performanceMessage = "**¡Estás por encima del promedio del equipo!**";
      } else if (data.totalVendido < avgTeamSales * 0.8) {
        performanceMessage = "**Oportunidad de mejora: estás por debajo del promedio.**";
      }
    }
    
    return {
      message: `**Tus Ventas (${period})**\n\n**Total Vendido:** $${data.totalVendido.toLocaleString()}\n**Vehículos:** ${data.count}\n**Ticket Promedio:** $${data.avgTicket.toLocaleString(undefined, { maximumFractionDigits: 0 })}\n**Comisión estimada:** $${data.comisionGenerada.toLocaleString(undefined, { maximumFractionDigits: 0 })}\n\n**Ranking:** ${myRank || 'N/A'}/${totalVendors}\n${performanceMessage}`,
      type: 'kpi_dashboard_vendor',
      data: {
        period,
        totalSales: data.totalVendido,
        salesCount: data.count,
        averageTicket: data.avgTicket,
        estimatedCommission: data.comisionGenerada,
        rank: myRank,
        totalVendors,
        teamStats
      }
    };
  }

  private async getExpensesAdmin(params: any = {}): Promise<IaResponse> {
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
      .limit(20);
    
    if (!gastos.length) {
      return {
        message: "**Gestión de Gastos**\n\nNo hay gastos registrados con los filtros aplicados.",
        type: 'text',
        suggestion: "Ver todos los gastos: /gastos"
      };
    }
    
    const total = gastos.reduce((acc, curr) => acc + curr.monto, 0);
    const byCategory: Record<string, number> = gastos.reduce((acc, curr) => {
      const key = curr.categoria || 'Sin categoría';
      acc[key] = (acc[key] || 0) + (curr.monto || 0);
      return acc;
    }, {} as Record<string, number>);
    
    const categories = Object.entries(byCategory)
      .map(([cat, amount]) => `${cat}: $${amount.toLocaleString()}`)
      .join('\n');
    
    return {
      message: `**Análisis de Gastos**\n\n**Total:** $${total.toLocaleString()}\n**Registros:** ${gastos.length}\n\n**Por Categoría:**\n${categories}`,
      type: 'expenses_table_admin',
      data: gastos,
      metadata: {
        total,
        count: gastos.length,
        byCategory,
        average: total / gastos.length,
        dateRange: startDate && endDate ? `${startDate} a ${endDate}` : 'Todos'
      }
    };
  }

  private async getSupportInfo(topic: string = 'general'): Promise<IaResponse> {
    const supportTopics = {
      system: {
        message: "**Soporte Técnico - Sistema CRM**\n\n",
        content: `**Problemas comunes y soluciones:**

1. **No puedo iniciar sesión:**
   - Verifica tu conexión a internet
   - Limpia caché del navegador
   - Usa "¿Olvidaste tu contraseña?"

2. **Reportes no se generan:**
   - Asegúrate de tener permisos adecuados
   - Verifica los filtros aplicados
   - Intenta con otro navegador

3. **Error al guardar datos:**
   - Completa todos los campos requeridos (*)
   - Verifica formato de fechas
   - Revisa conexión estable

**Contacto soporte técnico:**
soporte.tecnico@autobots.mx
Extensión 506
24/7 para emergencias críticas`
      },
      reports: {
        message: "**Soporte - Reportes y Análisis**\n\n",
        content: `**Guía de Reportes Disponibles:**

1. **Reporte de Ventas:**
   - Por vendedor, marca, período
   - Incluye comparativas y tendencias
   - Exportable a Excel/PDF

2. **Inventario Detallado:**
   - Stock actual vs mínimo
   - Vehículos por vencer en garantía
   - Análisis de rotación

3. **Clientes y Prospectos:**
   - Segmentación por comportamiento
   - Historial de interacciones
   - Pipeline de ventas

**Consejos:**
- Usa filtros para datos específicos
- Programa reportes automáticos
- Exporta para análisis externos`
      },
      account: {
        message: "👤 **Soporte - Cuenta y Usuarios**\n\n",
        content: `**Gestión de Cuenta:**

1. **Actualizar perfil:**
   - Foto, datos de contacto
   - Preferencias de notificación
   - Firmas digitales

2. **Permisos de usuario:**
   - Roles: Admin, Vendedor, Cliente
   - Accesos específicos por módulo
   - Restricciones de datos sensibles

3. **Seguridad:**
   - Cambio de contraseña cada 90 días
   - Autenticación de dos factores
   - Historial de acceso

**Para solicitudes:**
Contacta a tu administrador del sistema
o escribe a administracion@autobots.mx`
      },
      general: {
        message: "**Centro de Ayuda**\n\n",
        content: `**¿Cómo puedo ayudarte?**

Selecciona un tema o pregunta específicamente:

**Sistema CRM:** Problemas técnicos, errores, configuración

**Reportes:** Generación, interpretación, exportación

**Clientes:** Gestión, seguimiento, historial

**Inventario:** Stock, precios, disponibilidad

**Ventas:** Cotizaciones, facturación, comisiones

**Agenda:** Tareas, recordatorios, citas

**Contacto directo:**
soporte@autobots.mx
477 123 4567 Ext. 505
Chat en vivo (L-V 9am-6pm)`
      }
    };
    
    const selectedTopic = supportTopics[topic] || supportTopics.general;
    
    return {
      message: selectedTopic.message + selectedTopic.content,
      type: 'text',
      metadata: {
        topic,
        contactInfo: {
          email: 'soporte@autobots.mx',
          phone: '477 123 4567',
          extension: '505',
          hours: 'L-V 9am-6pm'
        }
      }
    };
  }

  private async scheduleTestDrive(userId: string, params: any): Promise<IaResponse> {
    const user = await this.userModel.findById(userId);
    
    if (!user) {
      return {
        message: "Primero necesito identificarte. Por favor, inicia sesión nuevamente.",
        type: 'text'
      };
    }
    
    const availableSlots = [
      "Lunes 10:00 AM", "Lunes 2:00 PM",
      "Martes 11:00 AM", "Martes 4:00 PM",
      "Miércoles 9:00 AM", "Miércoles 3:00 PM",
      "Jueves 10:30 AM", "Jueves 5:00 PM",
      "Viernes 11:30 AM", "Viernes 4:30 PM",
      "Sábado 9:30 AM", "Sábado 11:00 AM"
    ];
    
    return {
      message: `**Programar Prueba de Manejo**\n\nHola ${user.nombre.split(' ')[0]}, con gusto te ayudo a agendar una prueba de manejo.\n\n**Horarios disponibles esta semana:**\n${availableSlots.map((slot, i) => `${i + 1}. ${slot}`).join('\n')}\n\n**Para agendar:**\n1. Elige un horario\n2. Confirma el vehículo que te interesa\n3. Te contactaremos para confirmar\n\n¿Te interesa alguno de estos horarios?`,
      type: 'test_drive_slots',
      data: {
        slots: availableSlots,
        user: user.nombre,
        contact: user.telefono || user.email
      }
    };
  }

  private async calculateFinancing(params: any): Promise<IaResponse> {
    const price = params.price || 300000;
    const downPaymentPercent = params.downPaymentPercent || 20;
    const termMonths = params.termMonths || 48;
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
    
    let message = `**Simulación de Financiamiento**\n\n`;
    message += `**Precio del vehículo:** $${price.toLocaleString()}\n`;
    message += `**Enganche (${downPaymentPercent}%):** $${downPayment.toLocaleString()}\n`;
    message += `**Monto a financiar:** $${financedAmount.toLocaleString()}\n`;
    message += `**Plazo:** ${termMonths} meses\n`;
    message += `**Tasa anual:** ${annualRate}%\n\n`;
    message += `**Resultados:**\n`;
    message += `• **Pago mensual:** $${calculations.monthlyPayment.toLocaleString()}\n`;
    message += `• **Total a pagar:** $${calculations.totalPaid.toLocaleString()}\n`;
    message += `• **Intereses totales:** $${calculations.totalInterest.toLocaleString()}\n`;
    message += `• **Relación intereses/capital:** ${calculations.interestToPrincipal}%\n\n`;
    message += `**Nota:** Esta es una simulación. Tasas sujetas a aprobación de crédito.`;
    
    return {
      message,
      type: 'financing_calculation',
      data: calculations,
      metadata: {
        isEstimate: true,
        disclaimer: "Las tasas pueden variar según historial crediticio y condiciones del mercado."
      }
    };
  }

  private async getTeamPerformance(): Promise<IaResponse> {
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
          avgTicket: { $avg: '$totalPagado' },
          lastSale: { $max: '$createdAt' }
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
        message: "**Rendimiento del Equipo**\n\nNo hay datos de ventas en los últimos 30 días.",
        type: 'text'
      };
    }
    
    const totalTeamSales = performanceData.reduce((sum, vendor) => sum + vendor.totalSales, 0);
    const topPerformer = performanceData[0];
    
    let message = `**Rendimiento del Equipo (Últimos 30 días)**\n\n`;
    message += `**Ventas totales del equipo:** $${totalTeamSales.toLocaleString()}\n`;
    message += `**Vendedores activos:** ${performanceData.length}\n\n`;
    message += `**Top Performer:**\n`;
    message += `${topPerformer.vendedorInfo[0]?.nombre || 'N/A'}\n`;
    message += `• Ventas: $${topPerformer.totalSales.toLocaleString()}\n`;
    message += `• Unidades: ${topPerformer.saleCount}\n`;
    message += `• Ticket promedio: $${Math.round(topPerformer.avgTicket).toLocaleString()}\n\n`;
    message += `**Recomendaciones:**\n`;
    message += `1. Reconocer al top performer\n`;
    message += `2. Identificar oportunidades de capacitación\n`;
    message += `3. Establecer metas individuales\n`;
    
    return {
      message,
      type: 'team_performance',
      data: performanceData,
      metadata: {
        period: '30_days',
        totalTeamSales,
        averagePerVendor: totalTeamSales / performanceData.length,
        topPerformer: topPerformer.vendedorInfo[0]?.nombre
      }
    };
  }

  private async getMyPerformance(userId: string): Promise<IaResponse> {
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
          avgTicket: { $avg: '$totalPagado' },
          dailyAverage: { $avg: '$totalPagado' }
        }
      }
    ]);
    
    const myQuotes = await this.cotizacionModel.aggregate([
      {
        $match: {
          vendedor: new Types.ObjectId(userId),
          createdAt: { $gte: thirtyDaysAgo }
        }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);
    
    const stats = myStats[0] || { totalSales: 0, saleCount: 0, avgTicket: 0 };
    const quotesByStatus = Object.fromEntries(myQuotes.map(q => [q._id, q.count]));
    
    const conversionRate = quotesByStatus['Aprobada'] 
      ? (quotesByStatus['Aprobada'] / (quotesByStatus['Aprobada'] + quotesByStatus['Pendiente'] + quotesByStatus['Rechazada'])) * 100 
      : 0;
    
    let performanceLevel = "Regular";
    if (conversionRate > 30) performanceLevel = "Excelente";
    else if (conversionRate > 15) performanceLevel = "Bueno";
    
    return {
      message: `**Tu Rendimiento (Últimos 30 días)**\n\n**Ventas Totales:** $${stats.totalSales.toLocaleString()}\n**Vehículos Vendidos:** ${stats.saleCount}\n**Ticket Promedio:** $${Math.round(stats.avgTicket).toLocaleString()}\n**Tasa de Conversión:** ${conversionRate.toFixed(1)}%\n**Nivel:** ${performanceLevel}\n\n**Cotizaciones por estado:**\n✅ Aprobadas: ${quotesByStatus['Aprobada'] || 0}\n⏳ Pendientes: ${quotesByStatus['Pendiente'] || 0}\n❌ Rechazadas: ${quotesByStatus['Rechazada'] || 0}\n\n**Consejo:** Enfócate en seguir con clientes con cotizaciones pendientes para mejorar tu tasa de conversión.`,
      type: 'personal_performance',
      data: {
        ...stats,
        quotesByStatus,
        conversionRate,
        performanceLevel
      }
    };
  }

  private async getInventoryAnalysis(): Promise<IaResponse> {
    const inventory = await this.productModel.aggregate([
      {
        $group: {
          _id: '$tipo',
          totalStock: { $sum: '$stock' },
          totalValue: { $sum: { $multiply: ['$precioBase', '$stock'] } },
          avgDaysInStock: { $avg: { 
            $divide: [
              { $subtract: [new Date(), '$createdAt'] },
              1000 * 60 * 60 * 24
            ]
          }},
          count: { $sum: 1 }
        }
      },
      { $sort: { totalValue: -1 } }
    ]);
    
    const slowMoving = await this.productModel.find({
      stock: { $gt: 0 },
      createdAt: { $lte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) }
    })
    .sort({ createdAt: 1 })
    .limit(10);
    
    const totalInventoryValue = inventory.reduce((sum, cat) => sum + cat.totalValue, 0);
    const totalStock = inventory.reduce((sum, cat) => sum + cat.totalStock, 0);
    
    let message = `**Análisis de Inventario**\n\n`;
    message += `**Valor total del inventario:** $${totalInventoryValue.toLocaleString()}\n`;
    message += `**Total de unidades:** ${totalStock}\n\n`;
    message += `**Por Categoría:**\n`;
    
    inventory.forEach(cat => {
      const percentage = (cat.totalValue / totalInventoryValue * 100).toFixed(1);
      message += `• ${cat._id}: ${cat.totalStock} unidades (${percentage}% del valor)\n`;
    });
    
    if (slowMoving.length > 0) {
      message += `\n**Inventario de Lento Movimiento** (>90 días):\n`;
      slowMoving.forEach((product, i) => {
        if (i < 3) {
          const createdAt = (product as any).createdAt || new Date();
          const days = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
          message += `• ${product.marca} ${product.modelo}: ${days} días en inventario\n`;
        }
      });
      message += `\n**Recomendación:** Considerar promociones para estos ${slowMoving.length} vehículos.`;
    }
    
    return {
      message,
      type: 'inventory_analysis',
      data: {
        categories: inventory,
        slowMoving,
        totals: {
          value: totalInventoryValue,
          stock: totalStock,
          categories: inventory.length
        }
      }
    };
  }

  private async getUserProfile(userId: string): Promise<IaResponse> {
    const user = await this.userModel.findById(userId)
      .select('-password');
    
    if (!user) {
      return {
        message: "Usuario no encontrado. Por favor, verifica tu sesión.",
        type: 'text'
      };
    }
    
    let additionalInfo = "";
    
    if (user.rol === 'VENDEDOR') {
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
      additionalInfo = `\n**Este mes:**\n• Ventas: $${stats.totalSales.toLocaleString()}\n• Vehículos: ${stats.count}`;
    }
    
    const createdDate = (user as any).createdAt ? (user as any).createdAt.toLocaleDateString() : 'No disponible';
    
    return {
      message: `👤 **Tu Perfil**\n\n**Nombre:** ${user.nombre}\n**Rol:** ${user.rol}\n**Email:** ${user.email}\n**Teléfono:** ${user.telefono || 'No registrado'}\n**Miembro desde:** ${createdDate}${additionalInfo}`,
      type: 'user_profile',
      data: user
    };
  }

  private async getCompanyInfo(): Promise<IaResponse> {
    const companyInfo = {
      name: "Autobots - CRM Automotriz del Bajío",
      mission: "Proveer soluciones automotrices con excelencia, transparencia y servicio personalizado",
      values: ["Honestidad", "Innovación", "Servicio Personalizado", "Compromiso"],
      location: "Blvd. Adolfo López Mateos 123, León, Guanajuato, México. C.P. 37500",
      coordinates: "21.123456, -101.123456",
      contact: {
        general: "477 123 4567",
        sales: "Ext. 501-504",
        support: "soporte@autobots.mx (Ext. 505)",
        technical: "soporte.tecnico@autobots.mx (Ext. 506)",
        emergencies: "477 987 6543 (24/7)"
      },
      schedule: {
        weekdays: "Lunes a Viernes: 9:00 AM - 7:00 PM",
        saturday: "Sábados: 9:00 AM - 2:00 PM",
        sunday: "Domingo: Cerrado",
        holidays: "Horario especial en días festivos"
      },
      services: [
        "Venta de vehículos nuevos y seminuevos",
        "Financiamiento y crédito automotriz",
        "Seguros y garantías extendidas",
        "Servicio de mantenimiento y reparación",
        "Venta de refacciones y accesorios",
        "Evaluación y compra de tu usado"
      ],
      social: {
        facebook: "@AutobotsCRM",
        instagram: "@AutobotsCRM",
        linkedin: "Autobots CRM Automotriz",
        whatsapp: "477 123 4567"
      }
    };
    
    let message = `**${companyInfo.name}**\n\n`;
    message += `**Misión:** ${companyInfo.mission}\n\n`;
    message += `**Ubicación:**\n${companyInfo.location}\n\n`;
    message += `**Horarios:**\n${companyInfo.schedule.weekdays}\n${companyInfo.schedule.saturday}\n${companyInfo.schedule.sunday}\n\n`;
    message += `**Contacto:**\nGeneral: ${companyInfo.contact.general}\nSoporte: ${companyInfo.contact.support}\nTécnico: ${companyInfo.contact.technical}\nEmergencias: ${companyInfo.contact.emergencies}\n\n`;
    message += `**Servicios:**\n${companyInfo.services.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\n`;
    message += `**Síguenos:**\n${companyInfo.social.facebook}\n${companyInfo.social.instagram}\n💼 ${companyInfo.social.linkedin}\n`;
    
    return {
      message,
      type: 'company_info_detailed',
      data: companyInfo
    };
  }

  private async chatWithAi(prompt: string, userId: string): Promise<IaResponse> {
    const user = await this.userModel.findById(userId).select('nombre rol departamento').populate('departamento', 'nombre');
    const userName = user ? user.nombre.split(' ')[0] : 'Usuario';
    const userRole = user?.rol || 'CLIENTE';
    
    let roleContext = '';
    let systemPrompt = '';
    
    if (userRole === 'ADMIN') {
        roleContext = ADMIN_CONTEXT;
        systemPrompt = `
          ${BASE_CONTEXT}
          ${roleContext}
          
          USUARIO ACTUAL: ${userName} (${userRole} - ${(user && (user as any).departamento?.nombre) || 'Administración'}).
          
          CONTEXTO ACTUAL: ${new Date().toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          
          INSTRUCCIONES DE FORMATO:
          - Usa Markdown para negritas (**), listas y tablas cuando sea útil.
          - Mantén respuestas ejecutivas y orientadas a la toma de decisiones.
          - Proporciona insights basados en datos cuando sea posible.
          - Sé directo pero completo, máximo 4 párrafos.
          - Si es relevante, menciona KPIs o métricas.
          - Ofrece opciones o recomendaciones claras.
          
          EJEMPLOS DE RESPUESTAS IDEALES:
          "Basado en los datos del mes, te recomiendo..."
          "Las métricas clave a considerar son..."
          "Tienes tres opciones estratégicas: 1)..."
        `;
    } else if (userRole === 'VENDEDOR') {
        roleContext = VENDOR_CONTEXT;
        systemPrompt = `
          ${BASE_CONTEXT}
          ${roleContext}
          
          USUARIO ACTUAL: ${userName} (${userRole}).
          HORA ACTUAL: ${new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
          
          INSTRUCCIONES DE FORMATO:
          - Usa un tono motivacional y orientado a resultados.
          - Sé práctico y ofrece pasos accionables.
          - Usa emojis relevantes para mantener la energía positiva.
          - Proporciona ejemplos concretos cuando sugieras estrategias.
          - Mantén respuestas concisas pero útiles (2-3 párrafos máximo).
          - Si es sobre ventas, incluye números o porcentajes.
          
          EJEMPLOS DE RESPUESTAS IDEALES:
          "¡Excelente pregunta! Para eso te sugiero..."
          "Basado en mi experiencia, lo que funciona es..."
          "Puedes intentar esta técnica de cierre..."
          "Tu tasa de conversión actual sugiere que..."
        `;
    } else {
        roleContext = CLIENT_CONTEXT;
        systemPrompt = `
          ${BASE_CONTEXT}
          ${roleContext}
          
          USUARIO ACTUAL: ${userName} (Cliente potencial).
          CONTEXTO: El cliente está interesado en información automotriz.
          
          INSTRUCCIONES DE FORMATO:
          - Usa un tono cálido, amigable y entusiasta.
          - Explica conceptos técnicos en lenguaje simple.
          - Usa analogías cuando sea útil para explicar.
          - Incluye beneficios, no solo características.
          - Sé paciente y ofrece opciones.
          - Invita a la acción (prueba de manejo, cotización, etc.).
          - Usa emojis apropiados para hacerlo más cercano.
          - Evita jerga técnica innecesaria.
          
          EJEMPLOS DE RESPUESTAS IDEALES:
          "¡Hola ${userName}! Me encanta que preguntes sobre..."
          "Permíteme explicártelo de forma sencilla..."
          "Lo mejor de este modelo es que..."
          "¿Te gustaría agendar una prueba para sentirlo por ti mismo?"
          "Para tu perfil, te recomendaría considerar..."
        `;
    }
    
    const response = await this.callOllamaEnhanced(systemPrompt, prompt, userRole);
    return { 
      message: response, 
      type: 'text',
      metadata: {
        userRole,
        userName,
        timestamp: new Date().toISOString()
      }
    };
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
        num_predict: userRole === 'ADMIN' ? 250 : 200,
        temperature: userRole === 'CLIENTE' ? 0.7 : 0.4,
        top_p: 0.9,
        repeat_penalty: 1.1
      }
    };

    try {
      const { data } = await firstValueFrom(
        this.httpService.post(`${this.ollamaHost}/api/chat`, payload, { 
          timeout: 100000,
          headers: {
            'Content-Type': 'application/json'
          }
        })
      );
      
      let response = data.message.content;
      
      if (userRole === 'CLIENTE') {
        response = this.ensureClientFriendlyTone(response);
      } else if (userRole === 'ADMIN') {
        response = this.ensureExecutiveTone(response);
      }
      
      return response;
      
    } catch (error) {
      this.logger.error(`Error calling Ollama: ${error.message}`);
      
      if (userRole === 'CLIENTE') {
        return "Disculpa, estoy teniendo dificultades técnicas. ¿Podrías intentar tu pregunta de nuevo o contactar a nuestro equipo de soporte? 😊";
      } else if (userRole === 'VENDEDOR') {
        return "Error de conexión con la IA. Mientras tanto, ¿quieres que revise tu inventario disponible o tus tareas pendientes?";
      } else {
        return "El sistema de IA está temporalmente fuera de línea. Para consultas urgentes, revisa los reportes directamente en el dashboard o contacta al equipo técnico.";
      }
    }
  }

  private ensureClientFriendlyTone(response: string): string {
    if (!response.match(/^(¡Hola|Hola|Hola,|¡Hola,|Buenos|Buenas)/)) {
      response = `¡Hola! ${response}`;
    }
    
    response = response
      .replace(/óptimo/g, 'ideal')
      .replace(/eficiente/g, 'que ahorra')
      .replace(/rendimiento/g, 'desempeño')
      .replace(/características/g, 'características importantes')
      .replace(/beneficios/g, 'ventajas para ti');
    
    return response;
  }

  private ensureExecutiveTone(response: string): string {
    const sentences = response.split('. ');
    if (sentences.length > 4) {
      response = sentences.slice(0, 4).join('. ') + '.';
    }
    
    if (response.includes('1)') || response.includes('- ')) {
      response = response.replace(/(\d+\))/g, '\n$1').replace(/( - )/g, '\n• ');
    }
    
    return response;
  }
}