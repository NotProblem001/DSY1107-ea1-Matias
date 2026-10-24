package com.DSY1107.rabbitadmin.dto;

/** Regla comun de nombres: sin vacios, sin espacios y sin el prefijo reservado "amq.". */
public final class Nombres {

    public static final String PATRON = "^(?!amq\\.)[A-Za-z0-9._-]{1,200}$";
    public static final String MENSAJE = "solo letras, numeros, '.', '_' o '-' (1-200), sin prefijo reservado 'amq.'";

    private Nombres() {
    }
}
