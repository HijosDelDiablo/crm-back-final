import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { ProveedoresService } from './proveedores.service';
import { CreateProveedorDto, UpdateProveedorDto } from './dto/proveedor.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Rol } from '../auth/enums/rol.enum';

@ApiTags('Proveedores')
@Controller('proveedores')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Rol.ADMIN)
@ApiBearerAuth()
export class ProveedoresController {
  constructor(private readonly proveedoresService: ProveedoresService) { }

  @ApiOperation({
    summary: 'Crear proveedor (Admin)',
    description: `
    Crea un nuevo proveedor en el sistema.
    
    **Proceso:**
    - Valida que el nombre y contacto sean únicos
    - Crea el registro con estado activo por defecto
    - Inicialmente sin productos asociados
    
    **Validaciones:**
    - Nombre único en el sistema
    - Email válido si se proporciona
    - Teléfono válido si se proporciona
    - Solo administradores pueden crear proveedores
    `
  })
  @ApiBody({
    type: CreateProveedorDto,
    description: 'Datos del proveedor a crear',
    examples: {
      'proveedor_nacional': {
        summary: 'Proveedor nacional',
        value: {
          nombre: "AutoNacional S.A.",
          contacto: "Juan Pérez",
          email: "contacto@autonacional.com",
          telefono: "555-0123",
          direccion: "Av. Principal 123, Ciudad",
          tipo: "Nacional"
        }
      },
      'proveedor_importador': {
        summary: 'Importador internacional',
        value: {
          nombre: "AutoImport Ltda.",
          contacto: "María García",
          email: "import@autoimport.com",
          telefono: "555-0456",
          direccion: "Zona Franca, Puerto",
          tipo: "Internacional",
          pais: "Japón"
        }
      }
    }
  })
  @ApiResponse({
    status: 201,
    description: 'Proveedor creado exitosamente',
    schema: {
      example: {
        "_id": "507f1f77bcf86cd799439012",
        "nombre": "AutoImport Ltda.",
        "contacto": "María García",
        "email": "import@autoimport.com",
        "telefono": "555-0456",
        "direccion": "Zona Franca, Puerto",
        "tipo": "Internacional",
        "pais": "Japón",
        "activo": true,
        "productos": [],
        "createdAt": "2024-01-15T19:00:00.000Z",
        "updatedAt": "2024-01-15T19:00:00.000Z"
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Datos inválidos o nombre duplicado' })
  @ApiResponse({ status: 403, description: 'No autorizado para crear proveedores' })
  @Post()
  create(@Body() createProveedorDto: CreateProveedorDto) {
    return this.proveedoresService.create(createProveedorDto);
  }

  @ApiOperation({
    summary: 'Obtener todos los proveedores (Admin)',
    description: 'Retorna la lista completa de proveedores incluyendo activos e inactivos, con información detallada para gestión administrativa.'
  })
  @ApiResponse({
    status: 200,
    description: 'Lista completa de proveedores',
    schema: {
      example: [
        {
          "_id": "507f1f77bcf86cd799439012",
          "nombre": "AutoImport Ltda.",
          "contacto": "María García",
          "email": "import@autoimport.com",
          "telefono": "555-0456",
          "direccion": "Zona Franca, Puerto",
          "tipo": "Internacional",
          "pais": "Japón",
          "activo": true,
          "productos": [
            {
              "_id": "507f1f77bcf86cd799439011",
              "marca": "Toyota",
              "modelo": "Corolla"
            }
          ],
          "createdAt": "2024-01-15T19:00:00.000Z",
          "updatedAt": "2024-01-15T19:00:00.000Z"
        },
        {
          "_id": "507f1f77bcf86cd799439013",
          "nombre": "AutoNacional S.A.",
          "contacto": "Juan Pérez",
          "email": "contacto@autonacional.com",
          "telefono": "555-0123",
          "direccion": "Av. Principal 123, Ciudad",
          "tipo": "Nacional",
          "activo": false,
          "productos": [],
          "createdAt": "2024-01-10T10:00:00.000Z",
          "updatedAt": "2024-01-12T15:30:00.000Z"
        }
      ]
    }
  })
  @ApiResponse({ status: 403, description: 'No autorizado para ver proveedores' })
  @Get()
  findAll() {
    return this.proveedoresService.findAll();
  }

  @ApiOperation({
    summary: 'Obtener proveedores activos (Admin)',
    description: 'Retorna solo los proveedores que están marcados como activos y disponibles para asignar productos.'
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de proveedores activos',
    schema: {
      example: [
        {
          "_id": "507f1f77bcf86cd799439012",
          "nombre": "AutoImport Ltda.",
          "contacto": "María García",
          "email": "import@autoimport.com",
          "telefono": "555-0456",
          "tipo": "Internacional",
          "pais": "Japón",
          "activo": true,
          "productosCount": 5
        }
      ]
    }
  })
  @ApiResponse({ status: 403, description: 'No autorizado para ver proveedores' })
  @Get('activos')
  findActive() {
    return this.proveedoresService.findActive();
  }

  @ApiOperation({
    summary: 'Obtener proveedor por ID (Admin)',
    description: 'Retorna los detalles completos de un proveedor específico incluyendo su lista de productos asociados.'
  })
  @ApiParam({ name: 'id', description: 'ID del proveedor' })
  @ApiResponse({
    status: 200,
    description: 'Detalles del proveedor',
    schema: {
      example: {
        "_id": "507f1f77bcf86cd799439012",
        "nombre": "AutoImport Ltda.",
        "contacto": "María García",
        "email": "import@autoimport.com",
        "telefono": "555-0456",
        "direccion": "Zona Franca, Puerto",
        "tipo": "Internacional",
        "pais": "Japón",
        "activo": true,
        "productos": [
          {
            "_id": "507f1f77bcf86cd799439011",
            "marca": "Toyota",
            "modelo": "Corolla",
            "ano": 2023,
            "precioBase": 28000
          },
          {
            "_id": "507f1f77bcf86cd799439013",
            "marca": "Honda",
            "modelo": "Civic",
            "ano": 2022,
            "precioBase": 22000
          }
        ],
        "createdAt": "2024-01-15T19:00:00.000Z",
        "updatedAt": "2024-01-15T19:00:00.000Z"
      }
    }
  })
  @ApiResponse({ status: 403, description: 'No autorizado para ver proveedores' })
  @ApiResponse({ status: 404, description: 'Proveedor no encontrado' })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.proveedoresService.findById(id);
  }

  @ApiOperation({
    summary: 'Actualizar proveedor (Admin)',
    description: `
    Actualiza la información de un proveedor existente.
    
    **Campos actualizables:**
    - Información de contacto (email, teléfono, dirección)
    - País y tipo
    - Estado activo/inactivo
    
    **Validaciones:**
    - Solo administradores pueden actualizar proveedores
    - El proveedor debe existir
    - Nombre no puede duplicarse si se actualiza
    - Email debe ser válido si se proporciona
    `
  })
  @ApiParam({ name: 'id', description: 'ID del proveedor a actualizar' })
  @ApiBody({
    type: UpdateProveedorDto,
    description: 'Campos a actualizar',
    examples: {
      'actualizar_contacto': {
        summary: 'Actualizar información de contacto',
        value: {
          contacto: "María García López",
          email: "maria.garcia@autoimport.com",
          telefono: "555-0456-789"
        }
      },
      'cambiar_pais': {
        summary: 'Cambiar país de origen',
        value: {
          pais: "Corea del Sur",
          tipo: "Internacional"
        }
      }
    }
  })
  @ApiResponse({
    status: 200,
    description: 'Proveedor actualizado exitosamente',
    schema: {
      example: {
        "_id": "507f1f77bcf86cd799439012",
        "nombre": "AutoImport Ltda.",
        "contacto": "María García López",
        "email": "maria.garcia@autoimport.com",
        "telefono": "555-0456-789",
        "pais": "Corea del Sur",
        "updatedAt": "2024-01-15T20:00:00.000Z"
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 403, description: 'No autorizado para actualizar proveedores' })
  @ApiResponse({ status: 404, description: 'Proveedor no encontrado' })
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateProveedorDto: UpdateProveedorDto) {
    return this.proveedoresService.update(id, updateProveedorDto);
  }

  @ApiOperation({
    summary: 'Eliminar proveedor (Admin)',
    description: `
    Elimina un proveedor del sistema.
    
    **Consideraciones importantes:**
    - Solo proveedores sin productos asociados pueden eliminarse
    - Para proveedores con productos, se recomienda desactivarlos en lugar de eliminarlos
    - La eliminación es permanente y puede afectar reportes históricos
    
    **Validaciones:**
    - Solo administradores pueden eliminar proveedores
    - El proveedor debe existir
    - No debe tener productos asociados
    `
  })
  @ApiParam({ name: 'id', description: 'ID del proveedor a eliminar' })
  @ApiResponse({
    status: 200,
    description: 'Proveedor eliminado exitosamente',
    schema: {
      example: {
        "message": "Proveedor eliminado correctamente",
        "_id": "507f1f77bcf86cd799439012"
      }
    }
  })
  @ApiResponse({ status: 400, description: 'No se puede eliminar proveedor con productos asociados' })
  @ApiResponse({ status: 403, description: 'No autorizado para eliminar proveedores' })
  @ApiResponse({ status: 404, description: 'Proveedor no encontrado' })
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.proveedoresService.remove(id);
  }

  @ApiOperation({
    summary: 'Alternar estado activo del proveedor (Admin)',
    description: `
    Cambia el estado activo/inactivo de un proveedor.
    
    **Funcionamiento:**
    - Si está activo → se desactiva
    - Si está inactivo → se activa
    
    **Implicaciones:**
    - Proveedores inactivos no aparecen en listas de proveedores activos
    - No se pueden asignar nuevos productos a proveedores inactivos
    - Los productos ya asignados permanecen asociados
    
    **Validaciones:**
    - Solo administradores pueden cambiar el estado
    - El proveedor debe existir
    `
  })
  @ApiParam({ name: 'id', description: 'ID del proveedor' })
  @ApiResponse({
    status: 200,
    description: 'Estado del proveedor actualizado',
    schema: {
      example: {
        "_id": "507f1f77bcf86cd799439012",
        "nombre": "AutoImport Ltda.",
        "activo": false,
        "updatedAt": "2024-01-15T20:30:00.000Z"
      }
    }
  })
  @ApiResponse({ status: 403, description: 'No autorizado para cambiar estado de proveedores' })
  @ApiResponse({ status: 404, description: 'Proveedor no encontrado' })
  @Patch(':id/toggle-active')
  toggleActive(@Param('id') id: string) {
    return this.proveedoresService.toggleActive(id);
  }

  @ApiOperation({
    summary: 'Agregar producto a proveedor (Admin)',
    description: `
    Asocia un producto existente a un proveedor.
    
    **Proceso:**
    - Valida que el producto y proveedor existan
    - Establece la relación proveedor-producto
    - Actualiza las referencias cruzadas
    
    **Validaciones:**
    - Solo administradores pueden gestionar relaciones proveedor-producto
    - El producto debe existir
    - El proveedor debe existir y estar activo
    - El producto no debe estar ya asociado a otro proveedor
    `
  })
  @ApiParam({ name: 'id', description: 'ID del proveedor' })
  @ApiParam({ name: 'productoId', description: 'ID del producto a agregar' })
  @ApiResponse({
    status: 201,
    description: 'Producto agregado al proveedor exitosamente',
    schema: {
      example: {
        "_id": "507f1f77bcf86cd799439012",
        "nombre": "AutoImport Ltda.",
        "productos": [
          {
            "_id": "507f1f77bcf86cd799439011",
            "marca": "Toyota",
            "modelo": "Corolla",
            "ano": 2023
          }
        ],
        "updatedAt": "2024-01-15T21:00:00.000Z"
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Producto ya asociado a este proveedor' })
  @ApiResponse({ status: 403, description: 'No autorizado para gestionar productos de proveedores' })
  @ApiResponse({ status: 404, description: 'Proveedor o producto no encontrado' })
  @Post(':id/productos/:productoId')
  addProducto(@Param('id') id: string, @Param('productoId') productoId: string) {
    return this.proveedoresService.addProducto(id, productoId);
  }

  @ApiOperation({
    summary: 'Remover producto de proveedor (Admin)',
    description: `
    Elimina la asociación entre un producto y un proveedor.
    
    **Proceso:**
    - Valida que la relación exista
    - Remueve la referencia del producto al proveedor
    - Actualiza las referencias cruzadas
    
    **Consideraciones:**
    - El producto queda sin proveedor asignado
    - Puede volver a asignarse a otro proveedor posteriormente
    - No elimina el producto, solo la relación
    
    **Validaciones:**
    - Solo administradores pueden gestionar relaciones proveedor-producto
    - La relación proveedor-producto debe existir
    `
  })
  @ApiParam({ name: 'id', description: 'ID del proveedor' })
  @ApiParam({ name: 'productoId', description: 'ID del producto a remover' })
  @ApiResponse({
    status: 200,
    description: 'Producto removido del proveedor exitosamente',
    schema: {
      example: {
        "_id": "507f1f77bcf86cd799439012",
        "nombre": "AutoImport Ltda.",
        "productos": [],
        "updatedAt": "2024-01-15T21:30:00.000Z"
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Producto no está asociado a este proveedor' })
  @ApiResponse({ status: 403, description: 'No autorizado para gestionar productos de proveedores' })
  @ApiResponse({ status: 404, description: 'Proveedor o producto no encontrado' })
  @Delete(':id/productos/:productoId')
  removeProducto(@Param('id') id: string, @Param('productoId') productoId: string) {
    return this.proveedoresService.removeProducto(id, productoId);
  }
}