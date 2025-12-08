# 📋 **API Completa - SmartAssistant CRM Backend**

## 🔐 **Autenticación y Autorización**

### **POST** `/auth/register`
**Descripción:** Registrar nuevo usuario (Cliente por defecto)

**Headers:**
```
Content-Type: application/json
```

**Body:**
```json
{
  "nombre": "Juan Pérez",
  "email": "juan@email.com",
  "password": "password123",
  "telefono": "+52551234567" // opcional
}
```

**Response (201):**
```json
{
  "message": "Usuario registrado exitosamente",
  "user": {
    "_id": "507f1f77bcf86cd799439011",
    "nombre": "Juan Pérez",
    "email": "juan@email.com",
    "telefono": "+52551234567", // opcional
    "rol": "CLIENTE",
    "activo": true
  }
}
```

### **POST** `/auth/login`
**Descripción:** Login con credenciales

**Body:**
```json
{
  "email": "juan@email.com",
  "password": "password123"
}
```

**Response (200):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "_id": "507f1f77bcf86cd799439011",
    "nombre": "Juan Pérez",
    "email": "juan@email.com",
    "rol": "CLIENTE"
  }
}
```

### **GET** `/auth/google`
**Descripción:** Iniciar login con Google

### **GET** `/auth/google/callback`
**Descripción:** Callback de Google login

### **GET** `/auth/profile`
**Headers:**
```
Authorization: Bearer <access_token>
```

**Response (200):**
```json
{
  "_id": "507f1f77bcf86cd799439011",
  "nombre": "Juan Pérez",
  "email": "juan@email.com",
  "telefono": "+52551234567",
  "rol": "CLIENTE",
  "activo": true,
  "twoFactorEnabled": false
}
```

### **POST** `/auth/2fa/generate`
**Headers:**
```
Authorization: Bearer <access_token>
```

**Response (200):**
```json
{
  "secret": "JBSWY3DPEHPK3PXP",
  "qrCodeUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..."
}
```

### **POST** `/auth/2fa/turn-on`
**Headers:**
```
Authorization: Bearer <access_token>
```

**Body:**
```json
{
  "code": "123456"
}
```

### **POST** `/auth/forgot-password`
**Body:**
```json
{
  "email": "juan@email.com"
}
```

### **POST** `/auth/reset-password`
**Body:**
```json
{
  "token": "reset-token-here",
  "newPassword": "newpassword123"
}
```

### **PATCH** `/auth/admin/assign-role/{userId}`
**Headers:**
```
Authorization: Bearer <access_token> (Admin only)
```

**Body:**
```json
{
  "rol": "VENDEDOR"
}
```

### **DELETE** `/auth/admin/delete-user/{userId}`
**Headers:**
```
Authorization: Bearer <access_token> (Admin only)
```

---

## 👥 **Gestión de Usuarios**

### **GET** `/user/all`
**Headers:**
```
Authorization: Bearer <access_token> (Admin only)
```

**Response (200):**
```json
[
  {
    "_id": "507f1f77bcf86cd799439011",
    "nombre": "Juan Pérez",
    "email": "juan@email.com",
    "rol": "CLIENTE",
    "activo": true,
    "vendedorAsignado": "507f1f77bcf86cd799439012"
  }
]
```

### **GET** `/user/clients`
**Headers:**
```
Authorization: Bearer <access_token> (Admin/Vendedor)
```

### **GET** `/user/vendedores`
**Headers:**
```
Authorization: Bearer <access_token> (Admin only)
```

### **GET** `/user/vendedores-with-num-clients`
**Headers:**
```
Authorization: Bearer <access_token> (Admin only)
```

### **PATCH** `/user/{clientId}/set-seller-to-client/{sellerId}`
**Headers:**
```
Authorization: Bearer <access_token> (Admin only)
```

### **PATCH** `/user/{userId}/role`
**Headers:**
```
Authorization: Bearer <access_token> (Admin only)
```

**Body:**
```json
{
  "rol": "VENDEDOR"
}
```

### **PATCH** `/user/admin/{userId}/activate`
**Headers:**
```
Authorization: Bearer <access_token> (Admin only)
```

### **PATCH** `/user/admin/{userId}/deactivate`
**Headers:**
```
Authorization: Bearer <access_token> (Admin only)
```

### **GET** `/user/profile`
**Headers:**
```
Authorization: Bearer <access_token>
```

**Response (200):**
```json
{
  "_id": "507f1f77bcf86cd799439011",
  "nombre": "Juan Pérez",
  "email": "juan@email.com",
  "telefono": "+52551234567",
  "rol": "CLIENTE",
  "activo": true,
  "fotoPerfil": "/uploads/profile-123456.jpg",
  "documents": {
    "ine": {
      "url": "/uploads/documents/ine-123456.pdf",
      "uploadedAt": "2024-01-15T10:00:00.000Z",
      "status": "actual"
    },
    "domicilio": {
      "url": "/uploads/documents/domicilio-123456.pdf",
      "uploadedAt": "2024-01-15T10:00:00.000Z",
      "status": "actual"
    },
    "ingresos": {
      "url": "/uploads/documents/ingresos-123456.pdf",
      "uploadedAt": "2024-01-15T10:00:00.000Z",
      "status": "actual"
    }
  }
}
```

### **GET** `/user/documents/status`
**Headers:**
```
Authorization: Bearer <access_token>
```

**Response (200):**
```json
{
  "ine": {
    "uploaded": true,
    "status": "actual",
    "uploadedAt": "2024-01-15T10:00:00.000Z",
    "url": "https://uploadthing.com/..."
  },
  "ingresos": {
    "uploaded": false,
    "status": null,
    "uploadedAt": null,
    "url": null
  },
  "domicilio": {
    "uploaded": true,
    "status": "pasado",
    "uploadedAt": "2024-01-15T10:00:00.000Z",
    "url": "https://uploadthing.com/..."
  }
}
```

### **PATCH** `/user/profile`
**Headers:**
```
Authorization: Bearer <access_token>
```

**Body:**
```json
{
  "nombre": "Juan Pérez García",
  "telefono": "+52551234567"
}
```

### **POST** `/user/profile/upload-photo`
**Headers:**
```
Authorization: Bearer <access_token>
Content-Type: multipart/form-data
```

**Body (FormData):**
```
file: <image_file>
```

### **POST** `/user/profile/upload-ine`
**Headers:**
```
Authorization: Bearer <access_token>
Content-Type: multipart/form-data
```

**Body (FormData):**
```
file: <pdf_file>
```

### **POST** `/user/profile/upload-domicilio`
**Headers:**
```
Authorization: Bearer <access_token>
Content-Type: multipart/form-data
```

**Body (FormData):**
```
file: <pdf_file>
```

### **POST** `/user/profile/upload-ingresos`
**Headers:**
```
Authorization: Bearer <access_token>
Content-Type: multipart/form-data
```

**Body (FormData):**
```
file: <pdf_file>
```

### **PATCH** `/user/profile/update-photo`
**Headers:**
```
Authorization: Bearer <access_token>
Content-Type: multipart/form-data
```

**Body (FormData):**
```
file: <image_file>
```

### **PATCH** `/user/profile/update-ine`
**Headers:**
```
Authorization: Bearer <access_token>
Content-Type: multipart/form-data
```

**Body (FormData):**
```
file: <pdf_file>
```

### **PATCH** `/user/profile/update-domicilio`
**Headers:**
```
Authorization: Bearer <access_token>
Content-Type: multipart/form-data
```

**Body (FormData):**
```
file: <pdf_file>
```

### **PATCH** `/user/profile/update-ingresos`
**Headers:**
```
Authorization: Bearer <access_token>
Content-Type: multipart/form-data
```

**Body (FormData):**
```
file: <pdf_file>
```

### **GET** `/user/complete-info-seller`
**Headers:**
```
Authorization: Bearer <access_token>
```

### **GET** `/user/clients-of-seller/{sellerId}`
**Headers:**
```
Authorization: Bearer <access_token> (Admin/Vendedor)
```

### **PATCH** `/user/{sellerId}/desactivate-seller`
**Headers:**
```
Authorization: Bearer <access_token> (Admin)
```

### **PATCH** `/user/{sellerId}/activate-seller`
**Headers:**
```
Authorization: Bearer <access_token> (Admin)
```

### **POST** `/user/register-admin`
**Headers:**
```
Authorization: Bearer <access_token> (Admin only)
```

**Body:**
```json
{
  "nombre": "Admin Nuevo",
  "email": "admin@email.com",
  "telefono": "+52551234567",
  "password": "admin123"
}
```

### **GET** `/user/admins`
**Headers:**
```
Authorization: Bearer <access_token> (Admin only)
```

---

## 🚗 **Gestión de Productos**

### **POST** `/products/{productId}/upload`
**Headers:**
```
Authorization: Bearer <access_token> (Admin only)
Content-Type: multipart/form-data
```

**Body (FormData):**
```
file: <image_file>
```

### **GET** `/products/all`
**Headers:**
```
Authorization: Bearer <access_token>
```

**Response (200):**
```json
[
  {
    "_id": "507f1f77bcf86cd799439011",
    "marca": "Toyota",
    "modelo": "Corolla",
    "ano": 2022,
    "precioBase": 250000,
    "vin": "1HGBH41JXMN109186",
    "color": "Blanco",
    "kilometraje": 15000,
    "estado": "Disponible",
    "imageUrl": "/uploads/file-1705320000000-123456789.jpg",
    "descripcion": "Excelente estado",
    "condicion": "Usado",
    "tipo": "Sedán",
    "transmision": "Automática",
    "motor": "1.8L",
    "stock": 1,
    "proveedor": {
      "_id": "507f1f77bcf86cd799439012",
      "nombre": "AutoImport S.A."
    }
  }
]
```

### **POST** `/products`
**Headers:**
```
Authorization: Bearer <access_token> (Admin only)
```

**Body:**
```json
{
  "marca": "Toyota",
  "modelo": "Corolla",
  "ano": 2023,
  "precioBase": 280000,
  "vin": "1HGBH41JXMN109186",
  "color": "Rojo",
  "kilometraje": 0,
  "estado": "Disponible",
  "descripcion": "Vehículo nuevo con garantía",
  "condicion": "Nuevo",
  "tipo": "Sedán",
  "transmision": "Automática",
  "motor": "1.8L",
  "stock": 1,
  "proveedorId": "507f1f77bcf86cd799439012"
}
```

### **GET** `/products/{id}`
**Headers:**
```
Authorization: Bearer <access_token>
```

### **PATCH** `/products/{id}`
**Headers:**
```
Authorization: Bearer <access_token> (Admin only)
```

**Body:**
```json
{
  "precioBase": 290000,
  "estado": "Reservado"
}
```

### **DELETE** `/products/{id}`
**Headers:**
```
Authorization: Bearer <access_token> (Admin only)
```

---

## 💰 **Cotizaciones**

### **POST** `/cotizaciones`
**Headers:**
```
Authorization: Bearer <access_token> (Cliente)
```

**Body:**
```json
{
  "cocheId": "507f1f77bcf86cd799439011",
  "enganche": 50000,
  "plazoMeses": 60
}
```

**Response (201):**
```json
{
  "_id": "507f1f77bcf86cd799439013",
  "cliente": {
    "_id": "507f1f77bcf86cd799439014",
    "nombre": "Juan Pérez"
  },
  "coche": {
    "_id": "507f1f77bcf86cd799439011",
    "marca": "Toyota",
    "modelo": "Corolla",
    "precioBase": 250000
  },
  "enganche": 50000,
  "plazoMeses": 60,
  "pagoMensual": 4166.67,
  "totalPagado": 300000,
  "tasaInteres": 0.15,
  "status": "Pendiente",
  "createdAt": "2024-01-15T10:00:00.000Z"
}
```

### **GET** `/cotizaciones/mis-cotizaciones`
**Headers:**
```
Authorization: Bearer <access_token> (Cliente)
```

**Query Params:**
```
?status=Aprobada
```

### **GET** `/cotizaciones/all`
**Descripción:** Obtiene todas las cotizaciones. Los administradores ven todas las cotizaciones del sistema, mientras que los vendedores solo ven las cotizaciones que tienen asignadas.

**Headers:**
```
Authorization: Bearer <access_token> (Vendedor/Admin)
```

**Response (200):**
```json
[
  {
    "_id": "507f1f77bcf86cd799439013",
    "cliente": {
      "nombre": "Juan Pérez",
      "email": "juan@email.com",
      "telefono": "+52551234567"
    },
    "coche": {
      "marca": "Toyota",
      "modelo": "Corolla",
      "ano": 2020,
      "precioBase": 250000
    },
    "vendedor": {
      "nombre": "María García",
      "email": "maria@email.com"
    },
    "enganche": 50000,
    "plazoMeses": 60,
    "pagoMensual": 4166.67,
    "status": "Aprobada",
    "createdAt": "2024-01-15T10:00:00.000Z"
  }
]
```

---
**Headers:**
```
Authorization: Bearer <access_token> (Vendedor/Admin)
```

### **GET** `/cotizaciones/aprobadas`
**Headers:**
```
Authorization: Bearer <access_token> (Vendedor/Admin)
```

### **GET** `/cotizaciones/aprobadas-cliente`
**Headers:**
```
Authorization: Bearer <access_token> (Cliente)
```

### **GET** `/cotizaciones/aprobadas/{clienteId}`
**Headers:**
```
Authorization: Bearer <access_token> (Cliente/Admin)
```

### **POST** `/cotizaciones/vendedor-create`
**Headers:**
```
Authorization: Bearer <access_token> (Vendedor)
```

**Body:**
```json
{
  "clienteId": "507f1f77bcf86cd799439014",
  "cocheId": "507f1f77bcf86cd799439011",
  "enganche": 50000,
  "plazoMeses": 60
}
```

### **PATCH** `/cotizaciones/{id}/status`
**Headers:**
```
Authorization: Bearer <access_token> (Vendedor/Admin)
```

**Body:**
```json
{
  "status": "Aprobada"
}
```

### **PATCH** `/cotizaciones/{id}/notas`
**Headers:**
```
Authorization: Bearer <access_token> (Vendedor/Admin)
```

**Body:**
```json
{
  "notasVendedor": "Cliente interesado, documentos completos"
}
```

### **PATCH** `/cotizaciones/{idPricing}/set-seller-to-pricing/{idSeller}`
**Headers:**
```
Authorization: Bearer <access_token> (Admin)
```
+
### **GET** `/cotizaciones/{id}`
**Descripción:** Obtiene los detalles completos de una cotización específica. Si el usuario es vendedor asignado o admin, incluye el estado detallado de los documentos del cliente.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response (200):**
```json
{
  "_id": "507f1f77bcf86cd799439013",
  "cliente": {
    "_id": "507f1f77bcf86cd799439014",
    "nombre": "Juan Pérez",
    "email": "juan@email.com",
    "telefono": "+52551234567",
    "documents": {
      "ine": { "url": "https://...", "uploadedAt": "2024-01-10T08:00:00.000Z" },
      "domicilio": { "url": "https://...", "uploadedAt": "2024-01-10T08:05:00.000Z" },
      "ingresos": { "url": "https://...", "uploadedAt": "2024-01-10T08:10:00.000Z" }
    }
  },
  "coche": {
    "_id": "507f1f77bcf86cd799439011",
    "marca": "Toyota",
    "modelo": "Corolla",
    "ano": 2020,
    "precioBase": 250000,
    "imageUrl": "https://...",
    "condicion": "Usado",
    "transmision": "Manual",
    "descripcion": "Excelente estado"
  },
  "vendedor": {
    "_id": "507f1f77bcf86cd799439015",
    "nombre": "María García",
    "email": "maria@email.com",
    "telefono": "+52551234568"
  },
  "enganche": 50000,
  "plazoMeses": 60,
  "pagoMensual": 4166.67,
  "totalPagado": 300000,
  "tasaInteres": 0.15,
  "status": "Aprobada",
  "notasVendedor": "Cliente aprobado, documentos verificados",
  "createdAt": "2024-01-15T10:00:00.000Z",
  "documentosCliente": {
    "ine": {
      "uploaded": true,
      "status": "actual",
      "uploadedAt": "2024-01-10T08:00:00.000Z",
      "url": "https://..."
    },
    "ingresos": {
      "uploaded": true,
      "status": "actual",
      "uploadedAt": "2024-01-10T08:10:00.000Z",
      "url": "https://..."
    },
    "domicilio": {
      "uploaded": true,
      "status": "actual",
      "uploadedAt": "2024-01-10T08:05:00.000Z",
      "url": "https://..."
    }
  }
}
```

**Notas:**
- `documentosCliente` solo se incluye si el usuario autenticado es el vendedor asignado a la cotización o un administrador.
- Los campos `status` en `documentosCliente` indican si el documento está "actual" (vigente), "expirado" o "pendiente".

## 📧 **Sistema de Correos**

### **POST** `/email-module/send`
**Headers:**
```
Authorization: Bearer <access_token>
```

**Body:**
```json
{
  "to": "cliente@email.com",
  "subject": "Cotización Aprobada",
  "htmlBody": "<h1>¡Felicidades!</h1><p>Su cotización ha sido aprobada.</p>",
  "attachments": [
    {
      "filename": "cotizacion.pdf",
      "path": "/path/to/cotizacion.pdf"
    }
  ]
}
```

---

## 📊 **Dashboard y Estadísticas**

### **GET** `/dashboard/stats`
**Headers:**
```
Authorization: Bearer <access_token>
```

**Response (200):**
```json
{
  "totalProductos": 25,
  "productosDisponibles": 20,
  "totalCotizaciones": 45,
  "cotizacionesPendientes": 12,
  "cotizacionesAprobadas": 28,
  "totalClientes": 35,
  "totalVendedores": 5,
  "ventasMesActual": 1500000,
  "ventasMesAnterior": 1200000
}
```

---

## 🔄 **Flujo Completo de la Aplicación**

### **1. Registro/Login**
```javascript
// Frontend - Registro
const registerUser = async (userData) => {
  const response = await fetch('/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userData)
  });
  const data = await response.json();
  localStorage.setItem('token', data.access_token);
};

