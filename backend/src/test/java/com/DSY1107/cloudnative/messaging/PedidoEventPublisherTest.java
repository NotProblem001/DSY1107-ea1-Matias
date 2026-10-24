package com.DSY1107.cloudnative.messaging;

import com.DSY1107.cloudnative.messaging.PedidoEventPublisher.PedidoEvento;
import com.DSY1107.cloudnative.messaging.PedidoEventPublisher.TipoEvento;
import com.DSY1107.cloudnative.model.Pedido;
import org.junit.jupiter.api.Test;
import org.springframework.amqp.AmqpConnectException;
import org.springframework.amqp.rabbit.core.RabbitTemplate;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

class PedidoEventPublisherTest {

    private final RabbitTemplate template = mock(RabbitTemplate.class);
    private final PedidoEventPublisher publisher = new PedidoEventPublisher(template,
            "pedidos.eventos", "pedido.%s", "pedidos.documentos", "documento.factura");
    private final Pedido pedido = new Pedido(7L, "c@pedidos360.com", "Switch", 100.0, "PENDIENTE", null);

    @Test
    void creadoPublicaEventoYSolicitaFactura() {
        publisher.publicar(pedido, TipoEvento.CREADO);
        var esperado = new PedidoEvento(7L, "c@pedidos360.com", "Switch", 100.0, TipoEvento.CREADO);
        verify(template).convertAndSend("pedidos.eventos", "pedido.creado", (Object) esperado);
        verify(template).convertAndSend("pedidos.documentos", "documento.factura", (Object) esperado);
    }

    @Test
    void actualizadoNoPideFactura() {
        publisher.publicar(pedido, TipoEvento.ACTUALIZADO);
        verify(template).convertAndSend(eq("pedidos.eventos"), eq("pedido.actualizado"), any(Object.class));
        verify(template, never()).convertAndSend(eq("pedidos.documentos"), anyString(), any(Object.class));
    }

    @Test
    void brokerCaidoNoPropagaLaExcepcion() {
        doThrow(new AmqpConnectException(new RuntimeException("sin broker")))
                .when(template).convertAndSend(anyString(), anyString(), any(Object.class));
        publisher.publicar(pedido, TipoEvento.CREADO); // no lanza
    }
}
