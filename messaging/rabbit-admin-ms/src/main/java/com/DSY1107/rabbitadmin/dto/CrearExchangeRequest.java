package com.DSY1107.rabbitadmin.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

public record CrearExchangeRequest(
        @NotBlank @Pattern(regexp = Nombres.PATRON, message = Nombres.MENSAJE) String nombre,
        @NotNull(message = "tipo requerido: DIRECT, TOPIC, FANOUT o HEADERS") TipoExchange tipo) {

    public enum TipoExchange { DIRECT, TOPIC, FANOUT, HEADERS }
}
