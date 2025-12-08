# 📋 API de Cotizaciones - Documentación Frontend

## 🎯 Endpoints Disponibles

### GET /cotizaciones/all
**Obtener todas las cotizaciones con filtros opcionales según rol**

#### Parámetros de Query
- `status` (opcional): Filtrar por estado de cotización
  - `Pendiente`
  - `En Revision`
  - `Aprobada`
  - `Rechazada`
  - `Completada`

#### Headers Requeridos
```
Authorization: Bearer {token}
```

#### Permisos
- **CLIENTE**: Solo ve sus propias cotizaciones
- **VENDEDOR**: Solo ve cotizaciones asignadas a él
- **ADMIN**: Ve todas las cotizaciones del sistema

#### Response 200 - Éxito
```json
[
  {
    "_id": "693701160960537a2f4e6912",
    "cliente": {
      "_id": "6936b04c23014ff4c941eef1",
      "email": "joellbriones701@gmail.com",
      "nombre": "Chabelo locote",
      "telefono": "N/A",
      "fotoPerfil": "https://8rnc9otm8f.ufs.sh/f/346osYxsEd7RfKJvSMq1zIJiGbMCYR9pyNHK8aojqv5c0rnS"
    },
    "coche": {
      "_id": "691e21852163b6aded369fea",
      "marca": "Volvo",
      "modelo": "X3",
      "ano": 2022,
      "precioBase": 921000,
      "descripcion": "Unidad Volvo X3 en excelente estado, lista para entrega inmediata.",
      "condicion": "Nuevo",
      "tipo": "SUV",
      "transmision": "DCT",
      "motor": "2.5L",
      "imageUrl": "https://www.motortrend.com/uploads/2023/05/2024-volvo-ex30-render.jpg"
    },
    "vendedor": {
      "_id": "693696ff01f850377813b9b6",
      "email": "joellbriones703@gmail.com",
      "nombre": "chabelo good",
      "telefono": null,
      "fotoPerfil": null
    },
    "precioCoche": 921000,
    "enganche": 184200,
    "plazoMeses": 12,
    "tasaInteres": 0.15,
    "pagoMensual": 66502.32,
    "montoFinanciado": 736800,
    "totalPagado": 982227.89,
    "status": "En Revision",
    "notasVendedor": "",
    "createdAt": "2025-12-08T16:47:18.994Z",
    "updatedAt": "2025-12-08T16:47:43.180Z",
    "__v": 0,
    "compra": {
      "_id": "6936fd00e7ef73b4ad790f7b",
      "status": "Aprobada",
      "saldoPendiente": 1036134.71
    }
  }
]
```

#### Campos Importantes
- `compra`: Información de la compra asociada (si existe)
  - `_id`: ID de la compra
  - `status`: Estado de la compra
  - `saldoPendiente`: Monto pendiente por pagar

#### Response 401 - No Autorizado
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

#### Response 403 - Rol Insuficiente
```json
{
  "statusCode": 403,
  "message": "Forbidden resource"
}
```

---

## 📊 Estados de Cotización

| Estado | Descripción | Acciones Disponibles |
|--------|-------------|---------------------|
| `Pendiente` | Cotización creada, esperando asignación | Asignar vendedor |
| `En Revision` | Asignada a vendedor, en evaluación | Aprobar/Rechazar |
| `Aprobada` | Aprobada por vendedor, lista para compra | Crear compra |
| `Rechazada` | Rechazada por vendedor | - |
| `Completada` | Compra finalizada | - |

---

## 🔍 Ejemplos de Uso

### Obtener todas las cotizaciones en revisión (Vendedor)
```javascript
const response = await fetch('/api/cotizaciones/all?status=En%20Revision', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});

const cotizaciones = await response.json();
// Solo devuelve cotizaciones asignadas al vendedor autenticado
```

### Obtener todas las cotizaciones en revisión (Admin)
```javascript
const response = await fetch('/api/cotizaciones/all?status=En%20Revision', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});

const cotizaciones = await response.json();
// Devuelve TODAS las cotizaciones en revisión del sistema
```

### Obtener todas las cotizaciones (Cliente)
```javascript
const response = await fetch('/api/cotizaciones/all', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});

const misCotizaciones = await response.json();
// Solo devuelve las cotizaciones del cliente autenticado
```

### Obtener cotizaciones sin filtro
```javascript
const response = await fetch('/api/cotizaciones/all', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});

const cotizaciones = await response.json();
// Vendedor: solo las asignadas a él
// Admin: todas las cotizaciones
```

---

## 🎨 Estados de Compra (Campo `compra.status`)

| Estado | Descripción |
|--------|-------------|
| `Pendiente` | Compra iniciada, esperando evaluación |
| `En revisión` | En proceso de evaluación por analista |
| `Aprobada` | Aprobada, esperando pagos |
| `Rechazada` | Rechazada por el sistema |
| `Completada` | Pagada completamente |
| `Cancelada` | Cancelada por el cliente o sistema |

---

## 💡 Notas para Frontend

1. **Campo `compra` opcional**: Solo aparece si la cotización ya generó una compra
2. **Filtrado automático por rol**: El backend filtra automáticamente según el rol del usuario
3. **Estados case-insensitive**: El filtro de status maneja variaciones con/sin tilde
4. **Paginación**: Actualmente sin paginación, considera implementar si hay muchos registros
5. **Real-time**: Considera WebSockets para actualizaciones en tiempo real de estados</content>
<parameter name="filePath">/home/BatBriones/Documentos/school_final/crm-back-final/COTIZACIONES_API_DOCS.md