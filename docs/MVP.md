# MVP — Team Cornetas Winrate

## Objetivo
Registrar los juegos de Mitos y Leyendas del grupo y convertirlos en estadísticas útiles para el almuerzo y para preparación de torneos.

## Unidad de registro
Un **encuentro** contiene:

- fecha
- formato: almuerzo libre o BO3/torneo
- jugador A + raza/mazo
- jugador B + raza/mazo
- entre 1 y 3 juegos

Cada **juego** registra:

- quién ganó el dado
- quién ganó el juego

Esto permite dejar un BO3 incompleto si en el almuerzo solo alcanzaron a jugar una o dos partidas sin perder datos.

## Métricas incluidas en el MVP

- juegos totales
- encuentros totales
- winrate por jugador
- victorias y derrotas por jugador
- winrate por raza
- porcentaje de juegos donde el ganador del dado también ganó el juego
- filtros Hoy / Este mes / Histórico
- bitácora de últimos encuentros

## Fase cloud

El frontend parte con persistencia local para poder revisar UX sin depender del backend. El esquema `supabase/schema.sql` deja preparado el modo compartido:

- lectura pública de resultados y rankings
- escritura solo para usuarios autenticados
- RLS activado
- encuentros y juegos separados

## Próximas métricas recomendadas

1. Head-to-head entre jugadores.
2. Winrate de una raza contra otra raza.
3. Winrate por jugador + raza.
4. Racha actual y mejor racha.
5. Resultado de series BO3 (2-0 / 2-1 / incompletas).
6. Historial semanal y mensual con gráficos.
7. Ranking ELO interno del Team Cornetas.
8. Temporadas para reiniciar ranking sin borrar el histórico.
9. Torneos internos con bracket.
10. Exportación CSV/imagen para compartir resultados en WhatsApp.

## Criterio de producto
El ingreso de una partida debe tomar menos de un minuto desde un teléfono. Por eso jugadores y razas se reutilizan como sugerencias a medida que se registran datos.
