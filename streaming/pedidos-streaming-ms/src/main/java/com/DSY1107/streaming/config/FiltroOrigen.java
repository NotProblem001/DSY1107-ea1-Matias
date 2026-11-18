package com.DSY1107.streaming.config;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * En AWS el puerto queda abierto a internet para que API Gateway llegue a la EC2; este filtro exige el header
 * secreto que solo agrega API Gateway (tras validar el JWT), asi una llamada directa a la IP no se salta Cognito.
 * Sin ORIGEN_SECRETO (local) no filtra nada.
 */
@Component
public class FiltroOrigen extends OncePerRequestFilter {

	static final String HEADER = "x-origen-secreto";

	private final byte[] secreto;

	public FiltroOrigen(@Value("${ORIGEN_SECRETO:}") String secreto) {
		this.secreto = secreto.getBytes(StandardCharsets.UTF_8);
	}

	@Override
	protected boolean shouldNotFilter(HttpServletRequest request) {
		return secreto.length == 0 || request.getRequestURI().startsWith("/actuator/health");
	}

	@Override
	protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
			throws ServletException, IOException {
		String recibido = request.getHeader(HEADER);
		if (recibido == null || !MessageDigest.isEqual(secreto, recibido.getBytes(StandardCharsets.UTF_8))) {
			response.sendError(HttpServletResponse.SC_FORBIDDEN, "Acceso solo via API Gateway");
			return;
		}
		chain.doFilter(request, response);
	}
}
