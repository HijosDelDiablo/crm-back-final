# 🌐 APIs para Web (Cliente y Admin)

Este documento detalla los endpoints para la plataforma Web, incluyendo ejemplos de los cuerpos de petición (Body) y respuesta (Response) en formato JSON.

---

## 👤 Cliente (Web)

### 🔐 Autenticación

#### Registrarse como cliente
- **POST** `/auth/register`
- **Body:**
  ```json
  {
    "nombre": "Juan Pérez",
    "email": "juan@email.com",
    "password": "password123",
    "telefono": "5512345678"
  }
  ```
- **Response:**
  ```json
  {
    "user": {
      "_id": "6578a...",
      "nombre": "Juan Pérez",
      "email": "juan@email.com",
      "rol": "Cliente"
    },
    "token": "eyJhbGciOiJIUzI1Ni..."
  }
  ```

#### Iniciar sesión
- **POST** `/auth/login`
- **Body:**
  ```json
  {
    "email": "juan@email.com",
    "password": "password123"
  }
  ```
- **Response:**
  ```json
  {
    "user": {
      "_id": "6578a...",
      "nombre": "Juan Pérez",
      "email": "juan@email.com",
      "rol": "Cliente"
    },
    "token": "eyJhbGciOiJIUzI1Ni..."
  }
  ```

### 👤 Perfil y Documentos

#### Ver mi perfil
- **GET** `/user/profile`
- **Response:**
  ```json
  {
    "_id": "6578a...",
    "nombre": "Juan Pérez",
    "email": "juan@email.com",
    "rol": "Cliente",
    "documents": {
      "ine": { "url": "uploads/ine-123.pdf", "uploadedAt": "2023-12-01T10:00:00Z" },
      "domicilio": { "url": "uploads/dom-123.pdf", "uploadedAt": "2023-12-01T10:00:00Z" }
    }
  }
  ```

#### Subir documento (INE, Domicilio, Ingresos, Foto)
- **POST** `/user/profile/upload-ine` (o `upload-domicilio`, `upload-ingresos`, `upload-photo`)
- **Body:** `FormData` con campo `file`.
- **Response:**
  ```json
  {
    "message": "Documento subido exitosamente",
    "url": "/uploads/ine-123456789.pdf"
  }
  ```

### 🛍️ Tienda y Favoritos

#### Buscar autos
- **GET** `/products/tienda?marca=Toyota&precioMax=500000`
- **Response:**
  ```json
  [
    {
      "_id": "6591b...",
      "marca": "Toyota",
      "modelo": "Corolla",
      "ano": 2022,
      "precioBase": 450000,
      "imageUrl": "uploads/car-1.jpg",
      "disponible": true
    }
  ]
  ```

#### Ver detalle de auto
- **GET** `/products/:id`
- **Response:**
  ```json
  {
    "_id": "6591b...",
    "marca": "Toyota",
    "modelo": "Corolla",
    "ano": 2022,
    "precioBase": 450000,
    "descripcion": "Excelente estado, único dueño",
    "condicion": "Usado",
    "transmision": "Automática",
    "motor": "2.0L",
    "stock": 1
  }
  ```

#### Agregar a favoritos
- **POST** `/favorites-user/add/:productId`
- **Response:**
  ```json
  {
    "message": "Producto agregado a favoritos",
    "favorites": ["6591b...", "6592c..."]
  }
  ```

### 📝 Mis Trámites (Cotizaciones y Compras)

#### Crear cotización
- **POST** `/cotizaciones`
- **Body:**
  ```json
  {
    "cocheId": "6591b...",
    "enganche": 100000,
    "plazoMeses": 48
  }
  ```
- **Response:**
  ```json
  {
    "_id": "6593d...",
    "coche": "6591b...",
    "precioCoche": 450000,
    "enganche": 100000,
    "montoFinanciado": 350000,
    "pagoMensual": 9500.50,
    "status": "Pendiente"
  }
  ```

