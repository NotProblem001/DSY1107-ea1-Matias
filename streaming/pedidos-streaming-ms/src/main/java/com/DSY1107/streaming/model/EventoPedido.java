package com.DSY1107.streaming.model;

/** Evento de entrada del pipeline (topic pedidos-eventos). canal = "web" | "app" | "sucursal". */
public class EventoPedido {

	private String cliente;
	private double monto;
	private String canal;
	private Long timestamp;

	public EventoPedido() {
	}

	public EventoPedido(String cliente, double monto, String canal, Long timestamp) {
		this.cliente = cliente;
		this.monto = monto;
		this.canal = canal;
		this.timestamp = timestamp;
	}

	public String getCliente() {
		return cliente;
	}

	public void setCliente(String cliente) {
		this.cliente = cliente;
	}

	public double getMonto() {
		return monto;
	}

	public void setMonto(double monto) {
		this.monto = monto;
	}

	public String getCanal() {
		return canal;
	}

	public void setCanal(String canal) {
		this.canal = canal;
	}

	public Long getTimestamp() {
		return timestamp;
	}

	public void setTimestamp(Long timestamp) {
		this.timestamp = timestamp;
	}
}
