# 🔄 Flujos de la Aplicación CRM

Este documento describe los flujos de negocio principales de la aplicación, explicando cómo interactúan los diferentes roles (Cliente, Vendedor, Admin) para completar los procesos de venta y administración.

## 1. 🚗 Flujo de Venta y Financiamiento

Este es el proceso principal ("Core") del negocio, desde que un cliente se interesa por un auto hasta que lo termina de pagar.

### Paso 1: Descubrimiento y Cotización (Cliente)
1.  **Registro/Login:** El cliente se registra en la plataforma (Web/App).
2.  **Catálogo:** Explora los vehículos disponibles (`/products/tienda`) filtrando por marca, precio, etc.
3.  **Cotización:**
    *   El cliente selecciona un auto y decide cuánto dar de enganche y el plazo (meses).
    *   El sistema calcula automáticamente las mensualidades usando una fórmula de amortización francesa.
    *   Se genera una **Cotización** con estado `Pendiente`.
    *   El sistema envía un correo al cliente con la cotización en PDF.

### Paso 2: Solicitud de Compra (Cliente)
1.  **Iniciar Compra:** Si al cliente le gusta la cotización, hace clic en "Iniciar Compra" (`/compra`).
2.  **Creación de Compra:** Se crea un registro de **Compra** con estado `Pendiente`.
3.  **Asignación:** El sistema asigna automáticamente al vendedor que estaba gestionando la cotización (o al admin si no había).

### Paso 3: Evaluación y Aprobación (Vendedor/Admin)
1.  **Revisión:** El Vendedor ve la compra en su lista de `Pendientes`.
2.  **Evaluación:** El Vendedor revisa los documentos del cliente (INE, Comprobante de ingresos, etc.) y cambia el estado a `En_Revision`.
3.  **Aprobación:** Si todo está correcto, el Vendedor/Admin aprueba la compra (`/compra/:id/aprobar`).
    *   El sistema cambia el estado a `Aprobada`.
    *   Se genera la **Tabla de Amortización** definitiva.
    *   Se envía un correo al cliente confirmando la aprobación y adjuntando el calendario de pagos.

### Paso 4: Pagos (Cliente/Vendedor)
1.  **Enganche:** El primer pago suele ser el enganche.
2.  **Registro de Pagos:**
    *   **Cliente:** Puede pagar con **Tarjeta** desde su portal.
    *   **Vendedor:** Puede registrar pagos en **Efectivo** o **Transferencia** si el cliente va a la sucursal.
3.  **Actualización de Saldo:** Cada pago reduce el `saldoPendiente` de la compra.
4.  **Historial:** Ambos pueden ver el historial de pagos y cuánto falta por pagar.

---

## 2. 👥 Flujo de Gestión de Usuarios (Admin)

1.  **Alta de Personal:** El Admin registra nuevos Vendedores (`/auth/register/vendedor`).
2.  **Asignación de Clientes:** El Admin puede asignar manualmente un cliente a un vendedor específico para que le de seguimiento (`/user/:idClient/set-seller-to-client/:idSeller`).
3.  **Monitoreo:** El Admin puede ver todos los clientes, vendedores y sus estadísticas.

---

## 3. 📦 Flujo de Inventario y Proveedores (Admin)

1.  **Proveedores:** El Admin da de alta a las empresas o personas que suministran los autos (`/proveedores`).
2.  **Alta de Vehículos:** El Admin registra los autos en el sistema (`/products`), sube sus fotos y ficha técnica.
3.  **Stock:** Al venderse un auto, el sistema controla su disponibilidad (aunque actualmente el stock es 1 por VIN).

---

## 4. 💸 Flujo de Gastos (Admin/Vendedor)

1.  **Registro:** Para llevar control financiero, se registran gastos operativos (Luz, Renta, Comisiones, Mantenimiento de autos).
2.  **Reportes:** El Admin puede ver el total de gastos por categoría o fecha para calcular la utilidad real.

---

## 5. ⭐ Flujo de Calidad (Cliente)

1.  **Reseña:** Al finalizar una interacción o venta, el cliente puede calificar a su vendedor (`/seller-review`).
2.  **Reputación:** Estas calificaciones aparecen en el perfil del vendedor y ayudan a futuros clientes a elegir.
