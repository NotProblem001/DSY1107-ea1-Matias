package com.DSY1107.rabbitadmin.dto;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;

/**
 * @param quorum         true (por defecto): replicada en el cluster
 * @param deliveryLimit  solo colas quorum: entregas antes de dead-letter
 */
public record CrearColaRequest(
        @NotBlank @Pattern(regexp = Nombres.PATRON, message = Nombres.MENSAJE) String nombre,
        Boolean quorum,
        @Positive Integer ttlMs,
        @Positive Integer maxLength,
        @Pattern(regexp = Nombres.PATRON, message = Nombres.MENSAJE) String deadLetterExchange,
        @Pattern(regexp = "^[A-Za-z0-9._*#-]{1,255}$", message = "routing key invalida") String deadLetterRoutingKey,
        @Positive @Max(1000) Integer deliveryLimit) {

    public boolean esQuorum() {
        return quorum == null || quorum;
    }

    @AssertTrue(message = "deliveryLimit solo aplica a colas quorum")
    public boolean isDeliveryLimitCoherente() {
        return deliveryLimit == null || esQuorum();
    }

    @AssertTrue(message = "deadLetterRoutingKey requiere deadLetterExchange")
    public boolean isDeadLetterCoherente() {
        return deadLetterRoutingKey == null || deadLetterExchange != null;
    }
}
