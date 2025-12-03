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
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiBearerAuth,
  ApiParam,
  ApiConsumes
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { ProductService } from './product.service';
import { CreateProductDto, UpdateProductDto } from './dto/product.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Rol } from '../auth/enums/rol.enum';

@ApiTags('Products')
@Controller('products')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
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
  @ApiOperation({ summary: 'Upload product image (Admin)' })
  @ApiConsumes('multipart/form-data')
  @ApiParam({ name: 'id', description: 'Product ID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  async uploadImage(
    @Param('id') productId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const imageUrl = `/uploads/${file.filename}`;
    return this.productService.update(productId, { imageUrl });
  }

  @Get('all')
  @Roles(Rol.ADMIN, Rol.VENDEDOR, Rol.CLIENTE)
  @ApiOperation({ summary: 'Get all products (Admin)' })
  @ApiResponse({ status: 200, description: 'Return all products' })
  findAllForAdmin() {
    return this.productService.findAllForAdmin();
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Rol.ADMIN)
  @ApiOperation({ summary: 'Create product (Admin)' })
  @ApiResponse({ status: 201, description: 'Product created' })
  @ApiBody({ type: CreateProductDto })
  create(@Body() createProductDto: CreateProductDto) {
    return this.productService.create(createProductDto);
  }

  @Get('tienda')
  @ApiOperation({ summary: 'Get available products' })
  @ApiResponse({ status: 200, description: 'Return available products' })
  findAllAvailable() {
    return this.productService.findAllAvailable();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get product by ID' })
  @ApiParam({ name: 'id', description: 'Product ID' })
  @ApiResponse({ status: 200, description: 'Return product' })
  findOne(@Param('id') id: string) {
    return this.productService.findById(id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Rol.ADMIN)
  @ApiOperation({ summary: 'Update product (Admin)' })
  @ApiParam({ name: 'id', description: 'Product ID' })
  @ApiBody({ type: UpdateProductDto })
  update(@Param('id') id: string, @Body() updateProductDto: UpdateProductDto) {
    return this.productService.update(id, updateProductDto);
  }

  @Get('find-by-vin/:vin')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Find product by VIN' })
  @ApiParam({ name: 'vin', description: 'Vehicle Identification Number' })
  async findByVin(@Param('vin') vin: string) {
    return this.productService.findByVin(vin);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Rol.ADMIN)
  @ApiOperation({ summary: 'Delete product (Admin)' })
  @ApiParam({ name: 'id', description: 'Product ID' })
  remove(@Param('id') id: string) {
    return this.productService.delete(id);
  }

  @Patch(':productId/asignar-proveedor')
  @UseGuards(RolesGuard)
  @Roles(Rol.ADMIN)
  @ApiOperation({ summary: 'Assign provider to product (Admin)' })
  @ApiParam({ name: 'productId', description: 'Product ID' })
  @ApiBody({ schema: { type: 'object', properties: { proveedorId: { type: 'string' } } } })
  async asignarProveedor(
    @Param('productId') productId: string,
    @Body() body: { proveedorId: string },
  ) {
    return this.productService.asignarProveedor(productId, body.proveedorId);
  }

  @Get('por-proveedor/:proveedorId')
  @UseGuards(RolesGuard)
  @Roles(Rol.ADMIN, Rol.VENDEDOR)
  @ApiOperation({ summary: 'Get products by provider' })
  @ApiParam({ name: 'proveedorId', description: 'Provider ID' })
  async findByProveedor(@Param('proveedorId') proveedorId: string) {
    return this.productService.findByProveedor(proveedorId);
  }
}