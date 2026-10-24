package com.DSY1107.mensajeria.consumer;

import com.DSY1107.mensajeria.config.MensajeriaProperties;
import com.DSY1107.mensajeria.config.MensajeriaProperties.Politicas;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.rabbitmq.client.Channel;
import jakarta.validation.Validation;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.core.MessageProperties;
import org.springframework.amqp.rabbit.core.RabbitTemplate;

import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

class ConfirmacionManualTest {

    private static final String VALIDO = """
            {"pedidoId":1,"clienteEmail":"cliente@pedidos360.com","descripcion":"Switch","monto":1000,"tipo":"CREADO","simularFallo":"%s"}""";

    private final RabbitTemplate template = mock(RabbitTemplate.class);
    private final ConfirmacionManual confirmacion = new ConfirmacionManual(new ObjectMapper(),
            Validation.buildDefaultValidatorFactory().getValidator(), template,
            new MensajeriaProperties(null, null, new Politicas(1000, 10, 3, 5, 1000)));
    private final Channel canal = mock(Channel.class);

    private void procesar(String json, Integer reintentos) throws Exception {
        var props = new MessageProperties();
        props.setDeliveryTag(7L);
        props.setConsumerQueue("q");
        if (reintentos != null) {
            props.setHeader(ConfirmacionManual.HEADER_REINTENTOS, reintentos);
        }
        confirmacion.procesar(new Message(json.getBytes(StandardCharsets.UTF_8), props), canal, "TEST",
                evento -> FallosSimulados.aplicar(evento, "TEST"));
    }

    @Test
    void exitoHaceAck() throws Exception {
        procesar(VALIDO.formatted("NINGUNO"), null);
        verify(canal).basicAck(7L, false);
        verify(canal, never()).basicReject(anyLong(), anyBoolean());
    }

    @Test
    void errorTransitorioRepublicaConContadorYConfirma() throws Exception {
        procesar(VALIDO.formatted("TRANSITORIO"), 1);
        var captor = ArgumentCaptor.forClass(Message.class);
        verify(template).send(org.mockito.ArgumentMatchers.eq(""), org.mockito.ArgumentMatchers.eq("q"), captor.capture());
        assertEquals(2, (Integer) captor.getValue().getMessageProperties().getHeader(ConfirmacionManual.HEADER_REINTENTOS));
        verify(canal).basicAck(7L, false);
    }

    @Test
    void errorTransitorioAgotadoHaceNackSinRequeue() throws Exception {
        procesar(VALIDO.formatted("TRANSITORIO"), 3);
        verify(canal).basicNack(7L, false, false);
        verify(template, never()).send(anyString(), anyString(), any(Message.class));
    }

    @Test
    void errorPermanenteRechazaSinRequeue() throws Exception {
        procesar(VALIDO.formatted("PERMANENTE"), null);
        verify(canal).basicReject(7L, false);
    }

    @Test
    void jsonInvalidoVaALaDlq() throws Exception {
        procesar("no-es-json", null);
        verify(canal).basicReject(7L, false);
    }

    @Test
    void eventoQueNoCumpleValidacionVaALaDlq() throws Exception {
        procesar("{\"pedidoId\":1,\"clienteEmail\":\"no-es-correo\",\"descripcion\":\"x\",\"monto\":1,\"tipo\":\"CREADO\"}", null);
        verify(canal).basicReject(7L, false);
    }
}
