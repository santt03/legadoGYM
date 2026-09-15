# Plan de desarrollo del MVP web y Tauri de Legado Gym

## Objetivo de la primera entrega

Mostrar al cliente un flujo completo: dar de alta un socio, consultar su estado, crearle un plan de entrenamiento de cuatro semanas, cargar días y ejercicios, y exportar un PDF con la identidad de Legado Gym. La aplicación web será la base funcional; Tauri empaquetará esa misma interfaz para escritorio cuando el flujo esté validado.

## Qué se rescata de `C:\Users\santi\Desktop\GimMVP`

| Pieza | Reutilización prevista | Ajuste necesario |
| --- | --- | --- |
| `src/app/components/Layout.tsx` | Estructura de navegación lateral y estilo oscuro con acentos rojos | Reemplazar el logo SVG provisional por la identidad real de `docs/logoLegadoGym.jpeg`; retirar módulos financieros deshabilitados de la navegación del MVP. |
| `src/app/pages/Students.tsx`, `StudentCard.tsx`, `StudentForm.tsx`, `RenewSubscriptionDialog.tsx` | Flujos de alta, edición, listado, filtros por turno y renovación | Ampliar la ficha con edad o fecha de nacimiento, peso, objetivo y fechas de inicio/fin; unificar el cálculo de estados y adaptar a persistencia real. |
| `src/app/pages/Schedule.tsx` | No se incorpora | El cliente descartó la gestión de turnos para esta plataforma. |
| `src/app/pages/TrainingPlans.tsx` | Interacción de crear plan, semanas, días y ejercicios | Separar componentes, asociar por ID de socio, usar catálogo de ejercicios y validar los campos. |
| `src/app/hooks/useStudents.ts`, `useTrainingPlans.ts` | Referencia de operaciones y reglas de interfaz | Reemplazar `localStorage` por API y base de datos. No usar estos hooks como capa de persistencia final. |
| Generador PDF con jsPDF en `TrainingPlans.tsx` | Referencia visual y de contenido para una primera exportación | Extraerlo a un módulo propio y agregar los datos completos del socio; revisar paginación y casos de planes extensos. |
| Componentes `src/app/components/ui` y estilos | Reutilizar solamente los componentes que usemos | Evitar copiar todo el paquete de Figma y sus dependencias sin necesidad. |

La maqueta sirve como referencia de interacción y apariencia, pero contiene datos locales del navegador, un logo de sustitución y planes vinculados por nombre de alumno. Esas tres decisiones se corrigen antes de considerarla un MVP operativo.

## Decisión de arquitectura para web y escritorio

Mantener React + TypeScript + Vite como interfaz compartida, porque el repositorio actual ya usa esa base y Tauri la empaqueta directamente. La API debe ser independiente del frontend y concentrar las reglas de negocio; PostgreSQL guarda socios y planes estructurados. Así se conserva la posibilidad de una futura app móvil. El documento de arquitectura propone Next.js para web: antes de implementarlo hay que decidir si sus ventajas de SSR compensan mantener una interfaz distinta para Tauri. Para este panel interno, la ruta inicial recomendada es Vite + Tauri + API separada.

Tauri no debe ser el almacenamiento principal: la versión de escritorio consumirá la misma API que la web. De ese modo ambas muestran los mismos datos y el gimnasio no depende de una sola computadora.

## Fases

### Fase 0 — Base y demostración visual

- Adaptar al proyecto el layout, paleta y componentes imprescindibles de la maqueta.
- Usar la marca real en un formato apropiado para interfaz y PDF.
- Crear navegación real para Dashboard, Socios y Planes.
- Preparar datos de demostración claramente identificados para validar pantallas con el cliente.

**Entrega:** prototipo navegable que muestra el recorrido principal sin depender aún de datos del gimnasio.

### Fase 1 — Socios y vencimientos

- Definir el modelo `Gym`, `User` y `Member`, con IDs estables y fechas sin ambigüedad de zona horaria.
- Implementar API, validaciones y almacenamiento en PostgreSQL.
- Alta, edición, búsqueda, filtro y ficha individual del socio.
- Estados activo, próximo a vencer y vencido; renovación de la membresía.
- Dashboard con totales derivados de datos reales.

**Entrega:** el personal puede administrar socios y consultar vencimientos sin perder datos al cerrar la aplicación.

### Fase 2 — Catálogo y planes de cuatro semanas

- Modelo relacional para catálogo de ejercicios, plan, semana, día y ejercicio programado.
- Asociar cada plan al ID del socio y preservar historial.
- Crear, editar y consultar semanas 1 a 4, días y ejercicios con series, repeticiones, carga, descanso y observaciones.
- Validar orden, campos requeridos y duplicados; separar el editor de la lista de planes.

**Entrega:** un entrenador puede completar y volver a abrir el plan de un socio desde web o escritorio.

### Fase 3 — PDF y revisión con el cliente

- Generar el PDF desde el plan guardado, con nombre del socio, objetivo, fechas y ejercicios de las cuatro semanas.
- Revisar legibilidad, saltos de página y salida A4 para WhatsApp e impresión.
- Probar el flujo completo con datos representativos y corregir lo observado en la revisión.

**Entrega:** PDF profesional y demostración de punta a punta: socio → plan → PDF.

### Fase 4 — Acceso y empaquetado Tauri

- Autenticación de personal y roles `ADMIN` y `TRAINER` aplicados en la API.
- Configurar entornos y variables para web y Tauri; empaquetar una versión de escritorio para Windows.
- Verificar instalación, actualización del frontend, acceso a la API y descarga/guardado del PDF.
- Preparar respaldo de la base de datos y un procedimiento básico de recuperación.

**Entrega:** piloto utilizable por el gimnasio desde navegador y aplicación de escritorio.

## Criterio de cierre del MVP

El MVP está listo para mostrar como producto funcional cuando un usuario autorizado pueda cargar un socio, ver su vencimiento, crear y editar un plan de cuatro semanas, cerrar y reabrir la aplicación sin perderlo, y generar el PDF correcto desde la web y desde Tauri.

## Decisiones a validar con el cliente durante la revisión

1. Qué datos personales y medidas son obligatorios para la ficha y el PDF.
2. Si un socio puede tener varios planes simultáneos o solo uno vigente.
3. Si el PDF debe replicar la planilla de referencia o usar un formato nuevo optimizado para impresión.
