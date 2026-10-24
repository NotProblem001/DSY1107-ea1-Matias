package com.DSY1107.rabbitadmin.service;

import com.DSY1107.rabbitadmin.config.MonitoreoProperties;
import com.DSY1107.rabbitadmin.dto.Alerta;
import com.DSY1107.rabbitadmin.dto.Alerta.Nivel;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.AmqpException;
import org.springframework.amqp.rabbit.core.RabbitAdmin;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * Alertas basadas en metricas de las colas: acumulacion, colas sin consumidores y mensajes en DLQ.
 */
@Service
public class MonitoreoColasService {

    private static final Logger log = LoggerFactory.getLogger(MonitoreoColasService.class);

    private final RabbitAdmin rabbitAdmin;
    private final MonitoreoProperties props;
    private volatile List<Alerta> ultimas = List.of();

    public MonitoreoColasService(RabbitAdmin rabbitAdmin, MonitoreoProperties props) {
        this.rabbitAdmin = rabbitAdmin;
        this.props = props;
    }

    @Scheduled(fixedDelayString = "${monitoreo.intervalo-ms}", initialDelay = 10000)
    public void revisar() {
        List<Alerta> alertas = new ArrayList<>();
        Instant ahora = Instant.now();
        for (String cola : props.colas()) {
            try {
                var info = rabbitAdmin.getQueueInfo(cola);
                if (info == null) {
                    alertas.add(new Alerta(cola, Nivel.CRITICAL, "la cola no existe", ahora));
                } else if (cola.endsWith(".dlq")) {
                    if (info.getMessageCount() > 0) {
                        alertas.add(new Alerta(cola, Nivel.CRITICAL, info.getMessageCount() + " mensaje(s) muertos sin revisar", ahora));
                    }
                } else {
                    if (info.getMessageCount() >= props.umbralMensajes()) {
                        alertas.add(new Alerta(cola, Nivel.WARN, info.getMessageCount() + " mensajes acumulados (umbral "
                                + props.umbralMensajes() + ")", ahora));
                    }
                    if (info.getConsumerCount() == 0) {
                        alertas.add(new Alerta(cola, Nivel.WARN, "sin consumidores activos", ahora));
                    }
                }
            } catch (AmqpException e) {
                alertas.add(new Alerta(cola, Nivel.CRITICAL, "broker no disponible: " + e.getMessage(), ahora));
            }
        }
        alertas.forEach(a -> log.warn("[ALERTA {}] {}: {}", a.nivel(), a.cola(), a.mensaje()));
        ultimas = List.copyOf(alertas);
    }

    public List<Alerta> ultimasAlertas() {
        return ultimas;
    }
}
