# Navega360 Studio V4.1 · Corrección del error 404

## ¿Qué cambia respecto a V3?

**Ya NO necesitas exportar un ZIP ni subir fotografías a GitHub.** Se publica directamente desde el editor en Vercel y el enlace de visita abre un **visor sin herramientas de edición**.

- Editor: `https://TU-PROYECTO.vercel.app/`.
- Enlace para visitantes (ahora **sin depender de redirecciones**): `https://TU-PROYECTO.vercel.app/publicador/index.html?tour=identificador-de-tu-recorrido`.
- Los enlaces anteriores `/ver/identificador` siguen siendo compatibles gracias a una regla corregida de Vercel.
- Cambias hotspots o escenas → pulsa **☁ Publicar enlace → Guardar y actualizar recorrido en línea**. El enlace no cambia.
- El editor tiene contraseña **para publicar y sobrescribir** recorridos. El código del editor es público, pero la nube **no acepta escrituras sin la contraseña**.
- Los visitantes pueden recorrer las escenas, activar música, pulsar los hotspots con iconos personalizados y abrir Facebook/Google Maps, pero **no pueden modificar el recorrido desde el visor**.

## Solución al error `404 NOT_FOUND` de V4

La versión anterior usaba `cleanUrls: true` **junto con** un rewrite cuyo destino terminaba en `/publicador/index.html`. Vercel requiere que, cuando `cleanUrls` es `true`, el destino de un rewrite no lleve `.html`. Además, V4 mostraba el enlace incluso antes de verificar que la publicación había concluido.

**Cambios en V4.1:**

1. `vercel.json` configura explícitamente `cleanUrls: false` y conserva `/ver/:tour` como enlace retrocompatible.
2. El editor genera **directamente** `/publicador/index.html?tour=...`, que apunta a un archivo real del proyecto, sin necesitar el rewrite para verlo.
3. El editor **no muestra ni deja copiar** el enlace de visita hasta que el servidor termina de guardar el recorrido.

**Para actualizar si ya usabas V4:** Descomprime el ZIP V4.1. Sustituye en GitHub los archivos del proyecto (es suficiente modificar `vercel.json`, `cloud.js`, `index.html`, `api/publish.js` y `README.md`), asegurándote de que `vercel.json` y `index.html` están en la raíz del repositorio usada por Vercel. Después espera un despliegue correcto (estado **Ready**). No modifiques ni borres las fotos de Vercel Blob.

**Comprobaciones rápidas:**

- `https://TU-PROYECTO.vercel.app/`: debe abrir el editor.
- `https://TU-PROYECTO.vercel.app/publicador/index.html?tour=TU-ID`: debe abrir la interfaz del visor, aunque puede indicar "no se encontró" si todavía no se publicó el recorrido.
- `https://TU-PROYECTO.vercel.app/api/tour?id=TU-ID`: debe devolver JSON con escenas si se publicó; JSON con error si no existe. Si devuelve un 404 propio de Vercel, revisa la carpeta `api/` en GitHub y la configuración de **Root Directory** en Vercel.

Si **también la raíz del editor** devuelve la pantalla blanca 404, el problema es el despliegue o la carpeta raíz del proyecto; la corrección de la ruta por sí sola no lo arregla. Confirma que Vercel tenga como **Framework Preset: Other** y **Root Directory: `./`** si el código está en la raíz del repositorio, sin una carpeta `dist` obligatoria.

## Configurar GitHub y Vercel (solo una vez)

