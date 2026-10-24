package com.DSY1107.rabbitadmin.exception;

import org.springframework.amqp.AmqpConnectException;
import org.springframework.amqp.AmqpException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.HandlerMethodValidationException;

import java.util.LinkedHashMap;
import java.util.Map;

/** Traduce errores a respuestas claras: 400 validacion, 404, 409 rechazo del broker, 503 sin broker. */
@RestControllerAdvice
public class ApiExceptionHandler {

    public record ErrorRespuesta(int status, String error, Map<String, String> detalles) {
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<ErrorRespuesta> cuerpoInvalido(MethodArgumentNotValidException ex) {
        Map<String, String> detalles = new LinkedHashMap<>();
        ex.getBindingResult().getAllErrors().forEach(e -> detalles.putIfAbsent(
                e instanceof FieldError f ? f.getField() : e.getObjectName(), String.valueOf(e.getDefaultMessage())));
        return responder(HttpStatus.BAD_REQUEST, "Parametros invalidos", detalles);
    }

    @ExceptionHandler(HandlerMethodValidationException.class)
    ResponseEntity<ErrorRespuesta> parametroInvalido(HandlerMethodValidationException ex) {
        Map<String, String> detalles = new LinkedHashMap<>();
        ex.getAllValidationResults().forEach(r -> r.getResolvableErrors().forEach(e -> detalles.putIfAbsent(
                String.valueOf(r.getMethodParameter().getParameterName()), String.valueOf(e.getDefaultMessage()))));
        return responder(HttpStatus.BAD_REQUEST, "Parametros invalidos", detalles);
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    ResponseEntity<ErrorRespuesta> jsonInvalido(HttpMessageNotReadableException ex) {
        return responder(HttpStatus.BAD_REQUEST, "Cuerpo JSON invalido o tipo desconocido", Map.of());
    }

    @ExceptionHandler(RecursoNoEncontradoException.class)
    ResponseEntity<ErrorRespuesta> noEncontrado(RecursoNoEncontradoException ex) {
        return responder(HttpStatus.NOT_FOUND, ex.getMessage(), Map.of());
    }

    @ExceptionHandler(RecursoDuplicadoException.class)
    ResponseEntity<ErrorRespuesta> duplicado(RecursoDuplicadoException ex) {
        return responder(HttpStatus.CONFLICT, ex.getMessage(), Map.of());
    }

    @ExceptionHandler(AmqpConnectException.class)
    ResponseEntity<ErrorRespuesta> sinBroker(AmqpConnectException ex) {
        return responder(HttpStatus.SERVICE_UNAVAILABLE, "Ningun nodo RabbitMQ responde", Map.of());
    }

    /** RabbitMQ respondio pero rechazo la operacion (p. ej. PRECONDITION_FAILED). */
    @ExceptionHandler(AmqpException.class)
    ResponseEntity<ErrorRespuesta> rechazada(AmqpException ex) {
        Throwable causa = org.springframework.core.NestedExceptionUtils.getMostSpecificCause(ex);
        return responder(HttpStatus.CONFLICT, "RabbitMQ rechazo la operacion",
                Map.of("causa", String.valueOf(causa.getMessage())));
    }

    private ResponseEntity<ErrorRespuesta> responder(HttpStatus status, String error, Map<String, String> detalles) {
        return ResponseEntity.status(status).body(new ErrorRespuesta(status.value(), error, detalles));
    }
}
