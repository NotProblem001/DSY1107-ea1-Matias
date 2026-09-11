package com.DSY1107.cloudnative.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "pedidos")
public class Pedido {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String clienteEmail;

    @Column(nullable = false)
    private String descripcion;

    @Column(nullable = false)
    private Double monto;

    @Column(nullable = false)
    private String estado;

    @Column(nullable = false)
    private LocalDateTime fechaCreacion;

    public Pedido() {
    }

    public Pedido(Long id, String clienteEmail, String descripcion, Double monto, String estado, LocalDateTime fechaCreacion) {
        this.id = id;
        this.clienteEmail = clienteEmail;
        this.descripcion = descripcion;
        this.monto = monto;
        this.estado = estado;
        this.fechaCreacion = fechaCreacion;
    }

    public Pedido(String clienteEmail, String descripcion, Double monto) {
        this.clienteEmail = clienteEmail;
        this.descripcion = descripcion;
        this.monto = monto;
        this.estado = "PENDIENTE";
        this.fechaCreacion = LocalDateTime.now();
    }

    @PrePersist
    public void prePersist() {
        if (this.fechaCreacion == null) {
            this.fechaCreacion = LocalDateTime.now();
        }
        if (this.estado == null || this.estado.isBlank()) {
            this.estado = "PENDIENTE";
        }
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getClienteEmail() {
        return clienteEmail;
    }

    public void setClienteEmail(String clienteEmail) {
        this.clienteEmail = clienteEmail;
    }

    public String getDescripcion() {
        return descripcion;
    }

    public void setDescripcion(String descripcion) {
        this.descripcion = descripcion;
    }

    public Double getMonto() {
        return monto;
    }

    public void setMonto(Double monto) {
        this.monto = monto;
    }

    public String getEstado() {
        return estado;
    }

    public void setEstado(String estado) {
        this.estado = estado;
    }

    public LocalDateTime getFechaCreacion() {
        return fechaCreacion;
    }

    public void setFechaCreacion(LocalDateTime fechaCreacion) {
        this.fechaCreacion = fechaCreacion;
    }
}
