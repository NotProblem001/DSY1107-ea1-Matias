package com.DSY1107.streaming.consumer;

import java.time.Instant;

import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

import com.DSY1107.streaming.model.AlertaPedido;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

@Component
public class PedidoKafkaConsumer {

	private static final Logger log = LoggerFactory.getLogger(PedidoKafkaConsumer.class);

	private final RegistroStreaming registro;
	private final ObjectMapper objectMapper;

	public PedidoKafkaConsumer(RegistroStreaming registro, ObjectMapper objectMapper) {
		this.registro = registro;
		this.objectMapper = objectMapper;
	}

	@KafkaListener(topics = "${pedidos.kafka.topic}", groupId = "${spring.kafka.consumer.group-id}")
	public void recibir(ConsumerRecord<String, String> record) {
		log.info("RECIBIDO | topic={} particion={} offset={} key={} value={}",
				record.topic(), record.partition(), record.offset(), record.key(), record.value());
		registro.agregarRecibido(new RegistroStreaming.Recibido(record.topic(), record.partition(), record.offset(),
				record.key(), record.value(), Instant.ofEpochMilli(record.timestamp())));
	}

	/** Visor de la salida del pipeline 3.2.2: grupo propio, no compite con ningun otro consumidor. */
	@KafkaListener(topics = "${pedidos.pipeline.topic-alertas}", groupId = "pedidos-alertas-visor")
	public void alerta(ConsumerRecord<String, String> record) {
		try {
			AlertaPedido alerta = objectMapper.readValue(record.value(), AlertaPedido.class);
			registro.agregarAlerta(new RegistroStreaming.AlertaRecibida(alerta, record.partition(), record.offset(),
					Instant.ofEpochMilli(record.timestamp())));
		} catch (JsonProcessingException e) {
			log.warn("Alerta con JSON invalido en particion={} offset={}: {}", record.partition(), record.offset(),
					e.getOriginalMessage());
		}
	}
}
