package com.DSY1107.streaming.model;

/** Alerta de salida del pipeline (topic pedidos-alertas). */
public class AlertaPedido {

	private String cliente;
	private double monto;
	private String motivo;
	private String severidad;

	public AlertaPedido() {
	}

	public AlertaPedido(String cliente, double monto, String motivo, String severidad) {
		this.cliente = cliente;
		this.monto = monto;
		this.motivo = motivo;
		this.severidad = severidad;
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

	public String getMotivo() {
		return motivo;
	}

	public void setMotivo(String motivo) {
		this.motivo = motivo;
	}

	public String getSeveridad() {
		return severidad;
	}

	public void setSeveridad(String severidad) {
		this.severidad = severidad;
	}
}
