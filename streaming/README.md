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
# Lote de evidencia: 4 sin key + 5 con key (cliente-A, cliente-B, cliente-C)
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
   - Cada mensaje de **`cliente-A`** cae en la **misma partición**, y lo mismo pasa con `cliente-B` y `cliente-C`.
   - El **offset** crece por separado **dentro de cada partición** (cada partición tiene su propia secuencia desde 0).
   - Las líneas `ENVIADO | particion=... offset=...` del productor confirman la misma partición y el mismo offset desde el lado del envío.
3. Kafka-UI → Topics → `pedidos-particiones` → **Messages**: columnas Partition, Offset y Key.
4. Si llamas `/demo` otra vez, cada key vuelve a su misma partición y los offsets siguen desde donde iban.

Ejemplo de lo esperado (el número de partición de cada key depende del hash):

```
RECIBIDO | topic=pedidos-particiones particion=0 offset=0 key=null value=pedido-sin-key-1
RECIBIDO | topic=pedidos-particiones particion=1 offset=0 key=null value=pedido-sin-key-2
RECIBIDO | topic=pedidos-particiones particion=2 offset=0 key=null value=pedido-sin-key-3
RECIBIDO | topic=pedidos-particiones particion=0 offset=1 key=null value=pedido-sin-key-4
RECIBIDO | topic=pedidos-particiones particion=X offset=... key=cliente-A value=pedido-cliente-A-1
RECIBIDO | topic=pedidos-particiones particion=X offset=... key=cliente-A value=pedido-cliente-A-3
```

Nota: el consumidor lee las 3 particiones en paralelo, así que el **orden global** de las líneas puede mezclarse. Kafka solo garantiza el orden **dentro de una partición**, y justamente por eso se usa la key.

## Docker (opcional)

```bash
cd streaming/pedidos-streaming-ms
docker build -t pedidos-streaming-ms .
docker run --rm -p 8092:8092 --network streaming_kafka_net \
  -e KAFKA_BOOTSTRAP=kafka:29092 pedidos-streaming-ms
```
