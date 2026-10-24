package com.DSY1107.mensajeria.producer;

import com.DSY1107.mensajeria.config.MensajeriaProperties;
import com.DSY1107.mensajeria.model.PedidoEvento;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.connection.CorrelationData;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Component;

import java.util.UUID;

/**
 * Productor: publica en los exchanges configurados. Los mensajes salen persistentes (deliveryMode = 2,
 * valor por defecto de Spring AMQP) y con publisher confirm (ver RabbitMessagingConfig).
 */
@Component
public class PedidoEventPublisher {

    private static final Logger log = LoggerFactory.getLogger(PedidoEventPublisher.class);

    private final RabbitTemplate rabbitTemplate;
    private final MensajeriaProperties props;

    public PedidoEventPublisher(RabbitTemplate rabbitTemplate, MensajeriaProperties props) {
        this.rabbitTemplate = rabbitTemplate;
        this.props = props;
    }

    /** Topic exchange: routing key pedido.creado / pedido.actualizado / pedido.cancelado. */
    public String publicarEvento(PedidoEvento evento) {
        String routingKey = props.exchanges().eventosRoutingKey().formatted(evento.tipo().name().toLowerCase());
        return enviar(props.exchanges().eventos(), routingKey, evento);
    }

    /** Direct exchange: solicitud de generacion de factura. */
    public String solicitarDocumento(PedidoEvento evento) {
        return enviar(props.exchanges().documentos(), props.colas().documentos().routingKey(), evento);
    }

    private String enviar(String exchange, String routingKey, PedidoEvento evento) {
        var correlation = new CorrelationData(UUID.randomUUID().toString());
        rabbitTemplate.convertAndSend(exchange, routingKey, evento, correlation);
        log.info("[PRODUCTOR] -> {} [{}] pedido={} id={}", exchange, routingKey, evento.pedidoId(), correlation.getId());
        return routingKey;
    }
}
