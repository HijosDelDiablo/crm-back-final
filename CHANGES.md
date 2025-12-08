# 📋 **Cambios Recientes - CRM Backend**

## 🚀 **Versión: feat/sprint2**
**Fecha:** Diciembre 8, 2025

### ✨ **Nuevas Funcionalidades**

#### **Endpoints para Actualizar Archivos**
Se agregaron nuevos endpoints PATCH para permitir la actualización de archivos existentes en el perfil de usuario. Esto mejora la experiencia del usuario al poder reemplazar documentos sin necesidad de eliminar y volver a subir.

**Archivos Modificados:**
- `src/user/user.controller.ts`: Agregados 4 nuevos endpoints PATCH
- `API_DOCUMENTATION.md`: Actualizada documentación con los nuevos endpoints

**Nuevos Endpoints:**

1. **PATCH** `/user/profile/update-photo`
   - **Descripción:** Actualizar foto de perfil
   - **Tipo de archivo:** Imagen (JPEG, PNG, etc.)
   - **Autenticación:** JWT requerida

2. **PATCH** `/user/profile/update-ine`
   - **Descripción:** Actualizar documento INE
   - **Tipo de archivo:** PDF
   - **Autenticación:** JWT requerida

3. **PATCH** `/user/profile/update-domicilio`
   - **Descripción:** Actualizar documento de domicilio
   - **Tipo de archivo:** PDF
   - **Autenticación:** JWT requerida

4. **PATCH** `/user/profile/update-ingresos`
   - **Descripción:** Actualizar documento de ingresos
   - **Tipo de archivo:** PDF
   - **Autenticación:** JWT requerida

### 🔍 **Mejora en Logs de Cotizaciones**
Se agregaron logs detallados en el servicio de cotizaciones para mejorar el debugging y monitoreo del proceso de creación y gestión de cotizaciones.

**Archivos Modificados:**
- `src/cotizacion/cotizacion.service.ts`: Agregados logs en métodos clave

**Métodos con Logs Mejorados:**

1. **`generarCotizacion`** (Cliente)
   - Logs de inicio, validación de coche, cálculos financieros, guardado y envío de notificaciones

2. **`vendedorGenerarCotizacion`** (Vendedor)
   - Logs de asignación de cliente y llamada a generación

3. **`updateCotizacionStatus`** (Vendedor/Admin)
   - Logs de cambio de status, creación de compra (si aprobado) y envío de correos

4. **`setSellerToPricing`** (Admin)
   - Logs de asignación de vendedor a cotización

5. **`getCotizacionesPendientes`** (Vendedor)
   - Logs de consulta y cantidad de resultados

**Ejemplo de Logs:**
```
🚀 Iniciando generación de cotización para cliente 64f... - Coche ID: 64g...
✅ Coche encontrado: Toyota Corolla - Precio: $250000
📊 Cálculos realizados: ...
💾 Cotización guardada exitosamente - ID: 64h...
📧 Correo de cotización enviado a cliente@email.com
📄 PDF de cotización generado y enviado
```

### 📋 **Nuevo Endpoint para Estado de Documentos**
Se agregó un endpoint específico para consultar el estado de los documentos del usuario de manera simplificada.

**Archivos Modificados:**
- `src/user/user.service.ts`: Nuevo método `getDocumentStatus`
- `src/user/user.controller.ts`: Nuevo endpoint `GET /user/documents/status`
- `API_DOCUMENTATION.md`: Documentación actualizada

**Endpoint:** `GET /user/documents/status`

**Respuesta:**
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
    "status": null
  },
  "domicilio": {
    "uploaded": true,
    "status": "pasado"
  }
}
```

**Beneficios:**
- Consulta rápida del estado de documentos
- Información estructurada para el frontend
- Fácil integración con lógica de UI

### 🔧 **Detalles Técnicos**

- **Método HTTP:** PATCH (para indicar actualización parcial)
- **Content-Type:** multipart/form-data
- **Headers requeridos:** Authorization: Bearer <token>
- **Lógica backend:** Reutiliza los métodos existentes `uploadProfilePhoto` y `uploadDocument` del servicio, que ya manejan la sobrescritura
- **Almacenamiento:** UploadThing (con fallback local)
- **Validaciones:** Mismas que los endpoints POST existentes

### 📚 **Documentación Actualizada**

La documentación completa de la API en `API_DOCUMENTATION.md` ha sido actualizada para incluir:
- Descripciones detalladas de cada endpoint
- Ejemplos de headers y body
- Notas sobre autenticación y permisos

### 🧪 **Testing Recomendado**

Antes de desplegar, verificar:
- [ ] Los endpoints responden correctamente con archivos válidos
- [ ] La autenticación JWT funciona
- [ ] Los archivos se reemplazan correctamente (no se duplican)
- [ ] Los tipos de archivo están validados
- [ ] El build del proyecto pasa sin errores

### 🔒 **Consideraciones de Seguridad**

- Los usuarios solo pueden actualizar sus propios archivos
- Se mantiene la integridad de los datos existentes
- Los archivos antiguos se sobrescriben, no se eliminan físicamente (depende del servicio de almacenamiento)

---

**Responsable:** GitHub Copilot  
**Branch:** feat/sprint2  
**Estado:** ✅ Implementado y Documentado