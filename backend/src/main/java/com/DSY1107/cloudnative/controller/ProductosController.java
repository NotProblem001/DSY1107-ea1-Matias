package com.DSY1107.cloudnative.controller;

import com.DSY1107.cloudnative.model.Producto;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

@RestController
@RequestMapping("/productos")
public class ProductosController {

    private final ConcurrentHashMap<Long, Producto> inventario = new ConcurrentHashMap<>();
    private final AtomicLong contadorId = new AtomicLong(1);

    public ProductosController() {
        // Datos iniciales de prueba
        guardarProducto(new Producto(contadorId.getAndIncrement(), "Notebook Dell XPS 15", 1499990.0, "Computación"));
        guardarProducto(new Producto(contadorId.getAndIncrement(), "Monitor LG UltraWide 34\"", 429990.0, "Pantallas"));
        guardarProducto(new Producto(contadorId.getAndIncrement(), "Teclado Mecánico RGB", 79990.0, "Periféricos"));
        guardarProducto(new Producto(contadorId.getAndIncrement(), "Mouse Ergonómico MX Master 3S", 89990.0, "Periféricos"));
    }

    private void guardarProducto(Producto p) {
        inventario.put(p.getId(), p);
    }

    @GetMapping
    public ResponseEntity<List<Producto>> listar() {
        return ResponseEntity.ok(new ArrayList<>(inventario.values()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<Producto> obtenerPorId(@PathVariable Long id) {
        Producto p = inventario.get(id);
        if (p == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(p);
    }

    @PostMapping
    public ResponseEntity<Producto> crear(@RequestBody Producto nuevo) {
        long id = contadorId.getAndIncrement();
        nuevo.setId(id);
        inventario.put(id, nuevo);
        return ResponseEntity.status(HttpStatus.CREATED).body(nuevo);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Producto> actualizar(@PathVariable Long id, @RequestBody Producto datos) {
        if (!inventario.containsKey(id)) {
            return ResponseEntity.notFound().build();
        }
        datos.setId(id);
        inventario.put(id, datos);
        return ResponseEntity.ok(datos);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> eliminar(@PathVariable Long id) {
        if (!inventario.containsKey(id)) {
            return ResponseEntity.notFound().build();
        }
        inventario.remove(id);
        return ResponseEntity.noContent().build();
    }
}
