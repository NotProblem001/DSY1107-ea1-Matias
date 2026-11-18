# Evidencia: 3.2.2 Pipeline de eventos end-to-end (Pedidos360)

Corrida local del 2026-11-18 con `streaming/docker-compose.yml` (Zookeeper, Kafka 7.5.0 y Kafka-UI) y `pedidos-streaming-ms` levantado con `./mvnw spring-boot:run`. Configuración: `monto-minimo=1000` y `monto-sospechoso=1000000`.

## 1. Compilación

```
java version "21.0.11" 2026-04-21 LTS
./mvnw -q -DskipTests package  -> exit 0, target/pedidos-streaming-ms-0.0.1-SNAPSHOT.jar
./mvnw test                    -> Tests run: 3, Failures: 0, Errors: 0  (PedidoPartitionerTest, 3.2.1)
```

## 2. Topics creados por KafkaAdmin al arrancar

El broker tiene `AUTO_CREATE_TOPICS_ENABLE=false`, así que los topics los crea el propio microservicio.

```
$ kafka-topics --bootstrap-server localhost:9092 --list
__consumer_offsets
pedidos-alertas
pedidos-eventos
pedidos-particiones

Topic: pedidos-eventos  PartitionCount: 3  ReplicationFactor: 1
Topic: pedidos-alertas  PartitionCount: 3  ReplicationFactor: 1
```

## 3. Arranque del pipeline

```
INFO  [main]            Started PedidosStreamingApplication in 2.472 seconds
INFO  [StreamThread-1]  stream-client [pedidos-pipeline-app-...] State transition from REBALANCING to RUNNING
```

## 4. Casos enviados

```
$ curl -X POST localhost:8092/api/pipeline/demo
Demo pipeline enviada: NORMAL 50000 (web), SOSPECHOSO 2000000 (app), IGNORADO 500 (sucursal). [202]

$ curl -X POST localhost:8092/api/pipeline/evento -H "Content-Type: application/json" -d '{"cliente":"ana","monto":75000,"canal":"web"}'
$ curl ... -d '{"cliente":"bruno","monto":3500000,"canal":"sucursal"}'
$ curl ... -d '{"cliente":"carla","monto":200,"canal":"app"}'
-> los tres responden [202]
```

| Caso | Monto | Esperado | Obtenido |
|---|---|---|---|
| cliente-normal (web) | 50.000 | procesado, sin alerta | `Pedido procesado: 50000.0` |
| cliente-sospechoso (app) | 2.000.000 | procesado + alerta | `Pedido procesado: 2000000.0` y `ALERTA GENERADA` |
| cliente-ignorado (sucursal) | 500 | filtrado, sin log | ninguna línea |
| ana (web) | 75.000 | procesado, sin alerta | `Pedido procesado: 75000.0` |
| bruno (sucursal) | 3.500.000 | procesado + alerta | `Pedido procesado: 3500000.0` y `ALERTA GENERADA` |
| carla (app) | 200 | filtrado, sin log | ninguna línea |

## 5. Log del pipeline (`PedidoPipelineTopology`)

```
17:48:40.733  Pedido procesado: 2000000.0
17:48:40.733  ALERTA GENERADA: Pedido inusualmente alto en canal app
17:48:40.739  Pedido procesado: 50000.0
17:48:44.804  Pedido procesado: 75000.0
17:48:44.848  Pedido procesado: 3500000.0
17:48:44.848  ALERTA GENERADA: Pedido inusualmente alto en canal sucursal
```

Los montos 500 y 200 no aparecen porque el primer `filter` los descarta. Los eventos del `/demo` salen en otro orden que el de envío porque cada key cae en una partición distinta (la key es `cliente`), y Kafka solo garantiza el orden dentro de una partición.

## 6. Salida en el topic `pedidos-alertas`

```
$ docker exec pedidos360-kafka kafka-console-consumer --bootstrap-server localhost:9092 \
    --topic pedidos-alertas --from-beginning --timeout-ms 10000 \
    --property print.key=true --property key.separator=" | "
cliente-sospechoso | {"cliente":"cliente-sospechoso","monto":2000000.0,"motivo":"Pedido inusualmente alto en canal app","severidad":"ALTA"}
bruno | {"cliente":"bruno","monto":3500000.0,"motivo":"Pedido inusualmente alto en canal sucursal","severidad":"ALTA"}
Processed a total of 2 messages
```

