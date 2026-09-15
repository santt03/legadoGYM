# Legado Gym

Panel administrativo de Legado Gym. Incluye acceso con usuario y contraseña, socios, ficha individual, búsqueda, filtros por estado, dashboard de vencimientos y renovación de membresías. La fase 2 agrega un catálogo de ejercicios y planes de entrenamiento de cuatro semanas asociados al ID del socio. Los datos se guardan en PostgreSQL mediante una API independiente del frontend. No se gestionan turnos.

La fase 3 permite exportar cada plan guardado como PDF A4. El documento incluye la identidad del gimnasio, los datos disponibles del socio, fechas de las cuatro semanas, días y ejercicios con series, repeticiones, carga, descanso y observaciones. El botón de exportación se deshabilita cuando hay cambios sin guardar.

## Requisitos

- Node.js 22 o superior y npm.
- PostgreSQL 18 local, o Docker Desktop para levantar la base incluida en `compose.yaml`.

## Arranque local

1. `npm install`
2. `Copy-Item .env.example .env` en PowerShell. Ajustar `DATABASE_URL` si se usa otra instancia de PostgreSQL. Elegir una contraseña propia de al menos 12 caracteres en `ADMIN_PASSWORD`.
3. `docker compose up -d db` si se usa Docker. La base de Legado Gym queda en el puerto local 5433 para evitar conflictos con otros proyectos. Si ya existe PostgreSQL, crear una base llamada `legadogym` y ajustar el puerto en `.env`.
4. `npm run db:setup` para crear las tablas y el gimnasio inicial. Si ya se ejecutó durante la fase 1, repetirlo para agregar las tablas de planes y ejercicios.
5. `npm run admin:create` para crear el usuario configurado en `ADMIN_USERNAME`. Repetir este comando cambia su contraseña.
6. `npm run dev` para iniciar juntos la API en `127.0.0.1:3001` y la web en la URL que muestra Vite. `npm run dev:web` inicia solo la interfaz.

La interfaz muestra un error si la API o la base no están disponibles. El endpoint `GET /api/health` permite comprobar la conexión. El acceso al resto de la API requiere sesión. Las contraseñas se almacenan con scrypt y las sesiones en cookies `HttpOnly` de 12 horas. Para desplegar con HTTPS, configurar `COOKIE_SECURE=true`; no publicar esta configuración local sin preparar antes HTTPS, rotación de credenciales y controles operativos.

## Supabase

La API se conecta directamente al PostgreSQL de Supabase; las credenciales permanecen únicamente en el backend. Copiar la URI desde **Project Settings > Database > Connection string** y colocarla como `DATABASE_URL` en `.env`. Para desarrollo y despliegues con IPv4 conviene usar la URI del pooler. La cadena debe incluir `sslmode=require&uselibpqcompat=true` y la contraseña debe estar codificada como URL si contiene caracteres especiales.

Después de configurar la URI:

1. `npm run db:check` comprueba la conexión y confirma que SSL está activo.
2. `npm run db:setup` crea o actualiza el esquema de Legado Gym.
3. `npm run admin:create` crea o actualiza el acceso administrador.

No se deben usar `SUPABASE_SERVICE_ROLE_KEY`, la clave anónima ni credenciales de Supabase en variables `VITE_*`: el navegador y Tauri consumen la API de Legado Gym y nunca se conectan directamente a la base.

## Comprobaciones

`npm run build`, `npm run check:api` y `npm run lint`.

## Estructura

- `src/App.tsx`: dashboard, listado, ficha y formularios de socios.
- `server/index.ts`: API de socios, validación y renovación.
- `server/auth.ts`: login, sesión y protección de la API.
- `server/plans.ts`: API del catálogo y los planes de cuatro semanas.
- `src/planPdf.ts`: generación y descarga del PDF de entrenamiento.
- `server/schema.sql`: modelo relacional de gimnasio, usuarios, socios, ejercicios y entrenamientos.
- `docs/Plan_MVP_Web_Tauri.md`: fases del MVP web y escritorio.

La aplicación de escritorio con Tauri está preparada como piloto local. Consultar [Operación del piloto](docs/Operacion_Piloto.md) para compilar el instalador, iniciar su servidor, crear entrenadores y recuperar respaldos. Los planes se conservan al actualizar la ficha del socio; si un socio tiene planes, no se permite eliminarlo y debe marcarse como inactivo para preservar el historial.

## Deploy web

La interfaz Vite y la API Hono están preparadas para desplegarse juntas en Vercel, manteniendo las rutas `/api` bajo el mismo dominio. Consultar [Deploy en Vercel](docs/Deploy_Vercel.md) para configurar las variables, validar la entrega y agregar el dominio del cliente.
