package com.DSY1107.cloudnative.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.amqp.core.DirectExchange;
import org.springframework.amqp.core.ExchangeBuilder;
import org.springframework.amqp.core.TopicExchange;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.amqp.support.converter.MessageConverter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * El backend es productor: declara los exchanges donde publica (idempotente, mismos argumentos que
 * pedidos-mensajeria-ms) para no perder eventos si arranca antes que los consumidores.
 * Colas, bindings y DLQ pertenecen a los consumidores (pedidos-mensajeria-ms/RabbitTopologyConfig).
 */
@Configuration
public class RabbitConfig {

    @Bean
    public MessageConverter jsonMessageConverter(ObjectMapper objectMapper) {
        return new Jackson2JsonMessageConverter(objectMapper);
    }

    /** Ruta eventos de pedido: pedido.creado / pedido.actualizado. */
    @Bean
    public TopicExchange eventosExchange(@Value("${mensajeria.exchanges.eventos}") String nombre) {
        return ExchangeBuilder.topicExchange(nombre).durable(true).build();
    }

    /** Ruta documentos: documento.factura. */
    @Bean
    public DirectExchange documentosExchange(@Value("${mensajeria.exchanges.documentos}") String nombre) {
        return ExchangeBuilder.directExchange(nombre).durable(true).build();
    }
}
