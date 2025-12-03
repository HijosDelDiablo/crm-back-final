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
import { BadRequestException } from '@nestjs/common';
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
  constructor(private readonly productService: ProductService) { }

  @ApiOperation({
    summary: 'Subir imagen de producto (Admin)',
    description: `
    Permite subir una imagen para un producto específico.
    
    **Proceso:**
    - Valida que el producto exista
    - Guarda la imagen en el servidor
    - Actualiza la URL de imagen del producto
    
    **Validaciones:**
    - Solo administradores pueden subir imágenes
    - Formato de archivo: JPG, PNG, etc.
    - Tamaño máximo de archivo limitado por configuración del servidor
    `
  })
  @ApiConsumes('multipart/form-data')
  @ApiParam({ name: 'id', description: 'ID del producto' })
  @ApiBody({
    description: 'Archivo de imagen a subir',
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Archivo de imagen (JPG, PNG, etc.)'
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Imagen subida exitosamente',
    schema: {
      example: {
        "_id": "507f1f77bcf86cd799439011",
        "marca": "Toyota",
        "modelo": "Corolla",
        "imageUrl": "/uploads/file-1705320000000-123456789.jpg",
        "updatedAt": "2024-01-15T15:00:00.000Z"
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Archivo inválido o producto no encontrado' })
  @ApiResponse({ status: 403, description: 'No autorizado para subir imágenes' })
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

  @ApiOperation({
    summary: 'Obtener todos los productos (Admin/Vendedor/Cliente)',
    description: 'Retorna la lista completa de productos incluyendo información detallada para gestión interna.'
  })
  @ApiResponse({
    status: 200,
    description: 'Lista completa de productos',
    schema: {
      example: [
        {
          "_id": "507f1f77bcf86cd799439011",
          "marca": "Toyota",
          "modelo": "Corolla",
          "ano": 2022,
          "precioBase": 25000,
          "vin": "1HGBH41JXMN109186",
          "color": "Blanco",
          "kilometraje": 15000,
          "estado": "Disponible",
          "imageUrl": "/uploads/file-1705320000000-123456789.jpg",
          "proveedor": {
            "_id": "507f1f77bcf86cd799439012",
            "nombre": "AutoImport S.A.",
            "contacto": "contacto@autoimport.com"
          },
          "createdAt": "2024-01-15T10:00:00.000Z",
          "updatedAt": "2024-01-15T15:00:00.000Z"
        }
      ]
    }
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  @Get('all')
  @Roles(Rol.ADMIN, Rol.VENDEDOR, Rol.CLIENTE)
  findAllForAdmin() {
    return this.productService.findAllForAdmin();
  }

  @ApiOperation({
    summary: 'Crear producto (Admin)',
    description: `
    Permite crear un nuevo producto/vehículo en el inventario.
    
    **Proceso:**
    - Valida los datos del vehículo
    - Crea el registro en la base de datos con stock inicial (default 1)
    - Inicialmente sin imagen (puede subirse posteriormente)
    
    **Validaciones:**
    - VIN único en el sistema
    - Precio base positivo
    - Año válido
    - Stock debe ser >= 0 (opcional, default 1)
    - Solo administradores pueden crear productos
    `
  })
  @ApiBody({
    type: CreateProductDto,
    description: 'Datos del producto a crear',
    examples: {
      'vehiculo_nuevo': {
        summary: 'Vehículo nuevo',
        value: {
          marca: "Toyota",
          modelo: "Corolla",
          ano: 2023,
          precioBase: 28000,
          vin: "1HGBH41JXMN109186",
          color: "Rojo",
          kilometraje: 0,
          estado: "Disponible",
          descripcion: "Vehículo nuevo con garantía de fábrica",
          stock: 1
        }
      },
      'vehiculo_usado': {
        summary: 'Vehículo usado',
        value: {
          marca: "Honda",
          modelo: "Civic",
          ano: 2020,
          precioBase: 18000,
          vin: "2HGFC2F59LH123456",
          color: "Azul",
          kilometraje: 25000,
          estado: "Disponible",
          descripcion: "Excelente estado, único dueño, servicio al día",
          stock: 1
        }
      }
    }
  })
  @ApiResponse({
    status: 201,
    description: 'Producto creado exitosamente',
    schema: {
      example: {
        "_id": "507f1f77bcf86cd799439011",
        "marca": "Toyota",
        "modelo": "Corolla",
        "ano": 2023,
        "precioBase": 28000,
        "vin": "1HGBH41JXMN109186",
        "color": "Rojo",
        "kilometraje": 0,
        "estado": "Disponible",
        "descripcion": "Vehículo nuevo con garantía de fábrica",
        "createdAt": "2024-01-15T16:00:00.000Z",
        "updatedAt": "2024-01-15T16:00:00.000Z"
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Datos inválidos o VIN duplicado' })
  @ApiResponse({ status: 403, description: 'No autorizado para crear productos' })
  @Post()
  @UseGuards(RolesGuard)
  @Roles(Rol.ADMIN)
  create(@Body() createProductDto: CreateProductDto) {
    return this.productService.create(createProductDto);
  }

  @ApiOperation({
    summary: 'Obtener productos disponibles (Público)',
    description: 'Retorna la lista de productos disponibles para la venta en la tienda virtual. Accesible sin autenticación.'
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de productos disponibles',
    schema: {
      example: [
        {
          "_id": "507f1f77bcf86cd799439011",
          "marca": "Toyota",
          "modelo": "Corolla",
          "ano": 2023,
          "precioBase": 28000,
          "color": "Rojo",
          "kilometraje": 0,
          "estado": "Disponible",
          "imageUrl": "/uploads/file-1705320000000-123456789.jpg",
          "descripcion": "Vehículo nuevo con garantía de fábrica"
        },
        {
          "_id": "507f1f77bcf86cd799439013",
          "marca": "Honda",
          "modelo": "Civic",
          "ano": 2020,
          "precioBase": 18000,
          "color": "Azul",
          "kilometraje": 25000,
          "estado": "Disponible",
          "imageUrl": "/uploads/file-1705320000001-987654321.jpg",
          "descripcion": "Excelente estado, único dueño"
        }
      ]
    }
  })
  @Get('tienda')
  findAllAvailable() {
    return this.productService.findAllAvailable();
  }

  @ApiOperation({
    summary: 'Obtener producto por ID',
    description: 'Retorna los detalles completos de un producto específico por su ID.'
  })
  @ApiParam({ name: 'id', description: 'ID del producto' })
  @ApiResponse({
    status: 200,
    description: 'Detalles del producto',
    schema: {
      example: {
        "_id": "507f1f77bcf86cd799439011",
        "marca": "Toyota",
        "modelo": "Corolla",
        "ano": 2023,
        "precioBase": 28000,
        "vin": "1HGBH41JXMN109186",
        "color": "Rojo",
        "kilometraje": 0,
        "estado": "Disponible",
        "imageUrl": "/uploads/file-1705320000000-123456789.jpg",
        "descripcion": "Vehículo nuevo con garantía de fábrica",
        "proveedor": {
          "_id": "507f1f77bcf86cd799439012",
          "nombre": "AutoImport S.A.",
          "contacto": "contacto@autoimport.com"
        },
        "createdAt": "2024-01-15T16:00:00.000Z",
        "updatedAt": "2024-01-15T16:00:00.000Z"
      }
    }
  })
  @ApiResponse({ status: 404, description: 'Producto no encontrado' })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.productService.findById(id);
  }

  @ApiOperation({
    summary: 'Actualizar producto (Admin)',
    description: `
    Permite actualizar la información de un producto existente.
    
    **Campos actualizables:**
    - Precio base
    - Estado (Disponible, Vendido, Reservado, etc.)
    - Descripción
    - Información del vehículo
    
    **Validaciones:**
    - Solo administradores pueden actualizar productos
    - El producto debe existir
    - VIN no puede duplicarse si se actualiza
    `
  })
  @ApiParam({ name: 'id', description: 'ID del producto a actualizar' })
  @ApiBody({
    type: UpdateProductDto,
    description: 'Campos a actualizar',
    examples: {
      'actualizar_precio': {
        summary: 'Actualizar precio',
        value: {
          precioBase: 26500
        }
      },
      'marcar_vendido': {
        summary: 'Marcar como vendido',
        value: {
          estado: "Vendido"
        }
      }
    }
  })
  @ApiResponse({
    status: 200,
    description: 'Producto actualizado exitosamente',
    schema: {
      example: {
        "_id": "507f1f77bcf86cd799439011",
        "marca": "Toyota",
        "modelo": "Corolla",
        "ano": 2023,
        "precioBase": 26500,
        "estado": "Disponible",
        "updatedAt": "2024-01-15T17:00:00.000Z"
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 403, description: 'No autorizado para actualizar productos' })
  @ApiResponse({ status: 404, description: 'Producto no encontrado' })
  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Rol.ADMIN)
  update(@Param('id') id: string, @Body() updateProductDto: UpdateProductDto) {
    return this.productService.update(id, updateProductDto);
  }

  @ApiOperation({
    summary: 'Buscar producto por VIN',
    description: 'Busca un producto específico utilizando su número de identificación de vehículo (VIN).'
  })
  @ApiParam({
    name: 'vin',
    description: 'Número de Identificación de Vehículo (VIN)',
    example: '1HGBH41JXMN109186'
  })
  @ApiResponse({
    status: 200,
    description: 'Producto encontrado',
    schema: {
      example: {
        "_id": "507f1f77bcf86cd799439011",
        "marca": "Toyota",
        "modelo": "Corolla",
        "ano": 2023,
        "precioBase": 28000,
        "vin": "1HGBH41JXMN109186",
        "color": "Rojo",
        "kilometraje": 0,
        "estado": "Disponible",
        "imageUrl": "/uploads/file-1705320000000-123456789.jpg",
        "descripcion": "Vehículo nuevo con garantía de fábrica"
      }
    }
  })
  @ApiResponse({ status: 404, description: 'Producto no encontrado con ese VIN' })
  @Get('find-by-vin/:vin')
  @UseGuards(JwtAuthGuard)
  async findByVin(@Param('vin') vin: string) {
    return this.productService.findByVin(vin);
  }

  @ApiOperation({
    summary: 'Eliminar producto (Admin)',
    description: `
    Elimina un producto del inventario.
    
    **Consideraciones:**
    - Solo productos que no estén asociados a compras activas pueden eliminarse
    - La eliminación es permanente
    - Se recomienda marcar como "No disponible" en lugar de eliminar
    
    **Validaciones:**
    - Solo administradores pueden eliminar productos
    - El producto debe existir
    - No debe tener compras activas asociadas
    `
  })
  @ApiParam({ name: 'id', description: 'ID del producto a eliminar' })
  @ApiResponse({
    status: 200,
    description: 'Producto eliminado exitosamente',
    schema: {
      example: {
        "message": "Producto eliminado correctamente",
        "_id": "507f1f77bcf86cd799439011"
      }
    }
  })
  @ApiResponse({ status: 400, description: 'No se puede eliminar producto con compras activas' })
  @ApiResponse({ status: 403, description: 'No autorizado para eliminar productos' })
  @ApiResponse({ status: 404, description: 'Producto no encontrado' })
  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Rol.ADMIN)
  remove(@Param('id') id: string) {
    return this.productService.delete(id);
  }

  @ApiOperation({
    summary: 'Asignar proveedor a producto (Admin)',
    description: `
    Asigna un proveedor específico a un producto.
    
    **Uso típico:**
    - Vincular productos importados con sus proveedores
    - Rastrear origen de los vehículos
    - Gestionar relaciones comerciales
    
    **Validaciones:**
    - Solo administradores pueden asignar proveedores
    - El producto y proveedor deben existir
    - Un producto puede tener solo un proveedor asignado
    `
  })
  @ApiParam({ name: 'productId', description: 'ID del producto' })
  @ApiBody({
    description: 'ID del proveedor a asignar',
    schema: {
      type: 'object',
      properties: {
        proveedorId: {
          type: 'string',
          description: 'ID del proveedor',
          example: '507f1f77bcf86cd799439012'
        }
      },
      required: ['proveedorId']
    }
  })
  @ApiResponse({
    status: 200,
    description: 'Proveedor asignado exitosamente',
    schema: {
      example: {
        "_id": "507f1f77bcf86cd799439011",
        "marca": "Toyota",
        "modelo": "Corolla",
        "proveedor": {
          "_id": "507f1f77bcf86cd799439012",
          "nombre": "AutoImport S.A.",
          "contacto": "contacto@autoimport.com",
          "telefono": "555-0101"
        },
        "updatedAt": "2024-01-15T18:00:00.000Z"
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 403, description: 'No autorizado para asignar proveedores' })
  @ApiResponse({ status: 404, description: 'Producto o proveedor no encontrado' })
  @Patch(':productId/asignar-proveedor')
  @UseGuards(RolesGuard)
  @Roles(Rol.ADMIN)
  async asignarProveedor(
    @Param('productId') productId: string,
    @Body() body: { proveedorId: string },
  ) {
    return this.productService.asignarProveedor(productId, body.proveedorId);
  }

  @ApiOperation({
    summary: 'Obtener productos por proveedor (Admin/Vendedor)',
    description: 'Retorna todos los productos asociados a un proveedor específico. Útil para gestionar inventario por proveedor.'
  })
  @ApiParam({ name: 'proveedorId', description: 'ID del proveedor' })
  @ApiResponse({
    status: 200,
    description: 'Lista de productos del proveedor',
    schema: {
      example: [
        {
          "_id": "507f1f77bcf86cd799439011",
          "marca": "Toyota",
          "modelo": "Corolla",
          "ano": 2023,
          "precioBase": 28000,
          "vin": "1HGBH41JXMN109186",
          "estado": "Disponible",
          "proveedor": {
            "_id": "507f1f77bcf86cd799439012",
            "nombre": "AutoImport S.A."
          }
        },
        {
          "_id": "507f1f77bcf86cd799439013",
          "marca": "Honda",
          "modelo": "Civic",
          "ano": 2022,
          "precioBase": 22000,
          "vin": "2HGFC2F59LH123456",
          "estado": "Disponible",
          "proveedor": {
            "_id": "507f1f77bcf86cd799439012",
            "nombre": "AutoImport S.A."
          }
        }
      ]
    }
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  @ApiResponse({ status: 403, description: 'Rol insuficiente' })
  @ApiResponse({ status: 404, description: 'Proveedor no encontrado' })
  @Get('por-proveedor/:proveedorId')
  @UseGuards(RolesGuard)
  @Roles(Rol.ADMIN, Rol.VENDEDOR)
  async findByProveedor(@Param('proveedorId') proveedorId: string) {
    return this.productService.findByProveedor(proveedorId);
  }

  @ApiOperation({
    summary: 'Incrementar stock de producto (Admin/Vendedor)',
    description: `
    Permite agregar unidades al stock de un producto existente.
    
    **Proceso:**
    - Valida que el producto exista
    - Incrementa el stock en la cantidad especificada
    - Actualiza automáticamente el campo 'disponible' si el stock > 0
    
    **Validaciones:**
    - Cantidad debe ser positiva
    - Solo administradores o vendedores pueden modificar stock
    `
  })
  @ApiParam({ name: 'id', description: 'ID del producto' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        quantity: {
          type: 'number',
          minimum: 1,
          description: 'Cantidad a agregar al stock'
        }
      },
      required: ['quantity']
    },
    examples: {
      'incremento_basico': {
        summary: 'Incremento básico',
        value: { quantity: 5 }
      }
    }
  })
  @ApiResponse({
    status: 200,
    description: 'Stock incrementado exitosamente',
    schema: {
      example: {
        "_id": "507f1f77bcf86cd799439011",
        "marca": "Toyota",
        "modelo": "Corolla",
        "stock": 6,
        "disponible": true,
        "updatedAt": "2024-01-15T16:00:00.000Z"
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Cantidad inválida' })
  @ApiResponse({ status: 403, description: 'No autorizado para modificar stock' })
  @ApiResponse({ status: 404, description: 'Producto no encontrado' })
  @Patch(':id/increment-stock')
  @UseGuards(RolesGuard)
  @Roles(Rol.ADMIN, Rol.VENDEDOR)
  async incrementStock(
    @Param('id') id: string,
    @Body() body: { quantity: number },
  ) {
    if (!body.quantity || body.quantity <= 0) {
      throw new BadRequestException('La cantidad debe ser un número positivo');
    }
    return this.productService.incrementStock(id, body.quantity);
  }
}