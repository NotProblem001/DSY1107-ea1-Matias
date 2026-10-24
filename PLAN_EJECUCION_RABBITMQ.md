# Plan de ejecución · Auditoría RabbitMQ (PROMPT_RABBITMQ_AUDIT.md)

## 1. Diagnóstico del código actual

| Componente | Estado | Observación |
|---|---|---|
| `messaging/docker-compose.yml` | ✅ | 3 nodos `rabbitmq:4-management`, cookie compartida, `classic_config`, un volumen por nodo, healthchecks |
| `pedidos-mensajeria-ms` | ✅ | Topología centralizada en `application.yml` → `RabbitTopologyConfig`. 3 colas quorum con DLQ, consumidores por dominio, ACK manual |
| `rabbit-admin-ms` | ✅ | `RabbitAdminService`, DTO validados, alertas programadas |
| `backend` (EA1) | ✅ | Productor AMQP en `POST`/`PUT /pedidos`. Si no hay broker no se cuelga ni se marca DOWN |
| `frontend` | ✅ sin cambios | Ya invoca `POST`/`PUT /pedidos` (`api.js`). El payload cumple la validación de los consumidores, así que la cadena frontend → backend → RabbitMQ funciona |
| CI | ⚠️ → ✅ | Ver sección 2 |

**Convención de nombres** (se mantiene, no se renombra):
- exchanges: `pedidos.<propósito>`
- colas: `<dominio>.queue` / `<dominio>.dlq`
- routing keys: `pedido.<evento>`, `documento.<tipo>`, `<dominio>.dead`

Renombrar invalidaría las colas existentes (los argumentos de una cola son inmutables) sin ganar claridad.

## 2. Puntos de falla detectados

| # | Hallazgo | Severidad | Acción |
|---|---|---|---|
| 1 | `prefetch: 1` con colas quorum drenaba ~30 entregas/s. Una ráfaga de 2000 eventos desbordó `x-max-length` (1000) y 2033 entregas fueron a la DLQ por `maxlen` | Alta (bajo carga) | `prefetch: 25`, `concurrency: 3-5` → 1138 entregas/s, 0 a la DLQ |
| 2 | La prueba de carga con `xargs curl` (un proceso por request en Windows) no generaba presión real (58 ev/s, pico 0) | Media (prueba inválida) | Generador con hilos en Python stdlib (~440 ev/s) |
| 3 | `backend_compile` solo corría en `main`: los PR del backend no se validaban | Media | Trigger `pull_request` |
| 4 | Faltaba en CI la batería de resiliencia y carga | Media | Paso nuevo en `messaging_ci.yml` (1000 eventos) |
| 5 | `frontend_deploy`, `user_token_ms_deploy` (y `backend_deploy` si se dispara): `The security token included in the request is expired` | Externa | Las credenciales de AWS Academy en los secrets de GitHub vencen con cada sesión del lab. **No se modifican secrets**: el usuario debe actualizarlos (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN`) |

Ya corregidos antes de esta auditoría:
- reintentos infinitos (RabbitMQ 4 no cuenta los `nack requeue`);
- `__TypeId__` ajeno que rompía el ACK manual;
- E2E que contaba logs de corridas anteriores.

## 3. Estrategia de pruebas

| Nivel | Herramienta | Cobertura |
|---|---|---|
| Unitarias | JUnit + Mockito (3 servicios, 23 tests) | Decisión ACK/NACK/REJECT, productor del backend, validación REST del administrador |
| E2E | `messaging/scripts/prueba-e2e.sh` (33 checks) | Clúster, topología, ACK, reintento → NACK → DLQ, REJECT → DLQ, CRUD del administrador |
| Resiliencia y carga | `messaging/scripts/prueba-resiliencia-carga.sh` | Routing exclusivo, fanout, `requeue=true/false`, TTL → DLQ, reinicio de los 3 nodos, carga de N eventos (ACK + DLQ = 3N) |
| CI | `messaging_ci.yml` | Los tres niveles contra un clúster real en GitHub Actions |

Resultados: `PRUEBAS_RABBITMQ_EVIDENCIA.md`.
