package com.DSY1107.streaming.config;

import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

import org.apache.kafka.clients.producer.Partitioner;
import org.apache.kafka.common.Cluster;
import org.apache.kafka.common.utils.Utils;

/**
 * Particionador didactico.
 * El default de Kafka 3.3+ NO es round-robin para mensajes sin key: usa "sticky partitioning"
 * (llena un lote en una sola particion antes de cambiar), asi que un lote rapido sin key cae
 * casi entero en la misma particion. Este particionador fuerza round-robin estricto sin key
 * para hacer visible la distribucion, y con key usa el mismo hash murmur2 que el default.
 */
public class PedidoPartitioner implements Partitioner {

	private final AtomicInteger contador = new AtomicInteger();

	@Override
	public int partition(String topic, Object key, byte[] keyBytes, Object value, byte[] valueBytes, Cluster cluster) {
		int numParticiones = cluster.partitionsForTopic(topic).size();
		if (keyBytes == null) {
			return Utils.toPositive(contador.getAndIncrement()) % numParticiones;
		}
		return Utils.toPositive(Utils.murmur2(keyBytes)) % numParticiones;
	}

	/**
	 * Al abrir un lote nuevo el productor descarta la particion elegida y vuelve a llamar partition()
	 * (KAFKA-9965). Retrocedemos el contador para que esa segunda llamada repita la misma particion.
	 */
	@Override
	@SuppressWarnings("deprecation")
	public void onNewBatch(String topic, Cluster cluster, int prevPartition) {
		contador.decrementAndGet();
	}

	@Override
	public void configure(Map<String, ?> configs) {
		// sin configuracion
	}

	@Override
	public void close() {
		// sin recursos que liberar
	}
}
