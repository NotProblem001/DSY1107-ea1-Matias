package com.DSY1107.cloudnative.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

@RestController
public class DatosController {

    @GetMapping("/datos")
    public ResponseEntity<Map<String, Object>> obtenerDatosProtegidos() {
        Map<String, Object> data = new HashMap<>();
        data.put("timestamp", LocalDateTime.now().toString());
        data.put("mensaje", "Datos económicos y de indicadores del sistema");
        data.put("estado", "OK");
        data.put("autorizado", true);
        data.put("indicadores", Map.of(
            "uf", 37842.15,
            "dolar", 945.30,
            "euro", 1024.50,
            "utm", 66362.00
        ));
        return ResponseEntity.ok(data);
    }

    @GetMapping("/publico/datos")
    public ResponseEntity<Map<String, Object>> obtenerDatosPublicos() {
        Map<String, Object> data = new HashMap<>();
        data.put("timestamp", LocalDateTime.now().toString());
        data.put("mensaje", "Ruta pública de demostración y contraste (sin autenticación)");
        data.put("estado", "OK");
        data.put("autorizado", false);
        return ResponseEntity.ok(data);
    }
}
