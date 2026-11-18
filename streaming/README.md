# Pedidos360 — Streaming con Apache Kafka (Unidad 3)

Implementa la guía 3.2.1 *"Crear topic, productor y consumidor; offsets y particiones"* con el dominio Pedidos360:

- Topic `pedidos-particiones` con **3 particiones** y **replication-factor 1** (lo crea el microservicio al arrancar, `KafkaTopicConfig`).
- **Productor** (`PedidoKafkaProducer`) que envía mensajes **sin key** y **con key**.
- **Consumidor** (`PedidoKafkaConsumer`) que registra por cada mensaje: topic, partición, offset, key y value.

Está aislado de `messaging/` (RabbitMQ) y `backend/`: no comparte puertos ni redes.

| Componente | Puerto |
|---|---|
| Kafka (host) | 9092 |
| Kafka-UI | 8085 |
| pedidos-streaming-ms | 8092 |

## Cómo se reparten los mensajes (leer antes de la defensa)

- **Con key:** la partición se calcula con `murmur2(key) % particiones`. Todos los mensajes con la misma key caen **siempre en la misma partición**, así que su orden queda garantizado.
- **Sin key:** el **default real de este Kafka (kafka-clients 3.7, viene con Spring Boot 3.3.4) NO es round-robin**. Desde Kafka 3.3 (KIP-794) se usa *sticky partitioning*: el productor llena un lote en una sola partición antes de pasar a otra, porque así se envían menos peticiones y hay menos latencia. Con un lote corto y rápido como `/demo`, todos los mensajes sin key caerían casi seguro en **una sola** partición. La guía describe el round-robin, que era el comportamiento de clientes más antiguos.
- Para **hacer visible la distribución**, este proyecto registra un particionador propio, `config/PedidoPartitioner` (en `application.yml`, `spring.kafka.producer.properties.partitioner.class`). Sin key hace **round-robin estricto** (0, 1, 2, 0…). Con key usa el **mismo hash murmur2 que el default**, así que el comportamiento con key no cambia. Si quitas esa propiedad vuelves al sticky real, y también sirve para mostrarlo.
- Detalle técnico: cuando el productor abre un lote nuevo, llama `partition()` **dos veces** para el mismo mensaje (vía `onNewBatch`, bug conocido KAFKA-9965, que también afecta al `RoundRobinPartitioner` de Kafka). `PedidoPartitioner.onNewBatch` retrocede el contador para que el round-robin no se salte particiones.
- Las keys de `/demo` (`cliente-A`, `cliente-E`, `cliente-F`) se eligieron porque `murmur2 % 3` las reparte en particiones distintas (0, 1 y 2). Con `cliente-A/B/C/D` todas caen en la 0: el hash no promete repartir pocas keys de forma pareja.

## Pasos

```bash
# 1. Infraestructura (Zookeeper + Kafka + Kafka-UI)
cd streaming
docker compose up -d
docker compose ps

# 2. Kafka-UI
#    http://localhost:8085  (cluster "pedidos360")

# 3. Microservicio (otra terminal)
cd streaming/pedidos-streaming-ms
./mvnw spring-boot:run          # Windows: mvnw.cmd spring-boot:run
```

### Enviar mensajes

```bash
# Lote de evidencia: 4 sin key + 5 con key (cliente-A, cliente-E, cliente-F)
curl -X POST http://localhost:8092/api/streaming/demo

# Un mensaje sin key
curl -X POST "http://localhost:8092/api/streaming/sin-key?mensaje=pedido-100"

# Un mensaje con key
curl -X POST "http://localhost:8092/api/streaming/con-key?key=cliente-A&mensaje=pedido-101"
```

Las respuestas son `202 Accepted`.

## Alternativa CLI (como en la guía 3.2.1)

```bash
# Crear el topic a mano (no hace falta si el microservicio ya arrancó)
docker exec -it pedidos360-kafka kafka-topics --create \
  --topic pedidos-particiones --partitions 3 --replication-factor 1 \
  --bootstrap-server localhost:9092

# Describir: muestra las 3 particiones, su líder y sus réplicas
docker exec -it pedidos360-kafka kafka-topics --describe \
  --topic pedidos-particiones --bootstrap-server localhost:9092

# Listar topics
docker exec -it pedidos360-kafka kafka-topics --list --bootstrap-server localhost:9092

# Offsets y lag del grupo consumidor
docker exec -it pedidos360-kafka kafka-consumer-groups --describe \
  --group pedidos-streaming-group --bootstrap-server localhost:9092
```

