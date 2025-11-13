import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { ProductService } from './product.service';
import { CreateProductDto, UpdateProductDto } from './dto/product.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Rol } from '../auth/enums/rol.enum';

@Controller('products')
@UseGuards(JwtAuthGuard)
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Post(':id/upload')
  @UseGuards(RolesGuard)
  @Roles(Rol.ADMIN)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads',
        filename: (req, file, callback) => {
          const uniqueSuffix =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname);
          const filename = `${file.fieldname}-${uniqueSuffix}${ext}`;
          callback(null, filename);
        },
      }),
    }),
  )
  async uploadImage(
    @Param('id') productId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const imageUrl = `/uploads/${file.filename}`;
    return this.productService.update(productId, { imageUrl });
  }

  @Get('all')
  @UseGuards(RolesGuard)
  @Roles(Rol.ADMIN)
  findAllForAdmin() {
    return this.productService.findAllForAdmin();
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Rol.ADMIN)
  create(@Body() createProductDto: CreateProductDto) {
    return this.productService.create(createProductDto);
  }

  @Get('tienda')
  findAllAvailable() {
    return this.productService.findAllAvailable();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.productService.findById(id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Rol.ADMIN)
  update(@Param('id') id: string, @Body() updateProductDto: UpdateProductDto) {
    return this.productService.update(id, updateProductDto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Rol.ADMIN)
  remove(@Param('id') id: string) {
    return this.productService.delete(id);
  }


  @Get('find-by-vin/:vin')
  @UseGuards(JwtAuthGuard)
  async findByVin(@Param('vin') vin: string) {
    return this.productService.findByVin(vin);
  }
}