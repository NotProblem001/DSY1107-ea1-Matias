package com.DSY1107.cloudnative;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
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
	void testPublicoInfo() throws Exception {
		mockMvc.perform(get("/publico/info"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.sistema").value("Gestion de Solicitudes de Vacaciones"))
				.andExpect(jsonPath("$.estado").value("OPERATIVO"));
	}

	@Test
	void testListarSolicitudes() throws Exception {
		mockMvc.perform(get("/solicitudes"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$").isArray());
	}

	@Test
	void testCrearYAprobarSolicitud() throws Exception {
		String nuevaJson = """
				{
					"solicitanteEmail": "test.empleado@duocuc.cl",
					"fechaInicio": "2026-03-01",
					"fechaFin": "2026-03-10",
					"dias": 10,
					"motivo": "Descanso programado"
				}
				""";

		mockMvc.perform(post("/solicitudes")
						.contentType(MediaType.APPLICATION_JSON)
						.content(nuevaJson))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.id").exists())
				.andExpect(jsonPath("$.estado").value("PENDIENTE"))
				.andExpect(jsonPath("$.solicitanteEmail").value("test.empleado@duocuc.cl"));

		// Probar aprobacion
		String revisionJson = """
				{
					"comentario": "Aprobado por el jefe directo",
					"aprobadorEmail": "aprobador@duocuc.cl"
				}
				""";

		mockMvc.perform(post("/solicitudes/1/aprobar")
						.contentType(MediaType.APPLICATION_JSON)
						.content(revisionJson))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.id").value(1))
				.andExpect(jsonPath("$.estado").value("APROBADA"))
				.andExpect(jsonPath("$.comentarioRevision").value("Aprobado por el jefe directo"));
	}
}
