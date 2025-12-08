# Guía de Implementación de APIs

Este documento detalla los endpoints disponibles en el backend, organizados por el rol que los consume (Cliente vs. Admin/Vendedor).

## 📱 Implementación Lado Cliente

Estas APIs son consumidas por la aplicación móvil o portal web del cliente final.

### Autenticación
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/auth/register` | Registrar nuevo usuario cliente |
| POST | `/auth/login` | Iniciar sesión (retorna JWT) |
| GET | `/auth/google` | Iniciar sesión con Google |

### Perfil de Usuario
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/user/profile` | Obtener datos del perfil propio |
| PATCH | `/user/profile` | Actualizar datos del perfil |
| GET | `/user/documents/status` | Ver estado de documentos subidos |
| POST | `/user/profile/upload-photo` | Subir foto de perfil |
| POST | `/user/profile/upload-ine` | Subir documento INE |
| POST | `/user/profile/upload-domicilio` | Subir comprobante de domicilio |
| POST | `/user/profile/upload-ingresos` | Subir comprobante de ingresos |
| GET | `/user/complete-info-seller` | Ver lista de vendedores con reseñas |

### Tienda y Productos
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/products/tienda` | Listar productos disponibles (Filtros: marca, modelo, ano, precio) |
| GET | `/products/:id` | Ver detalle de un producto |
| POST | `/favorites-user/add/:productId` | Agregar producto a favoritos |
| DELETE | `/favorites-user/remove/:productId` | Eliminar producto de favoritos |
| GET | `/favorites-user` | Ver lista de favoritos |

### Cotizaciones
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/cotizaciones` | Generar nueva cotización |
| GET | `/cotizaciones/mis-cotizaciones` | Ver historial de cotizaciones |
| GET | `/cotizaciones/aprobadas-cliente` | Ver solo cotizaciones aprobadas |
| GET | `/cotizaciones/:id` | Ver detalle de una cotización |

### Compras y Pagos
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/compra` | Iniciar proceso de compra (desde cotización aprobada) |
| GET | `/compra/mis-compras` | Ver historial de compras |
| GET | `/compra/:cotizacionId` | Ver compra asociada a una cotización |
| GET | `/pagos/mis-pagos` | Ver historial completo de pagos realizados |
| GET | `/pagos/por-compra/:compraId` | Ver pagos de una compra específica |

### Reseñas y Otros
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/seller-review` | Crear reseña para un vendedor |
| GET | `/seller-review/vendedor/:id` | Ver reseñas de un vendedor |
| GET | `/proveedores/list` | Ver lista pública de proveedores |
| POST | `/iamodel/query` | Consultar al asistente IA |

---

## 💻 Implementación Lado Admin / Vendedor

Estas APIs son consumidas por el panel de administración y gestión.

### Autenticación y Gestión de Usuarios
| Rol | Método | Endpoint | Descripción |
|-----|--------|----------|-------------|
| Ambos | POST | `/auth/login` | Iniciar sesión |
| Admin | POST | `/auth/register/vendedor` | Registrar nuevo vendedor |
| Admin | GET | `/user/all` | Listar todos los usuarios |
| Admin | GET | `/user/vendedores` | Listar vendedores |
| Admin | GET | `/user/vendedores-with-num-clients` | Vendedores con conteo de clientes |
| Admin | PATCH | `/user/:id/role` | Cambiar rol de usuario |
| Admin | PATCH | `/user/admin/:id/activate` | Activar usuario |
| Admin | PATCH | `/user/admin/:id/deactivate` | Desactivar usuario |
| Admin | PATCH | `/user/:idClient/set-seller-to-client/:idSeller` | Asignar vendedor a cliente |
| Ambos | GET | `/user/clients` | Listar clientes |
| Ambos | GET | `/user/clients-of-seller/:sellerId` | Listar clientes de un vendedor |
| Ambos | GET | `/user/client/:id` | Ver detalle completo de cliente (incluye docs) |
| Vend | PATCH | `/user/my-player-id` | Actualizar ID de OneSignal |

### Dashboard (Admin)
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/dashboard/reporte-ventas` | Reporte general de ventas |
| GET | `/dashboard/top-productos` | Productos más vendidos |
| GET | `/dashboard/top-vendedores` | Vendedores con más ventas |
| GET | `/dashboard/ventas-periodo` | Ventas por periodo de tiempo |

### Gestión de Cotizaciones
| Rol | Método | Endpoint | Descripción |
|-----|--------|----------|-------------|
| Ambos | GET | `/cotizaciones/all` | Ver todas las cotizaciones |
| Ambos | GET | `/cotizaciones/pendientes` | Ver cotizaciones pendientes |
| Ambos | GET | `/cotizaciones/aprobadas` | Ver cotizaciones aprobadas |
| Ambos | GET | `/cotizaciones/:id` | Ver detalle de cotización |
| Vend | POST | `/cotizaciones/vendedor-create` | Crear cotización para un cliente |
| Ambos | PATCH | `/cotizaciones/:id/status` | Aprobar/Rechazar cotización |
| Ambos | PATCH | `/cotizaciones/:id/notas` | Agregar notas internas |
| Admin | PATCH | `/cotizaciones/:id/assign-vendedor` | Asignar vendedor a cotización |

### Gestión de Compras y Pagos
| Rol | Método | Endpoint | Descripción |
|-----|--------|----------|-------------|
| Ambos | GET | `/compra/all` | Ver todas las compras |
| Ambos | GET | `/compra/pendientes` | Ver compras pendientes de revisión |
| Ambos | GET | `/compra/en-revision` | Ver compras en revisión |
| Ambos | GET | `/compra/aprobadas` | Ver compras finalizadas |
| Ambos | GET | `/compra/:id` | Ver detalle de una compra |
| Ambos | POST | `/pagos` | Registrar nuevo pago |
| Ambos | GET | `/pagos/por-compra/:compraId` | Ver historial de pagos de una compra |

### Gestión de Inventario (Productos)
| Rol | Método | Endpoint | Descripción |
|-----|--------|----------|-------------|
| Admin | POST | `/products` | Crear nuevo vehículo |
| Admin | POST | `/products/:id/upload` | Subir imagen de vehículo |
| Ambos | GET | `/products/all` | Ver inventario completo (vista admin) |
| Ambos | GET | `/products/:id` | Ver detalle de vehículo |

### Gestión de Gastos
| Rol | Método | Endpoint | Descripción |
|-----|--------|----------|-------------|
| Ambos | POST | `/gastos` | Registrar gasto |
| Ambos | GET | `/gastos` | Listar gastos |
| Ambos | GET | `/gastos/rango-fechas` | Filtrar gastos por fecha |
| Ambos | GET | `/gastos/categoria/:categoria` | Filtrar gastos por categoría |
| Ambos | GET | `/gastos/total` | Ver total de gastos |

### Proveedores y Reseñas
| Rol | Método | Endpoint | Descripción |
|-----|--------|----------|-------------|
| Admin | POST | `/proveedores` | Registrar proveedor |
| Admin | GET | `/proveedores` | Listar proveedores (interno) |
| Ambos | GET | `/seller-review` | Ver todas las reseñas |
| Ambos | GET | `/seller-review/vendedor/:id` | Ver reseñas de un vendedor específico |
