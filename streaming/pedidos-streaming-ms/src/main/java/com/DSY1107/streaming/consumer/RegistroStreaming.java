package com.DSY1107.streaming.consumer;

import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.List;

import org.springframework.stereotype.Component;

import com.DSY1107.streaming.model.AlertaPedido;

/**
 * Memoria de lo ultimo consumido, para que el frontend pueda mostrarlo (un navegador no lee topics).
 * shortcut: en memoria y por instancia, se pierde al reiniciar; suficiente para una demo con una sola replica.
 */
@Component
public class RegistroStreaming {

	static final int MAXIMO = 50;

	public record Recibido(String topic, int particion, long offset, String key, String value, Instant hora) {
	}

	public record AlertaRecibida(AlertaPedido alerta, int particion, long offset, Instant hora) {
	}

	private final Deque<Recibido> recibidos = new ArrayDeque<>();
	private final Deque<AlertaRecibida> alertas = new ArrayDeque<>();

	public void agregarRecibido(Recibido r) {
		agregar(recibidos, r);
	}

	public void agregarAlerta(AlertaRecibida a) {
		agregar(alertas, a);
	}

	public List<Recibido> recibidos() {
		return copia(recibidos);
	}

	public List<AlertaRecibida> alertas() {
		return copia(alertas);
	}

	private static <T> void agregar(Deque<T> cola, T elemento) {
		synchronized (cola) {
			cola.addFirst(elemento);
			while (cola.size() > MAXIMO) {
				cola.removeLast();
			}
		}
	}

	private static <T> List<T> copia(Deque<T> cola) {
		synchronized (cola) {
			return List.copyOf(cola);
		}
	}
}
