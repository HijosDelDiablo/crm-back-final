# Guía de Implementación de APIs

Este documento detalla los endpoints disponibles en el backend, organizados por el rol que los consume (Cliente vs. Admin/Vendedor), incluyendo ejemplos de respuesta JSON para facilitar la integración.

---

## 📱 Implementación Lado Cliente

Estas APIs son consumidas por la aplicación móvil o portal web del cliente final.

### 🔐 Autenticación

#### Registrar nuevo usuario cliente
- **POST** `/auth/register`
- **Body:**
  ```json
  {
    "email": "cliente@email.com",
    "password": "password123",
    "nombre": "Juan Pérez",
    "telefono": "555-0000"
  }
  ```
- **Response:**
  ```json
  {
    "_id": "6578f...",
    "email": "cliente@email.com",
    "nombre": "Juan Pérez",
    "rol": "CLIENTE",
    "activo": true,
    "createdAt": "2023-12-12T10:00:00.000Z"
  }
  ```

#### Iniciar sesión
- **POST** `/auth/login`
- **Body:**
  ```json
  {
    "email": "cliente@email.com",
    "password": "password123"
  }
  ```
- **Response:**
  ```json
  {
    "user": {
      "_id": "6578f...",
      "email": "cliente@email.com",
      "nombre": "Juan Pérez",
      "rol": "CLIENTE"
    },
    "access_token": "eyJhbGciOiJIUzI1Ni..."
  }
  ```

#### Iniciar sesión con Google
- **GET** `/auth/google`
- **Response:** Redirecciona al flujo de OAuth de Google.

---

### 👤 Perfil de Usuario

#### Obtener perfil propio
- **GET** `/user/profile`
- **Response:**
  ```json
  {
    "_id": "6578f...",
    "nombre": "Juan Pérez",
    "email": "cliente@email.com",
    "telefono": "555-0000",
    "rol": "CLIENTE",
    "documents": {
      "ine": { "url": "/uploads/...", "uploadedAt": "..." },
      "domicilio": { "url": "/uploads/...", "uploadedAt": "..." }
    }
  }
  ```

#### Actualizar perfil
- **PATCH** `/user/profile`
- **Body:** `{ "nombre": "Juan P.", "telefono": "555-1111" }`
- **Response:** Objeto de usuario actualizado (similar a GET profile).

#### Ver estado de documentos
- **GET** `/user/documents/status`
- **Response:**
  ```json
  {
    "ine": { "url": "...", "uploadedAt": "...", "status": "actual" },
    "domicilio": { "url": "...", "uploadedAt": "...", "status": "pasado" }
  }
  ```

#### Subir documentos (Multipart/Form-Data)
- **POST** `/user/profile/upload-photo` (Campo: `file`)
- **POST** `/user/profile/upload-ine` (Campo: `file`)
- **POST** `/user/profile/upload-domicilio` (Campo: `file`)
- **POST** `/user/profile/upload-ingresos` (Campo: `file`)
- **Response:** Objeto de usuario actualizado.

#### Ver vendedores con reseñas
- **GET** `/user/complete-info-seller`
- **Response:**
  ```json
  [
    {
      "_id": "6579a...",
      "nombre": "Vendedor 1",
      "email": "vendedor@crm.com",
      "totalReviews": 15,
      "averageStars": 4.5
    }
  ]
  ```

---

### 🛍️ Tienda y Productos

#### Listar productos disponibles
- **GET** `/products/tienda`
- **Query Params:** `?marca=Toyota&modelo=Corolla&ano=2023&minPrecio=10000&maxPrecio=50000`
- **Response:**
  ```json
  [
    {
      "_id": "6571b...",
      "marca": "Toyota",
      "modelo": "Corolla",
      "ano": 2023,
      "precioBase": 350000,
      "imageUrl": "/uploads/car.jpg",
      "disponible": true
    }
  ]
  ```

