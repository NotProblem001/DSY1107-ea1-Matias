package com.DSY1107.streaming.controller;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.DSY1107.streaming.consumer.RegistroStreaming;
import com.DSY1107.streaming.producer.PedidoKafkaProducer;

@RestController
@RequestMapping("/api/streaming")
public class PedidoStreamingController {

	private final PedidoKafkaProducer producer;
	private final RegistroStreaming registro;

	public PedidoStreamingController(PedidoKafkaProducer producer, RegistroStreaming registro) {
		this.producer = producer;
		this.registro = registro;
	}

	/** Ultimos mensajes consumidos (mas nuevo primero), con particion y offset, para el frontend. */
	@GetMapping("/recibidos")
	public List<RegistroStreaming.Recibido> recibidos() {
		return registro.recibidos();
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
		// keys elegidas porque murmur2 % 3 las deja en particiones distintas (A->0, E->1, F->2)
		String[] keys = {"cliente-A", "cliente-E", "cliente-A", "cliente-F", "cliente-E"};
		for (int i = 0; i < keys.length; i++) {
			producer.enviarConKey(keys[i], "pedido-" + keys[i] + "-" + (i + 1));
		}
		return ResponseEntity.accepted().body("Demo enviada: 4 mensajes sin key y 5 con key (cliente-A, cliente-E, cliente-F). Revisa el log del consumidor.");
	}
}
