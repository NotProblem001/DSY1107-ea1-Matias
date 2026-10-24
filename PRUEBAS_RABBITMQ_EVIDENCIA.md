# Evidencia de pruebas · RabbitMQ (Pedidos360)

- **Fecha:** 2026-10-24.
- **Entorno local:** Docker Desktop (WSL2), clúster de 3 nodos `rabbitmq:4-management`, `pedidos-mensajeria-ms`, `rabbit-admin-ms` y `backend`.
- **CI:** GitHub Actions `ubuntu-latest`, mismo `docker-compose.yml`.

## Resumen

| Suite | Local | CI (run 40101979326) |
|---|---|---|
| Unitarias `pedidos-mensajeria-ms` | 6/6 ✅ | 6/6 ✅ |
| Unitarias `rabbit-admin-ms` | 7/7 ✅ | 7/7 ✅ |
| Unitarias + integración `backend` | 10/10 ✅ | 10/10 ✅ (run 40100525652) |
| `prueba-e2e.sh` | 33/33 ✅ | ✅ |
| `prueba-resiliencia-carga.sh` | ✅ (2000 eventos) | ✅ (1000 eventos) |

## Fase 2 · Pipelines

| Workflow | Disparador | Estado | Nota |
|---|---|---|---|
| `messaging_ci.yml` (nuevo) | push / PR en `messaging/**`, manual | ✅ | Unitarias en matriz → clúster real → E2E → resiliencia y carga → `down -v` siempre |
| `backend_compile.yml` | push a `main`, **PR (nuevo)**, manual | ✅ | Antes no validaba ramas ni PR |
| `frontend_compile.yml` | push a `main` | ✅ (último run) | Sin cambios |
| `backend_deploy` / `frontend_deploy` / `user_token_ms_deploy` | push a `main` | ❌ | `The security token included in the request is expired`: los secrets de AWS Academy vencieron. No se modificaron secrets. Hay que actualizarlos al iniciar el lab |

## Fase 3 · Batería de pruebas

### 3.1 Conectividad y topología

```
1. Routing exclusivo por routing key (topic)
  [OK]  pedido.actualizado llega a notificaciones (pedido.#)
  [OK]  tickets NO recibe pedido.actualizado (solo pedido.creado)
  [OK]  documentos NO recibe eventos del topic (solo direct)
2. Fanout: copia a todas las colas enlazadas, ignora la routing key
  [OK]  exchange fanout creado (201)
  [OK]  test.fan.a (enlazada) recibe (1)
  [OK]  test.fan.b (enlazada) recibe (1)
  [OK]  test.fan.c (sin binding) no recibe (0)
```

Además, `prueba-e2e.sh` verifica:
- productor → consumidor JSON con ACK en las 3 colas;
- exchanges `pedidos.eventos` (topic), `pedidos.documentos` y `pedidos.dlx` (direct);
- un exchange headers con `x-match=all` creado y enlazado desde el administrador.

### 3.2 Resiliencia y manejo de errores

```
3. Rechazo con requeue=true y requeue=false
  [OK]  reject requeue=true: vuelve a la cola (1)
  [OK]  reject requeue=true: no va a la DLQ (0)
  [OK]  reject requeue=false: sale de la cola (0)
  [OK]  reject requeue=false: llega a la DLQ (1)
4. Expiracion por TTL -> DLQ
  [OK]  test.ttl vacia tras 1.5 s de TTL (0)
  [OK]  DLQ acumula rechazado + expirado (2)
  [OK]  x-death.reason en la DLQ (expired,rejected)
5. Durabilidad: reinicio de los 3 nodos
  [OK]  50 mensajes persistentes antes del reinicio (50)
  cluster disponible tras 5.5 s
  [OK]  50 mensajes siguen tras el reinicio (50)
  [OK]  DLQ conserva sus mensajes tras el reinicio (2)
  [OK]  consumidores se reconectan solos y procesan
  [OK]  nodos en ejecucion tras el reinicio (3)
```