#### Ver detalle de producto
- **GET** `/products/:id`
- **Response:**
  ```json
  {
    "_id": "6571b...",
    "marca": "Toyota",
    "modelo": "Corolla",
    "ano": 2023,
    "precioBase": 350000,
    "descripcion": "Auto nuevo...",
    "vin": "123ABC...",
    "imageUrl": "/uploads/car.jpg",
    "stock": 1
  }
  ```

#### Favoritos
- **POST** `/favorites-user/add/:productId` -> Response: `{ "message": "Added" }`
- **DELETE** `/favorites-user/remove/:productId` -> Response: `{ "message": "Removed" }`
- **GET** `/favorites-user`
  - **Response:**
    ```json
    [
      {
        "_id": "6571b...",
        "marca": "Toyota",
        "modelo": "Corolla",
        "imageUrl": "..."
      }
    ]
    ```

---

### 📄 Cotizaciones

#### Generar cotización
- **POST** `/cotizaciones`
- **Body:**
  ```json
  {
    "cocheId": "6571b...",
    "enganche": 50000,
    "plazoMeses": 48
  }
  ```
- **Response:**
  ```json
  {
    "_id": "6580c...",
    "cliente": "6578f...",
    "coche": "6571b...",
    "precioCoche": 350000,
    "enganche": 50000,
    "plazoMeses": 48,
    "pagoMensual": 8500.50,
    "totalPagado": 458024.00,
    "status": "Pendiente"
  }
  ```

#### Ver historial de cotizaciones
- **GET** `/cotizaciones/mis-cotizaciones`
- **Response:** Array de objetos cotización (como arriba).

#### Ver cotizaciones aprobadas
- **GET** `/cotizaciones/aprobadas-cliente`
- **Response:** Array de cotizaciones con `status: "Aprobada"`.

#### Ver detalle de cotización
- **GET** `/cotizaciones/:id`
- **Response:** Objeto cotización con `cliente` y `coche` poblados.

---

### 🛒 Compras y Pagos

#### Iniciar proceso de compra
- **POST** `/compra`
- **Body:** `{ "cotizacionId": "6580c..." }`
- **Response:**
  ```json
  {
    "_id": "6591d...",
    "cotizacion": "6580c...",
    "cliente": "6578f...",
    "status": "Pendiente",
    "saldoPendiente": 408024.00
  }
  ```

#### Ver historial de compras
- **GET** `/compra/mis-compras`
- **Response:** Array de objetos compra.

#### Ver compra por cotización
- **GET** `/compra/:cotizacionId`
- **Response:** Objeto compra asociado a la cotización.

#### Registrar pago (Cliente - Solo Tarjeta)
- **POST** `/pagos`
- **Body:**
  ```json
  {
    "compraId": "6591d...",
    "monto": 8500.50,
    "metodoPago": "Tarjeta",
    "notas": "Pago mensualidad 1"
  }
  ```
- **Response:**
  ```json
  {
    "message": "Pago registrado correctamente",
    "pago": { ... }
  }
  ```

#### Ver historial de pagos
- **GET** `/pagos/mis-pagos`
- **Response:**
  ```json
  {
    "total": 5,
    "pagos": [
      {
        "_id": "65a2e...",
        "monto": 8500.50,
        "fecha": "2024-01-01T...",
        "metodoPago": "Transferencia",
        "compra": { ... }
      }
    ]
  }
  ```

#### Ver pagos por compra
- **GET** `/pagos/por-compra/:compraId`
- **Response:**
  ```json
  {
    "message": "Historial de pagos obtenido correctamente",
    "pagos": [ ... ]
  }
  ```

---

### ⭐ Reseñas y Otros

#### Crear reseña
- **POST** `/seller-review`
- **Body:**
  ```json
  {
    "vendedorId": "6579a...",
    "mensaje": "Excelente atención",
    "puntuacion": 5
  }
  ```
- **Response:** Objeto reseña creado.

#### Ver reseñas de vendedor
- **GET** `/seller-review/vendedor/:id`
- **Response:** Array de reseñas.

#### Consultar IA
- **POST** `/iamodel/query`
- **Body:** `{ "prompt": "¿Qué auto me recomiendas por 300k?" }`
- **Response:** `{ "response": "Te recomiendo el Toyota Corolla..." }`