Solo los 2 pedidos sobre 1.000.000 llegan a `pedidos-alertas`. También se ven en Kafka-UI (http://localhost:8085 → Topics → pedidos-alertas → Messages).

## 7. Robustez: mensaje inválido en la entrada

Se escribió `esto-no-es-json` directo en `pedidos-eventos` con `kafka-console-producer` y luego se envió un evento válido de 5.000.000:

```
17:49:15.659  WARN  RecordDeserializer : task [0_1] Skipping record due to deserialization error. topic=[pedidos-eventos]
17:49:19.081  INFO  Pedido procesado: 5000000.0
17:49:19.082  INFO  ALERTA GENERADA: Pedido inusualmente alto en canal web
```

Con `LogAndContinueExceptionHandler` el mensaje inválido se registra y se salta. El pipeline siguió en RUNNING: hubo 0 transiciones a ERROR.

Tradeoff: el mensaje inválido se descarta con solo un WARN en el log, y en producción eso puede esconder bugs. Lo correcto sería desviarlo a un topic de errores (DLQ), pero eso queda fuera de esta guía.

## 8. Regresión del 3.2.1 (`/api/streaming/demo` en la misma instancia)

```
RECIBIDO | topic=pedidos-particiones particion=0 offset=7  key=null      value=pedido-sin-key-1
RECIBIDO | topic=pedidos-particiones particion=1 offset=7  key=null      value=pedido-sin-key-2
RECIBIDO | topic=pedidos-particiones particion=2 offset=5  key=null      value=pedido-sin-key-3
RECIBIDO | topic=pedidos-particiones particion=0 offset=8  key=null      value=pedido-sin-key-4
RECIBIDO | topic=pedidos-particiones particion=0 offset=9  key=cliente-A value=pedido-cliente-A-1
RECIBIDO | topic=pedidos-particiones particion=0 offset=10 key=cliente-A value=pedido-cliente-A-3
RECIBIDO | topic=pedidos-particiones particion=1 offset=8  key=cliente-E value=pedido-cliente-E-2
RECIBIDO | topic=pedidos-particiones particion=1 offset=9  key=cliente-E value=pedido-cliente-E-5
RECIBIDO | topic=pedidos-particiones particion=2 offset=6  key=cliente-F value=pedido-cliente-F-4
```

Sin key sigue el round-robin (0→1→2→0) y cada key mantiene su partición (A→0, E→1, F→2). El `kafkaTemplate` String y `PedidoPartitioner` conviven con el `eventoKafkaTemplate` JSON sin interferir.

## 9. Terraform (sin costo, sin apply)

Corrido con las credenciales activas del Learner Lab (`hashicorp/terraform:1.9.8` en contenedor).

| Stack | validate | plan |
|---|---|---|
| `terraform-kafka/` (paridad) | `Success! The configuration is valid.`, `fmt -check` OK | `Plan: 2 to add, 0 to change, 0 to destroy.` |
| `terraform/` (backend EA1, sin modificar) | `Success! The configuration is valid.` | `No changes. Your infrastructure matches the configuration.` |

Detalle del plan de `terraform-kafka` (no se aplica):

```
# aws_security_group.kafka will be created
    ingress kafka 9092, kafka-ui 8085, api 8092  -> cidr_blocks = ["<mi-ip>/32"]
    egress 0-0 / -1 -> 0.0.0.0/0
# aws_instance.kafka will be created
    instance_type        = "t3.medium"
    iam_instance_profile = "LabInstanceProfile"
    metadata_options.http_tokens = "required"
    root_block_device    = gp3, 20 GB
    tags Proyecto        = "pedidos360-kafka"
```

El plan del backend se corrió con `-lock=false` y sin `-out`, solo lectura: no escribe estado ni archivos en `terraform/`.

## 10. Persistencia entre reinicios (`docker compose down` sin `-v`)

Bug encontrado y corregido: `kafka_data` persistía, pero Zookeeper no tenía volumen. Después de un `down`, ZK arrancaba con otro cluster id y Kafka abortaba:

```
kafka.common.InconsistentClusterIdException: The Cluster ID MGgNXvf7SjC4WRhDclLxUQ doesn't match stored clusterId Some(RmjKbi6NQNyiFcWY4rsUbA) in meta.properties.
```

Fix: volúmenes `zk_data` y `zk_log` en `docker-compose.yml`. Verificación: `down` → `up -d`, el broker arranca, hay 0 apariciones de `InconsistentClusterId` y la alerta sigue en `pedidos-alertas`:

```
{"cliente":"cliente-sospechoso","monto":2000000.0,"motivo":"Pedido inusualmente alto en canal app","severidad":"ALTA"}
```

Si ya tenías el volumen viejo y Kafka no levanta, se resetea una vez con `docker compose down -v`.
