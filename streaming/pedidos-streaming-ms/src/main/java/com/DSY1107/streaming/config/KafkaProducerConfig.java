package com.DSY1107.streaming.config;

import org.apache.kafka.common.serialization.StringSerializer;
import org.springframework.boot.autoconfigure.kafka.KafkaProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.core.DefaultKafkaProducerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.core.ProducerFactory;
import org.springframework.kafka.support.serializer.JsonSerializer;

import com.DSY1107.streaming.model.EventoPedido;

/**
 * KafkaAutoConfiguration crea kafkaTemplate y kafkaProducerFactory solo con @ConditionalOnMissingBean:
 * al declarar eventoKafkaTemplate el template String autoconfigurado desapareceria. Por eso:
 * - kafkaTemplate (3.2.1) se declara explicito sobre el producerFactory autoconfigurado (yml + PedidoPartitioner).
 * - el ProducerFactory JSON de eventos se arma inline, sin exponerlo como bean, para no anular el autoconfigurado.
 */
@Configuration
public class KafkaProducerConfig {

	@Bean
	public KafkaTemplate<String, String> kafkaTemplate(ProducerFactory<String, String> producerFactory) {
		return new KafkaTemplate<>(producerFactory);
	}

	@Bean
	public KafkaTemplate<String, EventoPedido> eventoKafkaTemplate(KafkaProperties kafkaProperties) {
		ProducerFactory<String, EventoPedido> factory = new DefaultKafkaProducerFactory<>(
				kafkaProperties.buildProducerProperties(null), new StringSerializer(), new JsonSerializer<>());
		return new KafkaTemplate<>(factory);
	}
}