---

## 💻 Implementación Lado Admin / Vendedor

Estas APIs son consumidas por el panel de administración.

### 👥 Gestión de Usuarios

#### Listar usuarios
- **GET** `/user/all` (Admin)
- **GET** `/user/clients` (Admin/Vendedor)
- **GET** `/user/vendedores` (Admin)
- **Response:** Array de usuarios.

#### Asignar vendedor a cliente
- **PATCH** `/user/:idClient/set-seller-to-client/:idSeller`
- **Response:** Usuario cliente actualizado con `vendedorQueAtiende`.

#### Ver detalle de cliente
- **GET** `/user/client/:id`
- **Response:** Usuario completo incluyendo objeto `documents`.

### 📊 Dashboard (Admin)

#### Reportes
- **GET** `/dashboard/reporte-ventas`
- **GET** `/dashboard/top-productos`
- **GET** `/dashboard/top-vendedores`
- **Response:** Estructuras de datos agregados para gráficas.

### 📝 Gestión de Cotizaciones

#### Listar cotizaciones
- **GET** `/cotizaciones/all`
- **GET** `/cotizaciones/pendientes`
- **GET** `/cotizaciones/aprobadas`
- **Response:** Array de cotizaciones pobladas con cliente y coche.

#### Crear cotización (Vendedor)
- **POST** `/cotizaciones/vendedor-create`
- **Body:**
  ```json
  {
    "clienteId": "...",
    "cocheId": "...",
    "enganche": 50000,
    "plazoMeses": 48
  }
  ```

#### Actualizar estado
- **PATCH** `/cotizaciones/:id/status`
- **Body:** `{ "status": "Aprobada" }` (o "Rechazada")

#### Asignar vendedor
- **PATCH** `/cotizaciones/:id/assign-vendedor`
- **Body:** `{ "vendedorId": "..." }`

### 🤝 Gestión de Compras

#### Listar compras
- **GET** `/compra/all` (Admin/Vendedor)
- **GET** `/compra/pendientes`
- **GET** `/compra/en-revision`
- **GET** `/compra/aprobadas`
- **Response:** Array de compras.

#### Ver detalle de compra
- **GET** `/compra/:id`
- **Response:** Objeto compra completo (incluye historial de pagos en el campo `pagos`).

#### Evaluar/Aprobar
- **PATCH** `/compra/:id/evaluar`
- **PATCH** `/compra/:id/aprobar`
- **Body (Aprobar):** `{ "notasAprobacion": "Todo correcto" }`

### 💰 Pagos

#### Registrar pago
- **POST** `/pagos`
- **Body:**
  ```json
  {
    "compraId": "6591d...",
    "monto": 8500.50,
    "metodoPago": "Efectivo",
    "notas": "Pago mensualidad 1"
  }
  ```
- **Response:**
  ```json
  {
    "message": "Pago registrado correctamente",
    "pago": { ... }
  }
  ```

#### Ver pagos de una compra
- **GET** `/pagos/por-compra/:compraId`
- **Response:** `{ "pagos": [...] }`

### 🚗 Inventario (Productos)

#### Crear producto
- **POST** `/products`
- **Body:**
  ```json
  {
    "marca": "Ford",
    "modelo": "Fiesta",
    "ano": 2022,
    "precioBase": 250000,
    "vin": "...",
    "descripcion": "...",
    "condicion": "Usado",
    "tipo": "Sedan",
    "transmision": "Manual",
    "motor": "1.6L",
    "color": "Azul"
  }
  ```

#### Subir imagen
- **POST** `/products/:id/upload` (Multipart `file`)

### 💸 Gastos

#### Registrar gasto
- **POST** `/gastos`
- **Body:**
  ```json
  {
    "concepto": "Luz oficina",
    "monto": 500,
    "categoria": "Servicios",
    "fechaGasto": "2024-01-15"
  }
  ```

#### Listar gastos
- **GET** `/gastos`
- **GET** `/gastos/total`