// Frontend - Login
const loginUser = async (credentials) => {
  const response = await fetch('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials)
  });
  const data = await response.json();
  localStorage.setItem('token', data.access_token);
  return data.user;
};
```

### **2. Subida de Documentos (Cliente)**
```javascript
// Frontend - Subir documentos
const uploadDocument = async (file, documentType) => {
  const token = localStorage.getItem('token');
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await fetch(`/user/profile/upload-${documentType}`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: formData
  });
  
  return await response.json();
};

// Uso
await uploadDocument(ineFile, 'ine');
await uploadDocument(domicilioFile, 'domicilio');
await uploadDocument(ingresosFile, 'ingresos');
```

### **3. Generar Cotización (Cliente)**
```javascript
// Frontend - Generar cotización
const generateQuote = async (carId, downPayment, months) => {
  const token = localStorage.getItem('token');
  
  const response = await fetch('/cotizaciones', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      cocheId: carId,
      enganche: downPayment,
      plazoMeses: months
    })
  });
  
  const quote = await response.json();
  
  // La cotización se genera automáticamente con PDF y email
  return quote;
};
```

### **4. Revisión de Cotizaciones (Vendedor)**
```javascript
// Frontend - Obtener cotizaciones pendientes
const getPendingQuotes = async () => {
  const token = localStorage.getItem('token');
  
  const response = await fetch('/cotizaciones/pendientes', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  return await response.json();
};

// Frontend - Ver documentos del cliente
const getQuoteDetails = async (quoteId) => {
  const token = localStorage.getItem('token');
  
  const response = await fetch(`/cotizaciones/${quoteId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  const quote = await response.json();
  
  // Verificar estado de documentos
  const documentsStatus = quote.cliente.documents;
  // ine, domicilio, ingresos con status: 'actual' | 'pasado'
  
  return quote;
};

// Frontend - Aprobar/Rechazar cotización
const updateQuoteStatus = async (quoteId, status, notes = '') => {
  const token = localStorage.getItem('token');
  
  // Actualizar estado
  await fetch(`/cotizaciones/${quoteId}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ status })
  });
  
  // Agregar notas si es necesario
  if (notes) {
    await fetch(`/cotizaciones/${quoteId}/notas`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ notasVendedor: notes })
    });
  }
};
```

### **5. Gestión de Productos (Admin)**
```javascript
// Frontend - Crear producto
const createProduct = async (productData) => {
  const token = localStorage.getItem('token');
  
  const response = await fetch('/products', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(productData)
  });
  
  return await response.json();
};