Errores de procesamiento en los consumidores (`prueba-e2e.sh`):
- error transitorio: 3 reintentos (`x-reintentos`) y luego `basicNack(requeue=false)` → `notificaciones.dlq`;
- error permanente: `basicReject(requeue=false)` → DLQ directo;
- failover: con `docker stop rabbitmq-2` se siguió publicando y consumiendo.

### 3.3 Carga y estrés

**Antes de la corrección** (`prefetch: 1`), 2000 eventos con 50 hilos:

```
  [FAIL] entregas confirmadas con ACK: esperado 6000, obtenido 3967
  publicacion: 4.1 s -> 491 eventos/s
  procesamiento total: 198.2 s -> 30 entregas/s
  pico de mensajes en espera: 2371
DLQ:  667 documentos.queue motivo=maxlen | 673 notificaciones.queue motivo=maxlen | 693 tickets.queue motivo=maxlen
```

- No se perdió ningún mensaje: las 2033 entregas que faltaban quedaron auditadas en la DLQ por la política `x-max-length=1000` (`drop-head`).
- La causa fue el consumo lento: con colas quorum, cada mensaje necesita un round-trip de Raft antes de recibir el siguiente.

**Después** (`prefetch: 25`, `concurrency: 3-5`):

| Métrica | Local (2000 eventos = 6000 entregas) | CI (1000 eventos = 3000 entregas) |
|---|---|---|
| Aceptados (HTTP 202) | 2000/2000 | 1000/1000 |
| ACK | **6000/6000**, DLQ 0 | **3000/3000**, DLQ 0 |
| REJECT/NACK | 0 | 0 |
| Publicación | 4.6 s → 437 eventos/s | 5.2 s → 193 eventos/s |
| Procesamiento total | 5.3 s → **1138 entregas/s** (×38) | 6.6 s → 453 entregas/s |
| Pico en espera | 0 (drenado antes del primer muestreo) | 1338 |
| Colas al final | 0/0/0 | 0/0/0 |

Estado del clúster tras la prueba local:

```
  nodo rabbit@rabbitmq-1: memoria 157 MB (limite 9547 MB) alarma_mem=False alarma_disco=False sockets/fd=54
  nodo rabbit@rabbitmq-2: memoria 155 MB (limite 9547 MB) alarma_mem=False alarma_disco=False sockets/fd=52
  nodo rabbit@rabbitmq-3: memoria 151 MB (limite 9547 MB) alarma_mem=False alarma_disco=False sockets/fd=52
  conexiones=2 canales=15 consumidores=12
```

Bajo la carga no se activó ninguna alarma de memoria ni de disco (`vm_memory_high_watermark` 0.6).

## Fase 4 · Auditoría de código

| Aspecto | Resultado |
|---|---|
| Convención de nombres | Consistente: `pedidos.<propósito>`, `<dominio>.queue/.dlq/.dead`, `pedido.<evento>`. Sin cambios, porque renombrar invalidaría colas existentes |
| Bucles de reintento | Corregido antes: contador propio `x-reintentos` (máx. 3) + `x-delivery-limit: 5` como red de seguridad |
| Serialización JSON | Corregido antes: el conversor JSON solo se usa al publicar; los listeners parsean el `Message` crudo y validan con Bean Validation |
| Throughput de consumidores | **Corregido en esta auditoría:** prefetch 1 → 25 |
| Frontend → backend → RabbitMQ | `frontend/src/api.js` invoca `POST`/`PUT /pedidos`; el backend publica `CREADO`/`ACTUALIZADO` (verificado con los tests del backend contra el clúster: ACK en los 3 consumidores) |

## Cómo reproducir

```bash
cd messaging
docker compose --profile apps up -d --build --wait
bash scripts/prueba-e2e.sh
N_CARGA=2000 PARALELO=50 bash scripts/prueba-resiliencia-carga.sh
```
