# Documentación Completa de la API - Flujo del Cliente en CRM Backend

Esta documentación detalla todos los endpoints implementados para el flujo completo del cliente en el sistema CRM backend (NestJS + MongoDB). Incluye rutas, métodos, descripciones, parámetros, respuestas, ejemplos de código y consideraciones de seguridad.

## Arquitectura General
- **Framework**: NestJS con TypeScript
- **Base de Datos**: MongoDB con Mongoose
- **Autenticación**: JWT con roles (CLIENTE, ADMIN, VENDEDOR)
- **Documentación**: Swagger/OpenAPI disponible en `/api/docs`
- **Servidor**: Puerto 2002

## Flujo del Cliente Implementado
1. Ver catálogo de productos
2. Crear cotización
3. Ver mis cotizaciones
4. Ver mis compras
5. Ver historial de pagos

## Endpoints Implementados

### 1. Ver Catálogo de Productos

#### GET /products/tienda
- **Descripción**: Obtiene la lista completa de productos disponibles en la tienda para que los clientes puedan navegar el catálogo.
- **Método**: GET
- **Ruta**: `/products/tienda`
- **Parámetros**: Ninguno
- **Autenticación**: Requiere JWT válido (rol CLIENTE)
- **Respuesta Exitosa (200)**:
  ```json
  [
    {
      "_id": "string",
      "name": "string",
      "description": "string",
      "price": "number",
      "category": "string",
      "images": ["string"],
      "stock": "number",
      "isActive": "boolean"
    }
  ]
  ```
- **Código de Ejemplo (Frontend)**:
  ```javascript
  const response = await fetch('http://localhost:2002/products/tienda', {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  const products = await response.json();
  ```
- **Consideraciones de Seguridad**: Endpoint protegido con JwtAuthGuard y RolesGuard. Solo usuarios autenticados con rol CLIENTE pueden acceder.

#### GET /products/:id
- **Descripción**: Obtiene los detalles de un producto específico por su ID.
- **Método**: GET
- **Ruta**: `/products/:id`
- **Parámetros**:
  - `id` (path): ID del producto (ObjectId de MongoDB)
- **Autenticación**: Requiere JWT válido (rol CLIENTE)
- **Respuesta Exitosa (200)**:
  ```json
  {
    "_id": "string",
    "name": "string",
    "description": "string",
    "price": "number",
    "category": "string",
    "images": ["string"],
    "stock": "number",
    "isActive": "boolean",
    "createdAt": "string",
    "updatedAt": "string"
  }
  ```