## Qué capturar como evidencia

1. `kafka-topics --describe` (o Kafka-UI → Topics → `pedidos-particiones`): **PartitionCount 3, ReplicationFactor 1**.
2. Log del microservicio después de `POST /demo`, líneas `RECIBIDO | ...`:
   - Los mensajes **sin key** (`key=null`) aparecen en las particiones **0, 1 y 2**.
   - Cada mensaje de **`cliente-A`** cae en la **misma partición**, y lo mismo pasa con `cliente-E` y `cliente-F`.
   - El **offset** crece por separado **dentro de cada partición** (cada partición tiene su propia secuencia desde 0).
   - Las líneas `ENVIADO | particion=... offset=...` del productor confirman la misma partición y el mismo offset desde el lado del envío.
3. Kafka-UI → Topics → `pedidos-particiones` → **Messages**: columnas Partition, Offset y Key.
4. Si llamas `/demo` otra vez, cada key vuelve a su misma partición y los offsets siguen desde donde iban.

Salida real del primer `POST /demo` con el topic vacío (el log viene agrupado por partición, porque el consumidor lee cada una por separado):

```
RECIBIDO | topic=pedidos-particiones particion=0 offset=0 key=null value=pedido-sin-key-1
RECIBIDO | topic=pedidos-particiones particion=0 offset=1 key=null value=pedido-sin-key-4
RECIBIDO | topic=pedidos-particiones particion=0 offset=2 key=cliente-A value=pedido-cliente-A-1
RECIBIDO | topic=pedidos-particiones particion=0 offset=3 key=cliente-A value=pedido-cliente-A-3
RECIBIDO | topic=pedidos-particiones particion=1 offset=0 key=null value=pedido-sin-key-2
RECIBIDO | topic=pedidos-particiones particion=1 offset=1 key=cliente-E value=pedido-cliente-E-2
RECIBIDO | topic=pedidos-particiones particion=1 offset=2 key=cliente-E value=pedido-cliente-E-5
RECIBIDO | topic=pedidos-particiones particion=2 offset=0 key=null value=pedido-sin-key-3
RECIBIDO | topic=pedidos-particiones particion=2 offset=1 key=cliente-F value=pedido-cliente-F-4
```

Sin key: 1→0, 2→1, 3→2, 4→0 (round-robin). Con key: `cliente-A` siempre en 0, `cliente-E` siempre en 1 y `cliente-F` siempre en 2. Un segundo `/demo` continúa el round-robin donde quedó (1→1, 2→2, 3→0, 4→1), las keys vuelven a la misma partición y los offsets siguen subiendo.

Nota: el consumidor lee las 3 particiones en paralelo, así que el **orden global** de las líneas puede mezclarse. Kafka solo garantiza el orden **dentro de una partición**, y justamente por eso se usa la key.

## Docker (opcional)

```bash
cd streaming/pedidos-streaming-ms
docker build -t pedidos-streaming-ms .
docker run --rm -p 8092:8092 --network streaming_kafka_net \
  -e KAFKA_BOOTSTRAP=kafka:29092 pedidos-streaming-ms
```

---

## 3.2.2 Pipeline end-to-end (Kafka Streams)

Pipeline **stateless** de la guía 3.2.2 en `streams/PedidoPipelineTopology`, en la misma app que el 3.2.1 (`application-id: pedidos-pipeline-app`):

```
pedidos-eventos ──► filter(monto >= 1000)       ── descarta montos irrelevantes ─► peek "Pedido procesado: <monto>"
                ──► filter(monto > 1000000)     ── detecta anómalos
                ──► mapValues(AlertaPedido)     ── motivo "Pedido inusualmente alto en canal <canal>", severidad ALTA
                ──► peek "ALERTA GENERADA: <motivo>"
                ──► pedidos-alertas
```

| Topic | Rol | Particiones / réplicas | Mensaje |
|---|---|---|---|
| `pedidos-eventos` | entrada | 3 / 1 | `EventoPedido {cliente, monto, canal, timestamp}`, key = cliente |
| `pedidos-alertas` | salida | 3 / 1 | `AlertaPedido {cliente, monto, motivo, severidad}` |

