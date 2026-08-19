# Team Cornetas — Mitos y Leyendas Winrate

Aplicación web para registrar las partidas de **Mitos y Leyendas** del Team Cornetas y convertirlas en estadísticas útiles para el almuerzo y para preparación de torneos.

## Jugadores

- Braulio
- Wladimick
- Ignacio
- Diego
- Claudio
- Diever
- Cristobal
- Renzo

La aplicación no usa login en el MVP. Al entrar se selecciona un perfil y la elección queda recordada en ese navegador. Esto es una identidad de conveniencia, no autenticación: cualquier persona con la URL puede seleccionar cualquiera de los perfiles.

## Qué permite registrar

Cada encuentro guarda:

- fecha
- formato `Almuerzo libre` o `BO3 / torneo`
- jugador A y su raza/mazo
- jugador B y su raza/mazo
- entre 1 y 3 juegos
- ganador del dado por juego
- ganador de cada juego
- integrante del Team Cornetas que registró el encuentro

El modelo permite guardar una sesión aunque ese día solo se alcancen a jugar uno o dos juegos.

## Métricas

- winrate por jugador
- victorias y derrotas
- winrate por raza
- juegos y encuentros por período
- ventaja del dado: cuántas veces gana el juego quien ganó el dado
- filtros Hoy / Este mes / Histórico
- ranking del Team Cornetas
- últimos encuentros

La portada incluye además un **Dado** rápido de 1 a 6 para resolver quién parte.

## Stack

- Next.js 16
- React 19
- TypeScript
- Supabase JS
- Supabase Postgres + RLS
- CSS responsive propio
- Vercel

## Variables de entorno

```bash
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

## Configuración de Supabase

Ejecutar en este orden desde **Supabase → SQL Editor**:

1. `supabase/schema.sql`
2. `supabase/002_public_player_mode.sql`

El segundo script cambia el MVP al modo sin login:

- lectura pública
- creación pública mediante perfil seleccionado
- sin permisos anónimos de actualización o eliminación

## Ejecutar localmente

```bash
npm install
npm run dev
```

Luego abre `http://localhost:3000`.

## Flujo del MVP

1. El integrante abre la app.
2. Selecciona su perfil.
3. Registra un encuentro de 1 a 3 juegos.
4. La información se guarda en Supabase.
5. Todos los dispositivos leen el mismo historial.
6. La app actualiza la nube automáticamente cada 15 segundos y al volver a la ventana.

## Seguridad del modo sin login

El selector de jugador **no prueba la identidad**. Está pensado para un grupo pequeño que comparte la URL. En esta etapa no se permite `UPDATE` ni `DELETE` al rol anónimo para reducir el riesgo de perder historial.

Si el proyecto crece, la siguiente mejora recomendada es un PIN por jugador o autenticación real.

## Próximas mejoras

- catálogo controlado de razas/mazos
- perfiles y estadísticas individuales
- head-to-head
- matchup de razas
- rachas
- ELO interno
- temporadas y torneos
