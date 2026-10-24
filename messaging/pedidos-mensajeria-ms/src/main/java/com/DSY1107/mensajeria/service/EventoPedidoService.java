package com.DSY1107.mensajeria.service;

import com.DSY1107.mensajeria.model.PedidoEvento;
import com.DSY1107.mensajeria.model.PedidoEvento.TipoEvento;
import com.DSY1107.mensajeria.producer.PedidoEventPublisher;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

/**
 * Regla de negocio: todo evento se notifica; un pedido CREADO ademas pide su factura.
 */
@Service
public class EventoPedidoService {

    private final PedidoEventPublisher publisher;

    public EventoPedidoService(PedidoEventPublisher publisher) {
        this.publisher = publisher;
    }

    /** @return routing keys usadas, para informar al cliente. */
    public List<String> registrar(PedidoEvento evento) {
        List<String> rutas = new ArrayList<>();
        rutas.add(publisher.publicarEvento(evento));
        if (evento.tipo() == TipoEvento.CREADO) {
            rutas.add(publisher.solicitarDocumento(evento));
        }
        return rutas;
    }
}
