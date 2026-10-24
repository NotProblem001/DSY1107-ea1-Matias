package com.DSY1107.rabbitadmin.dto;

import java.time.Instant;

public record Alerta(String cola, Nivel nivel, String mensaje, Instant detectada) {

    public enum Nivel { WARN, CRITICAL }
}
