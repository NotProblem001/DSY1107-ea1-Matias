package com.DSY1107.mensajeria.consumer.tickets;

import com.DSY1107.mensajeria.consumer.ConfirmacionManual;
import com.DSY1107.mensajeria.consumer.FallosSimulados;
import com.rabbitmq.client.Channel;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.util.UUID;

/** Dominio tickets: abre un ticket de despacho por cada pedido creado. */
@Component
public class TicketConsumer {

    private static final Logger log = LoggerFactory.getLogger(TicketConsumer.class);
    private static final String NOMBRE = "TICKETS";

    private final ConfirmacionManual confirmacion;

    public TicketConsumer(ConfirmacionManual confirmacion) {
        this.confirmacion = confirmacion;
    }

    @RabbitListener(id = "tickets-listener", queues = "${mensajeria.colas.tickets.nombre}")
    public void recibir(Message mensaje, Channel canal) throws IOException {
        confirmacion.procesar(mensaje, canal, NOMBRE, evento -> {
            FallosSimulados.aplicar(evento, NOMBRE);
            String ticket = "TCK-" + evento.pedidoId() + "-" + UUID.randomUUID().toString().substring(0, 8);
            log.info("[{}] Ticket {} abierto para pedido {} ({})", NOMBRE, ticket, evento.pedidoId(), evento.descripcion());
        });
    }
}
