# Team Cornetas — Mitos y Leyendas Winrate

Aplicación web para registrar las partidas de **Mitos y Leyendas** del Team Cornetas y convertirlas en estadísticas útiles para el almuerzo y para preparación de torneos.

## Qué permite registrar

Cada encuentro guarda:

- fecha
- formato `Almuerzo libre` o `BO3 / torneo`
- jugador A y su raza/mazo
- jugador B y su raza/mazo
- entre 1 y 3 juegos
- ganador del dado por juego
- ganador de cada juego

El modelo permite guardar un BO3 aunque ese día solo se alcancen a jugar uno o dos juegos.

## Métricas del MVP

- winrate por jugador
- victorias y derrotas
- winrate por raza
- juegos y encuentros por período
- ventaja del dado: cuántas veces gana el juego quien ganó el dado
- filtros Hoy / Este mes / Histórico
- ranking del Team Cornetas
- últimos encuentros

## Stack

- Next.js 16
- React 19
- TypeScript
- CSS responsive propio
- Supabase preparado para la fase de datos compartidos
- Vercel recomendado para publicación

## Ejecutar localmente

```bash
npm install
npm run dev
```

Luego abre `http://localhost:3000`.

## Estado actual

La rama `feat/mvp-team-cornetas` contiene una primera versión revisable que usa `localStorage` para poder probar toda la experiencia sin backend. Puedes usar **Cargar demo** para visualizar datos ficticios.

La siguiente fase conecta `supabase/schema.sql` para que todos vean el mismo historial. La lectura quedará pública y la escritura protegida mediante autenticación.

## Documentación

- `docs/MVP.md`: modelo, métricas y roadmap.
- `supabase/schema.sql`: esquema cloud propuesto con RLS.

## Próximos pasos

1. Crear proyecto Supabase del Team Cornetas.
2. Conectar Auth + base de datos al frontend.
3. Publicar en Vercel.
4. Agregar head-to-head, matchup de razas y ELO interno.
