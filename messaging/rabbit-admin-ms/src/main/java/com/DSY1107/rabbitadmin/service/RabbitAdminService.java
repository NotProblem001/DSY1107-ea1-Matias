package com.DSY1107.rabbitadmin.service;

import com.DSY1107.rabbitadmin.dto.BindingRequest;
import com.DSY1107.rabbitadmin.dto.ColaInfo;
import com.DSY1107.rabbitadmin.dto.CrearColaRequest;
import com.DSY1107.rabbitadmin.dto.CrearExchangeRequest;
import com.DSY1107.rabbitadmin.exception.RecursoDuplicadoException;
import com.DSY1107.rabbitadmin.exception.RecursoNoEncontradoException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.AmqpConnectException;
import org.springframework.amqp.AmqpException;
import org.springframework.core.NestedExceptionUtils;
import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.Exchange;
import org.springframework.amqp.core.ExchangeBuilder;
import org.springframework.amqp.core.QueueBuilder;
import org.springframework.amqp.rabbit.core.RabbitAdmin;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.Map;

/**
 * Unico punto que habla con RabbitAdmin. El controlador solo invoca operaciones de alto nivel.
 */
@Service
public class RabbitAdminService {

    private static final Logger log = LoggerFactory.getLogger(RabbitAdminService.class);

    private final RabbitAdmin rabbitAdmin;

    public RabbitAdminService(RabbitAdmin rabbitAdmin) {
        this.rabbitAdmin = rabbitAdmin;
    }

    // ---------- Colas ----------

    public ColaInfo crearCola(CrearColaRequest req) {
        if (rabbitAdmin.getQueueInfo(req.nombre()) != null) {
            throw new RecursoDuplicadoException("La cola '" + req.nombre() + "' ya existe");
        }
        if (req.deadLetterExchange() != null) {
            exigirExchange(req.deadLetterExchange());
        }
        QueueBuilder builder = QueueBuilder.durable(req.nombre());
        if (req.esQuorum()) {
            builder.quorum();
        }
        if (req.ttlMs() != null) builder.ttl(req.ttlMs());
        if (req.maxLength() != null) builder.maxLength(req.maxLength());
        if (req.deadLetterExchange() != null) builder.deadLetterExchange(req.deadLetterExchange());
        if (req.deadLetterRoutingKey() != null) builder.deadLetterRoutingKey(req.deadLetterRoutingKey());
        if (req.deliveryLimit() != null) builder.deliveryLimit(req.deliveryLimit());

        rabbitAdmin.declareQueue(builder.build());
        log.info("[ADMIN] Cola creada: {} (quorum={})", req.nombre(), req.esQuorum());
        return infoCola(req.nombre());
    }

    public ColaInfo infoCola(String nombre) {
        var info = rabbitAdmin.getQueueInfo(nombre);
        if (info == null) {
            throw new RecursoNoEncontradoException("La cola '" + nombre + "' no existe");
        }
        return new ColaInfo(info.getName(), info.getMessageCount(), info.getConsumerCount());
    }

    public int purgarCola(String nombre) {
        infoCola(nombre);
        int purgados = rabbitAdmin.purgeQueue(nombre);
        log.info("[ADMIN] Cola purgada: {} ({} mensajes)", nombre, purgados);
        return purgados;
    }

    /** ifUnused / ifEmpty: el broker rechaza (409) si la cola tiene consumidores o mensajes. */
    public void eliminarCola(String nombre, boolean soloSiSinUso, boolean soloSiVacia) {
        infoCola(nombre);
        rabbitAdmin.deleteQueue(nombre, soloSiSinUso, soloSiVacia);
        log.info("[ADMIN] Cola eliminada: {}", nombre);
    }

    // ---------- Exchanges ----------

    public void crearExchange(CrearExchangeRequest req) {
        if (existeExchange(req.nombre())) {
            throw new RecursoDuplicadoException("El exchange '" + req.nombre() + "' ya existe");
        }
        Exchange exchange = switch (req.tipo()) {
            case DIRECT -> ExchangeBuilder.directExchange(req.nombre()).durable(true).build();
            case TOPIC -> ExchangeBuilder.topicExchange(req.nombre()).durable(true).build();
            case FANOUT -> ExchangeBuilder.fanoutExchange(req.nombre()).durable(true).build();
            case HEADERS -> ExchangeBuilder.headersExchange(req.nombre()).durable(true).build();
        };
        rabbitAdmin.declareExchange(exchange);
        log.info("[ADMIN] Exchange creado: {} ({})", req.nombre(), req.tipo());
    }

    public void eliminarExchange(String nombre) {
        exigirExchange(nombre);
        rabbitAdmin.deleteExchange(nombre);
        log.info("[ADMIN] Exchange eliminado: {}", nombre);
    }

    // ---------- Bindings ----------

    public void crearBinding(BindingRequest req) {
        rabbitAdmin.declareBinding(binding(req));
        log.info("[ADMIN] Binding creado: {} -> {} [{}]", req.exchange(), req.cola(), req.routingKey());
    }

    public void eliminarBinding(BindingRequest req) {
        rabbitAdmin.removeBinding(binding(req));
        log.info("[ADMIN] Binding eliminado: {} -> {} [{}]", req.exchange(), req.cola(), req.routingKey());
    }

    private Binding binding(BindingRequest req) {
        infoCola(req.cola());
        exigirExchange(req.exchange());
        Map<String, Object> args = req.argumentos() == null ? Map.of() : new HashMap<>(req.argumentos());
        String rk = req.routingKey() == null ? "" : req.routingKey();
        return new Binding(req.cola(), Binding.DestinationType.QUEUE, req.exchange(), rk, args);
    }

    // ---------- Apoyo ----------

    private void exigirExchange(String nombre) {
        if (!existeExchange(nombre)) {
            throw new RecursoNoEncontradoException("El exchange '" + nombre + "' no existe");
        }
    }

    /** Declaracion pasiva: el broker responde 404 NOT_FOUND si no existe, sin crearlo. */
    private boolean existeExchange(String nombre) {
        try {
            rabbitAdmin.getRabbitTemplate().execute(canal -> canal.exchangeDeclarePassive(nombre));
            return true;
        } catch (AmqpConnectException e) {
            throw e;
        } catch (AmqpException e) {
            if (String.valueOf(NestedExceptionUtils.getMostSpecificCause(e).getMessage()).contains("NOT_FOUND")) {
                return false;
            }
            throw e;
        }
    }
}
