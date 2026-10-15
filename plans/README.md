# Planes de mejora

| # | Plan | Severidad | Estado |
|---|---|---|---|
| 001 | [Cerrar hojas por velocidad](001-sheet-gesture-velocity.md) | HIGH | DONE |
| 002 | [Transición de mes y cifras](002-dashboard-value-transitions.md) | MEDIUM | DONE |
| 003 | [Reacomodo FLIP de listas](003-list-flip-reflow.md) | MEDIUM | DONE |
| 004 | [Movimiento reducido con retroalimentación](004-reduced-motion-feedback.md) | MEDIUM | DONE |
| 005 | [Tokens, presión, desenfoque e interruptor](005-motion-tokens-press-polish.md) | LOW | DONE |
| 006 | [Chat, "escribiendo" y estados de carga](006-ai-chat-and-loading-states.md) | MEDIUM | DONE |
| 007 | [Deslizar avisos para cerrar](007-toast-swipe-dismiss.md) | LOW | DONE |
| 008 | [Tablet y horizontal](008-tablet-landscape-layout.md) | HIGH | DONE |
| 009 | [Ícono Barras](009-app-icon-bars.md) | MEDIUM | DONE |

## Orden recomendado

001 → 002 → 003 → 004 → 005 → 006 → 007 → 008 → 009.

## Dependencias

- 008 desactiva el gesto de 001 en ventanas centradas: ejecutar 001 antes.
- 004 y 006 añaden reglas al bloque de movimiento reducido; 005 introduce los tokens `--dur-*` que 006 puede usar.
- 009 es independiente (solo recursos).
