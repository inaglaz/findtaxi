# Despliegue en Cloudflare Pages + D1 (vía GitHub)

## 1. Subir el proyecto a GitHub

Desde la carpeta del proyecto:

```bash
git init
git add .
git commit -m "Initial commit: FindTaxi dashboard + Cloudflare Pages Function"
git branch -M main
```

Crea el repo en https://github.com/new (puede ser privado), copia la URL
y enlázalo:

```bash
git remote add origin https://github.com/<TU-USUARIO>/findtaxi.git
git push -u origin main
```

## 2. Aplicar el schema en D1

Tu base de datos ya existe (`findtaxi-db`, id `e8eaff95-06e7-4256-baec-07d4d25ed1c9`).
Falta crear la tabla `services`:

1. Abre https://dash.cloudflare.com → **Workers & Pages → D1 → findtaxi-db**.
2. Pestaña **Console**.
3. Pega el contenido de `schema.sql` y pulsa **Execute**.

## 3. Conectar GitHub a Pages

1. Cloudflare → **Workers & Pages → Create → Pages → Connect to Git**.
2. Selecciona el repo `findtaxi`.
3. Configuración del build:
   - **Project name**: `findtaxi`
   - **Production branch**: `main`
   - **Framework preset**: *None*
   - **Build command**: *(deja vacío)*
   - **Build output directory**: `/`
4. **Save and Deploy**.

El primer despliegue tardará ~1 min. Te dará una URL como
`https://findtaxi.pages.dev`.

## 4. Configurar binding de D1

En el proyecto Pages recién creado: **Settings → Functions → D1 database bindings → Add binding**.

- Variable name: `DB`
- D1 database: `findtaxi-db`

Repite el paso para **Preview** (botón "Add binding" en la sección Preview).

## 5. Configurar el secreto API_TOKEN

**Settings → Environment variables → Production → Add variable**.

- Variable name: `API_TOKEN`
- Value: `740ed5c2c08938d3ab8c020c82ba802c3332a0d6ae2f6287c2b17c63732b1f12`
- Marca como **Encrypt** (lo convierte en secret).

Repite en **Preview**.

> ⚠️ Es exactamente el mismo valor que ya está embebido en `index.html`.
> Si lo cambias en un sitio, cámbialo en los dos.

## 6. Re-desplegar

Después de añadir bindings y secret, hay que volver a desplegar para que
las Functions los lean:

- Opción rápida: **Deployments → último despliegue → "Retry deployment"**.
- Opción manual: haz un commit cualquiera (`git commit --allow-empty -m "redeploy"; git push`) y se redespliega solo.

## 7. Verificar

1. Abre `https://findtaxi.pages.dev`.
2. Apunta un servicio. La barra de estado abajo debería pasar a
   **"Sincronizado"** en ~1.5 s.
3. Recarga en otro navegador o dispositivo: deben aparecer los servicios.

## Cómo conectar tu dominio (opcional)

Si quieres que reemplace a `findtaxi.netlify.app`:

- Cloudflare Pages → **Custom domains → Set up a custom domain** y sigue
  el wizard.
- Cuando esté listo, da de baja el sitio en Netlify.

## Troubleshooting

| Síntoma                                              | Causa probable                                                  |
| ---------------------------------------------------- | --------------------------------------------------------------- |
| "Sin conexión" al abrir la app                       | Aún no has hecho re-deploy tras añadir el binding D1.           |
| 401 unauthorized en consola                          | El `API_TOKEN` del HTML no coincide con el secret de Cloudflare.|
| 500 "D1 binding missing"                             | Falta el binding `DB` en Settings → Functions.                  |
| 404 al pedir `/api/services`                         | La carpeta `functions/` no se subió al repo.                    |
| Las filas se ven en local pero no en otro dispositivo| Solo se sincroniza al modificar — abre/cierra alguna celda.     |
