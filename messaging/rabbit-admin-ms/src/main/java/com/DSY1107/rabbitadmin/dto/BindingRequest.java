package com.DSY1107.rabbitadmin.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.Map;

/**
 * @param routingKey  vacia para fanout/headers
 * @param argumentos  para exchanges headers, p. ej. {"x-match":"all","region":"rm"}
 */
public record BindingRequest(
        @NotBlank @Pattern(regexp = Nombres.PATRON, message = Nombres.MENSAJE) String cola,
        @NotBlank @Pattern(regexp = Nombres.PATRON, message = Nombres.MENSAJE) String exchange,
        @Pattern(regexp = "^[A-Za-z0-9._*#-]{0,255}$", message = "routing key invalida") String routingKey,
        @Size(max = 20) Map<String, String> argumentos) {
}