- **Código de Ejemplo (Frontend)**:
  ```javascript
  const productId = '507f1f77bcf86cd799439011';
  const response = await fetch(`http://localhost:2002/products/${productId}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  const product = await response.json();
  ```
- **Consideraciones de Seguridad**: Endpoint protegido con JwtAuthGuard y RolesGuard. Solo usuarios autenticados con rol CLIENTE pueden acceder.

### 2. Crear Cotización

#### POST /cotizacion
- **Descripción**: Permite a un cliente crear una nueva cotización basada en productos seleccionados.
- **Método**: POST
- **Ruta**: `/cotizacion`
- **Parámetros**:
  - Body (JSON):
    ```json
    {
      "products": [
        {
          "productId": "string",
          "quantity": "number"
        }
      ],
      "notes": "string (opcional)"
    }
    ```
- **Autenticación**: Requiere JWT válido (rol CLIENTE)
- **Respuesta Exitosa (201)**:
  ```json
  {
    "_id": "string",
    "userId": "string",
    "products": [
      {
        "productId": {
          "_id": "string",
          "name": "string",
          "price": "number"
        },
        "quantity": "number",
        "subtotal": "number"
      }
    ],
    "total": "number",
    "status": "PENDING",
    "notes": "string",
    "createdAt": "string",
    "updatedAt": "string"
  }
  ```
- **Código de Ejemplo (Frontend)**:
  ```javascript
  const cotizacionData = {
    products: [
      { productId: '507f1f77bcf86cd799439011', quantity: 2 },
      { productId: '507f1f77bcf86cd799439012', quantity: 1 }
    ],
    notes: 'Cotización urgente'
  };

  const response = await fetch('http://localhost:2002/cotizacion', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(cotizacionData)
  });
  const cotizacion = await response.json();
  ```
- **Consideraciones de Seguridad**: Endpoint protegido con JwtAuthGuard y RolesGuard. Solo usuarios autenticados con rol CLIENTE pueden crear cotizaciones.

### 3. Ver Mis Cotizaciones

#### GET /cotizacion/mis-cotizaciones
- **Descripción**: Obtiene la lista de cotizaciones del cliente autenticado, con opción de filtrar por estado.
- **Método**: GET
- **Ruta**: `/cotizacion/mis-cotizaciones`
- **Parámetros**:
  - Query (opcional): `status` (PENDING, APPROVED, REJECTED, PURCHASED)
- **Autenticación**: Requiere JWT válido (rol CLIENTE)
- **Respuesta Exitosa (200)**:
  ```json
  [
    {
      "_id": "string",
      "userId": "string",
      "products": [
        {
          "productId": {
            "_id": "string",
            "name": "string",
            "price": "number"
          },
          "quantity": "number",
          "subtotal": "number"
        }
      ],
      "total": "number",
      "status": "PENDING",
      "notes": "string",
      "createdAt": "string",
      "updatedAt": "string"
    }
  ]
  ```
- **Código de Ejemplo (Frontend)**:
  ```javascript
  // Obtener todas las cotizaciones
  const response = await fetch('http://localhost:2002/cotizacion/mis-cotizaciones', {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  const cotizaciones = await response.json();

  // Filtrar por estado aprobado
  const responseFiltrada = await fetch('http://localhost:2002/cotizacion/mis-cotizaciones?status=APPROVED', {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  const cotizacionesAprobadas = await responseFiltrada.json();
  ```
- **Consideraciones de Seguridad**: Endpoint protegido con JwtAuthGuard y RolesGuard. Solo el propietario de las cotizaciones puede verlas.

#### GET /cotizacion/:id
- **Descripción**: Obtiene los detalles de una cotización específica por su ID, solo si pertenece al cliente autenticado.
- **Método**: GET
- **Ruta**: `/cotizacion/:id`
- **Parámetros**:
  - `id` (path): ID de la cotización (ObjectId de MongoDB)
- **Autenticación**: Requiere JWT válido (rol CLIENTE)
- **Respuesta Exitosa (200)**:
  ```json
  {
    "_id": "string",
    "userId": "string",
    "products": [
      {
        "productId": {
          "_id": "string",
          "name": "string",
          "price": "number"
        },
        "quantity": "number",
        "subtotal": "number"
      }
    ],
    "total": "number",
    "status": "PENDING",
    "notes": "string",
    "createdAt": "string",
    "updatedAt": "string"
  }
  ```
- **Código de Ejemplo (Frontend)**:
  ```javascript
  const cotizacionId = '507f1f77bcf86cd799439011';
  const response = await fetch(`http://localhost:2002/cotizacion/${cotizacionId}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  const cotizacion = await response.json();
  ```
- **Consideraciones de Seguridad**: Endpoint protegido con JwtAuthGuard y RolesGuard. Solo el propietario de la cotización puede acceder a sus detalles.

### 4. Ver Mis Compras

#### GET /compra/mis-compras
- **Descripción**: Obtiene la lista de compras realizadas por el cliente autenticado.
- **Método**: GET
- **Ruta**: `/compra/mis-compras`
- **Parámetros**: Ninguno
- **Autenticación**: Requiere JWT válido (rol CLIENTE)
- **Respuesta Exitosa (200)**:
  ```json
  [
    {
      "_id": "string",
      "userId": "string",
      "cotizacionId": {
        "_id": "string",
        "total": "number",
        "status": "string"
      },
      "total": "number",
      "status": "PENDING",
      "createdAt": "string",
      "updatedAt": "string"
    }
  ]
  ```
- **Código de Ejemplo (Frontend)**:
  ```javascript
  const response = await fetch('http://localhost:2002/compra/mis-compras', {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  const compras = await response.json();
  ```
- **Consideraciones de Seguridad**: Endpoint protegido con JwtAuthGuard y RolesGuard. Solo el propietario de las compras puede verlas.

#### GET /compra/por-cotizacion/:cotizacionId
- **Descripción**: Obtiene la compra asociada a una cotización específica, solo si la cotización pertenece al cliente autenticado.
- **Método**: GET
- **Ruta**: `/compra/por-cotizacion/:cotizacionId`
- **Parámetros**:
  - `cotizacionId` (path): ID de la cotización (ObjectId de MongoDB)
- **Autenticación**: Requiere JWT válido (rol CLIENTE)
- **Respuesta Exitosa (200)**:
  ```json
  {
    "_id": "string",
    "userId": "string",
    "cotizacionId": {
      "_id": "string",
      "total": "number",
      "status": "string"
    },
    "total": "number",
    "status": "PENDING",
    "createdAt": "string",
    "updatedAt": "string"
  }
  ```
- **Código de Ejemplo (Frontend)**:
  ```javascript
  const cotizacionId = '507f1f77bcf86cd799439011';
  const response = await fetch(`http://localhost:2002/compra/por-cotizacion/${cotizacionId}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  const compra = await response.json();
  ```
- **Consideraciones de Seguridad**: Endpoint protegido con JwtAuthGuard y RolesGuard. Solo el propietario de la cotización puede acceder a la compra asociada.

### 5. Ver Historial de Pagos

#### GET /pagos/mis-pagos
- **Descripción**: Obtiene el historial de pagos realizados por el cliente autenticado.
- **Método**: GET
- **Ruta**: `/pagos/mis-pagos`
- **Parámetros**: Ninguno
- **Autenticación**: Requiere JWT válido (rol CLIENTE)
- **Respuesta Exitosa (200)**:
  ```json
  [
    {
      "_id": "string",
      "compraId": {
        "_id": "string",
        "total": "number"
      },
      "amount": "number",
      "method": "string",
      "status": "PENDING",
      "transactionId": "string",
      "createdAt": "string",
      "updatedAt": "string"
    }
  ]
  ```
- **Código de Ejemplo (Frontend)**:
  ```javascript
  const response = await fetch('http://localhost:2002/pagos/mis-pagos', {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  const pagos = await response.json();
  ```
- **Consideraciones de Seguridad**: Endpoint protegido con JwtAuthGuard y RolesGuard. Solo el propietario de los pagos puede verlos.

#### GET /pagos/por-cotizacion/:cotizacionId
- **Descripción**: Obtiene los pagos asociados a una cotización específica, solo si la cotización pertenece al cliente autenticado.
- **Método**: GET
- **Ruta**: `/pagos/por-cotizacion/:cotizacionId`
- **Parámetros**:
  - `cotizacionId` (path): ID de la cotización (ObjectId de MongoDB)
- **Autenticación**: Requiere JWT válido (rol CLIENTE)
- **Respuesta Exitosa (200)**:
  ```json
  [
    {
      "_id": "string",
      "compraId": {
        "_id": "string",
        "total": "number"
      },
      "amount": "number",
      "method": "string",
      "status": "PENDING",
      "transactionId": "string",
      "createdAt": "string",
      "updatedAt": "string"
    }
  ]
  ```
- **Código de Ejemplo (Frontend)**:
  ```javascript
  const cotizacionId = '507f1f77bcf86cd799439011';
  const response = await fetch(`http://localhost:2002/pagos/por-cotizacion/${cotizacionId}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  const pagos = await response.json();
  ```
- **Consideraciones de Seguridad**: Endpoint protegido con JwtAuthGuard y RolesGuard. Solo el propietario de la cotización puede acceder a los pagos asociados.

## Cómo Ejecutar el Servidor
1. Instalar dependencias: `npm install`
2. Configurar variables de entorno (MongoDB URI, JWT secret, etc.)
3. Ejecutar en desarrollo: `npm run start:dev`
4. Acceder a la documentación Swagger: `http://localhost:2002/api/docs`

## Notas para Implementación Frontend
- Todos los endpoints requieren autenticación JWT en el header `Authorization: Bearer <token>`
- Manejar errores HTTP apropiadamente (401 para no autorizado, 403 para prohibido, 404 para no encontrado)
- Los IDs son ObjectIds de MongoDB (24 caracteres hexadecimales)
- Estados posibles de cotizaciones: PENDING, APPROVED, REJECTED, PURCHASED
- Estados posibles de compras: PENDING, COMPLETED, CANCELLED
- Estados posibles de pagos: PENDING, COMPLETED, FAILED, REFUNDED

Esta documentación proporciona todo lo necesario para implementar el flujo completo del cliente en el frontend.