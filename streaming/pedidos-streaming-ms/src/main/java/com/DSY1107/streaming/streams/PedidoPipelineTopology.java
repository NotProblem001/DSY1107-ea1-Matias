package com.DSY1107.streaming.streams;

import org.apache.kafka.common.serialization.Serdes;
import org.apache.kafka.streams.StreamsBuilder;
import org.apache.kafka.streams.kstream.Consumed;
import org.apache.kafka.streams.kstream.KStream;
import org.apache.kafka.streams.kstream.Produced;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.annotation.EnableKafkaStreams;
import org.springframework.kafka.support.serializer.JsonSerde;

import com.DSY1107.streaming.model.AlertaPedido;
import com.DSY1107.streaming.model.EventoPedido;

/**
 * Pipeline stateless (guia 3.2.2): pedidos-eventos -> filtro monto minimo -> deteccion de anomalos -> pedidos-alertas.
 */
@Configuration
@EnableKafkaStreams
public class PedidoPipelineTopology {

	private static final Logger log = LoggerFactory.getLogger(PedidoPipelineTopology.class);

	@Value("${pedidos.pipeline.topic-entrada}")
	private String topicEntrada;

	@Value("${pedidos.pipeline.topic-alertas}")
	private String topicAlertas;

	@Value("${pedidos.pipeline.monto-minimo}")
	private double montoMinimo;

	@Value("${pedidos.pipeline.monto-sospechoso}")
	private double montoSospechoso;

	@Bean
	public KStream<String, EventoPedido> pipeline(StreamsBuilder builder) {
		JsonSerde<EventoPedido> eventoSerde = new JsonSerde<>(EventoPedido.class);
		eventoSerde.ignoreTypeHeaders();
		JsonSerde<AlertaPedido> alertaSerde = new JsonSerde<>(AlertaPedido.class);
		alertaSerde.ignoreTypeHeaders();

		KStream<String, EventoPedido> eventos = builder.stream(topicEntrada, Consumed.with(Serdes.String(), eventoSerde));

		eventos
				// 1) filtrar montos irrelevantes (y tombstones)
				.filter((cliente, evento) -> evento != null && evento.getMonto() >= montoMinimo)
				.peek((cliente, evento) -> log.info("Pedido procesado: {}", evento.getMonto()))
				// 2) detectar anomalos
				.filter((cliente, evento) -> evento.getMonto() > montoSospechoso)
				.mapValues(evento -> new AlertaPedido(evento.getCliente(), evento.getMonto(),
						"Pedido inusualmente alto en canal " + evento.getCanal(), "ALTA"))
				.peek((cliente, alerta) -> log.info("ALERTA GENERADA: {}", alerta.getMotivo()))
				// 3) escribir alertas
				.to(topicAlertas, Produced.with(Serdes.String(), alertaSerde));

		return eventos;
	}
}
