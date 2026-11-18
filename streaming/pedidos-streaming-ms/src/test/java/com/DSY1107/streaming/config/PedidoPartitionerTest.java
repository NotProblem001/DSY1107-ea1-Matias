package com.DSY1107.streaming.config;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Set;

import org.apache.kafka.common.Cluster;
import org.apache.kafka.common.Node;
import org.apache.kafka.common.PartitionInfo;
import org.junit.jupiter.api.Test;

class PedidoPartitionerTest {

	private static final String TOPIC = "pedidos-particiones";

	private final Node nodo = new Node(1, "localhost", 9092);
	private final Cluster cluster = new Cluster("test", List.of(nodo),
			List.of(0, 1, 2).stream().map(p -> new PartitionInfo(TOPIC, p, nodo, null, null)).toList(),
			Set.of(), Set.of());
	private final PedidoPartitioner partitioner = new PedidoPartitioner();

	@Test
	void sinKeyRepartePorRoundRobin() {
		int[] obtenidas = new int[6];
		for (int i = 0; i < 6; i++) {
			obtenidas[i] = partitioner.partition(TOPIC, null, null, "v", null, cluster);
		}
		assertEquals("[0, 1, 2, 0, 1, 2]", java.util.Arrays.toString(obtenidas));
	}

	@Test
	void mismaKeyCaeSiempreEnLaMismaParticion() {
		byte[] key = "cliente-A".getBytes(StandardCharsets.UTF_8);
		int primera = partitioner.partition(TOPIC, "cliente-A", key, "v", null, cluster);
		for (int i = 0; i < 5; i++) {
			partitioner.partition(TOPIC, null, null, "v", null, cluster); // intercalar mensajes sin key
			assertEquals(primera, partitioner.partition(TOPIC, "cliente-A", key, "v", null, cluster));
		}
	}
}