1. Conserva tu proyecto V3 y su URL para evitar perder datos. **Haz un respaldo** antes de actualizar; en V3 selecciona *Exportar sitio web* si funciona o conserva las fotografías originales y sus hotspots en el mismo navegador. Al actualizar el proyecto bajo el **mismo dominio** Vercel, V4 lee automáticamente su guardado local V3 (IndexedDB).
2. Abre el ZIP de V4 y **descomprímelo**. Sube **solo el código** al repositorio de GitHub vinculado a Vercel. Usa estos archivos del proyecto: `index.html`, `app.js`, `cloud.js`, `style.css`, `publicador/`, `api/`, `lib/`, `vendor/`, `package.json`, `vercel.json` y `README.md`. No subas fotografías ni la música.
3. En Vercel selecciona ese repositorio (o actualiza la implementación existente), **Framework Preset: Other**. Este proyecto ya no es meramente estático: utiliza funciones de Vercel y el paquete de Node `@vercel/blob`. Vercel debe instalar automáticamente la dependencia de `package.json`.
4. En el panel de Vercel, abre **Storage** → crea y conecta un almacenamiento **Blob público (Public)** al proyecto. El visor necesita imágenes accesibles por su URL. En configuraciones modernas Vercel puede habilitar autenticación OIDC automáticamente; V4 utiliza URLs firmadas y admite esta opción. No publiques secretos en GitHub.
5. En **Settings → Environment Variables**, agrega `NAVEGA_ADMIN_PASSWORD` con una contraseña fuerte de **mínimo 16 caracteres**. Selecciona **Production** y también Preview si vas a probar en entornos de prueba. **Nunca escribas esta contraseña en ningún archivo del repositorio.**
6. Después de crear Blob y la variable de entorno, **redeploy/redeploy** del proyecto para que las funciones obtengan la configuración.
7. Abre la dirección de Vercel del **editor**, desde el mismo navegador y dominio de V3. Verifica que tu recorrido siga cargado. Si usas otro navegador o dominio, la copia local no estará allí: carga tu respaldo ZIP (si lo tienes) o **Cargar publicado** si ya lo subiste en V4.
8. Pulsa **☁ Publicar enlace**, introduce la contraseña que configuraste, pulsa **Guardar y actualizar recorrido en línea** y espera el mensaje **«✓ Recorrido publicado»**. Copia el enlace del cuadro, envíalo a tus visitantes.

## Editar después de publicar

Conserva el mismo navegador y los datos del sitio para mantener el proyecto editable. Si editas desde otro equipo, usa el botón **«Cargar publicado»** con el enlace público, acepta reemplazar el proyecto local e introduce la contraseña solo al volver a publicar. Los archivos ya almacenados en la nube se reutilizan si no los cambias.

## Cuestiones importantes

- El guardado de escenas y hotspots mientras editas **sigue siendo local** y automático. Solo se sincroniza al pulsar «Guardar y actualizar recorrido en línea». Un editor colaborativo, ediciones simultáneas, versionado y cuentas individuales **aún no están implementados**.
- Los archivos multimedia se transfieren **directamente del navegador a Vercel Blob** con URL firmada por el servidor. La contraseña no se envía a Blob y **no** se introduce en un enlace compartido. El tamaño máximo de cada archivo en esta versión es de **250 MiB**, sujeto a límites de almacenamiento/cuenta/navegador. Para archivos muy grandes, es recomendable comprimir las fotos 360° antes de subirlas.
- **Vercel Blob tiene cuotas de uso y puede generar cargos** por almacenamiento, operaciones y descargas. Consulta la información de precios de tu cuenta en Vercel.
- **Blob público significa que las fotografías, música e iconos pueden ser descargados por cualquier persona que tenga su dirección pública**. El visor es de solo lectura; eso no impide guardar/copiar archivos vistos. No uses este modo para información confidencial.
- Los recorridos se guardan como manifiestos JSON con nombre de archivo nuevo cada publicación para evitar servir una versión anterior por caché. En cada visita se consulta el manifiesto más reciente del recorrido, lo que implica una operación de listado de Blob; es adecuado para proyectos pequeños, pero para tráfico alto convendría una base de datos o un índice de publicaciones.
- Si publicas con el mismo identificador desde otro navegador se reemplaza la **versión más reciente** visible, no las fotos originales. Los medios anteriores no se borran automáticamente; revisa Storage periódicamente.
- Los enlaces externos de hotspots admiten HTTP y HTTPS; el visor no ejecuta código de los enlaces.
- La música depende de la interacción del visitante; los navegadores suelen bloquear sonido automático.
- Pannellum 2.5.7 se carga desde el CDN de jsDelivr, requiere Internet.
- Usa música propia o con licencia apropiada para publicación.

## Estructura

`app.js`, `index.html`, `style.css`: editor original V3 compatible.

`cloud.js`: botones, subida directa a Blob, publicación e importación de recorridos de la nube.

`api/media-token.js`: autoriza cada subida y crea una URL temporal firmada. `api/media-url.js`: confirma el archivo y obtiene su URL. `api/publish.js`: escribe el manifiesto público tras verificar contraseña. `api/tour.js`: obtiene el recorrido público más reciente.

`lib/shared.js`: autenticación y validaciones comunes del servidor.

`publicador/`: visor público sin controles de edición.

`package.json`: dependencia de Vercel Blob.

## Referencias oficiales

- [Vercel Blob · documentación](https://vercel.com/docs/vercel-blob)
- [Firmar direcciones Blob](https://vercel.com/changelog/signed-urls-are-now-available-for-vercel-blob)
- [Seguridad de Blob](https://vercel.com/docs/vercel-blob/security)
- [Consumo y costos](https://vercel.com/docs/vercel-blob/usage-and-pricing)
