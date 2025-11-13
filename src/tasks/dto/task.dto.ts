import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsDateString,
  IsBoolean,
  IsMongoId,
} from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';

export class CreateTaskDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsDateString()
  @IsNotEmpty()
  dueDate: Date;

  @IsMongoId()
  @IsOptional()
  clienteId?: string;
}

export class UpdateTaskDto {
  @IsBoolean()
  @IsNotEmpty()
  isCompleted: boolean;
}