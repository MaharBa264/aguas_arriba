# Aguas arriba

Laboratorio interactivo del lance de pesca con mosca. Simula la caña, la línea, el líder y la mosca, y deja probar cómo cambian con el viento y el equipo.

## Estructura

- `public/`: el sitio. Es estático, sin paso de compilación; esta carpeta es lo único que se publica.
- `public/cast-model.js`: el modelo físico y el gesto del lanzador.
- `test/`: invariantes del modelo.
- `serve.js`: servidor local.

## Uso local

```bash
npm start   # http://localhost:8123
npm test
```

## Publicación

Cloudflare Pages, conectado a este repositorio: sin comando de compilación y con `public` como directorio de salida.
