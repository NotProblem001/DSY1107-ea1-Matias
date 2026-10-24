package com.DSY1107.cloudnative.messaging;

import com.DSY1107.cloudnative.model.Pedido;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.AmqpException;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Productor: publica cada pedido creado/actualizado en pedidos.eventos (topic) y pide la factura de los
 * pedidos nuevos en pedidos.documentos (direct). Mismo contrato JSON que consume pedidos-mensajeria-ms.
 */
@Component
public class PedidoEventPublisher {

    public enum TipoEvento { CREADO, ACTUALIZADO }

    public record PedidoEvento(Long pedidoId, String clienteEmail, String descripcion, Double monto, TipoEvento tipo) {
    }

    private static final Logger log = LoggerFactory.getLogger(PedidoEventPublisher.class);

    private final RabbitTemplate rabbitTemplate;
    private final String exchangeEventos;
    private final String routingKeyEventos;
    private final String exchangeDocumentos;
    private final String routingKeyDocumentos;

    public PedidoEventPublisher(RabbitTemplate rabbitTemplate,
                                @Value("${mensajeria.exchanges.eventos}") String exchangeEventos,
                                @Value("${mensajeria.exchanges.eventos-routing-key}") String routingKeyEventos,
                                @Value("${mensajeria.exchanges.documentos}") String exchangeDocumentos,
                                @Value("${mensajeria.documentos.routing-key}") String routingKeyDocumentos) {
        this.rabbitTemplate = rabbitTemplate;
        this.exchangeEventos = exchangeEventos;
        this.routingKeyEventos = routingKeyEventos;
        this.exchangeDocumentos = exchangeDocumentos;
        this.routingKeyDocumentos = routingKeyDocumentos;
    }

    /** Nunca lanza: el pedido ya quedo guardado y la mensajeria no debe tumbar la API. */
    public void publicar(Pedido pedido, TipoEvento tipo) {
        var evento = new PedidoEvento(pedido.getId(), pedido.getClienteEmail(), pedido.getDescripcion(), pedido.getMonto(), tipo);
        try {
            rabbitTemplate.convertAndSend(exchangeEventos, routingKeyEventos.formatted(tipo.name().toLowerCase()), evento);
            if (tipo == TipoEvento.CREADO) {
                rabbitTemplate.convertAndSend(exchangeDocumentos, routingKeyDocumentos, evento);
            }
            log.info("[PRODUCTOR] Evento {} publicado para pedido {}", tipo, pedido.getId());
        } catch (AmqpException e) {
            // shortcut: el evento se pierde si el broker no responde; usar outbox transaccional si debe ser garantizado
            log.error("[PRODUCTOR] No se pudo publicar {} del pedido {}: {}", tipo, pedido.getId(), e.getMessage());
        }
    }
}
