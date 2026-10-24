package com.DSY1107.mensajeria.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.boot.autoconfigure.amqp.RabbitTemplateCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Serializacion JSON y callbacks de confirmacion del productor.
 */
@Configuration
public class RabbitMessagingConfig {

    private static final Logger log = LoggerFactory.getLogger(RabbitMessagingConfig.class);

    /**
     * JSON solo en el productor. Los listeners reciben el Message crudo y ConfirmacionManual lo parsea:
     * asi un __TypeId__ desconocido (p. ej. publicado por el backend) no rompe la conversion antes del ACK manual.
     */
    @Bean
    public RabbitTemplateCustomizer confirmacionesProductor(ObjectMapper objectMapper) {
        return template -> {
            template.setMessageConverter(new Jackson2JsonMessageConverter(objectMapper));
            template.setConfirmCallback((correlation, ack, causa) -> {
                String id = correlation != null ? correlation.getId() : "?";
                if (ack) {
                    log.info("[PRODUCTOR] Broker confirmo el mensaje {}", id);
                } else {
                    log.error("[PRODUCTOR] Broker rechazo el mensaje {}: {}", id, causa);
                }
            });
            template.setReturnsCallback(r -> log.error("[PRODUCTOR] Mensaje sin cola destino: exchange={} routingKey={} motivo={}",
                    r.getExchange(), r.getRoutingKey(), r.getReplyText()));
        };
    }
}
