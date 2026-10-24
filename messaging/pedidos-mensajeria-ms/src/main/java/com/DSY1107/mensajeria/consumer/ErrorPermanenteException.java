package com.DSY1107.mensajeria.consumer;

/** Error no recuperable (datos invalidos, regla de negocio violada): el mensaje va directo a la DLQ. */
public class ErrorPermanenteException extends RuntimeException {

    public ErrorPermanenteException(String mensaje) {
        super(mensaje);
    }
}
