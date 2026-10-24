package com.DSY1107.rabbitadmin.controller;

import com.DSY1107.rabbitadmin.dto.ColaInfo;
import com.DSY1107.rabbitadmin.exception.RecursoNoEncontradoException;
import com.DSY1107.rabbitadmin.service.MonitoreoColasService;
import com.DSY1107.rabbitadmin.service.RabbitAdminService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.doThrow;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(RabbitAdminController.class)
class RabbitAdminControllerTest {

    @Autowired
    MockMvc mvc;

    @MockBean
    RabbitAdminService service;

    @MockBean
    MonitoreoColasService monitoreo;

    private org.springframework.test.web.servlet.ResultActions postJson(String url, String json) throws Exception {
        return mvc.perform(post(url).contentType(MediaType.APPLICATION_JSON).content(json));
    }

    @Test
    void creaColaValida() throws Exception {
        when(service.crearCola(any())).thenReturn(new ColaInfo("demo.queue", 0, 0));
        postJson("/api/rabbitmq/queues", "{\"nombre\":\"demo.queue\",\"ttlMs\":1000}")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.nombre").value("demo.queue"));
    }

    @Test
    void rechazaNombreVacio() throws Exception {
        postJson("/api/rabbitmq/queues", "{\"nombre\":\"\"}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detalles.nombre").exists());
        verify(service, never()).crearCola(any());
    }

    @Test
    void rechazaPrefijoReservadoYTtlNegativo() throws Exception {
        postJson("/api/rabbitmq/queues", "{\"nombre\":\"amq.hack\",\"ttlMs\":-5}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detalles.nombre").exists())
                .andExpect(jsonPath("$.detalles.ttlMs").exists());
    }

    @Test
    void rechazaDeliveryLimitEnColaClasica() throws Exception {
        postJson("/api/rabbitmq/queues", "{\"nombre\":\"c1\",\"quorum\":false,\"deliveryLimit\":3}")
                .andExpect(status().isBadRequest());
    }

    @Test
    void rechazaTipoDeExchangeDesconocido() throws Exception {
        postJson("/api/rabbitmq/exchanges", "{\"nombre\":\"ex1\",\"tipo\":\"RANDOM\"}")
                .andExpect(status().isBadRequest());
    }

    @Test
    void eliminarColaInexistenteDa404() throws Exception {
        doThrow(new RecursoNoEncontradoException("La cola 'x' no existe")).when(service).eliminarCola("x", false, false);
        mvc.perform(delete("/api/rabbitmq/queues/x")).andExpect(status().isNotFound());
    }

    @Test
    void rechazaNombreInvalidoEnRuta() throws Exception {
        mvc.perform(delete("/api/rabbitmq/queues/amq.default")).andExpect(status().isBadRequest());
    }
}
