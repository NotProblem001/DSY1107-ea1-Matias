package com.DSY1107.streaming.consumer;

import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

@Component
public class PedidoKafkaConsumer {

	private static final Logger log = LoggerFactory.getLogger(PedidoKafkaConsumer.class);

	@KafkaListener(topics = "${pedidos.kafka.topic}", groupId = "${spring.kafka.consumer.group-id}")
	public void recibir(ConsumerRecord<String, String> record) {
		log.info("RECIBIDO | topic={} particion={} offset={} key={} value={}",
				record.topic(), record.partition(), record.offset(), record.key(), record.value());
	}
}
