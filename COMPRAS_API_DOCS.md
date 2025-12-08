# 🛒 API de Compras - Documentación Frontend

## 🎯 Endpoints Disponibles

### GET /compra/all
**Obtener todas las compras con filtros opcionales**

#### Parámetros de Query
- `status` (opcional): Filtrar por estado de compra
  - `Pendiente`
  - `En revisión`
  - `Aprobada`
  - `Rechazada`
  - `Completada`
  - `Cancelada`

#### Headers Requeridos
```
Authorization: Bearer {token}
```

#### Permisos
- **CLIENTE**: Solo ve sus propias compras
- **VENDEDOR**: Solo ve compras donde es el vendedor asignado
- **ADMIN**: Ve todas las compras del sistema

#### Response 200 - Éxito
```json
[
  {
    "_id": "6936fd00e7ef73b4ad790f7b",
    "cliente": {
      "_id": "6936b04c23014ff4c941eef1",
      "nombre": "Chabelo locote",
      "email": "joellbriones701@gmail.com",
      "telefono": "N/A"
    },
    "vendedor": {
      "_id": "693696ff01f850377813b9b6",
      "nombre": "chabelo good",
      "email": "joellbriones703@gmail.com"
    },
    "cotizacion": {
      "_id": "693701160960537a2f4e6912",
      "coche": {
        "_id": "691e21852163b6aded369fea",
        "marca": "Volvo",
        "modelo": "X3",
        "ano": 2022,
        "precioBase": 921000
      }
    },
    "status": "Aprobada",
    "saldoPendiente": 1036134.71,
    "totalPagado": 0,
    "montoTotalCredito": 1036134.71,
    "createdAt": "2025-12-08T16:46:36.375Z",
    "updatedAt": "2025-12-08T16:46:36.375Z",
    "historialPagos": [
      {
        "_id": "6936fd00e7ef73b4ad790f7c",
        "compra": "6936fd00e7ef73b4ad790f7b",
        "monto": 50000,
        "tipoPago": "Abono",
        "fechaPago": "2025-12-08T16:46:36.375Z",
        "saldoPendiente": 986134.71,
        "createdAt": "2025-12-08T16:46:36.375Z"
      }
    ]
  }
]
```

#### Response 403 - Rol Insuficiente
```json
{
  "statusCode": 403,
  "message": "Acceso denegado según rol del usuario"
}
```

---

### GET /compra/por-cliente/{clienteId}
**Obtener compras de un cliente específico**

#### Headers Requeridos
```
Authorization: Bearer {token}
```

#### Permisos
- **CLIENTE**: Solo puede ver sus propias compras
- **VENDEDOR**: Puede ver compras de cualquier cliente
- **ADMIN**: Puede ver compras de cualquier cliente

---

### GET /compra/{id}
**Obtener detalles de una compra específica**

#### Headers Requeridos
```
Authorization: Bearer {token}
```

#### Permisos
- **CLIENTE**: Solo puede ver sus propias compras
- **VENDEDOR**: Solo puede ver compras donde es el vendedor asignado
- **ADMIN**: Puede ver cualquier compra

---

## 📊 Estados de Compra

| Estado | Descripción | Acciones Disponibles |
|--------|-------------|---------------------|
| `Pendiente` | Compra iniciada, esperando evaluación | Evaluar compra |
| `En revisión` | En evaluación por analista/vendedor | Aprobar/Rechazar |
| `Aprobada` | Aprobada, lista para pagos | Registrar pagos |
| `Rechazada` | Rechazada por el sistema | - |
| `Completada` | Pagada completamente | - |
| `Cancelada` | Cancelada por cliente o sistema | - |

---

## 🔍 Ejemplos de Uso

### Obtener compras en revisión (Vendedor)
```javascript
const response = await fetch('/api/compra/all?status=En%20revisión', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});

const compras = await response.json();
// Solo devuelve compras asignadas al vendedor autenticado
```

### Obtener compras de un cliente (Vendedor)
```javascript
const clienteId = "6936b04c23014ff4c941eef1";
const response = await fetch(`/api/compra/por-cliente/${clienteId}`, {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});

const comprasCliente = await response.json();
```

---

## 💡 Notas Importantes

1. **Historial de Pagos Incluido**: Todos los endpoints que devuelven compras ahora incluyen automáticamente el `historialPagos` con todos los pagos realizados en cada compra.

2. **Campo `historialPagos`**: Es un array que contiene todos los pagos de la compra, ordenados por fecha de creación.

3. **Filtrado Automático por Rol**: El backend filtra automáticamente las compras según el rol del usuario autenticado.

4. **Información Completa**: Cada compra incluye información detallada del cliente, vendedor, cotización y vehículo asociado.

### Obtener todas las compras (Cliente)
```javascript
const response = await fetch('/api/compra/all', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});

const misCompras = await response.json();
// Solo devuelve las compras del cliente autenticado
```</content>
<parameter name="filePath">/home/BatBriones/Documentos/school_final/crm-back-final/COMPRAS_API_DOCS.md