package com.DSY1107.streaming.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.DSY1107.streaming.producer.PedidoKafkaProducer;

@RestController
@RequestMapping("/api/streaming")
public class PedidoStreamingController {

	private final PedidoKafkaProducer producer;

	public PedidoStreamingController(PedidoKafkaProducer producer) {
		this.producer = producer;
	}

	@PostMapping("/sin-key")
	public ResponseEntity<String> sinKey(@RequestParam String mensaje) {
		producer.enviarSinKey(mensaje);
		return ResponseEntity.accepted().body("Mensaje enviado sin key: " + mensaje);
	}

	@PostMapping("/con-key")
	public ResponseEntity<String> conKey(@RequestParam String key, @RequestParam String mensaje) {
		producer.enviarConKey(key, mensaje);
		return ResponseEntity.accepted().body("Mensaje enviado con key=" + key + ": " + mensaje);
	}

	/** Lote de evidencia: 4 sin key (reparto entre particiones) y 5 con keys repetidas (misma particion por key). */
	@PostMapping("/demo")
	public ResponseEntity<String> demo() {
		for (int i = 1; i <= 4; i++) {
			producer.enviarSinKey("pedido-sin-key-" + i);
		}
		String[] keys = {"cliente-A", "cliente-B", "cliente-A", "cliente-C", "cliente-B"};
		for (int i = 0; i < keys.length; i++) {
			producer.enviarConKey(keys[i], "pedido-" + keys[i] + "-" + (i + 1));
		}
		return ResponseEntity.accepted().body("Demo enviada: 4 mensajes sin key y 5 con key (cliente-A, cliente-B, cliente-C). Revisa el log del consumidor.");
	}
}
