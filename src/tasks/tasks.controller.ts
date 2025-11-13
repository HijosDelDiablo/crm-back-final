import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Rol } from '../auth/enums/rol.enum';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { type ValidatedUser } from '../user/schemas/user.schema';
import { TasksService } from './tasks.service';
import { CreateTaskDto, UpdateTaskDto } from './dto/task.dto';

@Controller('tasks')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Rol.VENDEDOR)
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  createTask(
    @Body(ValidationPipe) dto: CreateTaskDto,
    @GetUser() user: ValidatedUser,
  ) {
    return this.tasksService.createTask(dto, user);
  }

  @Get('mis-tareas')
  getTasks(@GetUser() user: ValidatedUser) {
    return this.tasksService.getTasksForVendedor(user);
  }

  @Patch(':id/status')
  updateTask(
    @Param('id') taskId: string,
    @Body(ValidationPipe) dto: UpdateTaskDto,
    @GetUser() user: ValidatedUser,
  ) {
    return this.tasksService.updateTaskStatus(taskId, dto, user);
  }
}