package com.DSY1107.cloudnative;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class CloudnativeApplicationTests {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void contextLoads() {
    }

    @Test
    void testActuatorHealth() throws Exception {
        mockMvc.perform(get("/actuator/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"));
    }

    @Test
    void testPublicoDatos() throws Exception {
        mockMvc.perform(get("/publico/datos"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sistema").value("Pedidos360"))
                .andExpect(jsonPath("$.autorizado").value(false));
    }

    @Test
    void testRutaProtegidaSinAutenticacionRetorna401() throws Exception {
        mockMvc.perform(get("/pedidos"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser(username = "cliente@pedidos360.com", roles = {"USER"})
    void testListarPedidosConAutenticacion() throws Exception {
        mockMvc.perform(get("/pedidos"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray());
    }

    @Test
    @WithMockUser(username = "admin@pedidos360.com", roles = {"ADMIN"})
    void testCrudCompletoPedidos() throws Exception {
        // 1. Crear pedido (POST /pedidos) -> 201 Created
        String nuevoPedidoJson = """
                {
                    "clienteEmail": "empresa@pedidos360.com",
                    "descripcion": "Cluster Kubernetes 3 Nodos",
                    "monto": 2500000.0,
                    "estado": "PENDIENTE"
                }
                """;

        String respuestaPost = mockMvc.perform(post("/pedidos")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(nuevoPedidoJson))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").exists())
                .andExpect(jsonPath("$.clienteEmail").value("empresa@pedidos360.com"))
                .andExpect(jsonPath("$.monto").value(2500000.0))
                .andExpect(jsonPath("$.estado").value("PENDIENTE"))
                .andReturn().getResponse().getContentAsString();

        // Extraer id creado (primer digito de id o consultar por ID)
        mockMvc.perform(get("/pedidos/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(1));

        // 2. Actualizar pedido (PUT /pedidos/1) -> 200 OK
        String actualizacionJson = """
                {
                    "clienteEmail": "empresa@pedidos360.com",
                    "descripcion": "Cluster Kubernetes 3 Nodos - Aprobado",
                    "monto": 2600000.0,
                    "estado": "EN_PROCESO"
                }
                """;

        mockMvc.perform(put("/pedidos/1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(actualizacionJson))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.descripcion").value("Cluster Kubernetes 3 Nodos - Aprobado"))
                .andExpect(jsonPath("$.estado").value("EN_PROCESO"));

        // 3. Eliminar pedido (DELETE /pedidos/1) -> 204 No Content
        mockMvc.perform(delete("/pedidos/1"))
                .andExpect(status().isNoContent());

        // 4. Verificar eliminación -> 404 Not Found
        mockMvc.perform(get("/pedidos/1"))
                .andExpect(status().isNotFound());
    }

    @Test
    @WithMockUser(username = "auditor@pedidos360.com", roles = {"USER"})
    void testDatosProtegidosConAutenticacion() throws Exception {
        mockMvc.perform(get("/datos"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sistema").value("Pedidos360"))
                .andExpect(jsonPath("$.autorizado").value(true))
                .andExpect(jsonPath("$.indicadores.uf").exists());
    }
}
