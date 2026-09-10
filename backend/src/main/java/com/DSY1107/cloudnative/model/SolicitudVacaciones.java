package com.DSY1107.cloudnative.model;

public class SolicitudVacaciones {

    private Long id;
    private String solicitanteEmail;
    private String fechaInicio;
    private String fechaFin;
    private Integer dias;
    private String motivo;
    private String estado; // PENDIENTE, APROBADA, RECHAZADA
    private String comentarioRevision;
    private String aprobadorEmail;

    public SolicitudVacaciones() {
    }

    public SolicitudVacaciones(Long id, String solicitanteEmail, String fechaInicio, String fechaFin, Integer dias, String motivo, String estado) {
        this.id = id;
        this.solicitanteEmail = solicitanteEmail;
        this.fechaInicio = fechaInicio;
        this.fechaFin = fechaFin;
        this.dias = dias;
        this.motivo = motivo;
        this.estado = estado;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getSolicitanteEmail() {
        return solicitanteEmail;
    }

    public void setSolicitanteEmail(String solicitanteEmail) {
        this.solicitanteEmail = solicitanteEmail;
    }

    public String getFechaInicio() {
        return fechaInicio;
    }

    public void setFechaInicio(String fechaInicio) {
        this.fechaInicio = fechaInicio;
    }

    public String getFechaFin() {
        return fechaFin;
    }

    public void setFechaFin(String fechaFin) {
        this.fechaFin = fechaFin;
    }

    public Integer getDias() {
        return dias;
    }

    public void setDias(Integer dias) {
        this.dias = dias;
    }

    public String getMotivo() {
        return motivo;
    }

    public void setMotivo(String motivo) {
        this.motivo = motivo;
    }

    public String getEstado() {
        return estado;
    }

    public void setEstado(String estado) {
        this.estado = estado;
    }

    public String getComentarioRevision() {
        return comentarioRevision;
    }

    public void setComentarioRevision(String comentarioRevision) {
        this.comentarioRevision = comentarioRevision;
    }

    public String getAprobadorEmail() {
        return aprobadorEmail;
    }

    public void setAprobadorEmail(String aprobadorEmail) {
        this.aprobadorEmail = aprobadorEmail;
    }
}
