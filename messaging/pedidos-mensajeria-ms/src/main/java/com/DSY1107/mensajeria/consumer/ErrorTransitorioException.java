package com.DSY1107.mensajeria.consumer;

/** Error recuperable (servicio externo caido, timeout): el mensaje se reintenta. */
public class ErrorTransitorioException extends RuntimeException {

    public ErrorTransitorioException(String mensaje) {
        super(mensaje);
    }
}
