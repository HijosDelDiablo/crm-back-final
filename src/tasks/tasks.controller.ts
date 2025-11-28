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
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Rol } from '../auth/enums/rol.enum';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { type ValidatedUser } from '../user/schemas/user.schema';
import { TasksService } from './tasks.service';
import { CreateTaskDto, UpdateTaskDto } from './dto/task.dto';

@ApiTags('Tasks')
@Controller('tasks')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Rol.VENDEDOR)
@ApiBearerAuth()
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  @ApiOperation({ summary: 'Create task (Vendedor)' })
  @ApiResponse({ status: 201, description: 'Task created' })
  @ApiBody({ type: CreateTaskDto })
  createTask(
    @Body(ValidationPipe) dto: CreateTaskDto,
    @GetUser() user: ValidatedUser,
  ) {
    return this.tasksService.createTask(dto, user);
  }

  @Get('mis-tareas')
  @ApiOperation({ summary: 'Get my tasks (Vendedor)' })
  @ApiResponse({ status: 200, description: 'Return my tasks' })
  getTasks(@GetUser() user: ValidatedUser) {
    return this.tasksService.getTasksForVendedor(user);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update task status (Vendedor)' })
  @ApiParam({ name: 'id', description: 'Task ID' })
  @ApiBody({ type: UpdateTaskDto })
  updateTask(
    @Param('id') taskId: string,
    @Body(ValidationPipe) dto: UpdateTaskDto,
    @GetUser() user: ValidatedUser,
  ) {
    return this.tasksService.updateTaskStatus(taskId, dto, user);
  }
}