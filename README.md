# Navega360 Studio

Editor visual de recorridos virtuales 360°, listo para sitios estáticos en GitHub + Vercel. **No es una copia de Kuula, sino un editor propio de recorridos virtuales con funciones similares.**

## Funcionalidades

- Agregar muchas imágenes JPG, PNG o WEBP de una vez, o arrastrarlas al editor.
- Detectar panorámicas equirectangulares aproximadamente 2:1. Al agregar una colección nueva, la **primera y la última imagen** se establecen como fotografía normal; su tipo se puede cambiar manualmente.
- Cambiar el orden de las escenas y renombrarlas.
- Colocar *hotspots* de enlace o información en panorámicas 360° y fotos normales. Para mover un punto, selecciónalo y pulsa **Reubicar en la imagen**; después haz clic en la ubicación deseada.
- Asignar destinos entre las escenas.
- Guardar la orientación inicial de cada panorámica.
- Música de fondo, en bucle, activada por el visitante (los navegadores impiden reproducir audio con sonido automáticamente antes de una interacción).
- Vista previa de visitante, navegación anterior/siguiente y puntos interactivos.
- Guardado automático en el **almacenamiento local del navegador (IndexedDB)**.
- Exportación de un sitio web completo ZIP con fotografías, música, `tour.json` y un visor de visitantes.
- Importación del mismo ZIP para editar de nuevo y conservar un respaldo.

## Inicio inmediato (Windows)

1. Descomprime `Navega360-Studio.zip`.
2. Si tienes **Python 3** instalado, ejecuta `INICIAR-EN-WINDOWS.bat` y abre `http://localhost:8000`.
3. Como alternativa, publica la carpeta del editor mediante GitHub y Vercel. Abre la dirección pública del editor. El navegador debe tener conexión a Internet para cargar **Pannellum** desde el CDN.
4. **Subir fotografías** → organiza → **Enlace** o **Información** → clic en la fotografía para colocar el punto → configura el destino o la descripción a la derecha.
5. **Música de fondo** → sube el archivo de audio. **Vista previa** → prueba el recorrido.
6. **Exportar sitio web** → descargará un ZIP que también sirve como **respaldo editable** del recorrido.

> **Importante:** Si cierras el navegador, el proyecto normalmente sigue allí en el mismo navegador y equipo. No borres los datos del sitio, no dependas únicamente del guardado local y conserva el ZIP. Las fotografías no se almacenan automáticamente en GitHub o Vercel al subirlas al editor.

## Publicar el EDITOR en GitHub y Vercel

1. En GitHub crea un nuevo repositorio, por ejemplo `navega360-studio`.
2. Sube al repositorio los archivos de esta carpeta, incluyendo `index.html`, `app.js`, `style.css`, `vendor/`, `publicador/` y `vercel.json`.
3. Abre [vercel.com](https://vercel.com/), crea un nuevo proyecto e importa ese repositorio.
4. Usa **Framework Preset: Other** y deja vacío el **Build Command** (no requiere Node ni paquetes npm). Directorio de salida: raíz del proyecto (`.`), si te pide uno.
5. Vercel te dará una URL para abrir el editor desde cualquier equipo, aunque cada navegador manejará sus propios archivos locales.

## Publicar cada RECORRIDO terminado

1. Desde el editor, selecciona **Exportar sitio web**.
2. Descomprime el ZIP de salida. Verás `index.html`, `viewer.js`, `viewer.css`, `tour.json`, `assets/` y `vercel.json`.
3. Crea **otro repositorio** GitHub, por ejemplo `recorrido-teatro`.
4. Sube **los archivos descomprimidos a la raíz** de ese repositorio (no subas solo el ZIP).
5. Importa el segundo repositorio en Vercel como **sitio estático** (Framework: Other; sin compilación).
6. Comparte el enlace público que Vercel te entregue.
7. Cuando necesites editar, usa **Importar proyecto** en el editor con el ZIP respaldado, edita y vuelve a subir al repositorio del recorrido los archivos extraídos del nuevo ZIP.

> Si tienes muchas fotos o son muy grandes, el ZIP puede superar los límites de subida web de GitHub. Conviene optimizar las panorámicas JPG a 4096–8192 píxeles de ancho y un peso razonable por archivo. Pannellum recomienda 4096 px para amplia compatibilidad. Las fotografías 360° deben ser **equirectangulares**; una foto normal no se convierte en 360° al cambiar el selector.

## Limitaciones de esta versión

- Es una herramienta estática. **No incluye cuentas, editor colaborativo, subida directa a GitHub/Vercel ni base de datos remota**. La publicación requiere exportar y subir los archivos.
- No cuenta con funciones avanzadas de Kuula como estadísticas, mapas, planos, analíticas, alojamiento de medios, control multiusuario o recorridos VR con casco.
- El editor y el recorrido publicado usan Pannellum 2.5.7 mediante CDN externo, por lo que requieren Internet para ver imágenes panorámicas. Las fotografías normales funcionan sin ese recurso.
- Audio con copyright: usa música original, libre de derechos o con licencia apropiada para su publicación.

## Estructura

- `index.html`, `style.css`, `app.js`: editor.
- `vendor/jszip.min.js`: biblioteca JSZip para exportar/importar ZIP.
- `publicador/index.html`, `publicador/viewer.css`, `publicador/viewer.js`: plantilla pública incluida en cada exportación.
- `vercel.json`: configuración de sitio estático.
- `INICIAR-EN-WINDOWS.bat`: arranque local opcional mediante Python 3.

## Atribuciones

- **Pannellum** © Matthew Petroff y colaboradores, licencia MIT, [pannellum.org](https://pannellum.org/).
- **JSZip** © Stuart Knightley y colaboradores, licencia MIT/GPLv3; se distribuye con su archivo de licencia en `vendor/LICENCIA-JSZIP.md`.
