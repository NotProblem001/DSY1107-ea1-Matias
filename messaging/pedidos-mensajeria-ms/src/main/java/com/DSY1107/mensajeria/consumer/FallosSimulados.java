package com.DSY1107.mensajeria.consumer;

import com.DSY1107.mensajeria.model.PedidoEvento;

/** Permite demostrar los caminos NACK/reintento y REJECT/DLQ con el campo simularFallo del evento. */
public final class FallosSimulados {

    private FallosSimulados() {
    }

    public static void aplicar(PedidoEvento evento, String consumidor) {
        if (evento.simularFallo() == null) {
            return;
        }
        switch (evento.simularFallo()) {
            case TRANSITORIO -> throw new ErrorTransitorioException(consumidor + ": servicio externo no responde");
            case PERMANENTE -> throw new ErrorPermanenteException(consumidor + ": datos del pedido no procesables");
            case NINGUNO -> { }
        }
    }
}
