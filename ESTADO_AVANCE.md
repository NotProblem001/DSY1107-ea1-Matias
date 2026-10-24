# Estado de avance · EP3/EP4 RabbitMQ (Pedidos360)

Fuente: `CloudNative/EP3_DSY1107_Estudiante_encargo.pdf`, `EP4_..._presentación.pdf` y guías 2.1.1 – 2.3.1.

## Matriz de trazabilidad (pauta EP3 · encargo)

| # | Indicador (peso) | Dónde se cumple | Estado |
|---|---|---|---|
| 1 | Nombres de colas/exchanges/bindings centralizados (12%) | `messaging/*/src/main/resources/application.yml` → `MensajeriaProperties` | ✅ |
| 2 | Beans `Queue`/`Exchange`/`Binding` por caso de uso (13%) | `pedidos-mensajeria-ms/.../config/RabbitTopologyConfig.java` | ✅ |
| 3 | Configuración separada de la lógica de negocio (10%) | paquetes `config/` vs `producer/`, `consumer/`, `service/` | ✅ |
| 4 | `@RabbitListener` agrupados por dominio (15%) | `consumer/notificaciones`, `consumer/tickets`, `consumer/documentos`, `consumer/dlq` | ✅ |
| 5 | ACK manual, NACK, reintentos y DLQ (20%) | `consumer/ConfirmacionManual.java` + `x-delivery-limit` | ✅ |
| 6 | API REST del administrador (13%) | `rabbit-admin-ms/.../controller/RabbitAdminController.java` | ✅ |
| 7 | Lógica encapsulada en `RabbitAdminService` (10%) | `rabbit-admin-ms/.../service/RabbitAdminService.java` | ✅ |
| 8 | Validación de entrada con DTO (7%) | `rabbit-admin-ms/.../dto/*` + `ApiExceptionHandler` | ✅ |
| – | Mensajes no entregados → DLQ + logs | `consumer/dlq/DlqConsumer.java` | ✅ |
| – | Microservicios Spring Boot (varios) | `backend` (EA1) + `pedidos-mensajeria-ms` + `rabbit-admin-ms` | ✅ |
| – | Frontend Angular | El frontend existente es React (EA1). No se reescribió | ⚠️ pendiente decisión del equipo |

## Matriz EP4 (presentación)

| Requisito | Evidencia | Estado |
|---|---|---|
| ≥ 2 nodos RabbitMQ en clúster | `messaging/docker-compose.yml` (3 nodos, quorum) | ✅ local |
| 3 colas con su DLQ | notificaciones / tickets / documentos + `.dlq` | ✅ |
| Exchanges direct y topic | `pedidos.eventos` (topic), `pedidos.documentos` (direct), `pedidos.dlx` (direct) | ✅ |
| docker-compose en la nube | `terraform-rabbitmq/` (EC2 + user-data) | ver sección Fase 3 |

## Fases

- [x] Fase 0 – diagnóstico y matriz
- [x] Fase 1 – RabbitMQ base, productor/consumidor, exchanges
- [x] Fase 2 – ACK/NACK, durabilidad, DLX/DLQ, TTL, alertas, clúster
- [ ] Fase 3 – Terraform AWS (apply → verificar → destroy)
- [ ] Fase 4 – documentación final (`docs/EP3_RABBITMQ.md`)

## Entorno (Fase 0)

- Docker 29.8.0, Compose v5.5.1, Terraform 1.15.8, Java 21.0.11.
- `aws sts get-caller-identity` falla con `CERTIFICATE_VERIFY_FAILED` (el CLI no confía en la CA local que intercepta TLS; `curl` sí funciona).
