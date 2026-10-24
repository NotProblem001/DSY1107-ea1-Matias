package com.DSY1107.mensajeria.consumer.documentos;

import com.DSY1107.mensajeria.consumer.ConfirmacionManual;
import com.DSY1107.mensajeria.consumer.FallosSimulados;
import com.rabbitmq.client.Channel;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;

import java.io.IOException;

/** Dominio documentos: genera la factura del pedido. */
@Component
public class DocumentoConsumer {

    private static final Logger log = LoggerFactory.getLogger(DocumentoConsumer.class);
    private static final String NOMBRE = "DOCUMENTOS";

    private final ConfirmacionManual confirmacion;

    public DocumentoConsumer(ConfirmacionManual confirmacion) {
        this.confirmacion = confirmacion;
    }

    @RabbitListener(id = "documentos-listener", queues = "${mensajeria.colas.documentos.nombre}")
    public void recibir(Message mensaje, Channel canal) throws IOException {
        confirmacion.procesar(mensaje, canal, NOMBRE, evento -> {
            FallosSimulados.aplicar(evento, NOMBRE);
            log.info("[{}] Factura FAC-{}.pdf generada para {} por ${}", NOMBRE, evento.pedidoId(),
                    evento.clienteEmail(), String.format("%,.0f", evento.monto()));
        });
    }
}