// Frontend - Subir imagen del producto
const uploadProductImage = async (productId, imageFile) => {
  const token = localStorage.getItem('token');
  const formData = new FormData();
  formData.append('file', imageFile);
  
  const response = await fetch(`/products/${productId}/upload`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: formData
  });
  
  return await response.json();
};
```

### **6. Gestión de Usuarios (Admin)**
```javascript
// Frontend - Obtener todos los usuarios
const getAllUsers = async () => {
  const token = localStorage.getItem('token');
  
  const response = await fetch('/user/all', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  return await response.json();
};

// Frontend - Asignar rol
const assignRole = async (userId, role) => {
  const token = localStorage.getItem('token');
  
  const response = await fetch(`/user/${userId}/role`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ rol: role })
  });
  
  return await response.json();
};

// Frontend - Asignar vendedor a cliente
const assignSellerToClient = async (clientId, sellerId) => {
  const token = localStorage.getItem('token');
  
  const response = await fetch(`/user/${clientId}/set-seller-to-client/${sellerId}`, {
    method: 'PATCH',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  return await response.json();
};
```

### **7. Dashboard y Estadísticas**
```javascript
// Frontend - Obtener estadísticas
const getDashboardStats = async () => {
  const token = localStorage.getItem('token');
  
  const response = await fetch('/dashboard/stats', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  return await response.json();
};
```

---

## 🔐 **Roles y Permisos**

- **CLIENTE**: 
  - Generar cotizaciones
  - Ver sus propias cotizaciones
  - Subir documentos personales
  - Actualizar perfil

- **VENDEDOR**:
  - Ver cotizaciones pendientes
  - Aprobar/Rechazar cotizaciones
  - Ver documentos de clientes asignados
  - Agregar notas a cotizaciones
  - Ver estadísticas de ventas

- **ADMIN**:
  - Todos los permisos de VENDEDOR
  - Gestionar usuarios (crear, editar, eliminar, asignar roles)
  - Gestionar productos (CRUD completo)
  - Asignar vendedores a cotizaciones
  - Ver todas las estadísticas
  - Gestionar proveedores y gastos

---

## 📋 **Estados de Cotización**

- **Pendiente**: Cotización creada, esperando asignación de vendedor
- **En Revision**: Asignada a vendedor, siendo revisada
- **Aprobada**: Cotización aprobada, se crea automáticamente una Compra
- **Rechazada**: Cotización rechazada

---

## 📄 **Estados de Documentos**

- **actual**: Documento subido hace menos de 1 mes
- **pasado**: Documento subido hace más de 1 mes (requiere actualización)

---

## 💡 **Notas Importantes**

1. **Autenticación**: Todos los endpoints requieren `Authorization: Bearer <token>` excepto registro y login
2. **Archivos**: Las subidas de archivos usan `Content-Type: multipart/form-data`
3. **Roles**: Los endpoints están protegidos por roles específicos
4. **PDF**: Las cotizaciones aprobadas generan automáticamente PDF y lo envían por email
5. **Amortización**: Usa método Francés con tasa del 15% anual
6. **Documentos**: Los clientes deben mantener documentos actualizados (< 1 mes)

Esta documentación completa te permite integrar el frontend con todas las funcionalidades del backend CRM. ¡El sistema está listo para producción! 🚀