Los umbrales y los nombres de topic se definen en `pedidos.pipeline.*` (`application.yml`). Si llega un JSON inválido a `pedidos-eventos`, se loguea y se salta (`LogAndContinueExceptionHandler`) en vez de detener el pipeline. **Tradeoff:** el mensaje inválido se descarta con solo un WARN en el log, y en producción eso puede esconder bugs. Lo correcto sería desviarlo a un topic de errores (DLQ), pero eso queda fuera de esta guía.

Por qué hay dos `KafkaTemplate`: Spring Boot crea `kafkaTemplate` y `kafkaProducerFactory` solo si no existe otro bean de ese tipo (`@ConditionalOnMissingBean`). `config/KafkaProducerConfig` declara el `kafkaTemplate` String del 3.2.1 de forma explícita, sobre el producerFactory autoconfigurado, y arma el `eventoKafkaTemplate` JSON con un factory inline que no se expone como bean. Así el 3.2.1 no cambia.

### Cómo probar

```bash
cd streaming && docker compose up -d
cd pedidos-streaming-ms && ./mvnw spring-boot:run     # espera "State transition from REBALANCING to RUNNING"

# Los 3 casos de una vez: NORMAL 50000, SOSPECHOSO 2000000, IGNORADO 500
curl -X POST http://localhost:8092/api/pipeline/demo

# O uno por uno (timestamp opcional: si falta lo pone el servidor)
curl -X POST http://localhost:8092/api/pipeline/evento -H "Content-Type: application/json" \
  -d '{"cliente":"ana","monto":50000,"canal":"web"}'        # normal: se procesa, sin alerta
curl -X POST http://localhost:8092/api/pipeline/evento -H "Content-Type: application/json" \
  -d '{"cliente":"bruno","monto":2000000,"canal":"app"}'    # sospechoso: genera alerta
curl -X POST http://localhost:8092/api/pipeline/evento -H "Content-Type: application/json" \
  -d '{"cliente":"carla","monto":500,"canal":"sucursal"}'   # ignorado: se filtra

# Ver la salida
docker exec pedidos360-kafka kafka-console-consumer --bootstrap-server localhost:9092 \
  --topic pedidos-alertas --from-beginning --timeout-ms 10000
```

### Qué observar como evidencia

- En el log, `Pedido procesado: 50000.0` y `Pedido procesado: 2000000.0`; **nada** para 500.
- `ALERTA GENERADA: Pedido inusualmente alto en canal app` aparece **solo** para el sospechoso.
- En `pedidos-alertas` (console-consumer o Kafka-UI http://localhost:8085 → Topics → pedidos-alertas → Messages) aparece el JSON `{"cliente":...,"monto":2000000.0,"motivo":"Pedido inusualmente alto en canal app","severidad":"ALTA"}`.
- La corrida real está en [`EVIDENCIA_PIPELINE.md`](EVIDENCIA_PIPELINE.md).

### Siguiente paso (no implementado, igual que en la guía)

La **agregación del total por cliente** requiere estado: `groupByKey()` → `windowedBy(TimeWindows.ofSizeWithNoGrace(Duration.ofMinutes(5)))` → `aggregate(...)`, con un state store (RocksDB) y un topic changelog. Con eso se detectaría, por ejemplo, a un cliente que en una ventana de 5 minutos hace muchos pedidos chicos que juntos superan el umbral.

### Dónde corre cada cosa (local + AWS)

- **Local (Docker y mvnw):** Kafka, Kafka-UI y `pedidos-streaming-ms`. Es el entregable de la Unidad 3 y no tiene costo.
- **AWS:** solo el backend, con el stack existente `terraform/` (API Gateway, ECS, Cognito, RDS).
- El broker se configura por entorno con `KAFKA_BOOTSTRAP` (default `localhost:9092`; dentro de la red Docker, `kafka:29092`). El pipeline no depende del backend ni de Cognito.

- `terraform-kafka/` es solo **IaC de paridad** con `terraform-rabbitmq/` (una EC2 con este compose). Se valida con `init` y `validate` (y `plan` si hay credenciales), pero **no se aplica**. Su README explica la limitación de `KAFKA_ADVERTISED_LISTENERS=localhost` para un uso remoto.
