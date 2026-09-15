# Deploy de Legado Gym en Vercel

## Arquitectura

- Vercel entrega la interfaz React/Vite y ejecuta la API Hono como una Function Node.js.
- Supabase aloja PostgreSQL mediante el Transaction Pooler del puerto 6543.
- La interfaz y la API comparten dominio, por lo que la cookie de sesión permanece `HttpOnly`, `Secure` y `SameSite=Strict`.

## Crear el proyecto

1. En Vercel, elegir **Add New > Project**.
2. Importar `santt03/legadoGYM`.
3. Mantener el directorio raíz en `./`.
4. Vercel leerá `vercel.json`: framework Vite, comando `npm run build` y salida `dist`.

## Variables de producción

Crear estas variables en **Project > Settings > Environment Variables** y aplicarlas a **Production**:

```text
DATABASE_URL=postgresql://postgres.PROJECT_REF:PASSWORD@POOLER:6543/postgres?sslmode=require&uselibpqcompat=true
COOKIE_SECURE=true
```

`DATABASE_URL` debe ser la URI **Transaction pooler** copiada desde **Supabase > Connect**. No agregar estas variables con prefijo `VITE_`, porque eso las expondría al navegador.

El administrador ya está almacenado en PostgreSQL. `ADMIN_USERNAME` y `ADMIN_PASSWORD` solo se necesitan al ejecutar localmente `npm run admin:create`; la aplicación desplegada no los lee.

Después de modificar variables en Vercel hay que crear un deployment nuevo.

## Validación de la entrega

1. Abrir `/api/health`; debe responder `{"ok":true}`.
2. Abrir la URL principal e iniciar sesión.
3. Confirmar que aparecen Santiago Navarro y Valentina Ruiz con sus planes demo.
4. Abrir una rutina y una dieta, revisar la vista previa y descargar ambos PDF.
5. Crear un socio de prueba, renovarlo y eliminarlo para comprobar escritura en Supabase.
6. En **Vercel > Observability > Logs**, confirmar que no haya respuestas 500.

## Dominio para el cliente

La URL `*.vercel.app` sirve para la demostración. Para usar un dominio propio, agregarlo en **Project > Settings > Domains** y seguir los registros DNS indicados por Vercel. No hace falta cambiar el código ni las cookies.

## Respaldos

El panel web deriva la administración de respaldos a Supabase. La generación local con `pg_dump` sigue disponible en desarrollo y en la instalación Tauri mediante `npm run backup:db`.
