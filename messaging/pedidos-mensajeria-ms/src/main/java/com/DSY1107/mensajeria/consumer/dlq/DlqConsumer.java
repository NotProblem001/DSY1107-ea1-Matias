package com.DSY1107.mensajeria.consumer.dlq;

import com.rabbitmq.client.Channel;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

/**
 * Auditoria de mensajes muertos: registra en log por que murio cada mensaje (header x-death) y lo confirma.
 * El mensaje ya quedo trazado; la DLQ conserva solo lo que este listener aun no consumio (TTL 24 h).
 */
@Component
public class DlqConsumer {

    private static final Logger log = LoggerFactory.getLogger(DlqConsumer.class);

    @RabbitListener(id = "dlq-listener", autoStartup = "${mensajeria.auditoria-dlq-activa:true}", queues = {
            "${mensajeria.colas.notificaciones.dlq}",
            "${mensajeria.colas.tickets.dlq}",
            "${mensajeria.colas.documentos.dlq}"})
    public void auditar(Message mensaje, Channel canal) throws IOException {
        var props = mensaje.getMessageProperties();
        List<Map<String, ?>> xDeath = props.getXDeathHeader();
        Map<String, ?> ultima = xDeath == null || xDeath.isEmpty() ? Map.of() : xDeath.get(0);
        log.error("[DLQ] cola={} origen={} motivo={} veces={} cuerpo={}",
                props.getConsumerQueue(), ultima.get("queue"), ultima.get("reason"), ultima.get("count"),
                new String(mensaje.getBody(), StandardCharsets.UTF_8));
        canal.basicAck(props.getDeliveryTag(), false);
    }
}