#### Iniciar compra (de cotización aprobada)
- **POST** `/compra`
- **Body:**
  ```json
  {
    "cotizacionId": "6593d...",
    "datosFinancieros": {
      "ingresoMensual": 25000,
      "otrosIngresos": 5000,
      "gastosMensuales": 10000,
      "deudasActuales": 2000
    }
  }
  ```
- **Response:**
  ```json
  {
    "_id": "6594e...",
    "status": "Pendiente",
    "saldoPendiente": 350000,
    "cotizacion": "6593d..."
  }
  ```

#### Ver mis compras
- **GET** `/compra/mis-compras`
- **Response:**
  ```json
  [
    {
      "_id": "6594e...",
      "status": "Aprobada",
      "cotizacion": {
        "coche": { "marca": "Toyota", "modelo": "Corolla" }
      }
    }
  ]
  ```

#### Ver detalle de compra (con pagos)
- **GET** `/compra/:id`
- **Response:**
  ```json
  {
    "_id": "6594e...",
    "status": "Aprobada",
    "saldoPendiente": 340000,
    "totalPagado": 10000,
    "cotizacion": { ... },
    "pagos": [
      {
        "_id": "6595f...",
        "monto": 10000,
        "fecha": "2023-12-15T10:00:00Z",
        "metodoPago": "Tarjeta",
        "status": "REGISTRADO"
      }
    ]
  }
  ```

### 💳 Pagos

#### Ver mis pagos
- **GET** `/pagos/mis-pagos?compraId=...&fecha=2023-12-15`
- **Response:**
  ```json
  {
    "total": 5,
    "pagos": [
      {
        "_id": "6596g...",
        "monto": 5000,
        "fecha": "2023-12-15T10:00:00Z",
        "metodoPago": "Tarjeta"
      }
    ]
  }
  ```

#### Pagar con Tarjeta
- **POST** `/pagos`
- **Body:**
  ```json
  {
    "compraId": "6594e...",
    "monto": 5000,
    "metodoPago": "Tarjeta",
    "notas": "Pago mensualidad enero"
  }
  ```
- **Response:**
  ```json
  {
    "_id": "6596g...",
    "monto": 5000,
    "status": "REGISTRADO",
    "compra": "6594e..."
  }
  ```

---

## 🛡️ Admin (Web - Panel de Control)

### 👥 Gestión de Usuarios

#### Crear vendedor
- **POST** `/auth/register/vendedor`
- **Body:**
  ```json
  {
    "nombre": "Vendedor 1",
    "email": "vendedor@crm.com",
    "password": "securePass123"
  }
  ```
- **Response:** Objeto usuario creado.

#### Asignar cliente a vendedor
- **PATCH** `/user/:idClient/set-seller-to-client/:idSeller`
- **Response:**
  ```json
  {
    "message": "Vendedor asignado correctamente",
    "client": { ... },
    "seller": { ... }
  }
  ```

### 🚗 Inventario

#### Dar de alta auto
- **POST** `/products`
- **Body:**
  ```json
  {
    "marca": "Honda",
    "modelo": "Civic",
    "ano": 2023,
    "precioBase": 520000,
    "vin": "1HG...",
    "descripcion": "Nuevo modelo",
    "condicion": "Nuevo",
    "tipo": "Sedan",
    "transmision": "CVT",
    "motor": "1.5L Turbo",
    "color": "Blanco",
    "numPuertas": 4,
    "stock": 5
  }
  ```
- **Response:** Objeto producto creado.

### 📊 Supervisión

#### Aprobar compra final
- **PATCH** `/compra/:id/aprobar`
- **Body:**
  ```json
  {
    "status": "Completada",
    "comentarios": "Entrega realizada con éxito"
  }
  ```
- **Response:** Objeto compra actualizado con `fechaEntrega`.

#### Registrar pago manual (Caja)
- **POST** `/pagos`
- **Body:**
  ```json
  {
    "compraId": "6594e...",
    "monto": 15000,
    "metodoPago": "Efectivo",
    "notas": "Pago en ventanilla"
  }
  ```
- **Response:** Objeto pago creado.
