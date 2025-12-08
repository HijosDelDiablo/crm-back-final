# 📱 APIs para Vendedor (App/Móvil)

Este documento detalla los endpoints optimizados para el flujo de trabajo del **Vendedor**, incluyendo ejemplos de los cuerpos de petición (Body) y respuesta (Response) en formato JSON.

---

### 🏠 Inicio y Perfil

#### Iniciar sesión
- **POST** `/auth/login`
- **Body:**
  ```json
  {
    "email": "vendedor@crm.com",
    "password": "password123"
  }
  ```
- **Response:**
  ```json
  {
    "user": {
      "_id": "6578a...",
      "nombre": "Vendedor 1",
      "email": "vendedor@crm.com",
      "rol": "Vendedor"
    },
    "token": "eyJhbGciOiJIUzI1Ni..."
  }
  ```

#### Ver mi perfil
- **GET** `/user/profile`
- **Response:**
  ```json
  {
    "_id": "6578a...",
    "nombre": "Vendedor 1",
    "email": "vendedor@crm.com",
    "rol": "Vendedor"
  }
  ```

#### Registrar dispositivo (Notificaciones)
- **PATCH** `/user/my-player-id`
- **Body:**
  ```json
  {
    "playerId": "one-signal-player-id-123"
  }
  ```
- **Response:**
  ```json
  {
    "message": "Player ID actualizado"
  }
  ```

### 👥 Mis Clientes

#### Ver mi cartera de clientes
- **GET** `/user/clients-of-seller/:sellerId`
- **Response:**
  ```json
  [
    {
      "_id": "6578b...",
      "nombre": "Cliente Asignado 1",
      "email": "cliente1@email.com",
      "telefono": "5512345678"
    }
  ]
  ```

#### Ver ficha técnica del cliente
- **GET** `/user/client/:id`
- **Response:**
  ```json
  {
    "_id": "6578b...",
    "nombre": "Cliente Asignado 1",
    "documents": {
      "ine": { "url": "...", "uploadedAt": "..." }
    }
  }
  ```

### 📝 Gestión de Cotizaciones

#### Crear cotización rápida
- **POST** `/cotizaciones/vendedor-create`
- **Body:**
  ```json
  {
    "clienteId": "6578b...",
    "cocheId": "6591b...",
    "enganche": 50000,
    "plazoMeses": 60
  }
  ```
- **Response:**
  ```json
  {
    "_id": "6593d...",
    "cliente": "6578b...",
    "coche": "6591b...",
    "montoFinanciado": 400000,
    "pagoMensual": 8500.00,
    "status": "Pendiente"
  }
  ```

#### Ver cotizaciones pendientes
- **GET** `/cotizaciones/pendientes`
- **Response:** Array de cotizaciones.

#### Aprobar/Rechazar cotización
- **PATCH** `/cotizaciones/:id/status`
- **Body:**
  ```json
  {
    "status": "Aprobada"
  }
  ```
- **Response:** Cotización actualizada.

### 🤝 Gestión de Ventas (Compras)

#### Inbox: Nuevas solicitudes
- **GET** `/compra/pendientes`
- **Response:**
  ```json
  [
    {
      "_id": "6594e...",
      "cliente": { "nombre": "Juan Pérez" },
      "cotizacion": { "coche": { "modelo": "Civic" } },
      "status": "Pendiente",
      "createdAt": "2023-12-15T09:00:00Z"
    }
  ]
  ```

#### Ver detalle de venta (con historial de pagos)
- **GET** `/compra/:id`
- **Response:**
  ```json
  {
    "_id": "6594e...",
    "status": "En revisión",
    "datosFinancieros": { ... },
    "resultadoBuro": { "score": 720, "nivelRiesgo": "Bajo" },
    "pagos": [
      {
        "_id": "6595f...",
        "monto": 5000,
        "fecha": "2023-12-15T10:00:00Z",
        "metodoPago": "Efectivo"
      }
    ]
  }
  ```

#### Iniciar trámite (Evaluar)
- **PATCH** `/compra/:id/evaluar`
- **Response:** Compra pasa a estado "En revisión".

#### Aprobar venta final
- **PATCH** `/compra/:id/aprobar`
- **Body:**
  ```json
  {
    "status": "Completada",
    "comentarios": "Entrega programada para mañana"
  }
  ```
- **Response:** Compra completada.

### 💰 Cobranza

#### Registrar pago (Efectivo/Transferencia)
- **POST** `/pagos`
- **Body:**
  ```json
  {
    "compraId": "6594e...",
    "monto": 2500,
    "metodoPago": "Efectivo",
    "notas": "Abono parcial"
  }
  ```
- **Response:**
  ```json
  {
    "_id": "6597h...",
    "monto": 2500,
    "status": "REGISTRADO"
  }
  ```

### 📉 Mis Gastos

#### Registrar gasto
- **POST** `/gastos`
- **Body:**
  ```json
  {
    "monto": 500,
    "descripcion": "Gasolina visita cliente",→→→
    "categoria": "Viáticos"
  }
  ```
- **Response:**
  ```json
  {
    "_id": "6598i...",
    "monto": 500,
    "descripcion": "Gasolina visita cliente",
    "fecha": "2023-12-15T12:00:00Z"
  }
  ```
