package com.DSY1107.cloudnative.controller;

import com.DSY1107.cloudnative.model.Pedido;
import com.DSY1107.cloudnative.repository.PedidoRepository;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/pedidos")
public class PedidosController {

    private final PedidoRepository pedidoRepository;

    public PedidosController(PedidoRepository pedidoRepository) {
        this.pedidoRepository = pedidoRepository;
        // Precarga inicial si la base de datos está vacía
        if (this.pedidoRepository.count() == 0) {
            this.pedidoRepository.save(new Pedido(null, "cliente@pedidos360.com", "Servidor Dell PowerEdge R750", 3599990.0, "COMPLETADO", LocalDateTime.now().minusDays(3)));
            this.pedidoRepository.save(new Pedido(null, "cliente@pedidos360.com", "Switch Cisco Catalyst 9200", 1250000.0, "EN_PROCESO", LocalDateTime.now().minusDays(1)));
            this.pedidoRepository.save(new Pedido(null, "admin@pedidos360.com", "Licencias Red Hat Enterprise Linux", 850000.0, "PENDIENTE", LocalDateTime.now()));
        }
    }

    @GetMapping
    public ResponseEntity<List<Pedido>> listar() {
        return ResponseEntity.ok(pedidoRepository.findAll());
    }

    @GetMapping("/{id}")
    public ResponseEntity<Pedido> obtenerPorId(@PathVariable Long id) {
        return pedidoRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<Pedido> crear(@RequestBody Pedido nuevoPedido) {
        if (nuevoPedido.getFechaCreacion() == null) {
            nuevoPedido.setFechaCreacion(LocalDateTime.now());
        }
        if (nuevoPedido.getEstado() == null || nuevoPedido.getEstado().isBlank()) {
            nuevoPedido.setEstado("PENDIENTE");
        }
        Pedido guardado = pedidoRepository.save(nuevoPedido);
        return ResponseEntity.status(HttpStatus.CREATED).body(guardado);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Pedido> actualizar(@PathVariable Long id, @RequestBody Pedido datosActualizados) {
        Optional<Pedido> pedidoOpt = pedidoRepository.findById(id);
        if (pedidoOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        Pedido pedidoExistente = pedidoOpt.get();
        if (datosActualizados.getClienteEmail() != null) {
            pedidoExistente.setClienteEmail(datosActualizados.getClienteEmail());
        }
        if (datosActualizados.getDescripcion() != null) {
            pedidoExistente.setDescripcion(datosActualizados.getDescripcion());
        }
        if (datosActualizados.getMonto() != null) {
            pedidoExistente.setMonto(datosActualizados.getMonto());
        }
        if (datosActualizados.getEstado() != null) {
            pedidoExistente.setEstado(datosActualizados.getEstado());
        }

        Pedido actualizado = pedidoRepository.save(pedidoExistente);
        return ResponseEntity.ok(actualizado);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> eliminar(@PathVariable Long id) {
        if (!pedidoRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        pedidoRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }
}
