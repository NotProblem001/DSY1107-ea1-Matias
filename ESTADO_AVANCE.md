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
| API Manager creado y funcionando | EA1: `terraform/apigateway.tf` (HTTP API v2) | EA1, no reverificado en esta sesión |
| Configuración del API Manager hacia el backend | EA1: rutas e integración HTTP proxy en `apigateway.tf` | EA1, no reverificado |
| Frontend consume endpoints vía API Manager | EA1: `frontend/src` + `scripts/config-frontend.sh` | EA1, no reverificado |
| API Manager valida JWT (rechaza inválidas, acepta válidas) | EA1: JWT Authorizer + scope guards; sección 3 del README | EA1, no reverificado |
| Tenant IDaaS y usuarios registrados | EA1: `terraform/cognito.tf` (3 cuentas demo) | EA1, no reverificado |
| Login OAuth 2.0/OIDC con JWT válido | EA1: Code Flow + PKCE en `frontend/src` | EA1, no reverificado |
| Backend y frontend desplegados e integrados en la nube | EA1: ECS Fargate + Amplify (`scripts/publicar-*.sh`) | EA1, no reverificado. En ECS el backend no tiene broker: los eventos se pierden con log de error |
| ≥ 2 nodos RabbitMQ en clúster | `messaging/docker-compose.yml` (3 nodos, quorum) | ✅ local |
| 3 colas con su DLQ | notificaciones / tickets / documentos + `.dlq` | ✅ |
| Exchanges direct y topic | `pedidos.eventos` (topic), `pedidos.documentos` (direct), `pedidos.dlx` (direct) | ✅ |
| docker-compose en la nube levantando RabbitMQ | `terraform-rabbitmq/desplegar.sh` (EC2 + ECR), evidencia en `docs/evidencias/aws-ec2-2026-10-24.txt` | ✅ verificado y destruido. El docente aclaró que local basta; si se exige en la nube, hay que volver a desplegar el día de la presentación |

## Fases

- [x] Fase 0 – diagnóstico y matriz
- [x] Fase 1 – RabbitMQ base, productor/consumidor, exchanges (commit `35610d2`)
- [x] Fase 2 – ACK/NACK, durabilidad, DLX/DLQ, TTL, alertas, clúster, failover probado
- [x] Fase 3 – Terraform AWS: apply → verificación → `destroy` (6 recursos destruidos, 0 en el estado) (commit `3a3c555`)
- [x] Fase 4 – documentación `docs/EP3_RABBITMQ.md` (sin commit, según el plan)

## Pruebas

- Unitarias: `ConfirmacionManualTest` (6) y `RabbitAdminControllerTest` (7) ✅
- E2E local `messaging/scripts/prueba-e2e.sh`: 33/33 ✅
- Nube: clúster de 3 nodos, 6 colas quorum, ACK y DLQ verificados ✅

## Revisiones periódicas

- **2026-10-24 ~01:55:**
  - Indicadores 1–8 se mantienen. El `grep` de nombres de colas/exchanges escritos a mano en las clases Java da 0 resultados.
  - `docker compose ps`: 5/5 contenedores arriba, los 3 nodos healthy. Sin errores ni alertas inesperadas en los logs de los últimos 25 min.
  - Brechas abiertas, sin corregir:
    - Frontend Angular: el actual es React.
    - El `backend` EA1 no publica eventos. Se dejó así por la regla 1 del plan (no tocar la lógica core).

- **2026-10-24 ~02:15:** sin cambios de código desde la revisión anterior. 5/5 contenedores arriba, logs limpios. Las mismas 2 brechas siguen esperando decisión del usuario.
- **2026-10-24 ~02:35:** sin cambios. 5/5 contenedores arriba (~55 min), logs limpios.
- **2026-10-24 ~02:55:** sin cambios. 5/5 contenedores arriba (~1 h), logs limpios.
- **Revisiones siguientes (x23):** sin cambios. 5/5 contenedores arriba (~9 h), logs limpios.

## Hallazgos corregidos en la autoevaluación

1. RabbitMQ 4 no cuenta los `basicNack(requeue=true)` en `x-delivery-count`, lo que causó un bucle de reintentos. Se reemplazó por el contador `x-reintentos` + NACK final.
2. La declaración pasiva de un exchange inexistente no lanzaba `AmqpIOException`, por eso el administrador respondía 409 en lugar de 201/404. Corregido.
3. El SCP de AWS Academy bloquea S3 en Terraform. El código se entrega por ECR.

## Entorno (Fase 0)

- Docker 29.8.0, Compose v5.5.1, Terraform 1.15.8, Java 21.0.11.
- `aws sts get-caller-identity` falla con `CERTIFICATE_VERIFY_FAILED` porque un proxy local intercepta TLS. Solución: `AWS_CA_BUNDLE` con las CA raíz de Windows, o el CLI y Terraform dentro de contenedores (`terraform-rabbitmq/tf.sh`).
- Maven: `MAVEN_OPTS=-Djavax.net.ssl.trustStoreType=Windows-ROOT`.

## Cambios posteriores

- **Backend publica eventos** (`backend/.../messaging/PedidoEventPublisher`): `POST /pedidos` → `CREADO` (evento + factura) y `PUT /pedidos/{id}` → `ACTUALIZADO`. Tests del backend 10/10; verificado con el clúster local (ACK de los 3 consumidores). Brecha "backend sin productor" cerrada.
- **Bug corregido en `pedidos-mensajeria-ms`:** el conversor JSON se aplicaba a los listeners y un `__TypeId__` desconocido rompía la conversión antes del ACK manual. Ahora el JSON se usa solo en el productor. E2E 33/33.
- **Aclaración del docente:** RabbitMQ y los microservicios pueden correr localmente; `terraform-rabbitmq/` queda como opcional.
- **Revisión posterior:**
  - El backend ahora declara sus exchanges (`TopicExchange` y `DirectExchange`) en `RabbitConfig`, lo que cierra la brecha del indicador 2 ("para todos los microservicios").
  - Bug en `prueba-e2e.sh`: contaba los logs de corridas anteriores. Ahora usa `--since` de la corrida. Resultado 33/33.
  - La alerta CRITICAL de `notificaciones.dlq` apareció durante el rebuild y se resolvió sola.
- **Auditoría (PROMPT_RABBITMQ_AUDIT.md):**
  - Prefetch 1 → 25: de 30 a 1138 entregas/s. La carga de 2000 eventos ya no desborda `x-max-length`.
  - Batería nueva `prueba-resiliencia-carga.sh` (fanout, requeue, TTL, reinicio, carga), integrada en el CI.
  - `backend_compile` ahora valida PR.
  - Los deploys fallan por credenciales vencidas de AWS Academy en los secrets (acción del usuario).
  - Detalle en `PLAN_EJECUCION_RABBITMQ.md` y `PRUEBAS_RABBITMQ_EVIDENCIA.md`.
- **Revisión post-auditoría:**
  - Los 5 contenedores están arriba y `/alertas` está vacío.
  - Los errores del log son todos esperados: el reinicio intencional de los nodos (14:18:00) y los fallos simulados de los pedidos 102/103 de la E2E.
  - Rama sincronizada con `origin` (`54f438d`) y sin cambios pendientes.
  - Brecha abierta: frontend Angular.
- **Revisión siguiente:** sin cambios. 5/5 contenedores arriba, logs limpios.
