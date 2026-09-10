package com.DSY1107.cloudnative.model;

public class RevisionRequest {

    private String comentario;
    private String aprobadorEmail;

    public RevisionRequest() {
    }

    public RevisionRequest(String comentario, String aprobadorEmail) {
        this.comentario = comentario;
        this.aprobadorEmail = aprobadorEmail;
    }

    public String getComentario() {
        return comentario;
    }

    public void setComentario(String comentario) {
        this.comentario = comentario;
    }

    public String getAprobadorEmail() {
        return aprobadorEmail;
    }

    public void setAprobadorEmail(String aprobadorEmail) {
        this.aprobadorEmail = aprobadorEmail;
    }
}
