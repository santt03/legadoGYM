# Operación del piloto web y escritorio

## Usuarios y permisos

- El administrador puede abrir **Configuración** para cambiar el nombre y logo del gimnasio, elegir la duración inicial de las membresías y crear o editar usuarios. El entrenador no ve esa sección.
- Las contraseñas creadas o cambiadas desde el panel deben tener al menos 12 caracteres. Cambiar la contraseña o el rol invalida las sesiones activas de ese usuario.

- `ADMIN`: consulta y administra socios, renovaciones, catálogo y planes.
- `TRAINER`: consulta socios y crea o edita ejercicios y planes. No puede modificar socios ni borrar ejercicios usados.
- Para crear o cambiar el administrador: configurar `ADMIN_USERNAME` y `ADMIN_PASSWORD` en `.env`, luego ejecutar `npm run admin:create`.
- Para crear o cambiar un entrenador: configurar `STAFF_USERNAME`, `STAFF_PASSWORD` y opcionalmente `STAFF_NAME` en `.env`, luego ejecutar `npm run staff:create`. Las contraseñas deben tener al menos 12 caracteres. Cambiar una contraseña invalida las sesiones de ese usuario.

## Navegador y escritorio en el equipo piloto

1. Iniciar Docker Desktop y ejecutar `docker compose up -d db`.
2. Ejecutar `npm run db:setup` una vez por cada instalación o actualización del esquema.
3. Para desarrollo, `npm run dev` inicia web y API. Abrir `http://localhost:5173`.
4. Para usar el instalador de escritorio, ejecutar `npm run build` y mantener `npm run serve` activo. La aplicación de Tauri abre `http://127.0.0.1:3001`, donde la API sirve la misma web y sus rutas `/api`.
5. Ejecutar `npm run desktop:build` para crear un instalador NSIS de Windows bajo `src-tauri/target/release/bundle/nsis`.

La app de escritorio de este piloto requiere que PostgreSQL y la API estén ejecutándose en **el mismo equipo**. El instalador no incluye la base ni el servidor Node. No distribuirlo todavía para instalarlo en otras computadoras: para eso hay que publicar la API y la web en un host común con HTTPS o empaquetar un servidor local apropiado. El frontend puede actualizarse con `npm run build` y reiniciando la app, sin reconstruir el instalador, porque Tauri carga la web servida por la API.

## Respaldo y recuperación

- En **Configuración → Respaldos**, el administrador puede generar un respaldo verificado y descargarlo. El servidor necesita `pg_dump` y `pg_restore` instalados; si no están en `PATH`, configurar `PG_BIN_DIR`.

- Ejecutar `npm run backup:db`. Crea un archivo `.dump` con fecha en `backups/` y lo verifica con `pg_restore --list`.
- Copiar los respaldos a otra unidad segura; `backups/` está excluida del repositorio.
- Para ensayar una restauración, crear una base vacía distinta de producción y ejecutar `pg_restore --no-owner --no-privileges --dbname=<base_de_prueba> <archivo.dump>`, con los mismos datos de conexión de `.env`.
- Para recuperar producción, detener la API, conservar una copia del estado actual, restaurar el archivo elegido en una base vacía y apuntar `DATABASE_URL` a esa base. Verificar socios, planes y login antes de reabrir la API.

El respaldo de esta fase fue restaurado en una base temporal y se verificó que recupera las nueve tablas de la aplicación.
# DNI y vigencia para el futuro control de acceso

Los socios nuevos requieren un DNI de 7 u 8 dígitos, sin puntos. No se puede repetir dentro del gimnasio. Las fichas anteriores conservan sus datos y muestran el DNI como pendiente hasta que un administrador las edite.

La consulta autenticada `GET /api/members/eligibility?dni=12345678` devuelve `found`, `eligible`, `reason`, `memberId`, `memberName`, `startDate` y `endDate`. `eligible` solo es verdadero cuando la ficha no está inactiva y la fecha actual de PostgreSQL cae entre inicio y vencimiento, ambos inclusive. Los motivos posibles son `ACTIVE`, `INACTIVE`, `NOT_STARTED`, `EXPIRED` y `NOT_FOUND`. La futura integración de huella deberá resolver la identidad del socio y consultar esta API; todavía no se almacena ningún dato biométrico ni se habilita acceso físico automáticamente.
