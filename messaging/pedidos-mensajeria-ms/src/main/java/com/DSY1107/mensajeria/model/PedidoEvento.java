package com.DSY1107.mensajeria.model;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

/**
 * Evento de dominio de un pedido (mismo vocabulario que la entidad Pedido del backend EA1).
 *
 * @param simularFallo solo para demostracion: fuerza un error transitorio o permanente en los consumidores.
 */
public record PedidoEvento(
        @NotNull @Positive Long pedidoId,
        @NotBlank @Email String clienteEmail,
        @NotBlank @Size(max = 255) String descripcion,
        @NotNull @PositiveOrZero Double monto,
        @NotNull TipoEvento tipo,
        SimulacionFallo simularFallo) {

    public enum TipoEvento { CREADO, ACTUALIZADO, CANCELADO }

    public enum SimulacionFallo { NINGUNO, TRANSITORIO, PERMANENTE }
}
