package com.DSY1107.streaming.producer;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.support.SendResult;
import org.springframework.stereotype.Component;

@Component
public class PedidoKafkaProducer {

	private static final Logger log = LoggerFactory.getLogger(PedidoKafkaProducer.class);

	private final KafkaTemplate<String, String> kafkaTemplate;
	private final String topic;

	public PedidoKafkaProducer(KafkaTemplate<String, String> kafkaTemplate,
			@Value("${pedidos.kafka.topic}") String topic) {
		this.kafkaTemplate = kafkaTemplate;
		this.topic = topic;
	}

	public void enviarSinKey(String mensaje) {
		log.info("ENVIANDO SIN KEY | topic={} value={}", topic, mensaje);
		kafkaTemplate.send(topic, mensaje).whenComplete(this::registrarResultado);
	}

	public void enviarConKey(String key, String mensaje) {
		log.info("ENVIANDO CON KEY | topic={} key={} value={}", topic, key, mensaje);
		kafkaTemplate.send(topic, key, mensaje).whenComplete(this::registrarResultado);
	}

	private void registrarResultado(SendResult<String, String> resultado, Throwable error) {
		if (error != null) {
			log.error("ERROR al enviar a topic={}: {}", topic, error.getMessage(), error);
			return;
		}
		var meta = resultado.getRecordMetadata();
		log.info("ENVIADO | particion={} offset={} key={}", meta.partition(), meta.offset(),
				resultado.getProducerRecord().key());
	}
}
