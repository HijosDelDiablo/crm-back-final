# 💳 API de Pagos - Documentación Frontend

## 🎯 Endpoints Disponibles

### GET /pago/historial/{compraId}
**Obtener historial de pagos de una compra específica**

#### Headers Requeridos
```
Authorization: Bearer {token}
```

#### Permisos
- **CLIENTE**: Solo puede ver pagos de sus propias compras
- **VENDEDOR**: Solo puede ver pagos de compras donde es el vendedor asignado
- **ADMIN**: Puede ver pagos de cualquier compra

#### Response 200 - Éxito
```json
[
  {
    "_id": "6936fd00e7ef73b4ad790f7c",
    "compra": {
      "_id": "6936fd00e7ef73b4ad790f7b",
      "cliente": {
        "_id": "6936b04c23014ff4c941eef1",
        "nombre": "Chabelo locote"
      },
      "cotizacion": {
        "_id": "693701160960537a2f4e6912",
        "coche": {
          "marca": "Volvo",
          "modelo": "X3"
        }
      }
    },
    "monto": 50000,
    "tipoPago": "Abono",
    "fechaPago": "2025-12-08T16:46:36.375Z",
    "saldoPendiente": 986134.71,
    "createdAt": "2025-12-08T16:46:36.375Z"
  }
]
```

#### Response 403 - Sin Permisos
```json
{
  "statusCode": 403,
  "message": "No tienes permisos para ver los pagos de esta compra"
}
```

#### Response 404 - Compra No Encontrada
```json
{
  "statusCode": 404,
  "message": "Compra no encontrada"
}
```

---

### POST /pago/registrar
**Registrar un nuevo pago**

#### Headers Requeridos
```
Authorization: Bearer {token}
Content-Type: application/json
```

#### Body Request
```json
{
  "compraId": "6936fd00e7ef73b4ad790f7b",
  "monto": 50000,
  "tipoPago": "Abono"
}
```

#### Permisos
- **CLIENTE**: Solo puede registrar pagos en sus propias compras
- **VENDEDOR**: Solo puede registrar pagos en compras donde es el vendedor asignado
- **ADMIN**: Puede registrar pagos en cualquier compra

#### Response 201 - Pago Registrado
```json
{
  "_id": "6936fd00e7ef73b4ad790f7c",
  "compra": "6936fd00e7ef73b4ad790f7b",
  "monto": 50000,
  "tipoPago": "Abono",
  "fechaPago": "2025-12-08T16:46:36.375Z",
  "saldoPendiente": 986134.71,
  "createdAt": "2025-12-08T16:46:36.375Z"
}
```

#### Response 400 - Monto Inválido
```json
{
  "statusCode": 400,
  "message": "El monto del pago debe ser mayor a 0"
}
```

#### Response 400 - Compra Completada
```json
{
  "statusCode": 400,
  "message": "La compra ya está completada"
}
```

---

### POST /pago/completar-compra/{compraId}
**Marcar una compra como completada (pago total)**

#### Headers Requeridos
```
Authorization: Bearer {token}
```

#### Permisos
- **VENDEDOR**: Solo puede completar compras donde es el vendedor asignado
- **ADMIN**: Puede completar cualquier compra

#### Response 200 - Compra Completada
```json
{
  "message": "Compra completada exitosamente",
  "compra": {
    "_id": "6936fd00e7ef73b4ad790f7b",
    "status": "Completada",
    "saldoPendiente": 0,
    "totalPagado": 1036134.71
  }
}
```

#### Response 400 - Saldo Pendiente
```json
{
  "statusCode": 400,
  "message": "No se puede completar la compra, aún hay saldo pendiente"
}
```

---

## 💰 Tipos de Pago

| Tipo | Descripción |
|------|-------------|
| `Abono` | Pago parcial hacia el saldo pendiente |
| `Pago Total` | Pago completo del saldo restante |

---

## 🔍 Ejemplos de Uso

### Obtener historial de pagos
```javascript
const compraId = "6936fd00e7ef73b4ad790f7b";
const response = await fetch(`/api/pago/historial/${compraId}`, {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});

if (response.ok) {
  const historialPagos = await response.json();
  console.log('Historial de pagos:', historialPagos);
} else {
  const error = await response.json();
  console.error('Error:', error.message);
}
```

### Registrar un pago
```javascript
const pagoData = {
  compraId: "6936fd00e7ef73b4ad790f7b",
  monto: 50000,
  tipoPago: "Abono"
};

const response = await fetch('/api/pago/registrar', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(pagoData)
});

if (response.ok) {
  const pagoRegistrado = await response.json();
  console.log('Pago registrado:', pagoRegistrado);
} else {
  const error = await response.json();
  console.error('Error:', error.message);
}
```

### Completar compra
```javascript
const compraId = "6936fd00e7ef73b4ad790f7b";
const response = await fetch(`/api/pago/completar-compra/${compraId}`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});

if (response.ok) {
  const resultado = await response.json();
  console.log('Compra completada:', resultado);
} else {
  const error = await response.json();
  console.error('Error:', error.message);
}
```

---

## ⚠️ Consideraciones Importantes

1. **Validación de Saldos**: El sistema valida automáticamente que los pagos no excedan el saldo pendiente
2. **Actualización de Inventario**: Al completar una compra, se decrementa automáticamente el stock del producto
3. **Estados de Compra**: Los pagos afectan el estado de la compra (de "Aprobada" a "Completada")
4. **Permisos**: Los clientes solo pueden ver/registrar pagos en sus propias compras