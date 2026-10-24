package com.DSY1107.mensajeria.consumer;

import com.DSY1107.mensajeria.config.MensajeriaProperties;
import com.DSY1107.mensajeria.model.PedidoEvento;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.rabbitmq.client.Channel;
import jakarta.validation.Validator;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.core.MessageBuilder;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.util.function.Consumer;

/**
 * Politica de confirmacion comun a todos los consumidores (acknowledge-mode: manual).
 *
 * <ul>
 *   <li>Exito -> basicAck.</li>
 *   <li>{@link ErrorTransitorioException} (recuperable) con reintentos disponibles -> se republica una copia al
 *       final de la misma cola con x-reintentos + 1 y se hace basicAck del original.
 *       (RabbitMQ 4 no incrementa x-delivery-count en basicNack con requeue, por eso el contador es propio.)</li>
 *   <li>Error transitorio con reintentos agotados -> basicNack(requeue=false): la cola lo manda al DLX.</li>
 *   <li>JSON invalido, evento que no cumple validacion, {@link ErrorPermanenteException} o error inesperado
 *       -> basicReject(requeue=false): va directo a la DLQ, reintentar no lo arreglaria.</li>
 * </ul>
 */
@Component
public class ConfirmacionManual {

    static final String HEADER_REINTENTOS = "x-reintentos";

    private static final Logger log = LoggerFactory.getLogger(ConfirmacionManual.class);

    private final ObjectMapper mapper;
    private final Validator validator;
    private final RabbitTemplate rabbitTemplate;
    private final int maxReintentos;

    public ConfirmacionManual(ObjectMapper mapper, Validator validator, RabbitTemplate rabbitTemplate,
                              MensajeriaProperties props) {
        this.mapper = mapper;
        this.validator = validator;
        this.rabbitTemplate = rabbitTemplate;
        this.maxReintentos = props.politicas().maxReintentos();
    }

    public void procesar(Message mensaje, Channel canal, String consumidor, Consumer<PedidoEvento> logica) throws IOException {
        var props = mensaje.getMessageProperties();
        long tag = props.getDeliveryTag();
        try {
            PedidoEvento evento = mapper.readValue(mensaje.getBody(), PedidoEvento.class);
            var violaciones = validator.validate(evento);
            if (!violaciones.isEmpty()) {
                var v = violaciones.iterator().next();
                throw new ErrorPermanenteException("Evento invalido: " + v.getPropertyPath() + " " + v.getMessage());
            }
            logica.accept(evento);
            canal.basicAck(tag, false);
            log.info("[{}] ACK pedido={}", consumidor, evento.pedidoId());
        } catch (ErrorTransitorioException e) {
            int reintentos = reintentos(mensaje);
            if (reintentos < maxReintentos) {
                Message copia = MessageBuilder.fromMessage(mensaje).setHeader(HEADER_REINTENTOS, reintentos + 1).build();
                rabbitTemplate.send("", props.getConsumerQueue(), copia);
                canal.basicAck(tag, false);
                log.warn("[{}] Reintento {}/{} programado: {}", consumidor, reintentos + 1, maxReintentos, e.getMessage());
            } else {
                canal.basicNack(tag, false, false);
                log.error("[{}] NACK -> DLQ tras {} reintentos: {}", consumidor, reintentos, e.getMessage());
            }
        } catch (Exception e) {
            canal.basicReject(tag, false);
            log.error("[{}] REJECT -> DLQ: {}", consumidor, e.getMessage());
        }
    }

    private static int reintentos(Message mensaje) {
        Object valor = mensaje.getMessageProperties().getHeader(HEADER_REINTENTOS);
        return valor instanceof Number n ? n.intValue() : 0;
    }
}
