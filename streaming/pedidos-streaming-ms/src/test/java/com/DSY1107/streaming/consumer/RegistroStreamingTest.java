package com.DSY1107.streaming.consumer;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.time.Instant;

import org.junit.jupiter.api.Test;

class RegistroStreamingTest {

	@Test
	void guardaSoloLosUltimosYElMasNuevoPrimero() {
		RegistroStreaming registro = new RegistroStreaming();
		for (int i = 0; i < RegistroStreaming.MAXIMO + 10; i++) {
			registro.agregarRecibido(new RegistroStreaming.Recibido("t", 0, i, null, "v" + i, Instant.now()));
		}
		assertEquals(RegistroStreaming.MAXIMO, registro.recibidos().size());
		assertEquals(RegistroStreaming.MAXIMO + 9, registro.recibidos().get(0).offset());
		assertEquals(10, registro.recibidos().get(RegistroStreaming.MAXIMO - 1).offset());
	}
}
