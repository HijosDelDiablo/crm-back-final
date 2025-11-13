import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Task, TaskDocument } from './schemas/task.schema';
import { CreateTaskDto, UpdateTaskDto } from './dto/task.dto';
import { ValidatedUser } from '../user/schemas/user.schema';

@Injectable()
export class TasksService {
  constructor(
    @InjectModel(Task.name) private taskModel: Model<TaskDocument>,
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
}