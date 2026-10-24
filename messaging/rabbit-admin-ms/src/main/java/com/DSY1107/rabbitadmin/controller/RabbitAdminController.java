package com.DSY1107.rabbitadmin.controller;

import com.DSY1107.rabbitadmin.dto.Alerta;
import com.DSY1107.rabbitadmin.dto.BindingRequest;
import com.DSY1107.rabbitadmin.dto.ColaInfo;
import com.DSY1107.rabbitadmin.dto.CrearColaRequest;
import com.DSY1107.rabbitadmin.dto.CrearExchangeRequest;
import com.DSY1107.rabbitadmin.dto.Nombres;
import com.DSY1107.rabbitadmin.service.MonitoreoColasService;
import com.DSY1107.rabbitadmin.service.RabbitAdminService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Pattern;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * API REST de administracion de RabbitMQ.
 *
 * <pre>
 * POST   /api/rabbitmq/queues                  crea una cola (quorum por defecto)
 * GET    /api/rabbitmq/queues/{nombre}         mensajes y consumidores
 * POST   /api/rabbitmq/queues/{nombre}/purge   vacia la cola
 * DELETE /api/rabbitmq/queues/{nombre}         elimina (ifUnused, ifEmpty opcionales)
 * POST   /api/rabbitmq/exchanges               crea exchange DIRECT | TOPIC | FANOUT | HEADERS
 * DELETE /api/rabbitmq/exchanges/{nombre}      elimina el exchange
 * POST   /api/rabbitmq/bindings                une cola y exchange
 * DELETE /api/rabbitmq/bindings                elimina la union (mismo cuerpo que POST)
 * GET    /api/rabbitmq/alertas                 ultimas alertas del monitoreo
 * </pre>
 */
@RestController
@RequestMapping("/api/rabbitmq")
public class RabbitAdminController {

    private final RabbitAdminService service;
    private final MonitoreoColasService monitoreo;

    public RabbitAdminController(RabbitAdminService service, MonitoreoColasService monitoreo) {
        this.service = service;
        this.monitoreo = monitoreo;
    }

    @PostMapping("/queues")
    public ResponseEntity<ColaInfo> crearCola(@Valid @RequestBody CrearColaRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.crearCola(req));
    }

    @GetMapping("/queues/{nombre}")
    public ColaInfo infoCola(@PathVariable @Pattern(regexp = Nombres.PATRON, message = Nombres.MENSAJE) String nombre) {
        return service.infoCola(nombre);
    }

    @PostMapping("/queues/{nombre}/purge")
    public Map<String, Object> purgarCola(@PathVariable @Pattern(regexp = Nombres.PATRON, message = Nombres.MENSAJE) String nombre) {
        return Map.of("cola", nombre, "purgados", service.purgarCola(nombre));
    }

    @DeleteMapping("/queues/{nombre}")
    public ResponseEntity<Void> eliminarCola(
            @PathVariable @Pattern(regexp = Nombres.PATRON, message = Nombres.MENSAJE) String nombre,
            @RequestParam(defaultValue = "false") boolean ifUnused,
            @RequestParam(defaultValue = "false") boolean ifEmpty) {
        service.eliminarCola(nombre, ifUnused, ifEmpty);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/exchanges")
    public ResponseEntity<CrearExchangeRequest> crearExchange(@Valid @RequestBody CrearExchangeRequest req) {
        service.crearExchange(req);
        return ResponseEntity.status(HttpStatus.CREATED).body(req);
    }

    @DeleteMapping("/exchanges/{nombre}")
    public ResponseEntity<Void> eliminarExchange(@PathVariable @Pattern(regexp = Nombres.PATRON, message = Nombres.MENSAJE) String nombre) {
        service.eliminarExchange(nombre);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/bindings")
    public ResponseEntity<BindingRequest> crearBinding(@Valid @RequestBody BindingRequest req) {
        service.crearBinding(req);
        return ResponseEntity.status(HttpStatus.CREATED).body(req);
    }

    @DeleteMapping("/bindings")
    public ResponseEntity<Void> eliminarBinding(@Valid @RequestBody BindingRequest req) {
        service.eliminarBinding(req);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/alertas")
    public List<Alerta> alertas() {
        return monitoreo.ultimasAlertas();
    }
}
