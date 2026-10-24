package com.DSY1107.mensajeria.controller;

import com.DSY1107.mensajeria.model.PedidoEvento;
import com.DSY1107.mensajeria.service.EventoPedidoService;
import jakarta.validation.Valid;
import org.springframework.amqp.AmqpException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/eventos")
public class EventoPedidoController {

    private final EventoPedidoService service;

    public EventoPedidoController(EventoPedidoService service) {
        this.service = service;
    }

    /** 202: el evento quedo en el broker; el procesamiento es asincrono. */
    @PostMapping("/pedidos")
    public ResponseEntity<Map<String, Object>> publicar(@Valid @RequestBody PedidoEvento evento) {
        var rutas = service.registrar(evento);
        return ResponseEntity.accepted().body(Map.of("pedidoId", evento.pedidoId(), "routingKeys", rutas));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> invalido(MethodArgumentNotValidException ex) {
        var errores = ex.getBindingResult().getFieldErrors().stream()
                .collect(Collectors.toMap(e -> e.getField(), e -> String.valueOf(e.getDefaultMessage()), (a, b) -> a));
        return ResponseEntity.badRequest().body(Map.of("error", "Evento invalido", "campos", errores));
    }

    @ExceptionHandler(AmqpException.class)
    public ResponseEntity<Map<String, Object>> sinBroker(AmqpException ex) {
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .body(Map.of("error", "RabbitMQ no disponible", "detalle", String.valueOf(ex.getMessage())));
    }
}
