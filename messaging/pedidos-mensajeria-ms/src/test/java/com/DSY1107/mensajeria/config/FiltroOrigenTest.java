package com.DSY1107.mensajeria.config;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

class FiltroOrigenTest {

	private int status(String secreto, String uri, String header) throws Exception {
		MockHttpServletRequest req = new MockHttpServletRequest("GET", uri);
		if (header != null) {
			req.addHeader(FiltroOrigen.HEADER, header);
		}
		MockHttpServletResponse res = new MockHttpServletResponse();
		new FiltroOrigen(secreto).doFilter(req, res, new MockFilterChain());
		return res.getStatus();
	}

	@Test
	void sinSecretoConfiguradoNoFiltra() throws Exception {
		assertEquals(200, status("", "/api/x", null));
	}

	@Test
	void conSecretoExigeHeaderCorrecto() throws Exception {
		assertEquals(403, status("s3cr3t", "/api/x", null));
		assertEquals(403, status("s3cr3t", "/api/x", "otro"));
		assertEquals(200, status("s3cr3t", "/api/x", "s3cr3t"));
	}

	@Test
	void healthQuedaLibre() throws Exception {
		assertEquals(200, status("s3cr3t", "/actuator/health", null));
	}
}
