package com.DSY1107.mensajeria.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Nombres de exchanges, colas, routing keys y politicas, leidos de application.yml (prefijo "mensajeria").
 */
@ConfigurationProperties(prefix = "mensajeria")
public record MensajeriaProperties(Exchanges exchanges, Colas colas, Politicas politicas) {

    public record Exchanges(String eventos, String eventosRoutingKey, String documentos, String dlx) {
    }

    public record Colas(Cola notificaciones, Cola tickets, Cola documentos) {
    }

    public record Cola(String nombre, String routingKey, String dlq, String dlqRoutingKey) {
    }

    public record Politicas(int ttlMs, int maxLength, int maxReintentos, int deliveryLimit, int dlqTtlMs) {
    }
}
