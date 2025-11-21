import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Model, Types } from 'mongoose';
import { Task, TaskDocument } from './schemas/task.schema';
import { CreateTaskDto, UpdateTaskDto } from './dto/task.dto';
import { ValidatedUser } from '../user/schemas/user.schema';
import { OneSignalService } from '../notifications/onesignal.service';

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    @InjectModel(Task.name) private taskModel: Model<TaskDocument>,
    private readonly oneSignalService: OneSignalService,
  ) {}

  async createTask(
    dto: CreateTaskDto,
    vendedor: ValidatedUser,
  ): Promise<TaskDocument> {
    const newTask = new this.taskModel({
      ...dto,
      vendedor: new Types.ObjectId(vendedor._id),
      cliente: dto.clienteId ? new Types.ObjectId(dto.clienteId) : undefined,
    });
    return newTask.save();
  }

  async getTasksForVendedor(vendedor: ValidatedUser): Promise<TaskDocument[]> {
    return this.taskModel
      .find({ vendedor: new Types.ObjectId(vendedor._id) })
      .populate('cliente', 'nombre email telefono')
      .sort({ isCompleted: 1, dueDate: 1 })
      .exec();
  }

  async updateTaskStatus(
    taskId: string,
    dto: UpdateTaskDto,
    vendedor: ValidatedUser,
  ): Promise<TaskDocument> {
    const task = await this.taskModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(taskId),
        vendedor: new Types.ObjectId(vendedor._id),
      },
      { isCompleted: dto.isCompleted },
      { new: true },
    );

    if (!task) {
      throw new NotFoundException('Tarea no encontrada o no te pertenece.');
    }
    return task;
  }

  /**
   * Envía notificaciones de tareas pendientes todos los días a las 8:00 AM
   * Puedes ajustar el horario modificando el cron expression
   */
  @Cron('0 8 * * *', {
    name: 'notificar-tareas-pendientes',
    timeZone: 'America/Mexico_City',
  })
  async notificarTareasPendientes() {
    this.logger.log('Iniciando notificación de tareas pendientes...');

    try {
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);

      const manana = new Date(hoy);
      manana.setDate(manana.getDate() + 1);

      // Buscar tareas no completadas que vencen hoy o ya vencieron
      const tareasPendientes = await this.taskModel
        .find({
          isCompleted: false,
          dueDate: { $lte: manana },
        })
        .populate('vendedor', 'nombre oneSignalPlayerId email')
        .populate('cliente', 'nombre')
        .exec();

      if (tareasPendientes.length === 0) {
        this.logger.log('No hay tareas pendientes para notificar.');
        return;
      }

      // Agrupar tareas por vendedor
      const tareasPorVendedor = new Map<string, TaskDocument[]>();
      
      for (const tarea of tareasPendientes) {
        const vendedorId = tarea.vendedor._id.toString();
        if (!tareasPorVendedor.has(vendedorId)) {
          tareasPorVendedor.set(vendedorId, []);
        }
        tareasPorVendedor.get(vendedorId)!.push(tarea);
      }

      // Enviar notificaciones a cada vendedor
      for (const [vendedorId, tareas] of tareasPorVendedor.entries()) {
        const vendedor = tareas[0].vendedor as any;
        
        if (!vendedor.oneSignalPlayerId) {
          this.logger.warn(`Vendedor ${vendedor.nombre} no tiene Player ID configurado.`);
          continue;
        }

        const numTareas = tareas.length;
        const tareasVencidas = tareas.filter(t => new Date(t.dueDate) < hoy).length;
        const tareasHoy = tareas.filter(t => {
          const dueDate = new Date(t.dueDate);
          dueDate.setHours(0, 0, 0, 0);
          return dueDate.getTime() === hoy.getTime();
        }).length;

        let mensaje = '';
        if (tareasVencidas > 0 && tareasHoy > 0) {
          mensaje = `Tienes ${tareasVencidas} tarea(s) vencida(s) y ${tareasHoy} para hoy.`;
        } else if (tareasVencidas > 0) {
          mensaje = `Tienes ${tareasVencidas} tarea(s) vencida(s).`;
        } else {
          mensaje = `Tienes ${tareasHoy} tarea(s) pendiente(s) para hoy.`;
        }

        // Enviar notificación push
        await this.oneSignalService.sendPushNotificationToPlayerIds(
          [vendedor.oneSignalPlayerId],
          '📋 Recordatorio de Tareas',
          mensaje,
        );

        this.logger.log(`Notificación enviada a ${vendedor.nombre} (${numTareas} tareas)`);
      }

      this.logger.log(`Proceso completado: ${tareasPorVendedor.size} vendedores notificados.`);
    } catch (error) {
      this.logger.error(`Error al notificar tareas pendientes: ${error.message}`, error.stack);
    }
  }

  /**
   * Notificación de tareas que vencen mañana (opcional)
   * Se ejecuta todos los días a las 6:00 PM
   */
  @Cron('0 18 * * *', {
    name: 'notificar-tareas-manana',
    timeZone: 'America/Mexico_City',
  })
  async notificarTareasManana() {
    this.logger.log('Notificando tareas que vencen mañana...');

    try {
      const manana = new Date();
      manana.setDate(manana.getDate() + 1);
      manana.setHours(0, 0, 0, 0);

      const pasadoManana = new Date(manana);
      pasadoManana.setDate(pasadoManana.getDate() + 1);

      const tareas = await this.taskModel
        .find({
          isCompleted: false,
          dueDate: { $gte: manana, $lt: pasadoManana },
        })
        .populate('vendedor', 'nombre oneSignalPlayerId')
        .populate('cliente', 'nombre')
        .exec();

      const tareasPorVendedor = new Map<string, TaskDocument[]>();
      
      for (const tarea of tareas) {
        const vendedorId = tarea.vendedor._id.toString();
        if (!tareasPorVendedor.has(vendedorId)) {
          tareasPorVendedor.set(vendedorId, []);
        }
        tareasPorVendedor.get(vendedorId)!.push(tarea);
      }

      for (const [_, tareas] of tareasPorVendedor.entries()) {
        const vendedor = tareas[0].vendedor as any;
        
        if (!vendedor.oneSignalPlayerId) continue;

        const numTareas = tareas.length;
        const mensaje = `Tienes ${numTareas} tarea(s) pendiente(s) para mañana.`;

        await this.oneSignalService.sendPushNotificationToPlayerIds(
          [vendedor.oneSignalPlayerId],
          '🔔 Recordatorio',
          mensaje,
        );
      }

      this.logger.log(`Recordatorios de mañana enviados a ${tareasPorVendedor.size} vendedores.`);
    } catch (error) {
      this.logger.error(`Error al notificar tareas de mañana: ${error.message}`, error.stack);
    }
  }

  /**
   * Notificación urgente: tareas que vencen en 1 hora
   * Se ejecuta cada hora para verificar si hay tareas próximas a vencer
   */
  @Cron('0 * * * *', {
    name: 'notificar-tareas-urgentes',
    timeZone: 'America/Mexico_City',
  })
  async notificarTareasUrgentes() {
    this.logger.log('Verificando tareas que vencen en 1 hora...');

    try {
      const ahora = new Date();
      const dentroDeUnaHora = new Date(ahora.getTime() + 60 * 60 * 1000);
      const dentroDeDosHoras = new Date(ahora.getTime() + 120 * 60 * 1000);

      // Buscar tareas que vencen entre 1 y 2 horas desde ahora
      const tareasUrgentes = await this.taskModel
        .find({
          isCompleted: false,
          dueDate: { $gte: dentroDeUnaHora, $lt: dentroDeDosHoras },
        })
        .populate('vendedor', 'nombre oneSignalPlayerId')
        .populate('cliente', 'nombre')
        .exec();

      if (tareasUrgentes.length === 0) {
        this.logger.log('No hay tareas próximas a vencer.');
        return;
      }

      // Agrupar tareas por vendedor
      const tareasPorVendedor = new Map<string, TaskDocument[]>();
      
      for (const tarea of tareasUrgentes) {
        const vendedorId = tarea.vendedor._id.toString();
        if (!tareasPorVendedor.has(vendedorId)) {
          tareasPorVendedor.set(vendedorId, []);
        }
        tareasPorVendedor.get(vendedorId)!.push(tarea);
      }

      // Enviar notificaciones urgentes
      for (const [_, tareas] of tareasPorVendedor.entries()) {
        const vendedor = tareas[0].vendedor as any;
        
        if (!vendedor.oneSignalPlayerId) {
          this.logger.warn(`Vendedor ${vendedor.nombre} no tiene Player ID configurado.`);
          continue;
        }

        for (const tarea of tareas) {
          const cliente = tarea.cliente as any;
          const tiempoRestante = Math.round((new Date(tarea.dueDate).getTime() - ahora.getTime()) / (60 * 1000));
          
          let mensaje = `⏰ "${tarea.title}" vence en ${tiempoRestante} minutos`;
          if (cliente) {
            mensaje += ` - Cliente: ${cliente.nombre}`;
          }

          await this.oneSignalService.sendPushNotificationToPlayerIds(
            [vendedor.oneSignalPlayerId],
            '🚨 Tarea Urgente',
            mensaje,
          );

          this.logger.log(`Notificación urgente enviada a ${vendedor.nombre} para tarea: ${tarea.title}`);
        }
      }

      this.logger.log(`${tareasUrgentes.length} notificaciones urgentes enviadas.`);
    } catch (error) {
      this.logger.error(`Error al notificar tareas urgentes: ${error.message}`, error.stack);
    }
  }
}