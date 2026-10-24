package com.DSY1107.mensajeria.config;

import com.DSY1107.mensajeria.config.MensajeriaProperties.Cola;
import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.DirectExchange;
import org.springframework.amqp.core.ExchangeBuilder;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.core.QueueBuilder;
import org.springframework.amqp.core.TopicExchange;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Topologia de mensajeria de Pedidos360. RabbitAdmin (auto-configurado por Boot) declara estos beans al conectar.
 *
 * <pre>
 * Ruta 1 Notificaciones: pedidos.eventos (topic)     --pedido.#-->          notificaciones.queue --DLX--> notificaciones.dlq
 * Ruta 2 Tickets       : pedidos.eventos (topic)     --pedido.creado-->     tickets.queue        --DLX--> tickets.dlq
 * Ruta 3 Documentos    : pedidos.documentos (direct) --documento.factura--> documentos.queue     --DLX--> documentos.dlq
 * DLX                  : pedidos.dlx (direct) enruta por x-dead-letter-routing-key a la DLQ de cada cola
 * </pre>
 *
 * Todas las colas son quorum (replicadas en los nodos del cluster) y durables.
 */
@Configuration
public class RabbitTopologyConfig {

    private final MensajeriaProperties props;

    public RabbitTopologyConfig(MensajeriaProperties props) {
        this.props = props;
    }

    // ---------- Exchanges ----------

    @Bean
    public TopicExchange eventosExchange() {
        return ExchangeBuilder.topicExchange(props.exchanges().eventos()).durable(true).build();
    }

    @Bean
    public DirectExchange documentosExchange() {
        return ExchangeBuilder.directExchange(props.exchanges().documentos()).durable(true).build();
    }

    @Bean
    public DirectExchange dlxExchange() {
        return ExchangeBuilder.directExchange(props.exchanges().dlx()).durable(true).build();
    }

    // ---------- Ruta 1: notificaciones ----------

    @Bean
    public Queue notificacionesQueue() {
        return colaPrincipal(props.colas().notificaciones());
    }

    @Bean
    public Queue notificacionesDlq() {
        return colaMuerta(props.colas().notificaciones());
    }

    @Bean
    public Binding notificacionesBinding(Queue notificacionesQueue, TopicExchange eventosExchange) {
        return BindingBuilder.bind(notificacionesQueue).to(eventosExchange)
                .with(props.colas().notificaciones().routingKey());
    }

    @Bean
    public Binding notificacionesDlqBinding(Queue notificacionesDlq, DirectExchange dlxExchange) {
        return BindingBuilder.bind(notificacionesDlq).to(dlxExchange)
                .with(props.colas().notificaciones().dlqRoutingKey());
    }

    // ---------- Ruta 2: tickets ----------

    @Bean
    public Queue ticketsQueue() {
        return colaPrincipal(props.colas().tickets());
    }

    @Bean
    public Queue ticketsDlq() {
        return colaMuerta(props.colas().tickets());
    }

    @Bean
    public Binding ticketsBinding(Queue ticketsQueue, TopicExchange eventosExchange) {
        return BindingBuilder.bind(ticketsQueue).to(eventosExchange)
                .with(props.colas().tickets().routingKey());
    }

    @Bean
    public Binding ticketsDlqBinding(Queue ticketsDlq, DirectExchange dlxExchange) {
        return BindingBuilder.bind(ticketsDlq).to(dlxExchange)
                .with(props.colas().tickets().dlqRoutingKey());
    }

    // ---------- Ruta 3: documentos ----------

    @Bean
    public Queue documentosQueue() {
        return colaPrincipal(props.colas().documentos());
    }

    @Bean
    public Queue documentosDlq() {
        return colaMuerta(props.colas().documentos());
    }

    @Bean
    public Binding documentosBinding(Queue documentosQueue, DirectExchange documentosExchange) {
        return BindingBuilder.bind(documentosQueue).to(documentosExchange)
                .with(props.colas().documentos().routingKey());
    }

    @Bean
    public Binding documentosDlqBinding(Queue documentosDlq, DirectExchange dlxExchange) {
        return BindingBuilder.bind(documentosDlq).to(dlxExchange)
                .with(props.colas().documentos().dlqRoutingKey());
    }

    // ---------- Plantillas ----------

    /** Cola de trabajo: quorum, TTL, limite de largo y limite de entregas; lo que muere va al DLX. */
    private Queue colaPrincipal(Cola cola) {
        var p = props.politicas();
        return QueueBuilder.durable(cola.nombre())
                .quorum()
                .deadLetterExchange(props.exchanges().dlx())
                .deadLetterRoutingKey(cola.dlqRoutingKey())
                .ttl(p.ttlMs())
                .maxLength(p.maxLength())
                .deliveryLimit(p.deliveryLimit())
                .build();
    }

    /** DLQ: quorum y retencion acotada para auditoria. */
    private Queue colaMuerta(Cola cola) {
        return QueueBuilder.durable(cola.dlq())
                .quorum()
                .ttl(props.politicas().dlqTtlMs())
                .build();
    }
}
