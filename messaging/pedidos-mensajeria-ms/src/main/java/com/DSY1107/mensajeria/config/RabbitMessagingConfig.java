package com.DSY1107.mensajeria.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.amqp.support.converter.MessageConverter;
import org.springframework.boot.autoconfigure.amqp.RabbitTemplateCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Serializacion JSON y callbacks de confirmacion del productor.
 */
@Configuration
public class RabbitMessagingConfig {

    private static final Logger log = LoggerFactory.getLogger(RabbitMessagingConfig.class);

    @Bean
    public MessageConverter jsonMessageConverter(ObjectMapper objectMapper) {
        return new Jackson2JsonMessageConverter(objectMapper);
    }

    @Bean
    public RabbitTemplateCustomizer confirmacionesProductor() {
        return template -> {
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
