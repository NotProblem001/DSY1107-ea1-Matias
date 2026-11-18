package com.DSY1107.streaming.config;

import org.apache.kafka.clients.admin.NewTopic;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.config.TopicBuilder;

/**
 * KafkaAdmin (autoconfigurado por Spring Boot) crea este topic al arrancar,
 * por eso funciona aunque el broker tenga KAFKA_AUTO_CREATE_TOPICS_ENABLE=false.
 */
@Configuration
public class KafkaTopicConfig {

	@Bean
	public NewTopic pedidosParticionesTopic(@Value("${pedidos.kafka.topic}") String topic) {
		return TopicBuilder.name(topic)
				.partitions(3)
				.replicas(1)
				.build();
	}

	@Bean
	public NewTopic pedidosEventosTopic(@Value("${pedidos.pipeline.topic-entrada}") String topic) {
		return TopicBuilder.name(topic)
				.partitions(3)
				.replicas(1)
				.build();
	}

	@Bean
	public NewTopic pedidosAlertasTopic(@Value("${pedidos.pipeline.topic-alertas}") String topic) {
		return TopicBuilder.name(topic)
				.partitions(3)
				.replicas(1)
				.build();
	}
}
