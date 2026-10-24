package com.DSY1107.mensajeria.consumer.notificaciones;

import com.DSY1107.mensajeria.consumer.ConfirmacionManual;
import com.DSY1107.mensajeria.consumer.FallosSimulados;
import com.rabbitmq.client.Channel;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;

import java.io.IOException;

/** Dominio notificaciones: avisa al cliente de cada cambio de su pedido. */
@Component
public class NotificacionConsumer {

    private static final Logger log = LoggerFactory.getLogger(NotificacionConsumer.class);
    private static final String NOMBRE = "NOTIFICACIONES";

    private final ConfirmacionManual confirmacion;

    public NotificacionConsumer(ConfirmacionManual confirmacion) {
        this.confirmacion = confirmacion;
    }

    @RabbitListener(id = "notificaciones-listener", queues = "${mensajeria.colas.notificaciones.nombre}")
    public void recibir(Message mensaje, Channel canal) throws IOException {
        confirmacion.procesar(mensaje, canal, NOMBRE, evento -> {
            FallosSimulados.aplicar(evento, NOMBRE);
            log.info("[{}] Correo a {}: su pedido {} fue {}", NOMBRE, evento.clienteEmail(), evento.pedidoId(),
                    evento.tipo().name().toLowerCase());
        });
    }
}
