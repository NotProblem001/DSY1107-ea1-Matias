package com.DSY1107.streaming.controller;

import java.util.List;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.DSY1107.streaming.consumer.RegistroStreaming;
import com.DSY1107.streaming.model.EventoPedido;

@RestController
@RequestMapping("/api/pipeline")
public class PipelineSimuladorController {

	private final KafkaTemplate<String, EventoPedido> kafkaTemplate;
	private final String topicEntrada;
	private final RegistroStreaming registro;

	public PipelineSimuladorController(@Qualifier("eventoKafkaTemplate") KafkaTemplate<String, EventoPedido> kafkaTemplate,
			@Value("${pedidos.pipeline.topic-entrada}") String topicEntrada, RegistroStreaming registro) {
		this.kafkaTemplate = kafkaTemplate;
		this.topicEntrada = topicEntrada;
		this.registro = registro;
	}

	/** Ultimas alertas leidas de pedidos-alertas (mas nueva primero). */
	@GetMapping("/alertas")
	public List<RegistroStreaming.AlertaRecibida> alertas() {
		return registro.alertas();
	}

	@PostMapping("/evento")
	public ResponseEntity<String> evento(@RequestBody EventoPedido evento) {
		if (evento.getTimestamp() == null) {
			evento.setTimestamp(System.currentTimeMillis());
		}
		kafkaTemplate.send(topicEntrada, evento.getCliente(), evento);
		return ResponseEntity.accepted().body("Evento enviado a " + topicEntrada + ": cliente=" + evento.getCliente()
				+ " monto=" + evento.getMonto() + " canal=" + evento.getCanal());
	}

	/** 3 casos de evidencia: NORMAL (pasa sin alerta), SOSPECHOSO (genera alerta), IGNORADO (bajo el minimo). */
	@PostMapping("/demo")
	public ResponseEntity<String> demo() {
		long ahora = System.currentTimeMillis();
		kafkaTemplate.send(topicEntrada, "cliente-normal", new EventoPedido("cliente-normal", 50000, "web", ahora));
		kafkaTemplate.send(topicEntrada, "cliente-sospechoso", new EventoPedido("cliente-sospechoso", 2000000, "app", ahora));
		kafkaTemplate.send(topicEntrada, "cliente-ignorado", new EventoPedido("cliente-ignorado", 500, "sucursal", ahora));
		return ResponseEntity.accepted().body("Demo pipeline enviada: NORMAL 50000 (web), SOSPECHOSO 2000000 (app), IGNORADO 500 (sucursal).");
	}
}
